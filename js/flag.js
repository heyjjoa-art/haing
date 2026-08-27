// 전통 놀이 "청기백기"를 반응 게임으로 만들었다. 명령이 뜨면(예: "청기 올리고
// 백기 내리지 마!") 시간 안에 두 깃발을 정확한 상태로 맞춰야 한다 - 언급 안 된
// 깃발은 이전 상태 그대로 둬야 하고, "내리지 마"는 결국 "올려라"와 같은 뜻이라는
// 게 이 놀이의 핵심 함정이다. 레벨이 오를수록 두 깃발을 한꺼번에 지시하거나
// 부정문("~하지 마")이 섞이고 반응 시간도 짧아진다. 하노이의 탑처럼 순서대로
// 깨야 다음 레벨이 열리고(10레벨), 한 레벨은 정답 10개를 다 맞히면 클리어,
// 목숨 3개를 다 잃으면 그 판은 끝. 관리자 계정에서만 테스트하는 개발 중
// 게임이라 WordGameStore(게임 기회) 연동은 하지 않는다.
(function () {
  "use strict";

  var LEVEL_COUNT = 10;
  var ROUND_TARGET = 10; // 이 개수만큼 맞히면 레벨 클리어
  var LIVES_MAX = 3;

  var BLUE_LABEL = "청기";
  var WHITE_LABEL = "백기";

  // 레벨마다 난이도(tier)와 반응 시간을 정한다. tier 1: 한쪽 깃발만, 부정문 없음.
  // tier 2: 두 깃발 동시 지시 추가. tier 3~4: 부정문("~하지 마") 섞임, 시간은
  // 계속 짧아진다.
  var LEVELS = (function () {
    var arr = [];
    for (var level = 1; level <= LEVEL_COUNT; level++) {
      var tier = level <= 2 ? 1 : level <= 4 ? 2 : level <= 7 ? 3 : 4;
      var timeLimit = Math.max(1200, 3400 - (level - 1) * 220);
      arr.push({ tier: tier, timeLimit: timeLimit });
    }
    return arr;
  })();

  var levelNumEl = document.getElementById("flgLevelNum");
  var levelTotalEl = document.getElementById("flgLevelTotal");
  var levelPickerEl = document.getElementById("flgLevelPicker");
  var bestEl = document.getElementById("flgBest");
  var livesEl = document.getElementById("flgLives");
  var scoreEl = document.getElementById("flgScore");
  var progressEl = document.getElementById("flgProgress");

  var timerBarEl = document.getElementById("flgTimerBar");
  var commandEl = document.getElementById("flgCommand");
  var feedbackEl = document.getElementById("flgFeedback");

  var blueBtn = document.getElementById("flgBlueBtn");
  var whiteBtn = document.getElementById("flgWhiteBtn");
  var blueClothEl = document.getElementById("flgBlueCloth");
  var whiteClothEl = document.getElementById("flgWhiteCloth");
  var blueStateEl = document.getElementById("flgBlueState");
  var whiteStateEl = document.getElementById("flgWhiteState");

  var hintEl = document.getElementById("flgHint");

  var overlayEl = document.getElementById("flgOverlay");
  var overlayTitleEl = document.getElementById("flgOverlayTitle");
  var overlayDescEl = document.getElementById("flgOverlayDesc");
  var nextBtn = document.getElementById("flgNextBtn");
  var retryBtn = document.getElementById("flgRetryBtn");

  var DEFAULT_HINT = "글자와 소리로 명령이 나와요. 깃발을 눌러서 올리고 내려요 - 언급 안 된 깃발은 그대로 둬야 해요!";

  var currentLevel = 1;
  var lives = LIVES_MAX;
  var correctCount = 0;
  var score = 0;
  var blueUp = false;
  var whiteUp = false;
  var targetBlue = false;
  var targetWhite = false;
  var roundActive = false;
  var isLevelOver = false;
  var timeoutHandle = null;
  var advanceHandle = null;

  function childKeyPart() {
    var childId = typeof ChildStore !== "undefined" && ChildStore.getActive();
    return childId ? childId + "_" : "guest_";
  }

  function unlockedLevelKey() {
    return "haingFlagUnlockedLevel_" + childKeyPart();
  }

  function getUnlockedLevel() {
    var raw = parseInt(localStorage.getItem(unlockedLevelKey()), 10);
    if (isNaN(raw) || raw < 1) return 1;
    return Math.min(raw, LEVEL_COUNT);
  }

  function unlockLevel(level) {
    if (level > getUnlockedLevel()) {
      localStorage.setItem(unlockedLevelKey(), String(level));
    }
  }

  function bestScoreKey(level) {
    return "haingFlagBestScore_" + childKeyPart() + level;
  }

  function clearedKey(level) {
    return "haingFlagCleared_" + childKeyPart() + level;
  }

  function isCleared(level) {
    return localStorage.getItem(clearedKey(level)) === "1";
  }

  // Tts(js/tts.js)는 영어(en-US) 전용이라 한국어 명령을 읽히면 발음이 깨진다 -
  // 그래서 이 게임은 Web Speech API를 직접 한국어(ko-KR) 목소리로 불러 쓴다.
  function speakCommand(text) {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    var utter = new SpeechSynthesisUtterance(text);
    utter.lang = "ko-KR";
    utter.rate = 1;
    window.speechSynthesis.speak(utter);
  }

  function stopSpeech() {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  }

  // 실제 청기백기 구호처럼 짧게: "청기 올려!", "백기 내려!", "청기 올리고
  // 백기 내려!", "청기 내리지 말고 백기 내리지 마!" 식으로, 두 개를 이을 때는
  // 쉼표가 아니라 "-고"/"-지 말고" 연결어미를 그대로 쓴다. isFirst=true면
  // 문장 중간에 오는 연결형("올리고", "내리지 말고")을, false면 문장을
  // 끝맺는 종결형("올려!", "내리지 마!")을 돌려준다.
  function wordFor(wantUp, useNegation, isFirst) {
    if (!useNegation) {
      if (wantUp) return isFirst ? "올리고" : "올려";
      return isFirst ? "내리고" : "내려";
    }
    // "내리지 마" = 내려가면 안 됨 = 결국 올라가 있어야 함(올려와 같은 목표).
    if (wantUp) return isFirst ? "내리지 말고" : "내리지 마";
    // "올리지 마" = 올라가면 안 됨 = 결국 내려가 있어야 함(내려와 같은 목표).
    return isFirst ? "올리지 말고" : "올리지 마";
  }

  function flagPhrase(label, wantUp, useNegation, isFirst) {
    var text = label + " " + wordFor(wantUp, useNegation, isFirst);
    return isFirst ? text : text + "!";
  }

  // 지금 tier에 맞춰 명령 문장과, 그 문장이 요구하는 두 깃발의 최종 상태를
  // 만든다. 언급 안 된 깃발은 목표가 "지금 상태 그대로"다.
  function buildCommand(tier, prevBlue, prevWhite) {
    var nextTargetBlue = prevBlue;
    var nextTargetWhite = prevWhite;

    var mentionBoth = tier >= 2 && Math.random() < (tier >= 3 ? 0.65 : 0.5);
    var allowNegation = tier >= 3;

    // 목표를 완전 무작위로 고르면 "이미 그 상태"인 경우가 절반이나 나와서
    // 매번 손을 움직여야 하는 재미가 줄어든다 - 그래서 실제로 상태를 바꿔야
    // 하는 쪽으로 확률을 기울이고, 가끔("그대로 두기" 함정) 지금 상태를
    // 그대로 다시 지시하기도 한다.
    var FLIP_BIAS = 0.75;

    var text;
    if (mentionBoth) {
      var blueUpWant = Math.random() < FLIP_BIAS ? !prevBlue : prevBlue;
      var whiteUpWant = Math.random() < FLIP_BIAS ? !prevWhite : prevWhite;
      nextTargetBlue = blueUpWant;
      nextTargetWhite = whiteUpWant;
      var blueNeg = allowNegation && Math.random() < (tier >= 4 ? 0.6 : 0.4);
      var whiteNeg = allowNegation && Math.random() < (tier >= 4 ? 0.6 : 0.4);

      // 어느 깃발을 먼저 부를지도 섞는다(항상 청기부터면 금방 패턴이 읽힌다).
      var blueFirst = Math.random() < 0.5;
      var firstPart = blueFirst
        ? flagPhrase(BLUE_LABEL, blueUpWant, blueNeg, true)
        : flagPhrase(WHITE_LABEL, whiteUpWant, whiteNeg, true);
      var secondPart = blueFirst
        ? flagPhrase(WHITE_LABEL, whiteUpWant, whiteNeg, false)
        : flagPhrase(BLUE_LABEL, blueUpWant, blueNeg, false);
      text = firstPart + " " + secondPart;
    } else {
      var isBlue = Math.random() < 0.5;
      var neg = allowNegation && Math.random() < 0.4;
      if (isBlue) {
        var blueWant = Math.random() < FLIP_BIAS ? !prevBlue : prevBlue;
        nextTargetBlue = blueWant;
        text = flagPhrase(BLUE_LABEL, blueWant, neg, false);
      } else {
        var whiteWant = Math.random() < FLIP_BIAS ? !prevWhite : prevWhite;
        nextTargetWhite = whiteWant;
        text = flagPhrase(WHITE_LABEL, whiteWant, neg, false);
      }
    }

    return { text: text, targetBlue: nextTargetBlue, targetWhite: nextTargetWhite };
  }

  function formatLives() {
    return "❤️".repeat(Math.max(0, lives)) + "🖤".repeat(Math.max(0, LIVES_MAX - lives));
  }

  function updateStatsUI() {
    scoreEl.textContent = String(score);
    livesEl.textContent = formatLives();
    progressEl.textContent = correctCount + " / " + ROUND_TARGET;
  }

  function showBest() {
    var raw = parseInt(localStorage.getItem(bestScoreKey(currentLevel)), 10) || 0;
    bestEl.textContent = raw > 0 ? raw + "점" : "-";
  }

  function renderLevelPicker() {
    var unlocked = getUnlockedLevel();
    levelPickerEl.innerHTML = "";
    for (var level = 1; level <= LEVEL_COUNT; level++) {
      (function (lv) {
        var btn = document.createElement("button");
        btn.type = "button";
        var locked = lv > unlocked;
        var classes = ["stage-tab", "stage-tab--level"];
        if (lv === currentLevel) classes.push("current");
        if (locked) classes.push("locked");
        else if (isCleared(lv)) classes.push("cleared");
        btn.className = classes.join(" ");
        btn.textContent = locked ? "🔒" : String(lv);
        btn.disabled = locked;
        btn.addEventListener("click", function () {
          if (roundActive) return;
          newGame(lv);
        });
        levelPickerEl.appendChild(btn);
      })(level);
    }
  }

  function renderFlagUI() {
    blueClothEl.classList.toggle("is-down", !blueUp);
    whiteClothEl.classList.toggle("is-down", !whiteUp);
    blueStateEl.textContent = blueUp ? "올림" : "내림";
    blueStateEl.classList.toggle("is-up", blueUp);
    whiteStateEl.textContent = whiteUp ? "올림" : "내림";
    whiteStateEl.classList.toggle("is-up", whiteUp);
  }

  function describeTarget(tb, tw) {
    return BLUE_LABEL + " " + (tb ? "올림" : "내림") + ", " + WHITE_LABEL + " " + (tw ? "올림" : "내림");
  }

  function clearTimers() {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
      timeoutHandle = null;
    }
    if (advanceHandle) {
      clearTimeout(advanceHandle);
      advanceHandle = null;
    }
  }

  function endRound(cleared, reason) {
    isLevelOver = true;
    roundActive = false;
    clearTimers();
    stopSpeech();

    var key = bestScoreKey(currentLevel);
    var prevBest = parseInt(localStorage.getItem(key), 10) || 0;
    var isNewBest = score > prevBest;
    if (isNewBest) localStorage.setItem(key, String(score));

    if (cleared) {
      localStorage.setItem(clearedKey(currentLevel), "1");
      if (currentLevel < LEVEL_COUNT) unlockLevel(currentLevel + 1);
    }

    showBest();
    renderLevelPicker();

    var nextAvailable = cleared && currentLevel < LEVEL_COUNT;

    overlayTitleEl.textContent = cleared ? "🎉 레벨 클리어!" : "😵 아쉬워요!";
    overlayDescEl.textContent =
      reason + " 점수 " + score + "점 (" + correctCount + "/" + ROUND_TARGET + " 정답)" +
      (isNewBest ? " 🎉 신기록!" : "");

    nextBtn.hidden = !nextAvailable;
    retryBtn.textContent = "🔄 다시 하기";
    overlayEl.hidden = false;
  }

  function onCorrect() {
    clearTimers();
    roundActive = false;
    correctCount++;
    score += 10 * currentLevel;
    feedbackEl.textContent = "✅ 정답!";
    feedbackEl.className = "flg-feedback flg-feedback--good";
    updateStatsUI();

    if (correctCount >= ROUND_TARGET) {
      endRound(true, "다 맞혔어요!");
      return;
    }
    advanceHandle = setTimeout(startCommand, 550);
  }

  function onTimeout() {
    roundActive = false;
    lives--;
    feedbackEl.textContent = "❌ 시간 초과! 정답은 " + describeTarget(targetBlue, targetWhite);
    feedbackEl.className = "flg-feedback flg-feedback--bad";
    blueUp = targetBlue;
    whiteUp = targetWhite;
    renderFlagUI();
    updateStatsUI();

    if (lives <= 0) {
      advanceHandle = setTimeout(function () {
        endRound(false, "목숨을 다 잃었어요.");
      }, 750);
      return;
    }
    advanceHandle = setTimeout(startCommand, 900);
  }

  function checkMatch() {
    if (!roundActive) return;
    if (blueUp === targetBlue && whiteUp === targetWhite) onCorrect();
  }

  function startCommand() {
    if (isLevelOver) return;
    var conf = LEVELS[currentLevel - 1];
    var cmd = buildCommand(conf.tier, blueUp, whiteUp);
    targetBlue = cmd.targetBlue;
    targetWhite = cmd.targetWhite;

    commandEl.textContent = cmd.text;
    speakCommand(cmd.text);
    feedbackEl.textContent = "";
    feedbackEl.className = "flg-feedback";
    roundActive = true;

    timerBarEl.classList.remove("is-danger");
    timerBarEl.style.transition = "none";
    timerBarEl.style.width = "100%";
    // 리플로우를 강제해서 바로 뒤의 transition이 적용되게 한다(안 하면 처음
    // width:100% 대입과 곧이은 transition 시작이 브라우저에서 합쳐져 버린다).
    void timerBarEl.offsetWidth;
    timerBarEl.style.transition = "width " + conf.timeLimit + "ms linear";
    timerBarEl.style.width = "0%";

    timeoutHandle = setTimeout(onTimeout, conf.timeLimit);

    // 지시가 "지금 상태 그대로 두면 되는" 경우(예: 이미 내려간 깃발을 또
    // 내리라고 하거나, 언급 안 된 깃발만 있는 경우)도 있다 - 그때는 아이가
    // 아무것도 누르지 않아도 이미 정답이니, 클릭을 기다리지 않고 바로 채점한다.
    checkMatch();
  }

  function newGame(level) {
    currentLevel = level;
    lives = LIVES_MAX;
    correctCount = 0;
    score = 0;
    blueUp = false;
    whiteUp = false;
    isLevelOver = false;
    roundActive = false;
    clearTimers();

    renderFlagUI();
    levelNumEl.textContent = String(level);
    updateStatsUI();
    showBest();
    renderLevelPicker();

    commandEl.textContent = "준비하세요!";
    feedbackEl.textContent = "";
    feedbackEl.className = "flg-feedback";
    hintEl.textContent = DEFAULT_HINT;
    timerBarEl.style.transition = "none";
    timerBarEl.style.width = "100%";
    timerBarEl.classList.remove("is-danger");
    overlayEl.hidden = true;

    advanceHandle = setTimeout(startCommand, 900);
  }

  blueBtn.addEventListener("click", function () {
    if (!roundActive) return;
    blueUp = !blueUp;
    renderFlagUI();
    checkMatch();
  });

  whiteBtn.addEventListener("click", function () {
    if (!roundActive) return;
    whiteUp = !whiteUp;
    renderFlagUI();
    checkMatch();
  });

  retryBtn.addEventListener("click", function () {
    newGame(currentLevel);
  });
  nextBtn.addEventListener("click", function () {
    newGame(Math.min(currentLevel + 1, LEVEL_COUNT));
  });

  document.addEventListener("visibilitychange", function () {
    if (document.hidden && roundActive) {
      // 화면을 벗어나면 타이머가 계속 흘러 억울하게 시간초과가 나지 않도록,
      // 지금 명령을 취소하고 돌아왔을 때 같은 레벨을 다시 시작한다.
      clearTimers();
      stopSpeech();
      roundActive = false;
      if (!isLevelOver) advanceHandle = setTimeout(startCommand, 400);
    }
  });

  levelTotalEl.textContent = String(LEVEL_COUNT);
  newGame(getUnlockedLevel());
})();
