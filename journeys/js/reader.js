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

  var storyTitleEl = document.getElementById("storyTitle");
  var levelSubtitleEl = document.getElementById("levelSubtitle");
  var storyImageCol = document.getElementById("storyImageCol");
  var storyPhotosEl = document.getElementById("storyPhotos");
  var storyTextArea = document.getElementById("storyTextArea");
  var listenBtn = document.getElementById("listenBtn");
  var followBtn = document.getElementById("followBtn");
  var aloneBtn = document.getElementById("aloneBtn");

  var stampBoardWeeksEl = document.getElementById("stampBoardWeeks");

  var SPEED_KEY = "journeysReadSpeed";
  var SPEED_RATES = { slow: 0.5, normal: 1, fast: 1.5 };
  var speedButtons = Array.prototype.slice.call(document.querySelectorAll(".speed-btn"));
  var currentSpeed = localStorage.getItem(SPEED_KEY);
  if (!SPEED_RATES[currentSpeed]) currentSpeed = "normal";

  function currentSpeedRate() {
    return SPEED_RATES[currentSpeed];
  }

  function updateSpeedButtons() {
    speedButtons.forEach(function (btn) {
      btn.classList.toggle("active", btn.getAttribute("data-speed") === currentSpeed);
    });
  }

  // 속도를 바꾸면, 지금 읽던 중이었다면 그 자리에서 바로 새 속도로 이어서 읽어준다.
  function setSpeed(speed) {
    if (!SPEED_RATES[speed] || speed === currentSpeed) return;
    var mode = activeMode;
    var wordIndex = currentReadingEl ? findWordIndexByEl(currentReadingEl) : -1;

    currentSpeed = speed;
    localStorage.setItem(SPEED_KEY, speed);
    updateSpeedButtons();

    if (mode && wordIndex !== -1) {
      stopAll();
      resumeReading(mode, wordIndex);
    }
  }

  speedButtons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      setSpeed(btn.getAttribute("data-speed"));
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

  function render() {
    levelSubtitleEl.textContent = "Level " + unit.level;
    storyTitleEl.textContent = unit.title;

    // photos가 없는 옛날 데이터(단일 photoDataUrl)도 그대로 보여준다.
    var photos = unit.photos || (unit.photoDataUrl ? [unit.photoDataUrl] : []);
    if (photos.length > 0) {
      photos.forEach(function (src, idx) {
        var wrap = document.createElement("div");
        wrap.className = "story-photo";

        var badge = document.createElement("span");
        badge.className = "story-photo-badge";
        badge.textContent = (idx + 1) + "페이지";
        wrap.appendChild(badge);

        var img = document.createElement("img");
        img.src = src;
        img.alt = "본문 사진 " + (idx + 1) + "페이지";
        wrap.appendChild(img);

        storyPhotosEl.appendChild(wrap);
      });
      storyImageCol.hidden = false;
    }

    buildStoryText(unit.text);
    renderStampButtons();
    renderStampBoard();
  }

  function buildStoryText(text) {
    var paragraphs = text
      .split(/\n\s*\n/)
      .map(function (p) {
        return p.trim();
      })
      .filter(Boolean);

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
          onStageCompleted("alone");
          stopAll();
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

  var BUTTONS = {
    listen: { btn: listenBtn, label: "🔊 1. 음원 듣기", playingLabel: "⏸ 듣는 중 (다시 누르면 멈춤)" },
    follow: { btn: followBtn, label: "✨ 2. 따라 읽기", playingLabel: "⏸ 따라 읽는 중 (다시 누르면 멈춤)" },
    alone: { btn: aloneBtn, label: "📖 3. 혼자 읽기", playingLabel: "⏸ 혼자 읽는 중 (다시 누르면 멈춤)" }
  };

  function resetButtons() {
    Object.keys(BUTTONS).forEach(function (key) {
      var b = BUTTONS[key];
      b.btn.classList.remove("playing");
      b.btn.textContent = b.label;
    });
  }

  function stopAll() {
    playToken++;
    Tts.stop();
    stopFallbackHighlighter();
    clearReadingHighlight();
    resetButtons();
    activeMode = null;
  }

  function setPlaying(mode) {
    resetButtons();
    var b = BUTTONS[mode];
    b.btn.classList.add("playing");
    b.btn.textContent = b.playingLabel;
    activeMode = mode;
  }

  // 오늘 이 단계를 끝까지 마쳤을 때 호출. 오늘 1·2·3번을 모두 마치면 도장판에 도장이
  // 찍히고, 처음 다 채운 순간에만 보상(오늘의 운세)을 보여준다.
  function onStageCompleted(stage) {
    if (!childId || typeof StampStore === "undefined") return;
    var result = StampStore.markStageDone(childId, unit.id, stage);
    renderStampButtons();
    renderStampBoard();
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

  function renderStampBoard() {
    if (typeof StampStore === "undefined") return;
    var weeks = StampStore.getWeekGrid(childId, unit.id);
    stampBoardWeeksEl.innerHTML = "";
    weeks.forEach(function (week) {
      var row = document.createElement("div");
      row.className = "stamp-week-row";
      week.days.forEach(function (day) {
        var cell = document.createElement("div");
        cell.className = "stamp-day-cell";
        if (day.stamped) cell.classList.add("stamped");
        if (day.isToday) cell.classList.add("today");
        if (day.isFuture) cell.classList.add("future");
        cell.innerHTML =
          '<span class="stamp-day-label">' + day.label + "</span>" +
          '<span class="stamp-day-icon">' + (day.stamped ? "성공" : "") + "</span>";
        row.appendChild(cell);
      });
      stampBoardWeeksEl.appendChild(row);
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
      stopAll();
      return;
    }
    playWithHighlight("listen", currentSpeedRate());
  });

  followBtn.addEventListener("click", function () {
    if (activeMode === "follow") {
      stopAll();
      return;
    }
    playWithHighlight("follow", currentSpeedRate());
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

    var boundaryFired = false;
    var startCharOffset = wordSpans[startWordIndex] ? wordSpans[startWordIndex].start : 0;
    var textToSpeak = joinedText.slice(startCharOffset);

    Tts.speak(textToSpeak, {
      rate: rate,
      onboundary: function (event) {
        if (playToken !== myToken) return;
        if (event.name === "word" || event.name === undefined) {
          boundaryFired = true;
          stopFallbackHighlighter();
          highlightAt(startCharOffset + event.charIndex);
        }
      },
      onend: function () {
        if (playToken !== myToken) return;
        onStageCompleted(mode);
        stopAll();
      }
    });

    // 태블릿/모바일 브라우저는 "지금 읽는 단어" 이벤트를 안 보내주는 경우가 많다.
    // 0.6초 안에 진짜 이벤트가 안 오면 어림잡은 시간으로 대신 하이라이트를 넘긴다.
    fallbackTimer = setTimeout(function () {
      if (playToken !== myToken) return;
      if (!boundaryFired) startFallbackHighlighter(rate, null, startWordIndex);
    }, 600);
  }

  aloneBtn.addEventListener("click", function () {
    if (activeMode === "alone") {
      stopAll();
      return;
    }
    stopAll();
    var myToken = playToken;
    setPlaying("alone");
    startFallbackHighlighter(currentSpeedRate(), function () {
      if (playToken !== myToken) return;
      onStageCompleted("alone");
      stopAll();
    });
  });

  render();

  window.__journeysRenderStamps = function () {
    renderStampButtons();
    renderStampBoard();
  };
})();
