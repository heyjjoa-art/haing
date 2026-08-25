// 하노이의 탑 - 기둥 3개, 원반은 세 단계(3/4/5개)로 나눠서 낸다. 드래그 대신
// "출발 기둥 누르기 → 도착 기둥 누르기" 두 번 탭으로 옮기게 해서 스도쿠/스마일
// 찾기와 같은 터치 방식을 맞췄다. 규칙 위반(작은 원반 위에 큰 원반)이면 옮기지
// 않고 대상 기둥을 잠깐 흔들어서 알려준다.
(function () {
  "use strict";

  var LEVELS = {
    easy: { label: "쉬운 단계", disks: 3 },
    medium: { label: "중간 단계", disks: 4 },
    hard: { label: "어려운 단계", disks: 5 }
  };
  var LEVEL_ORDER = ["easy", "medium", "hard"];
  var TARGET_PEG = 2;

  var bestEl = document.getElementById("hanoiBest");
  var timerEl = document.getElementById("hanoiTimer");
  var movesEl = document.getElementById("hanoiMoves");
  var minMovesEl = document.getElementById("hanoiMinMoves");
  var hintEl = document.getElementById("hanoiHint");
  var boardEl = document.getElementById("hanoiBoard");
  var restartBtn = document.getElementById("hanoiRestartBtn");

  var overlayEl = document.getElementById("hanoiOverlay");
  var overlayTitleEl = document.getElementById("hanoiOverlayTitle");
  var overlayDescEl = document.getElementById("hanoiOverlayDesc");
  var retryBtn = document.getElementById("hanoiRetryBtn");

  var tabs = {
    easy: document.getElementById("hanoiEasyTab"),
    medium: document.getElementById("hanoiMediumTab"),
    hard: document.getElementById("hanoiHardTab")
  };

  var DEFAULT_HINT = "기둥을 눌러 원반을 고르고, 옮길 기둥을 다시 눌러보세요.";

  var currentLevel = "easy";
  var diskCount = 3;
  var pegs = [];
  var selectedPeg = null;
  var moveCount = 0;
  var isSolved = false;
  var startTime = 0;
  var timerId = null;

  function bestMovesKey(level) {
    var childId = typeof ChildStore !== "undefined" && ChildStore.getActive();
    return "haingHanoiBestMoves_" + (childId ? childId + "_" : "guest_") + level;
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
        diskEl.dataset.size = String(size);
        diskEl.style.width = (34 + size * 16) + "px";
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
    var optimal = Math.pow(2, diskCount) - 1;

    var key = bestMovesKey(currentLevel);
    var prevBest = parseInt(localStorage.getItem(key), 10);
    var isNewBest = isNaN(prevBest) || moveCount < prevBest;
    if (isNewBest) localStorage.setItem(key, String(moveCount));
    showBest();

    var isOptimal = moveCount === optimal;
    overlayTitleEl.textContent = isOptimal ? "🌟 최소 횟수로 완성!" : "🎉 완성했어요!";
    overlayDescEl.textContent =
      LEVELS[currentLevel].label + "를 " + moveCount + "번 만에, " + formatTime(elapsed) + "만에 다 옮겼어요!" +
      (isOptimal ? " 최소 이동 횟수(" + optimal + "회)로 풀었어요!" : isNewBest ? " 🎉 신기록!" : "");
    overlayEl.hidden = false;
  }

  function newGame(level) {
    currentLevel = level;
    diskCount = LEVELS[level].disks;
    LEVEL_ORDER.forEach(function (key) {
      tabs[key].classList.toggle("active", key === level);
    });

    initPegs(diskCount);
    selectedPeg = null;
    moveCount = 0;
    isSolved = false;
    movesEl.textContent = "0";
    minMovesEl.textContent = String(Math.pow(2, diskCount) - 1);
    hintEl.textContent = DEFAULT_HINT;
    overlayEl.hidden = true;
    showBest();
    startTimer();
    renderBoard();
  }

  LEVEL_ORDER.forEach(function (level) {
    tabs[level].addEventListener("click", function () {
      if (isSolved) return;
      newGame(level);
    });
  });

  restartBtn.addEventListener("click", function () {
    newGame(currentLevel);
  });

  retryBtn.addEventListener("click", function () {
    newGame(currentLevel);
  });

  newGame("easy");
})();
