// 도감 게임 기회로 들어오는 두 번째 보너스 게임. 완전한 답을 랜덤 백트래킹으로
// 만든 뒤 칸을 지워 문제를 낸다(유일해 검증은 하지 않는 캐주얼 버전) - 빈칸을
// 다 채우고 규칙 위반이 없으면 그 자체로 정답으로 인정한다.
(function () {
  "use strict";

  // 예전 easy/medium/hard 문자열 키를 그대로 최고기록 키에 쓴다 - 이미 쌓인
  // 아이들의 실제 최고기록을 안 날리려고, 레벨 번호(1/2/3)는 화면 표시에만 쓴다.
  var LEVEL_KEYS = ["easy", "medium", "hard"];
  var LEVELS = [
    { label: "쉬움", givens: 38 },
    { label: "보통", givens: 30 },
    { label: "어려움", givens: 24 }
  ];
  var LEVEL_COUNT = LEVELS.length;

  var creditsEl = document.getElementById("sudokuCredits");
  var bestEl = document.getElementById("sudokuBest");
  var timerEl = document.getElementById("sudokuTimer");
  var conflictsEl = document.getElementById("sudokuConflicts");
  var boardEl = document.getElementById("sudokuBoard");
  var numpadEl = document.getElementById("sudokuNumpad");

  var overlayEl = document.getElementById("sudokuOverlay");
  var overlayDescEl = document.getElementById("sudokuOverlayDesc");
  var overlayNoteEl = document.getElementById("sudokuOverlayNote");
  var nextBtn = document.getElementById("sudokuNextBtn");
  var retryBtn = document.getElementById("sudokuRetryBtn");

  var levelNumEl = document.getElementById("sudokuLevelNum");
  var levelTotalEl = document.getElementById("sudokuLevelTotal");
  var levelSelectEl = document.getElementById("sudokuLevelSelect");

  var currentLevel = 1;
  var userGrid = [];
  var fixed = [];
  var selected = null;
  var isSolved = false;
  var startTime = 0;
  var timerId = null;

  function childKeyPart() {
    var childId = typeof ChildStore !== "undefined" && ChildStore.getActive();
    return childId ? childId + "_" : "guest_";
  }

  function unlockedLevelKey() {
    return "haingSudokuUnlockedLevel_" + childKeyPart();
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

  function bestTimeKey(level) {
    return "haingSudokuBest_" + childKeyPart() + LEVEL_KEYS[level - 1];
  }

  // 잠긴 레벨은 셀렉트에 아예 안 보이게 - 이미 깬(해금된) 레벨 중에서만
  // 고를 수 있다.
  function renderLevelChoice() {
    var unlocked = getUnlockedLevel();
    levelSelectEl.innerHTML = "";
    for (var level = 1; level <= unlocked; level++) {
      var opt = document.createElement("option");
      opt.value = String(level);
      opt.textContent = "레벨 " + level + " · " + LEVELS[level - 1].label;
      levelSelectEl.appendChild(opt);
    }
    levelSelectEl.value = String(currentLevel);
  }

  function formatTime(totalSeconds) {
    var m = Math.floor(totalSeconds / 60);
    var s = totalSeconds % 60;
    return m + ":" + (s < 10 ? "0" : "") + s;
  }

  function showBestTime() {
    var raw = localStorage.getItem(bestTimeKey(currentLevel));
    bestEl.textContent = raw ? formatTime(parseInt(raw, 10)) : "-";
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

  function clone2D(grid) {
    return grid.map(function (row) {
      return row.slice();
    });
  }

  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  function isSafe(grid, r, c, n) {
    for (var i = 0; i < 9; i++) {
      if (grid[r][i] === n || grid[i][c] === n) return false;
    }
    var boxR = Math.floor(r / 3) * 3;
    var boxC = Math.floor(c / 3) * 3;
    for (var dr = 0; dr < 3; dr++) {
      for (var dc = 0; dc < 3; dc++) {
        if (grid[boxR + dr][boxC + dc] === n) return false;
      }
    }
    return true;
  }

  function findEmpty(grid) {
    for (var r = 0; r < 9; r++) {
      for (var c = 0; c < 9; c++) {
        if (grid[r][c] === 0) return [r, c];
      }
    }
    return null;
  }

  function fillGrid(grid) {
    var pos = findEmpty(grid);
    if (!pos) return true;
    var r = pos[0];
    var c = pos[1];
    var nums = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    for (var i = 0; i < nums.length; i++) {
      var n = nums[i];
      if (isSafe(grid, r, c, n)) {
        grid[r][c] = n;
        if (fillGrid(grid)) return true;
        grid[r][c] = 0;
      }
    }
    return false;
  }

  function generateSolution() {
    var grid = [];
    for (var r = 0; r < 9; r++) grid.push(new Array(9).fill(0));
    fillGrid(grid);
    return grid;
  }

  function makePuzzle(solution, givens) {
    var puzzle = clone2D(solution);
    var cells = [];
    for (var r = 0; r < 9; r++) {
      for (var c = 0; c < 9; c++) cells.push([r, c]);
    }
    shuffle(cells);
    var toRemove = 81 - givens;
    for (var i = 0; i < toRemove; i++) {
      puzzle[cells[i][0]][cells[i][1]] = 0;
    }
    return puzzle;
  }

  function computeConflicts() {
    var conflict = [];
    for (var r = 0; r < 9; r++) conflict.push(new Array(9).fill(false));

    for (var r1 = 0; r1 < 9; r1++) {
      var seenRow = {};
      for (var c1 = 0; c1 < 9; c1++) {
        var v = userGrid[r1][c1];
        if (!v) continue;
        if (seenRow[v] !== undefined) {
          conflict[r1][c1] = true;
          conflict[r1][seenRow[v]] = true;
        } else {
          seenRow[v] = c1;
        }
      }
    }
    for (var c2 = 0; c2 < 9; c2++) {
      var seenCol = {};
      for (var r2 = 0; r2 < 9; r2++) {
        var v2 = userGrid[r2][c2];
        if (!v2) continue;
        if (seenCol[v2] !== undefined) {
          conflict[r2][c2] = true;
          conflict[seenCol[v2]][c2] = true;
        } else {
          seenCol[v2] = r2;
        }
      }
    }
    for (var br = 0; br < 3; br++) {
      for (var bc = 0; bc < 3; bc++) {
        var seenBox = {};
        for (var dr = 0; dr < 3; dr++) {
          for (var dc = 0; dc < 3; dc++) {
            var r3 = br * 3 + dr;
            var c3 = bc * 3 + dc;
            var v3 = userGrid[r3][c3];
            if (!v3) continue;
            if (seenBox[v3]) {
              conflict[r3][c3] = true;
              conflict[seenBox[v3][0]][seenBox[v3][1]] = true;
            } else {
              seenBox[v3] = [r3, c3];
            }
          }
        }
      }
    }
    return conflict;
  }

  function renderBoard() {
    var conflict = computeConflicts();
    var conflictCount = 0;
    for (var i = 0; i < 9; i++) {
      for (var j = 0; j < 9; j++) {
        if (conflict[i][j]) conflictCount++;
      }
    }
    conflictsEl.textContent = String(conflictCount);

    var selectedValue = selected ? userGrid[selected[0]][selected[1]] : 0;

    boardEl.innerHTML = "";
    for (var r = 0; r < 9; r++) {
      for (var c = 0; c < 9; c++) {
        var btn = document.createElement("button");
        btn.type = "button";
        var value = userGrid[r][c];
        btn.textContent = value ? String(value) : "";

        var classes = ["sudoku-cell"];
        if (fixed[r][c]) classes.push("given");
        if (selected) {
          var sr = selected[0];
          var sc = selected[1];
          if (sr === r && sc === c) {
            classes.push("selected");
          } else if (sr === r || sc === c || (Math.floor(sr / 3) === Math.floor(r / 3) && Math.floor(sc / 3) === Math.floor(c / 3))) {
            classes.push("peer");
          }
          if (selectedValue && value === selectedValue && !(sr === r && sc === c)) {
            classes.push("same-value");
          }
        }
        if (conflict[r][c]) classes.push("conflict");
        if (c % 3 === 2 && c !== 8) classes.push("box-right");
        if (r % 3 === 2 && r !== 8) classes.push("box-bottom");

        btn.className = classes.join(" ");
        (function (rr, cc) {
          btn.addEventListener("click", function () {
            selectCell(rr, cc);
          });
        })(r, c);
        boardEl.appendChild(btn);
      }
    }

    return conflictCount;
  }

  function selectCell(r, c) {
    if (isSolved) return;
    selected = [r, c];
    renderBoard();
  }

  function checkWin() {
    for (var r = 0; r < 9; r++) {
      for (var c = 0; c < 9; c++) {
        if (userGrid[r][c] === 0) return false;
      }
    }
    var conflict = computeConflicts();
    for (var i = 0; i < 9; i++) {
      for (var j = 0; j < 9; j++) {
        if (conflict[i][j]) return false;
      }
    }
    return true;
  }

  function setValue(n) {
    if (isSolved || !selected) return;
    var r = selected[0];
    var c = selected[1];
    if (fixed[r][c]) return;
    userGrid[r][c] = n;
    renderBoard();
    if (checkWin()) onWin();
  }

  function onWin() {
    isSolved = true;
    stopTimer();
    var elapsed = Math.floor((Date.now() - startTime) / 1000);
    var key = bestTimeKey(currentLevel);
    var prevBest = parseInt(localStorage.getItem(key), 10);
    var isNewBest = isNaN(prevBest) || elapsed < prevBest;
    if (isNewBest) localStorage.setItem(key, String(elapsed));
    showBestTime();

    var isFinalLevel = currentLevel === LEVEL_COUNT;
    if (currentLevel === getUnlockedLevel() && !isFinalLevel) unlockLevel(currentLevel + 1);
    renderLevelChoice();

    var creditsLeft = typeof WordGameStore !== "undefined" ? WordGameStore.getCredits("sudoku") : 0;
    overlayDescEl.textContent =
      LEVELS[currentLevel - 1].label + " 스도쿠를 " + formatTime(elapsed) + "만에 다 풀었어요!" + (isNewBest ? " 🎉 신기록!" : "");
    nextBtn.hidden = isFinalLevel;
    retryBtn.hidden = creditsLeft <= 0;
    overlayNoteEl.hidden = creditsLeft > 0;
    overlayEl.hidden = false;
  }

  function newGame(level) {
    currentLevel = level;
    levelNumEl.textContent = String(level);
    renderLevelChoice();

    var solution = generateSolution();
    var puzzle = makePuzzle(solution, LEVELS[level - 1].givens);
    userGrid = clone2D(puzzle);
    fixed = puzzle.map(function (row) {
      return row.map(function (v) {
        return v !== 0;
      });
    });
    selected = null;
    isSolved = false;
    overlayEl.hidden = true;
    showBestTime();
    startTimer();
    renderBoard();
  }

  // 레벨을 바꾸는 것 자체는 기회를 안 쓴다(예전 탭 전환도 무료였다) - 기회는
  // "다시 하기"로 같은 레벨에서 새 퍼즐을 받을 때만 쓴다.
  levelSelectEl.addEventListener("change", function () {
    if (isSolved) return;
    newGame(parseInt(levelSelectEl.value, 10));
  });

  nextBtn.addEventListener("click", function () {
    newGame(Math.min(currentLevel + 1, LEVEL_COUNT));
  });

  numpadEl.addEventListener("click", function (e) {
    var btn = e.target.closest ? e.target.closest(".sudoku-num-btn") : null;
    if (!btn) return;
    setValue(parseInt(btn.dataset.num, 10));
  });

  document.addEventListener("keydown", function (e) {
    if (isSolved) return;
    if (e.key >= "1" && e.key <= "9") {
      setValue(parseInt(e.key, 10));
      return;
    }
    if (e.key === "Backspace" || e.key === "Delete" || e.key === "0") {
      setValue(0);
      return;
    }
    if (!selected) return;
    var r = selected[0];
    var c = selected[1];
    if (e.key === "ArrowUp") { selectCell(Math.max(0, r - 1), c); e.preventDefault(); }
    else if (e.key === "ArrowDown") { selectCell(Math.min(8, r + 1), c); e.preventDefault(); }
    else if (e.key === "ArrowLeft") { selectCell(r, Math.max(0, c - 1)); e.preventDefault(); }
    else if (e.key === "ArrowRight") { selectCell(r, Math.min(8, c + 1)); e.preventDefault(); }
  });

  retryBtn.addEventListener("click", function () {
    if (typeof WordGameStore === "undefined" || !WordGameStore.spendCredit("sudoku")) return;
    creditsEl.textContent = WordGameStore.getCreditsLabel("sudoku");
    newGame(currentLevel);
  });

  creditsEl.textContent = typeof WordGameStore !== "undefined" ? WordGameStore.getCreditsLabel("sudoku") : "0";
  levelTotalEl.textContent = String(LEVEL_COUNT);
  newGame(getUnlockedLevel());
})();
