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

  // 읽는 속도 버튼 자체는 Journeys 메뉴 맨 위로 옮겨갔다(home.js) - 여기서는 그
  // 설정값만 읽어서 재생 속도에 반영한다.
  var SPEED_KEY = "journeysReadSpeed";
  var SPEED_RATES = { slow: 0.5, normal: 1, fast: 1.5 };

  function currentSpeedRate() {
    var speed = localStorage.getItem(SPEED_KEY);
    return SPEED_RATES[speed] || SPEED_RATES.normal;
  }

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
  // 그 지점부터 이어서 읽는다. hasUnfinishedPlayback은 "이 페이지를 끝까지 재생해서
  // 다 읽지는 않았다"는 표시로, updatePageNavDisabled()가 페이지 이동을 계속 잠그는
  // 데 쓴다 - 멈춤 버튼으로 잠금을 피해가지 못하게(다 듣기 전엔 페이지 이동 금지).
  var pausedWordIndex = { listen: 0, follow: 0, alone: 0 };
  var hasUnfinishedPlayback = false;

  var rewardModalEl = document.getElementById("rewardModal");
  var rewardZodiacEl = document.getElementById("rewardZodiac");
  var rewardTextEl = document.getElementById("rewardText");
  var rewardLuckyColorEl = document.getElementById("rewardLuckyColor");
  var rewardLuckyNumberEl = document.getElementById("rewardLuckyNumber");
  var rewardCloseBtn = document.getElementById("rewardCloseBtn");

  var wordSpans = []; // { start, end, el }
  var joinedText = "";
  var currentReadingEl = null;
  var activeMode = null; // 'listen' | 'follow' | 'alone'
  var playToken = 0; // 모드를 바꿀 때마다 올려서, 이미 취소된 재생의 뒤늦은 콜백을 무시한다.
  var fallbackTimer = null;
  var fallbackIndex = 0;
  var currentChunkBoundaryFired = null; // 지금 재생 중인 청크의 boundary 도착 여부를 표시하는 콜백

  var pages = []; // { photo, pageNumber, paragraphs }
  var currentPageIndex = 0;

  // 긴 책(사진 10장 이상 등)은 한 번에 끝까지 못 읽고 나갔다 다시 들어오는 일이
  // 흔해서, 마지막으로 보던 페이지를 아이별로 기억해뒀다가 다음에 들어오면 거기서부터
  // 이어서 보여준다 - 매번 1페이지부터 다시 넘기지 않아도 되게.
  function pagePosKey() {
    return "journeysPagePos_" + (childId || "guest") + "_" + unit.id;
  }

  function saveCurrentPagePos() {
    localStorage.setItem(pagePosKey(), String(currentPageIndex));
  }

  function loadSavedPagePos() {
    var raw = localStorage.getItem(pagePosKey());
    var n = raw != null ? parseInt(raw, 10) : 0;
    return isNaN(n) ? 0 : n;
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
    renderPage(loadSavedPagePos());
    renderStampButtons();
    checkAndAwardTrophies();
  }

  // 페이지를 넘기면 재생 중이던 소리/형광펜은 멈춘다(stopAll) - 이전 페이지 내용을
  // 새 페이지로 이어서 읽지는 않는다. 이전/다음 페이지 버튼 자체가 재생 중에는
  // updatePageNavDisabled()로 잠겨 있어서, 형광펜이 그 페이지를 끝까지 읽기 전에는
  // 아예 눌리지 않는다 - 다 듣기 전에 건너뛰어서 다음 페이지로 넘기지 못 하게 하려는 것.
  function renderPage(idx) {
    stopAll();
    currentPageIndex = Math.max(0, Math.min(idx, pages.length - 1));
    resetButtons(); // stopAll()은 이전 페이지 번호로 이미 그려버렸으니 새 페이지 번호로 다시 그린다
    saveCurrentPagePos();
    pausedWordIndex = { listen: 0, follow: 0, alone: 0 };
    hasUnfinishedPlayback = false;
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

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  prevPageBtn.addEventListener("click", function () {
    renderPage(currentPageIndex - 1);
  });
  nextPageBtn.addEventListener("click", function () {
    renderPage(currentPageIndex + 1);
  });

  // 재생 중(activeMode)이거나, 단어 뜻 팝업 때문에 잠깐 멈춘 중(pendingResumeMode, 곧
  // 이어서 읽을 예정)이거나, 다 안 끝났는데 멈춤 버튼으로 직접 멈춘 상태(hasUnfinishedPlayback)면
  // 형광펜이 이 페이지를 다 읽지 않은 것으로 보고 이전/다음 페이지 버튼을 잠근다 -
  // 멈춤 버튼을 눌러서 끝까지 안 듣고 페이지를 넘겨버리는 것도 막는다.
  function updatePageNavDisabled() {
    var stillReading = !!activeMode || !!pendingResumeMode || hasUnfinishedPlayback;
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
      var myToken = playToken;
      setPlaying("alone");
      startFallbackHighlighter(
        currentSpeedRate(),
        function () {
          if (playToken !== myToken) return;
          onReadingFinished("alone");
        },
        wordIndex
      );
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

  // 아이콘 줄 + 글자 줄로 나눠서 버튼을 좁은 칸에서도 안 넘치게 그린다. 페이지가
  // 여러 장인 유닛은 지금 몇 페이지째인지도 버튼에 함께 보여준다 - 도장은 "듣기/따라읽기/
  // 혼자읽기"를 마지막 페이지까지 끝까지 재생해야만 찍히는데, 버튼만 봐서는 지금 페이지가
  // 마지막인지 알기 어려워서 "다 들었는데 왜 도장이 안 찍히지"로 헷갈리기 쉬웠다.
  function buttonHtml(icon, label) {
    var progressHtml =
      pages.length > 1
        ? '<span class="listen-btn-progress">' + (currentPageIndex + 1) + "/" + pages.length + "</span>"
        : "";
    return (
      '<span class="listen-btn-icon">' + icon + "</span>" +
      '<span class="listen-btn-label">' + label + "</span>" +
      progressHtml
    );
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

  // 재생 중에 버튼을 다시 눌러 직접 멈췄을 때 호출. 지금 읽던 단어 위치를 그 모드의
  // "멈춘 지점"으로 기억해뒀다가, 같은 버튼을 또 누르면 거기서부터 이어서 읽는다.
  // 끝까지 다 읽은 게 아니므로 hasUnfinishedPlayback을 세워서 페이지 이동도 계속 잠가둔다.
  function pauseCurrentReading(mode) {
    var idx = currentReadingEl ? findWordIndexByEl(currentReadingEl) : -1;
    pausedWordIndex[mode] = idx > 0 ? idx : 0;
    hasUnfinishedPlayback = true;
    stopAll();
  }

  // 이 페이지를 (멈추지 않고) 끝까지 다 읽었을 때 호출 - 마지막 페이지면 오늘의
  // 단계를 완료 처리하고, 다음에 같은 버튼을 눌렀을 때 다시 처음부터 읽도록 멈춘
  // 지점 기록을 지운 뒤, 페이지 이동 잠금도 풀어준다.
  function onReadingFinished(mode) {
    if (currentPageIndex === pages.length - 1) onStageCompleted(mode);
    pausedWordIndex[mode] = 0;
    hasUnfinishedPlayback = false;
    stopAll();
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
    playWithHighlight("listen", currentSpeedRate(), pausedWordIndex.listen);
  });

  followBtn.addEventListener("click", function () {
    if (activeMode === "follow") {
      pauseCurrentReading("follow");
      return;
    }
    playWithHighlight("follow", currentSpeedRate(), pausedWordIndex.follow);
  });

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

  aloneBtn.addEventListener("click", function () {
    if (activeMode === "alone") {
      pauseCurrentReading("alone");
      return;
    }
    stopAll();
    var myToken = playToken;
    setPlaying("alone");
    startFallbackHighlighter(currentSpeedRate(), function () {
      if (playToken !== myToken) return;
      onReadingFinished("alone");
    }, pausedWordIndex.alone);
  });

  render();

  window.__journeysRenderStamps = function () {
    renderStampButtons();
    checkAndAwardTrophies();
  };
})();
