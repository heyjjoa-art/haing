(function () {
  "use strict";

  var params = new URLSearchParams(window.location.search);
  var unitId = params.get("id");
  var unit = unitId ? JourneysStore.getUnit(unitId) : null;

  // 관리자 탭(?admin=1)에서 들어왔으면, 목록으로 돌아갈 때도 admin=1을 유지해서
  // 수정/삭제 버튼이 계속 보이게 한다.
  var isAdmin = params.get("admin") === "1";
  var backHref = "index.html" + (isAdmin ? "?admin=1" : "");

  var readerMain = document.querySelector(".reader-main");

  if (!unit) {
    readerMain.innerHTML =
      '<p class="empty-state">유닛을 찾을 수 없어요. <a href="' + backHref + '">목록으로 돌아가기</a></p>';
    return;
  }

  var childId = typeof ChildStore !== "undefined" ? ChildStore.getActive() : null;

  var backLinkEl = document.getElementById("backLink");
  if (backLinkEl) backLinkEl.href = backHref;

  var storyTitleEl = document.getElementById("storyTitleEl");
  var pagePhotoWrap = document.getElementById("pagePhotoWrap");
  var pagePhotoImg = document.getElementById("pagePhotoImg");
  var pagePhotoBadge = document.getElementById("pagePhotoBadge");
  var pageNav = document.getElementById("pageNav");
  var prevPageBtn = document.getElementById("prevPageBtn");
  var nextPageBtn = document.getElementById("nextPageBtn");
  var pageIndicatorEl = document.getElementById("pageIndicator");
  var storyTextArea = document.getElementById("storyTextArea");
  var listenBtn = document.getElementById("listenBtn");
  var followBtn = document.getElementById("followBtn");
  var aloneBtn = document.getElementById("aloneBtn");
  var modeProgressEl = document.getElementById("modeProgressEl");
  var recordingNoticeEl = document.getElementById("recordingNoticeEl");
  var myVoiceRowEl = document.getElementById("myVoiceRow");
  var myVoicePlayBtnEl = document.getElementById("myVoicePlayBtn");
  var speedControlEl = document.getElementById("speedControl");

  // 읽는 속도 버튼 - 예전엔 Journeys 메뉴 맨 위(목록 화면)에 있었는데, 실제로 속도를
  // 바꿔가며 쓰는 곳은 책을 펴서 읽는 이 화면이라 진행율 바 옆으로 옮겨왔다.
  var SPEED_KEY = "journeysReadSpeed";
  var SPEED_RATES = { slow: 0.5, normal: 1, fast: 1.5 };
  var speedButtons = speedControlEl ? Array.prototype.slice.call(speedControlEl.querySelectorAll(".speed-btn")) : [];

  function currentSpeedRate() {
    var speed = localStorage.getItem(SPEED_KEY);
    return SPEED_RATES[speed] || SPEED_RATES.normal;
  }

  function updateSpeedButtons() {
    var speed = localStorage.getItem(SPEED_KEY) in SPEED_RATES ? localStorage.getItem(SPEED_KEY) : "normal";
    speedButtons.forEach(function (btn) {
      btn.classList.toggle("active", btn.getAttribute("data-speed") === speed);
    });
  }

  speedButtons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      var speed = btn.getAttribute("data-speed");
      if (!SPEED_RATES[speed]) return;
      localStorage.setItem(SPEED_KEY, speed);
      updateSpeedButtons();
    });
  });
  updateSpeedButtons();

  var wordPopupEl = document.getElementById("wordPopup");
  var wordPopupWordEl = document.getElementById("wordPopupWord");
  var wordPopupMeaningEl = document.getElementById("wordPopupMeaning");
  var wordPopupEnEl = document.getElementById("wordPopupEn");
  var wordPopupCloseBtn = document.getElementById("wordPopupClose");
  var wordLookupToken = 0;
  var wordCloseTimer = null;
  var pendingResumeMode = null; // 단어를 누르기 전에 읽고 있던 모드
  var pendingResumeWordIndex = -1; // 그때 읽고 있던 단어의 wordSpans 인덱스

  // 재생 중에 버튼을 다시 눌러 직접 멈춘 경우(자동으로 다 끝난 게 아니라) 쓴다.
  // 모드별로 멈춘 지점을 기억해뒀다가, 같은 버튼을 또 누르면 처음부터가 아니라
  // 그 지점부터 이어서 읽는다. hasUnfinishedPlayback은 모드별로 "이 페이지를 끝까지
  // 재생해서 다 읽지는 않았다"는 표시로, updatePageNavDisabled()가 그 모드를 보는 동안
  // 페이지 이동을 계속 잠그는 데 쓴다 - 멈춤 버튼으로 잠금을 피해가지 못하게(다 듣기
  // 전엔 페이지 이동 금지). 모드별로 따로 관리해서, 한 모드를 멈춰놓은 채로 다른
  // 모드로 갈아타는 건 막지 않는다(그 모드는 자기 진도와 무관하니까).
  var pausedWordIndex = { listen: 0, follow: 0, alone: 0 };
  var hasUnfinishedPlayback = { listen: false, follow: false, alone: false };

  var rewardModalEl = document.getElementById("rewardModal");
  var rewardZodiacEl = document.getElementById("rewardZodiac");
  var rewardTextEl = document.getElementById("rewardText");
  var rewardLuckyColorEl = document.getElementById("rewardLuckyColor");
  var rewardLuckyNumberEl = document.getElementById("rewardLuckyNumber");
  var rewardCloseBtn = document.getElementById("rewardCloseBtn");

  var wordSpans = []; // { start, end, el }
  var joinedText = "";
  var currentReadingEl = null;
  var currentReadingEls = []; // 혼자읽기 문장 단위 하이라이트용 - 한 문장의 단어 span 여러 개를 한꺼번에 켜둔다
  var activeMode = null; // 'listen' | 'follow' | 'alone'
  var playToken = 0; // 모드를 바꿀 때마다 올려서, 이미 취소된 재생의 뒤늦은 콜백을 무시한다.
  var fallbackTimer = null;
  var fallbackIndex = 0;
  var currentChunkBoundaryFired = null; // 지금 재생 중인 청크의 boundary 도착 여부를 표시하는 콜백

  var pages = []; // { photo, pageNumber, paragraphs }
  // 음원듣기/따라읽기/혼자읽기는 각자 다른 속도로 책을 읽어나갈 수 있으므로(듣기는
  // 5페이지까지 들었는데 혼자읽기는 아직 1페이지일 수 있음), "어디까지 읽었는지"를
  // 모드별로 따로 기억한다. currentPageIndex는 지금 화면에 보이는 페이지 하나뿐이고,
  // viewedMode는 지금 화면이 "누구 기준"으로 보이고 있는지(어느 모드의 진도를 보고
  // 있는지)를 나타낸다 - 아무 모드도 안 눌렀으면 null(그냥 책 미리보기).
  var pageIndexByMode = { listen: 0, follow: 0, alone: 0 };
  var currentPageIndex = 0;
  var viewedMode = null;

  // 긴 책(사진 10장 이상 등)은 한 번에 끝까지 못 읽고 나갔다 다시 들어오는 일이
  // 흔해서, 모드별로 마지막으로 보던 페이지를 아이별로 기억해뒀다가 다음에 들어오면
  // 거기서부터 이어서 보여준다 - 매번 1페이지부터 다시 넘기지 않아도 되게.
  function pagePosKey(mode) {
    return "journeysPagePos_" + (childId || "guest") + "_" + unit.id + "_" + mode;
  }

  function savePagePos(mode) {
    localStorage.setItem(pagePosKey(mode), String(pageIndexByMode[mode]));
  }

  function loadPagePos(mode) {
    var raw = localStorage.getItem(pagePosKey(mode));
    var n = raw != null ? parseInt(raw, 10) : 0;
    return isNaN(n) ? 0 : n;
  }

  // 모드 구분이 생기기 전(이번 세션 초반)엔 페이지 위치를 유닛당 하나로만 저장했다.
  // 그 옛 값이 남아있으면, 아직 모드별 값이 하나도 없을 때 딱 한 번 세 모드 모두에
  // 그대로 복사해준다 - 이어읽던 자리를 1페이지로 되돌리지 않기 위해서다. 그 뒤로는
  // 모드별 값이 이미 있으니 이 함수는 계속 아무 일도 안 한다.
  function legacyPagePosKey() {
    return "journeysPagePos_" + (childId || "guest") + "_" + unit.id;
  }

  function migrateLegacyPagePosIfNeeded() {
    var legacyRaw = localStorage.getItem(legacyPagePosKey());
    if (legacyRaw == null) return;
    ["listen", "follow", "alone"].forEach(function (mode) {
      if (localStorage.getItem(pagePosKey(mode)) == null) {
        localStorage.setItem(pagePosKey(mode), legacyRaw);
      }
    });
  }

  // 마지막 페이지까지 다 읽고 끝냈을 때만 한 번 켜두는 1회성 표시. "중간까지
  // 읽다 나간 경우"(이어서 보던 자리를 그대로 기억)와는 분명히 구분해야 해서 -
  // 다 읽은 책을 다시 열면 복습하려는 거라 1페이지부터 다시 보여주고 싶지만,
  // 그 다음부터 페이지를 넘기다 중간에 나가면 그 자리는 평소처럼 그대로
  // 저장돼야 한다. 그래서 이 표시는 render()에서 딱 한 번만 "소비"되고 바로
  // 지워진다 - 그 이후엔 pageIndexByMode/pagePos가 평소처럼 이어서 저장을 맡는다.
  function bookDoneKey(mode) {
    return "journeysBookDone_" + (childId || "guest") + "_" + unit.id + "_" + mode;
  }

  // 이 모드의 "어디까지 읽었는지" 포인터를 옮긴다 - 페이지를 옮길 때마다 저장하고,
  // 새 페이지로 넘어간 거니 그 모드의 문장 중간 재개 지점(pausedWordIndex)도 리셋하고,
  // 상단 진행율 바도 다시 그린다.
  function setModePageIndex(mode, idx) {
    pageIndexByMode[mode] = Math.max(0, Math.min(idx, pages.length - 1));
    savePagePos(mode);
    pausedWordIndex[mode] = 0;
    updateProgressBars();
  }

  var PAGE_BREAK_MARKER = "====";

  // 실제 책처럼 사진 한 장 = 페이지 한 장으로 묶는다. 사진별 본문이 따로 저장돼 있지
  // 않아서(add.html은 문단만 빈 줄로 구분해 한 덩어리로 받는다), 두 단계로 나눈다:
  // 1) 문단 그룹 사이에 명시적으로 "====" 줄이 있고 그 개수가 사진 수와 정확히
  //    맞아떨어지면 그 경계를 그대로 믿는다 - 사진 촬영 순서와 실제 글 순서가 다르거나
  //    (예: 뒤 페이지 사진을 먼저 올린 경우), 페이지마다 문단 수가 들쭉날쭉해도 정확하다.
  // 2) 마커가 없거나 개수가 안 맞는(마커 없이 저장된 옛날 자료 포함) 경우엔, 문단 수를
  //    사진 수로 비례 배분하는 걸로 대신한다 - 사진 1장당 문단 2개로 딱 맞는 자료가
  //    많아서 대부분 맞지만, 완벽히 정확하다는 보장은 없는 임시방편이다.
  function buildPages(unit) {
    var photos = unit.photos || (unit.photoDataUrl ? [unit.photoDataUrl] : []);
    var rawParagraphs = unit.text
      .split(/\n\s*\n/)
      .map(function (p) {
        return p.trim();
      })
      .filter(Boolean);

    if (photos.length === 0) {
      return [{ photo: null, pageNumber: null, paragraphs: rawParagraphs }];
    }

    var markedGroups = [[]];
    rawParagraphs.forEach(function (p) {
      if (p === PAGE_BREAK_MARKER) {
        markedGroups.push([]);
      } else {
        markedGroups[markedGroups.length - 1].push(p);
      }
    });

    if (markedGroups.length === photos.length) {
      return markedGroups.map(function (group, i) {
        return { photo: photos[i], pageNumber: i + 1, paragraphs: group };
      });
    }

    var result = [];
    var m = rawParagraphs.length;
    var n = photos.length;
    for (var i = 0; i < n; i++) {
      var from = Math.floor((i * m) / n);
      var to = Math.floor(((i + 1) * m) / n);
      result.push({ photo: photos[i], pageNumber: i + 1, paragraphs: rawParagraphs.slice(from, to) });
    }
    return result;
  }

  function render() {
    storyTitleEl.textContent = unit.title;
    pages = buildPages(unit);
    migrateLegacyPagePosIfNeeded();
    ["listen", "follow", "alone"].forEach(function (mode) {
      if (localStorage.getItem(bookDoneKey(mode)) != null) {
        // 지난번에 이 모드로 끝까지 다 읽었던 책 - 복습하러 다시 들어온 거니
        // 1페이지부터 다시 보여준다. 표시는 여기서 바로 지워서 한 번만 적용되고,
        // 이제부터 페이지를 넘기면 평소처럼 그 자리가 새로 저장된다.
        localStorage.removeItem(bookDoneKey(mode));
        pageIndexByMode[mode] = 0;
        savePagePos(mode);
      } else {
        pageIndexByMode[mode] = Math.max(0, Math.min(loadPagePos(mode), pages.length - 1));
      }
    });
    // 세 모드 중 가장 뒤처진(아직 덜 읽은) 모드의 페이지를 먼저 보여준다 - 이어서
    // 할 일이 남은 곳을 열자마자 보여주려는 것.
    var initialIdx = Math.min(pageIndexByMode.listen, pageIndexByMode.follow, pageIndexByMode.alone);
    renderPage(initialIdx, null);
    renderStampButtons();
    checkAndAwardTrophies();
  }

  // 재생 중이던 소리/형광펜을 멈춘다. 지금 뭔가 재생 중이었다면(activeMode) 이건
  // "다 안 끝났는데 끊긴 것"이므로, 버튼으로 직접 멈춘 것과 똑같이 취급해서 그 모드의
  // 멈춘 지점을 기억해두고 페이지 잠금을 유지한다 - 다른 모드로 갈아타거나 페이지를
  // 넘기다가 재생이 끊겨도 그 모드의 진행 상황이 조용히 사라지지 않게 하려는 것.
  function interruptActiveModeIfPlaying() {
    if (activeMode) {
      var idx = currentReadingEl ? findWordIndexByEl(currentReadingEl) : -1;
      pausedWordIndex[activeMode] = idx > 0 ? idx : 0;
      hasUnfinishedPlayback[activeMode] = true;
      if ((activeMode === "follow" || activeMode === "alone") && typeof RecordingStore !== "undefined") {
        RecordingStore.cancelCapture(activeMode);
      }
    }
    stopAll();
  }

  // 페이지를 넘기면 재생 중이던 소리/형광펜은 멈춘다 - 이전 페이지 내용을 새 페이지로
  // 이어서 읽지는 않는다. mode를 주면 "이 모드 기준으로 보는 화면"이라는 뜻이고,
  // 이전/다음 페이지 버튼 자체가 그 모드가 재생 중(또는 못다 읽은 채 멈춘 상태)이면
  // updatePageNavDisabled()로 잠겨 있어서, 형광펜이 그 페이지를 끝까지 읽기 전에는
  // 아예 눌리지 않는다 - 다 듣기 전에 건너뛰어서 다음 페이지로 넘기지 못 하게 하려는 것.
  function renderPage(idx, mode) {
    interruptActiveModeIfPlaying();
    currentPageIndex = Math.max(0, Math.min(idx, pages.length - 1));
    viewedMode = mode || null;
    resetButtons(); // stopAll()은 이전 페이지 번호로 이미 그려버렸으니 새 페이지 번호로 다시 그린다
    clearRecordingNotice();
    var page = pages[currentPageIndex];

    if (page.photo) {
      pagePhotoImg.src = page.photo;
      pagePhotoImg.alt = "본문 사진 " + (page.pageNumber || currentPageIndex + 1) + "페이지";
      pagePhotoBadge.textContent = (page.pageNumber || currentPageIndex + 1) + "페이지";
      pagePhotoWrap.hidden = false;
    } else {
      pagePhotoWrap.hidden = true;
    }

    buildStoryText(page.paragraphs);

    pageNav.hidden = pages.length <= 1;
    pageIndicatorEl.textContent = (currentPageIndex + 1) + " / " + pages.length;
    updatePageNavDisabled();
    updateProgressBars();
    updateMyVoiceRow();

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // 이전 페이지는 그냥 다시 보기 용도라 그 모드의 진도(pageIndexByMode)를 뒤로
  // 되돌리지 않는다 - 예전 페이지를 잠깐 다시 봤다고 진행이 깎이면 안 되니까. 다음
  // 페이지는 지금 보고 있는 모드가 있고, 아직 그 모드가 가본 적 없는 페이지라면
  // 그 모드의 진도를 거기까지 넓혀준다(그래야 나중에 그 모드 버튼을 다시 누르면
  // 여기서부터 이어진다).
  prevPageBtn.addEventListener("click", function () {
    renderPage(currentPageIndex - 1, viewedMode);
  });
  nextPageBtn.addEventListener("click", function () {
    var mode = viewedMode;
    var targetIdx = currentPageIndex + 1;
    renderPage(targetIdx, mode);
    if (mode && targetIdx > pageIndexByMode[mode]) setModePageIndex(mode, targetIdx);
  });

  // 재생 중(activeMode)이거나, 단어 뜻 팝업 때문에 잠깐 멈춘 중(pendingResumeMode, 곧
  // 이어서 읽을 예정)이거나, 지금 보고 있는 모드가 이 페이지를 다 안 읽고 멈춘 상태면
  // (hasUnfinishedPlayback[viewedMode]) 형광펜이 이 페이지를 다 읽지 않은 것으로 보고
  // 이전/다음 페이지 버튼을 잠근다 - 멈춤 버튼을 눌러서 끝까지 안 듣고 페이지를
  // 넘겨버리는 것도 막는다. 다른 모드로 갈아타는 건 이 잠금과 무관하다(모드 버튼은
  // 여기서 안 건드림).
  function updatePageNavDisabled() {
    var lockedByViewedMode = !!viewedMode && !!hasUnfinishedPlayback[viewedMode];
    var stillReading = !!activeMode || !!pendingResumeMode || lockedByViewedMode;
    prevPageBtn.disabled = stillReading || currentPageIndex === 0;
    nextPageBtn.disabled = stillReading || currentPageIndex === pages.length - 1;
  }

  function buildStoryText(paragraphs) {
    storyTextArea.innerHTML = "";
    wordSpans = [];

    var offset = 0;
    paragraphs.forEach(function (paragraph, pIdx) {
      var p = document.createElement("p");
      var tokens = paragraph.split(/(\s+)/);

      tokens.forEach(function (token) {
        if (token === "") return;
        if (/^\s+$/.test(token)) {
          p.appendChild(document.createTextNode(token));
          offset += token.length;
          return;
        }
        var span = document.createElement("span");
        span.className = "story-word";
        span.textContent = token;
        span.addEventListener("click", function () {
          speakWord(token, paragraph);
        });
        p.appendChild(span);
        wordSpans.push({ start: offset, end: offset + token.length, el: span });
        offset += token.length;
      });

      storyTextArea.appendChild(p);
      if (pIdx < paragraphs.length - 1) {
        offset += 1; // paragraphs.join(" ")에서 문단 사이에 들어가는 공백 한 칸
      }
    });

    joinedText = paragraphs.join(" ");
  }

  function findWordIndexByEl(el) {
    for (var i = 0; i < wordSpans.length; i++) {
      if (wordSpans[i].el === el) return i;
    }
    return -1;
  }

  function findWordIndexAtChar(charIndex) {
    for (var i = 0; i < wordSpans.length; i++) {
      if (charIndex >= wordSpans[i].start && charIndex < wordSpans[i].end) return i;
    }
    return -1;
  }

  function clearWordCloseTimer() {
    if (wordCloseTimer) {
      clearTimeout(wordCloseTimer);
      wordCloseTimer = null;
    }
  }

  // 팝업을 닫고, 단어를 누르기 전에 읽고 있던 게 있으면 그 지점부터 이어서 읽는다.
  function closeWordPopupAndResume() {
    clearWordCloseTimer();
    wordPopupEl.classList.remove("open");
    var mode = pendingResumeMode;
    var wordIndex = pendingResumeWordIndex;
    pendingResumeMode = null;
    pendingResumeWordIndex = -1;
    if (mode && wordIndex !== -1) {
      resumeReading(mode, wordIndex);
    }
  }

  function resumeReading(mode, wordIndex) {
    if (mode === "alone") {
      startAloneMode(wordIndex);
    } else {
      playWithHighlight(mode, currentSpeedRate(), wordIndex);
    }
  }

  // 모르는 단어를 누르면 읽어주고, 한글 뜻과 영영 설명을 아래쪽 팝업에 보여준다. 읽던
  // 중이었다면 잠깐 멈췄다가, 팝업이 자동으로 닫히면서 그 지점부터 다시 이어서 읽어준다.
  // context(단어가 속한 문단)를 넘겨주면, 여러 뜻 중 본문에 나온 뜻에 가장 가까운
  // 영영 설명을 골라준다(Dictionary.lookup 참고).
  function speakWord(rawWord, context) {
    var clean = rawWord.replace(/[^a-zA-Z']/g, "");
    if (!clean) return;

    pendingResumeMode = activeMode;
    pendingResumeWordIndex = currentReadingEl ? findWordIndexByEl(currentReadingEl) : -1;

    stopAll();
    clearWordCloseTimer();

    wordPopupWordEl.textContent = clean;
    wordPopupMeaningEl.textContent = "뜻 찾는 중...";
    wordPopupEnEl.textContent = "";
    wordPopupEl.classList.add("open");

    if (Tts.isSupported()) {
      Tts.speak(clean, { rate: 0.75, pitch: 1.5 });
    }

    var myLookupToken = ++wordLookupToken;

    function scheduleAutoClose() {
      wordCloseTimer = setTimeout(function () {
        if (myLookupToken !== wordLookupToken) return;
        closeWordPopupAndResume();
      }, 3600);
    }

    if (typeof Dictionary !== "undefined") {
      Dictionary.lookup(clean, context).then(function (result) {
        if (myLookupToken !== wordLookupToken) return; // 그 사이 다른 단어를 눌렀으면 무시
        wordPopupMeaningEl.textContent = result && result.ko ? "뜻: " + result.ko : "뜻을 찾지 못했어요 😥";
        wordPopupEnEl.textContent = result && result.en ? result.en : "";
        scheduleAutoClose();
      });
    } else {
      wordPopupMeaningEl.textContent = "";
      scheduleAutoClose();
    }
  }

  wordPopupCloseBtn.addEventListener("click", closeWordPopupAndResume);

  function clearReadingHighlight() {
    if (currentReadingEl) {
      currentReadingEl.classList.remove("reading");
      currentReadingEl = null;
    }
    if (currentReadingEls.length) {
      currentReadingEls.forEach(function (el) {
        el.classList.remove("reading");
      });
      currentReadingEls = [];
    }
  }

  function highlightAt(charIndex) {
    clearReadingHighlight();
    var match = wordSpans.find(function (w) {
      return charIndex >= w.start && charIndex < w.end;
    });
    if (match) {
      match.el.classList.add("reading");
      currentReadingEl = match.el;
      match.el.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }

  function stopFallbackHighlighter() {
    if (fallbackTimer) {
      clearTimeout(fallbackTimer);
      fallbackTimer = null;
    }
  }

  // 실제 오디오 없이(1·2번은 TTS 이벤트가 안 올 때 대신, 3번은 처음부터) 단어 글자 수로
  // 읽는 시간을 어림잡아 순서대로 하이라이트를 넘긴다. startIndex를 주면 그 단어부터 이어서 시작한다.
  function startFallbackHighlighter(rate, onDone, startIndex) {
    var charsPerSecond = 13 * rate;
    fallbackIndex = startIndex || 0;

    function step() {
      if (fallbackIndex >= wordSpans.length) {
        if (onDone) onDone();
        return;
      }
      var w = wordSpans[fallbackIndex];
      clearReadingHighlight();
      w.el.classList.add("reading");
      currentReadingEl = w.el;
      w.el.scrollIntoView({ block: "center", behavior: "smooth" });

      var text = w.el.textContent;
      var durationMs = Math.max(150, (text.length / charsPerSecond) * 1000);
      fallbackIndex++;
      fallbackTimer = setTimeout(step, durationMs);
    }

    step();
  }

  var voiceGateTimer = null;
  var voiceGateIndex = 0;

  function stopVoiceGatedHighlighter() {
    if (voiceGateTimer) {
      clearTimeout(voiceGateTimer);
      voiceGateTimer = null;
    }
  }

  // 한 단어의 마지막 글자가 문장을 끝내는 문장부호(. ! ?)로 끝나면(뒤에 닫는 따옴표/
  // 괄호가 붙어도 됨) 그 단어를 문장의 끝으로 본다.
  var SENTENCE_END_RE = /[.!?]+["'’”)\]]*$/;

  function isSentenceEndWord(el) {
    return SENTENCE_END_RE.test(el.textContent);
  }

  // startIndex부터 훑어서 문장이 끝나는 단어의 인덱스를 찾는다. 문장부호 없이 페이지가
  // 끝나면(마지막 문장) 마지막 단어를 끝으로 본다.
  function sentenceEndIndexFrom(startIndex) {
    for (var i = startIndex; i < wordSpans.length; i++) {
      if (isSentenceEndWord(wordSpans[i].el)) return i;
    }
    return wordSpans.length - 1;
  }

  // 혼자읽기 전용: 정해진 속도로 그냥 넘기는 게 아니라, 실제로 소리 내어 읽는 낌새
  // (마이크 음량, RecordingStore.isVoiceActive)가 감지돼야 다음으로 넘어간다 - 읽는
  // 척만 하고 형광펜만 넘겨서 녹음 없이 페이지를 끝내버리는 걸 막으려는 것.
  // 단어 하나마다 끊어 읽어야 넘어가면 답답하므로, 문장 하나를 통째로 하이라이트해
  // 두고 그 문장을 다 읽었는지를 문장 단위로 확인한다: 목소리가 문장 길이에 비례한
  // MIN_SPEAK_MS_PER_WORD * 단어수 이상 잡히고, 그 뒤로 SILENCE_MS 이상 조용해지면
  // "그 문장을 다 읽었다"고 보고 다음 문장으로 넘어간다. 시간 제한으로 그냥 넘기는
  // 건 없다 - 실제로 그만큼 소리 내어 읽어야만 넘어간다.
  var VOICE_GATE_MIN_SPEAK_MS_PER_WORD = 150;
  var VOICE_GATE_SILENCE_MS = 500;
  var VOICE_GATE_POLL_MS = 90;

  function startVoiceGatedHighlighter(startIndex, onDone) {
    voiceGateIndex = startIndex || 0;

    function highlightSentence(fromIdx, toIdx) {
      clearReadingHighlight();
      var els = [];
      for (var i = fromIdx; i <= toIdx; i++) {
        wordSpans[i].el.classList.add("reading");
        els.push(wordSpans[i].el);
      }
      currentReadingEl = wordSpans[fromIdx].el;
      currentReadingEls = els;
      wordSpans[fromIdx].el.scrollIntoView({ block: "center", behavior: "smooth" });
    }

    function waitForSentence() {
      if (voiceGateIndex >= wordSpans.length) {
        if (onDone) onDone();
        return;
      }
      var sentenceEndIdx = sentenceEndIndexFrom(voiceGateIndex);
      var wordCount = sentenceEndIdx - voiceGateIndex + 1;
      highlightSentence(voiceGateIndex, sentenceEndIdx);

      var minSpeakMs = VOICE_GATE_MIN_SPEAK_MS_PER_WORD * wordCount;
      var lastCheck = Date.now();
      var activeMs = 0;
      var silentStreakMs = 0;

      function poll() {
        var now = Date.now();
        var dt = now - lastCheck;
        lastCheck = now;
        var active = typeof RecordingStore !== "undefined" && RecordingStore.isVoiceActive("alone");
        if (active) {
          activeMs += dt;
          silentStreakMs = 0;
        } else {
          silentStreakMs += dt;
        }
        var spokeEnough = activeMs >= minSpeakMs;
        var doneSpeaking = spokeEnough && silentStreakMs >= VOICE_GATE_SILENCE_MS;
        if (doneSpeaking) {
          voiceGateIndex = sentenceEndIdx + 1;
          voiceGateTimer = setTimeout(waitForSentence, 30);
          return;
        }
        voiceGateTimer = setTimeout(poll, VOICE_GATE_POLL_MS);
      }

      poll();
    }

    waitForSentence();
  }

  // 아이콘 줄 + 글자 줄로 나눠서 버튼을 좁은 칸에서도 안 넘치게 그린다. 페이지 진행률은
  // (버튼 안이 아니라) 상단 진행율 바 3개에 모드별로 따로 보여준다 - updateProgressBars() 참고.
  function buttonHtml(icon, label) {
    return (
      '<span class="listen-btn-icon">' + icon + "</span>" +
      '<span class="listen-btn-label">' + label + "</span>"
    );
  }

  var PROGRESS_FILL_EL = {
    listen: document.getElementById("progressFillListen"),
    follow: document.getElementById("progressFillFollow"),
    alone: document.getElementById("progressFillAlone")
  };
  var PROGRESS_COUNT_EL = {
    listen: document.getElementById("progressCountListen"),
    follow: document.getElementById("progressCountFollow"),
    alone: document.getElementById("progressCountAlone")
  };

  function updateProgressBars() {
    if (!modeProgressEl) return;
    modeProgressEl.hidden = pages.length <= 1;
    Object.keys(pageIndexByMode).forEach(function (mode) {
      var pct = pages.length > 1 ? Math.round(((pageIndexByMode[mode] + 1) / pages.length) * 100) : 100;
      PROGRESS_FILL_EL[mode].style.width = pct + "%";
      PROGRESS_COUNT_EL[mode].textContent = (pageIndexByMode[mode] + 1) + "/" + pages.length;
    });
  }

  var BUTTONS = {
    listen: { btn: listenBtn, icon: "🔊", label: "음원 듣기", playingLabel: "다시 누르면 멈춤" },
    follow: { btn: followBtn, icon: "✨", label: "따라 읽기", playingLabel: "다시 누르면 멈춤" },
    alone: { btn: aloneBtn, icon: "📖", label: "혼자 읽기", playingLabel: "다시 누르면 멈춤" }
  };

  function resetButtons() {
    Object.keys(BUTTONS).forEach(function (key) {
      var b = BUTTONS[key];
      b.btn.classList.remove("playing");
      b.btn.innerHTML = buttonHtml(b.icon, b.label);
    });
  }

  function stopAll() {
    playToken++;
    Tts.stop();
    stopFallbackHighlighter();
    stopVoiceGatedHighlighter();
    clearReadingHighlight();
    resetButtons();
    activeMode = null;
    currentChunkBoundaryFired = null;
    updatePageNavDisabled();
  }

  function setPlaying(mode) {
    resetButtons();
    var b = BUTTONS[mode];
    b.btn.classList.add("playing");
    b.btn.innerHTML = buttonHtml("⏸", b.playingLabel);
    activeMode = mode;
    updatePageNavDisabled();
  }

  // 재생 중에 버튼을 다시 눌러 직접 멈췄을 때 호출 - interruptActiveModeIfPlaying()가
  // 멈춘 지점 기억/페이지 잠금/녹음 취소를 다 처리해준다.
  function pauseCurrentReading(mode) {
    interruptActiveModeIfPlaying();
  }

  // 이 페이지를 (멈추지 않고) 끝까지 다 읽었을 때 호출. 듣기는 녹음이 필요 없으니
  // 바로 완료 처리하고, 따라읽기/혼자읽기는 실제로 목소리가 녹음됐는지 먼저 확인한
  // 뒤에만 완료 처리한다(녹음이 없으면 완료가 아니다 - 처음부터 다시 읽게 한다).
  function onReadingFinished(mode) {
    var myToken = playToken;
    if (mode === "follow" || mode === "alone") {
      finalizeRecordingForMode(mode).then(function (ok) {
        if (playToken !== myToken) return;
        if (ok) completeModeReadThrough(mode);
        else rejectModeReadThrough(mode);
      });
    } else {
      completeModeReadThrough(mode);
    }
  }

  function finalizeRecordingForMode(mode) {
    if (typeof RecordingStore === "undefined") return Promise.resolve(false);
    return RecordingStore.stopCapture(mode, currentPageIndex).then(
      function (result) {
        // blob이 있어도(마이크가 켜져 있었다는 뜻) hadVoiceActivity가 false면 그냥
        // 조용히 마이크만 켜놓은 것 - 실제로 소리 낸 게 한 번도 없으면 완료로 안 친다.
        if (!result || !result.blob || result.blob.size === 0 || !result.hadVoiceActivity) return false;
        return RecordingStore.saveTake(childId, unit.id, mode, currentPageIndex, result.blob, result.blob.type).then(
          function () {
            return true;
          },
          function () {
            return false;
          }
        );
      },
      function () {
        return false;
      }
    );
  }

  // 끝까지 다 읽었을 때(듣기는 항상, 따라읽기/혼자읽기는 녹음까지 확인된 경우) 호출 -
  // 마지막 페이지면 오늘의 단계를 완료 처리하고, 다음에 같은 버튼을 눌렀을 때 다시
  // 처음부터 읽도록 멈춘 지점 기록을 지운 뒤, 페이지 이동 잠금도 풀어준다.
  function completeModeReadThrough(mode) {
    if (currentPageIndex === pages.length - 1) {
      onStageCompleted(mode);
      // 다음에 이 모드로 다시 들어오면 1페이지부터 복습할 수 있게 표시해둔다
      // (render()에서 한 번만 소비됨 - bookDoneKey 주석 참고).
      localStorage.setItem(bookDoneKey(mode), "1");
    }
    pausedWordIndex[mode] = 0;
    hasUnfinishedPlayback[mode] = false;
    stopAll();
    updateMyVoiceRow();
  }

  // 끝까지 읽긴 읽었지만(따라읽기/혼자읽기) 녹음이 안 남았을 때 호출 - 완료로 치지
  // 않는다. 부분 재개가 아니라 처음부터 다시 읽어야 새 녹음이 온전히 남으므로 멈춘
  // 지점도 0으로 되돌리고, 페이지 잠금은 그대로 유지한 채 이유를 배너로 알려준다.
  function rejectModeReadThrough(mode) {
    pausedWordIndex[mode] = 0;
    hasUnfinishedPlayback[mode] = true;
    stopAll();
    showRecordingNotice(mode, "recording-missing");
  }

  var RECORDING_NOTICE_MESSAGES = {
    unsupported: "이 기기/브라우저는 목소리 녹음을 지원하지 않아요.\n읽는 연습은 할 수 있지만 도장은 찍히지 않아요.",
    denied: "마이크 사용이 허용되지 않아 목소리를 녹음하지 못했어요. 설정에서 마이크 권한을 허용해주세요.\n녹음 없이는 도장이 찍히지 않아요.",
    "recording-missing": "이번엔 목소리가 녹음되지 않았어요. 다시 한 번 읽어볼까요?\n녹음이 돼야 도장이 찍혀요."
  };

  function showRecordingNotice(mode, reasonCode) {
    if (!recordingNoticeEl) return;
    recordingNoticeEl.textContent = RECORDING_NOTICE_MESSAGES[reasonCode] || RECORDING_NOTICE_MESSAGES["recording-missing"];
    recordingNoticeEl.hidden = false;
  }

  function clearRecordingNotice() {
    if (recordingNoticeEl) recordingNoticeEl.hidden = true;
  }

  // 지금 보고 있는 페이지에 그 모드(따라읽기/혼자읽기)의 저장된 녹음이 있으면 "내
  // 목소리 듣기" 버튼을 보여준다. 듣기 모드는 애초에 녹음이 없으니 항상 숨긴다.
  var myVoiceObjectUrl = null;

  function revokeMyVoiceUrl() {
    if (myVoiceObjectUrl) {
      URL.revokeObjectURL(myVoiceObjectUrl);
      myVoiceObjectUrl = null;
    }
  }

  function updateMyVoiceRow() {
    if (!myVoiceRowEl) return;
    revokeMyVoiceUrl();
    myVoiceRowEl.hidden = true;
    if (typeof RecordingStore === "undefined") return;
    if (viewedMode !== "follow" && viewedMode !== "alone") return;
    var mode = viewedMode;
    var pageIdx = currentPageIndex;
    RecordingStore.getTake(childId, unit.id, mode, pageIdx).then(function (take) {
      if (viewedMode !== mode || currentPageIndex !== pageIdx || !take) return; // 그 사이 페이지/모드가 바뀌었으면 무시
      myVoiceRowEl.hidden = false;
      myVoiceObjectUrl = URL.createObjectURL(take.blob);
      myVoicePlayBtnEl.onclick = function () {
        new Audio(myVoiceObjectUrl).play();
      };
    });
  }

  // 오늘 이 단계를 끝까지 마쳤을 때 호출. 오늘 1·2·3번을 모두 마치면 도장판에 도장이
  // 찍히고, 처음 다 채운 순간에만 보상(오늘의 운세)을 보여준다.
  function onStageCompleted(stage) {
    if (!childId || typeof StampStore === "undefined") return;
    var result = StampStore.markStageDone(childId, unit.id, stage);
    renderStampButtons();
    checkAndAwardTrophies();
    if (result.justCompletedAll) {
      showRewardModal();
    }
  }

  function renderStampButtons() {
    if (!childId || typeof StampStore === "undefined") return;
    var today = StampStore.getTodayStamps(childId, unit.id);
    Object.keys(BUTTONS).forEach(function (key) {
      BUTTONS[key].btn.classList.toggle("stamped", !!today[key]);
    });
  }

  // 월~금 도장 5개를 한 주 안에 다 채우면(개근) Word 도감의 "트로피 카드" 탭에 이
  // 유닛의 Journeys 트로피 카드가 하나 들어가며(처음 개근한 주에 한해) 보너스 게임
  // 기회를 3회 준다. 주간 도장판 UI 자체는 Journeys 메뉴 맨 위로 옮겨갔지만(home.js,
  // 유닛과 무관하게 "오늘 어느 유닛이든" 기준), 트로피는 여전히 이 유닛을 그 주
  // 월~금 내내 읽었을 때만 준다. 중복 지급 방지는 WordCardStore.awardJourneysTrophy
  // 안에서 이 카드가 이미 있는지로 판단한다.
  function checkAndAwardTrophies() {
    if (!childId || typeof StampStore === "undefined" || typeof WordCardStore === "undefined") return;
    var weeks = StampStore.getWeekGrid(childId, unit.id);
    weeks.forEach(function (week) {
      var weekComplete = week.days.every(function (day) {
        return day.stamped;
      });
      if (weekComplete) {
        WordCardStore.awardJourneysTrophy(unit.id, week.weekStart, "1week", StampStore.weekLabel(week.weekStart));
      }
    });
  }

  function showRewardModal() {
    if (typeof ChildStore === "undefined" || typeof FortuneStore === "undefined") return;
    var info = ChildStore.getInfo(childId);
    if (!info) return;
    var fortune = FortuneStore.getTodayFortune(info.zodiac);
    rewardZodiacEl.textContent = info.zodiacEmoji + " " + info.name + " (" + info.zodiac + ")";
    rewardTextEl.textContent = fortune.main;
    rewardLuckyColorEl.textContent = "🎨 행운의 색: " + fortune.color;
    rewardLuckyNumberEl.textContent = "🔢 행운의 숫자: " + fortune.number;
    rewardModalEl.hidden = false;
  }

  rewardCloseBtn.addEventListener("click", function () {
    rewardModalEl.hidden = true;
  });

  listenBtn.addEventListener("click", function () {
    if (activeMode === "listen") {
      pauseCurrentReading("listen");
      return;
    }
    startMode("listen");
  });

  followBtn.addEventListener("click", function () {
    if (activeMode === "follow") {
      pauseCurrentReading("follow");
      return;
    }
    startMode("follow");
  });

  aloneBtn.addEventListener("click", function () {
    if (activeMode === "alone") {
      pauseCurrentReading("alone");
      return;
    }
    startMode("alone");
  });

  // 모드 버튼을 눌러 새로 시작할 때 공통으로 거치는 길목. 무슨 모드든 먼저 그 모드가
  // 멈춰둔(가장 멀리 읽은) 페이지로 화면을 옮겨서 이어서 하도록 만든다. 듣기는 녹음이
  // 필요 없어 바로 재생하고, 따라읽기/혼자읽기는 먼저 마이크 녹음을 켠 뒤(권한 요청
  // 포함) 재생을 시작한다 - 권한이 없어도 읽기 연습 자체는 막지 않고, 완료(도장)
  // 처리만 나중에 onReadingFinished에서 막는다.
  function startMode(mode) {
    renderPage(pageIndexByMode[mode], mode);
    if (mode === "listen") {
      playWithHighlight("listen", currentSpeedRate(), pausedWordIndex.listen);
      return;
    }
    var myToken = playToken;
    if (typeof RecordingStore === "undefined") {
      showRecordingNotice(mode, "unsupported");
      beginModePlayback(mode);
      return;
    }
    RecordingStore.startCapture(mode, currentPageIndex).then(
      function () {
        if (playToken !== myToken) return;
        beginModePlayback(mode);
      },
      function (err) {
        if (playToken !== myToken) return;
        showRecordingNotice(mode, (err && err.reason) || "denied");
        beginModePlayback(mode);
      }
    );
  }

  function beginModePlayback(mode) {
    if (mode === "alone") startAloneMode(pausedWordIndex.alone);
    else playWithHighlight(mode, currentSpeedRate(), pausedWordIndex.follow);
  }

  // 마이크가 실제로 켜져 있으면(RecordingStore.isCapturing) 목소리가 잡혀야 다음
  // 단어로 넘어가는 voiceGatedHighlighter를 쓴다. 마이크 권한이 없거나 지원 안 되는
  // 기기라면 그 방식은 하염없이 기다리기만 하므로, 그때는 원래의 속도 기반
  // fallbackHighlighter로 대신한다(완료 처리는 어차피 녹음이 있어야만 나므로,
  // 이 경우는 처음부터 도장을 못 받는다는 안내가 이미 떠 있는 상태다).
  function startAloneMode(startWordIndex) {
    var myToken = playToken;
    setPlaying("alone");
    var onDone = function () {
      if (playToken !== myToken) return;
      onReadingFinished("alone");
    };
    var canVoiceGate = typeof RecordingStore !== "undefined" && RecordingStore.isCapturing("alone");
    if (canVoiceGate) {
      startVoiceGatedHighlighter(startWordIndex, onDone);
    } else {
      startFallbackHighlighter(currentSpeedRate(), onDone, startWordIndex);
    }
  }

  // 1번(듣기)·2번(따라읽기) 공용: TTS로 전체를 읽으면서 지금 읽는 단어를 하이라이트한다.
  // startWordIndex를 주면 그 단어부터(예: 단어 뜻 팝업을 보고 난 뒤, 속도를 바꾼 뒤) 이어서 읽는다.
  function playWithHighlight(mode, rate, startWordIndex) {
    startWordIndex = startWordIndex || 0;
    stopAll();
    if (!Tts.isSupported()) {
      BUTTONS[mode].btn.textContent = "이 브라우저는 음성 읽기를 지원하지 않아요";
      return;
    }
    var myToken = playToken;
    setPlaying(mode);

    var startCharOffset = wordSpans[startWordIndex] ? wordSpans[startWordIndex].start : 0;
    var textToSpeak = joinedText.slice(startCharOffset);

    Tts.speak(textToSpeak, {
      rate: rate,
      // Tts.speak()은 내부적으로 문장 단위(청크)로 잘라 순서대로 이어 말한다. 그
      // 청크가 실제로 소리 나기 시작할 때마다(onchunkstart) 형광펜을 그 지점으로 다시
      // 맞춘다 - onboundary(단어 단위 실시간 위치)를 지원하지 않는 음성(크롬 네트워크
      // 보이스 등)이 많아서, 이렇게 자주 다시 맞춰 주지 않으면 뒤로 갈수록 어림잡은
      // 시간과 실제 소리가 점점 어긋난다. 이러면 오차가 나더라도 청크 하나(짧은 문장
      // 하나) 분량을 못 벗어난다.
      onchunkstart: function (offset) {
        if (playToken !== myToken) return;
        var boundaryFiredForThisChunk = false;
        stopFallbackHighlighter();
        var absoluteChar = startCharOffset + offset;
        highlightAt(absoluteChar);
        fallbackTimer = setTimeout(function () {
          if (playToken !== myToken || boundaryFiredForThisChunk) return;
          var fromIndex = findWordIndexAtChar(absoluteChar);
          if (fromIndex !== -1) startFallbackHighlighter(rate, null, fromIndex + 1);
        }, 250);
        // onboundary가 이 청크 안에서 한 번이라도 오면, 그 뒤로는 실시간 위치를
        // 우선하고 어림잡은 타이머는 쓰지 않는다.
        currentChunkBoundaryFired = function () {
          boundaryFiredForThisChunk = true;
        };
      },
      onboundary: function (event) {
        if (playToken !== myToken) return;
        if (event.name === "word" || event.name === undefined) {
          if (currentChunkBoundaryFired) currentChunkBoundaryFired();
          stopFallbackHighlighter();
          highlightAt(startCharOffset + event.charIndex);
        }
      },
      onend: function () {
        if (playToken !== myToken) return;
        onReadingFinished(mode);
      }
    });
  }

  render();

  window.__journeysRenderStamps = function () {
    renderStampButtons();
    checkAndAwardTrophies();
  };
})();
