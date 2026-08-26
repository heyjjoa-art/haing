// 하노이의 탑 - 기둥은 항상 3개(원반 개수를 늘려도 최소 이동 횟수 2^n-1 공식이
// 그대로 성립하는 건 기둥 3개일 때뿐이라, 기둥을 늘리는 대신 원반 개수로 레벨을
// 나눈다). 레벨 1부터 순서대로 깨야 다음 레벨이 열리고, 최종 레벨(6단계, 원반
// 8개 · 최소 255회)까지 올라간다. 드래그 대신 "출발 기둥 누르기 → 도착 기둥
// 누르기" 두 번 탭으로 옮긴다.
(function () {
  "use strict";

  var LEVEL_COUNT = 6;
  var FIRST_LEVEL_DISKS = 3;
  var TARGET_PEG = 2;

  function disksForLevel(level) {
    return FIRST_LEVEL_DISKS + (level - 1);
  }

  function optimalMoves(level) {
    return Math.pow(2, disksForLevel(level)) - 1;
  }

  var bestEl = document.getElementById("hanoiBest");
  var timerEl = document.getElementById("hanoiTimer");
  var movesEl = document.getElementById("hanoiMoves");
  var minMovesEl = document.getElementById("hanoiMinMoves");
  var levelNumEl = document.getElementById("hanoiLevelNum");
  var levelTotalEl = document.getElementById("hanoiLevelTotal");
  var levelPickerEl = document.getElementById("hanoiLevelPicker");
  var hintEl = document.getElementById("hanoiHint");
  var boardEl = document.getElementById("hanoiBoard");
  var restartBtn = document.getElementById("hanoiRestartBtn");

  var overlayEl = document.getElementById("hanoiOverlay");
  var overlayTitleEl = document.getElementById("hanoiOverlayTitle");
  var overlayDescEl = document.getElementById("hanoiOverlayDesc");
  var nextBtn = document.getElementById("hanoiNextBtn");
  var retryBtn = document.getElementById("hanoiRetryBtn");

  var DEFAULT_HINT = "기둥을 눌러 원반을 고르고, 옮길 기둥을 다시 눌러보세요.";

  var currentLevel = 1;
  var diskCount = FIRST_LEVEL_DISKS;
  var pegs = [];
  var selectedPeg = null;
  var moveCount = 0;
  var isSolved = false;
  var startTime = 0;
  var timerId = null;

  function childKeyPart() {
    var childId = typeof ChildStore !== "undefined" && ChildStore.getActive();
    return childId ? childId + "_" : "guest_";
  }

  function unlockedLevelKey() {
    return "haingHanoiUnlockedLevel_" + childKeyPart();
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

  function bestMovesKey(level) {
    return "haingHanoiBestMoves_" + childKeyPart() + level;
  }

  function formatTime(totalSeconds) {
    var m = Math.floor(totalSeconds / 60);
    var s = totalSeconds % 60;
    return m + ":" + (s < 10 ? "0" : "") + s;
  }

  function showBest() {
    var raw = localStorage.getItem(bestMovesKey(currentLevel));
    bestEl.textContent = raw ? raw + "회" : "-";
  }

  function stopTimer() {
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }
  }

  function startTimer() {
    stopTimer();
    startTime = Date.now();
    timerEl.textContent = "0:00";
    timerId = setInterval(function () {
      timerEl.textContent = formatTime(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
  }

  function initPegs(count) {
    var start = [];
    for (var size = count; size >= 1; size--) start.push(size);
    pegs = [start, [], []];
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
        else if (localStorage.getItem(bestMovesKey(lv))) classes.push("cleared");
        btn.className = classes.join(" ");
        btn.textContent = locked ? "🔒" : String(lv);
        btn.disabled = locked;
        btn.addEventListener("click", function () {
          if (isSolved) return;
          newGame(lv);
        });
        levelPickerEl.appendChild(btn);
      })(level);
    }
  }

  function renderBoard() {
    boardEl.innerHTML = "";
    pegs.forEach(function (stack, i) {
      var pegEl = document.createElement("div");
      pegEl.className = "hanoi-peg" + (selectedPeg === i ? " selected" : "");

      var disksEl = document.createElement("div");
      disksEl.className = "hanoi-disks";
      stack.forEach(function (size, idx) {
        var diskEl = document.createElement("div");
        diskEl.className = "hanoi-disk";
        diskEl.dataset.size = String(((size - 1) % 8) + 1);
        var maxWidth = 100;
        var minWidth = 26;
        var width = diskCount > 1 ? minWidth + (maxWidth - minWidth) * ((size - 1) / (diskCount - 1)) : maxWidth;
        diskEl.style.width = Math.round(width) + "px";
        if (selectedPeg === i && idx === stack.length - 1) diskEl.classList.add("lifted");
        disksEl.appendChild(diskEl);
      });
      pegEl.appendChild(disksEl);

      var baseEl = document.createElement("div");
      baseEl.className = "hanoi-base";
      pegEl.appendChild(baseEl);

      pegEl.addEventListener("click", function () {
        onPegClick(i);
      });

      boardEl.appendChild(pegEl);
    });
  }

  function flashInvalid(pegIndex) {
    var pegEl = boardEl.children[pegIndex];
    if (!pegEl) return;
    pegEl.classList.add("invalid");
    setTimeout(function () {
      pegEl.classList.remove("invalid");
    }, 400);
  }

  function onPegClick(i) {
    if (isSolved) return;

    if (selectedPeg === null) {
      if (pegs[i].length === 0) {
        hintEl.textContent = "그 기둥엔 원반이 없어요.";
        return;
      }
      selectedPeg = i;
      hintEl.textContent = "옮길 기둥을 눌러주세요.";
      renderBoard();
      return;
    }

    if (selectedPeg === i) {
      selectedPeg = null;
      hintEl.textContent = DEFAULT_HINT;
      renderBoard();
      return;
    }

    var from = pegs[selectedPeg];
    var to = pegs[i];
    var disk = from[from.length - 1];
    var topOfTo = to[to.length - 1];

    if (topOfTo !== undefined && topOfTo < disk) {
      flashInvalid(i);
      hintEl.textContent = "❌ 더 작은 원반 위에는 올릴 수 없어요!";
      return;
    }

    from.pop();
    to.push(disk);
    moveCount++;
    movesEl.textContent = String(moveCount);
    selectedPeg = null;
    hintEl.textContent = DEFAULT_HINT;
    renderBoard();

    if (pegs[TARGET_PEG].length === diskCount) onWin();
  }

  function onWin() {
    isSolved = true;
    stopTimer();
    var elapsed = Math.floor((Date.now() - startTime) / 1000);
    var optimal = optimalMoves(currentLevel);

    var key = bestMovesKey(currentLevel);
    var prevBest = parseInt(localStorage.getItem(key), 10);
    var isNewBest = isNaN(prevBest) || moveCount < prevBest;
    if (isNewBest) localStorage.setItem(key, String(moveCount));
    showBest();

    var isFinalLevel = currentLevel === LEVEL_COUNT;
    var justUnlockedNext = currentLevel === getUnlockedLevel() && !isFinalLevel;
    if (justUnlockedNext) unlockLevel(currentLevel + 1);
    renderLevelPicker();

    var isOptimal = moveCount === optimal;
    overlayTitleEl.textContent = isFinalLevel ? "🏆 모든 단계 클리어!" : isOptimal ? "🌟 최소 횟수로 완성!" : "🎉 완성했어요!";
    overlayDescEl.textContent =
      "레벨 " + currentLevel + "을(를) " + moveCount + "번 만에, " + formatTime(elapsed) + "만에 다 옮겼어요!" +
      (isOptimal ? " 최소 이동 횟수(" + optimal + "회)로 풀었어요!" : isNewBest ? " 🎉 신기록!" : "") +
      (justUnlockedNext ? " 다음 레벨이 열렸어요!" : "");

    nextBtn.hidden = isFinalLevel;
    overlayEl.hidden = false;
  }

  function newGame(level) {
    currentLevel = level;
    diskCount = disksForLevel(level);

    initPegs(diskCount);
    selectedPeg = null;
    moveCount = 0;
    isSolved = false;
    movesEl.textContent = "0";
    minMovesEl.textContent = String(optimalMoves(level));
    levelNumEl.textContent = String(level);
    hintEl.textContent = DEFAULT_HINT;
    overlayEl.hidden = true;
    showBest();
    startTimer();
    renderBoard();
    renderLevelPicker();
  }

  restartBtn.addEventListener("click", function () {
    newGame(currentLevel);
  });

  retryBtn.addEventListener("click", function () {
    newGame(currentLevel);
  });

  nextBtn.addEventListener("click", function () {
    newGame(Math.min(currentLevel + 1, LEVEL_COUNT));
  });

  levelTotalEl.textContent = String(LEVEL_COUNT);
  newGame(1);
})();
