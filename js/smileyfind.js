// "해피 찾기" - 지뢰찾기 규칙을 그대로 쓰되, 지뢰 대신 스마일 아이콘을 숨겨서
// 아이들에게 무섭지 않은 테마로 바꾼 버전이다. 관리자 계정에서만 테스트하는
// 개발 중 게임이라 WordGameStore(게임 기회) 연동은 아직 하지 않는다.
(function () {
  "use strict";

  var DIFFICULTIES = {
    easy: { label: "쉬운 단계", rows: 8, cols: 8, smileys: 10 },
    medium: { label: "중간 단계", rows: 10, cols: 10, smileys: 16 },
    hard: { label: "어려운 단계", rows: 12, cols: 12, smileys: 24 }
  };
  var DIFFICULTY_ORDER = ["easy", "medium", "hard"];
  var difficultyTabs = {
    easy: document.getElementById("sfEasyTab"),
    medium: document.getElementById("sfMediumTab"),
    hard: document.getElementById("sfHardTab")
  };
  var currentDifficulty = "easy";

  var boardEl = document.getElementById("sfBoard");
  var remainingEl = document.getElementById("sfRemaining");
  var timerEl = document.getElementById("sfTimer");
  var bestEl = document.getElementById("sfBest");
  var overlayEl = document.getElementById("sfOverlay");
  var overlayTitleEl = document.getElementById("sfOverlayTitle");
  var overlayDescEl = document.getElementById("sfOverlayDesc");
  var retryBtn = document.getElementById("sfRetryBtn");
  var revealModeBtn = document.getElementById("sfRevealModeBtn");
  var flagModeBtn = document.getElementById("sfFlagModeBtn");

  var rows = 0;
  var cols = 0;
  var grid = [];
  var cellEls = [];
  var mode = "reveal"; // "reveal" | "flag"
  var started = false;
  var over = false;
  var placed = false;
  var revealedSafeCount = 0;
  var startTime = 0;
  var timerId = null;

  function emptyGrid(r, c) {
    var g = [];
    for (var i = 0; i < r; i++) {
      var row = [];
      for (var j = 0; j < c; j++) {
        row.push({ smiley: false, count: 0, revealed: false, flagged: false });
      }
      g.push(row);
    }
    return g;
  }

  function forEachNeighbor(r, c, fn) {
    for (var dr = -1; dr <= 1; dr++) {
      for (var dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        var nr = r + dr;
        var nc = c + dc;
        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) fn(nr, nc);
      }
    }
  }

  // 첫 클릭 칸과 그 주변 8칸은 스마일을 피해서 배치한다 - 첫 클릭에 바로
  // 지는 일이 없게, 그리고 처음부터 어느 정도 빈 칸이 열리게 해준다.
  function placeSmileys(safeR, safeC) {
    var safe = {};
    safe[safeR + "_" + safeC] = true;
    forEachNeighbor(safeR, safeC, function (nr, nc) {
      safe[nr + "_" + nc] = true;
    });

    var candidates = [];
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        if (!safe[r + "_" + c]) candidates.push([r, c]);
      }
    }
    for (var i = candidates.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = candidates[i];
      candidates[i] = candidates[j];
      candidates[j] = tmp;
    }

    var count = Math.min(DIFFICULTIES[currentDifficulty].smileys, candidates.length);
    for (var k = 0; k < count; k++) {
      var pos = candidates[k];
      grid[pos[0]][pos[1]].smiley = true;
    }

    for (var r2 = 0; r2 < rows; r2++) {
      for (var c2 = 0; c2 < cols; c2++) {
        if (grid[r2][c2].smiley) continue;
        var n = 0;
        forEachNeighbor(r2, c2, function (nr, nc) {
          if (grid[nr][nc].smiley) n++;
        });
        grid[r2][c2].count = n;
      }
    }
    placed = true;
  }

  function totalSafeCells() {
    return rows * cols - DIFFICULTIES[currentDifficulty].smileys;
  }

  function formatTime(ms) {
    var totalSec = Math.floor(ms / 1000);
    var m = Math.floor(totalSec / 60);
    var s = totalSec % 60;
    return m + ":" + (s < 10 ? "0" : "") + s;
  }

  function startTimer() {
    startTime = Date.now();
    if (timerId) clearInterval(timerId);
    timerId = setInterval(function () {
      timerEl.textContent = formatTime(Date.now() - startTime);
    }, 1000);
  }

  function stopTimer() {
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }
  }

  function bestTimeKey() {
    var childId = typeof ChildStore !== "undefined" && ChildStore.getActive();
    return "haingSmileyBest_" + (childId ? childId + "_" : "guest_") + currentDifficulty;
  }

  function showBestTime() {
    var saved = parseInt(localStorage.getItem(bestTimeKey()), 10);
    bestEl.textContent = saved ? formatTime(saved) : "-";
  }

  function maybeSaveBestTime(elapsedMs) {
    var key = bestTimeKey();
    var saved = parseInt(localStorage.getItem(key), 10);
    if (!saved || elapsedMs < saved) {
      localStorage.setItem(key, String(elapsedMs));
    }
    showBestTime();
  }

  function updateRemaining() {
    var flaggedCount = 0;
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        if (grid[r][c].flagged) flaggedCount++;
      }
    }
    remainingEl.textContent = String(Math.max(0, DIFFICULTIES[currentDifficulty].smileys - flaggedCount));
  }

  function renderCell(r, c) {
    var cell = grid[r][c];
    var el = cellEls[r][c];
    el.classList.toggle("revealed", cell.revealed);
    el.classList.toggle("flagged", !cell.revealed && cell.flagged);
    el.classList.toggle("smiley", cell.revealed && cell.smiley);
    el.classList.toggle("wrong-flag", over && cell.flagged && !cell.smiley);

    if (cell.revealed) {
      if (cell.smiley) {
        el.textContent = "🙂";
        el.removeAttribute("data-count");
      } else {
        el.textContent = cell.count > 0 ? String(cell.count) : "";
        el.setAttribute("data-count", String(cell.count));
      }
    } else if (cell.flagged) {
      el.textContent = "🚩";
      el.removeAttribute("data-count");
    } else if (over && cell.smiley) {
      el.textContent = "🙂";
      el.removeAttribute("data-count");
    } else {
      el.textContent = "";
      el.removeAttribute("data-count");
    }
  }

  function revealFlood(r, c) {
    var stack = [[r, c]];
    while (stack.length > 0) {
      var pos = stack.pop();
      var pr = pos[0];
      var pc = pos[1];
      var cell = grid[pr][pc];
      if (cell.revealed || cell.flagged) continue;
      cell.revealed = true;
      revealedSafeCount++;
      renderCell(pr, pc);
      if (cell.count === 0) {
        forEachNeighbor(pr, pc, function (nr, nc) {
          if (!grid[nr][nc].revealed && !grid[nr][nc].smiley) stack.push([nr, nc]);
        });
      }
    }
  }

  function revealAllSmileys() {
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        if (grid[r][c].smiley) renderCell(r, c);
        else if (grid[r][c].flagged && !grid[r][c].smiley) renderCell(r, c);
      }
    }
  }

  function endGame(won) {
    over = true;
    stopTimer();
    var elapsed = Date.now() - startTime;
    revealAllSmileys();
    if (won) {
      maybeSaveBestTime(elapsed);
      overlayTitleEl.textContent = "🎉 모두 찾았어요!";
      overlayDescEl.textContent = DIFFICULTIES[currentDifficulty].label + " · 시간 " + formatTime(elapsed);
    } else {
      overlayTitleEl.textContent = "앗! 스마일을 밟았어요";
      overlayDescEl.textContent = DIFFICULTIES[currentDifficulty].label + " · 시간 " + formatTime(elapsed);
    }
    overlayEl.hidden = false;
  }

  function handleReveal(r, c) {
    var cell = grid[r][c];
    if (cell.revealed || cell.flagged) return;

    if (!started) {
      started = true;
      if (!placed) placeSmileys(r, c);
      startTimer();
    }

    if (cell.smiley) {
      cell.revealed = true;
      renderCell(r, c);
      endGame(false);
      return;
    }

    revealFlood(r, c);
    updateRemaining();
    if (revealedSafeCount >= totalSafeCells()) {
      endGame(true);
    }
  }

  function handleFlagToggle(r, c) {
    var cell = grid[r][c];
    if (cell.revealed) return;
    if (!started) {
      started = true;
      if (!placed) placeSmileys(r, c);
      startTimer();
    }
    cell.flagged = !cell.flagged;
    renderCell(r, c);
    updateRemaining();
  }

  function onCellActivate(r, c) {
    if (over) return;
    if (mode === "flag") {
      handleFlagToggle(r, c);
    } else {
      handleReveal(r, c);
    }
  }

  function buildBoardDom() {
    boardEl.innerHTML = "";
    boardEl.style.gridTemplateColumns = "repeat(" + cols + ", 1fr)";
    boardEl.style.maxWidth = Math.min(360, cols * 32) + "px";
    cellEls = [];
    for (var r = 0; r < rows; r++) {
      var rowEls = [];
      for (var c = 0; c < cols; c++) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "sf-cell";
        (function (rr, cc) {
          btn.addEventListener("click", function () {
            onCellActivate(rr, cc);
          });
        })(r, c);
        boardEl.appendChild(btn);
        rowEls.push(btn);
      }
      cellEls.push(rowEls);
    }
  }

  function resetGame() {
    var conf = DIFFICULTIES[currentDifficulty];
    rows = conf.rows;
    cols = conf.cols;
    grid = emptyGrid(rows, cols);
    placed = false;
    started = false;
    over = false;
    revealedSafeCount = 0;
    stopTimer();
    timerEl.textContent = "0:00";
    overlayEl.hidden = true;
    showBestTime();
    buildBoardDom();
    updateRemaining();
  }

  function setDifficulty(key) {
    currentDifficulty = key;
    DIFFICULTY_ORDER.forEach(function (k) {
      difficultyTabs[k].classList.toggle("active", k === key);
    });
    resetGame();
  }

  function setMode(next) {
    mode = next;
    revealModeBtn.classList.toggle("active", mode === "reveal");
    flagModeBtn.classList.toggle("active", mode === "flag");
  }

  DIFFICULTY_ORDER.forEach(function (key) {
    difficultyTabs[key].addEventListener("click", function () {
      setDifficulty(key);
    });
  });

  revealModeBtn.addEventListener("click", function () {
    setMode("reveal");
  });
  flagModeBtn.addEventListener("click", function () {
    setMode("flag");
  });

  retryBtn.addEventListener("click", function () {
    resetGame();
  });

  document.addEventListener("visibilitychange", function () {
    if (document.hidden && started && !over) stopTimer();
    else if (!document.hidden && started && !over) startTimer();
  });

  resetGame();
})();
