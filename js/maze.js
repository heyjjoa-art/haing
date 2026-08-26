// 도감 게임칸에서 들어오는 미로찾기. 매판 새 미로를 랜덤 생성한다(recursive
// backtracker). 관리자 계정에서만 테스트하는 개발 중 게임이라 WordGameStore
// (게임 기회) 연동은 아직 하지 않는다.
(function () {
  "use strict";

  var BOARD_PX = 320;

  var DIFFICULTIES = {
    easy: { label: "쉬움", size: 6 },
    normal: { label: "보통", size: 9 },
    hard: { label: "어려움", size: 12 }
  };
  var DIFFICULTY_ORDER = ["easy", "normal", "hard"];
  var difficultyTabs = {
    easy: document.getElementById("mazeEasyTab"),
    normal: document.getElementById("mazeNormalTab"),
    hard: document.getElementById("mazeHardTab")
  };
  var currentDifficulty = "easy";

  var boardCanvas = document.getElementById("mazeBoard");
  var boardCtx = boardCanvas.getContext("2d");
  var timerEl = document.getElementById("mazeTimer");
  var bestEl = document.getElementById("mazeBest");

  var overlayEl = document.getElementById("mazeOverlay");
  var overlayScoreEl = document.getElementById("mazeOverlayScore");
  var retryBtn = document.getElementById("mazeRetryBtn");

  var upBtn = document.getElementById("mazeUpBtn");
  var downBtn = document.getElementById("mazeDownBtn");
  var leftBtn = document.getElementById("mazeLeftBtn");
  var rightBtn = document.getElementById("mazeRightBtn");

  var DIRS = {
    N: { dx: 0, dy: -1, opposite: "S" },
    S: { dx: 0, dy: 1, opposite: "N" },
    E: { dx: 1, dy: 0, opposite: "W" },
    W: { dx: -1, dy: 0, opposite: "E" }
  };

  var size = 6;
  var cells = [];
  var player = { x: 0, y: 0 };
  var goal = { x: 0, y: 0 };
  var isDone = false;
  var timerId = null;
  var startTime = 0;
  var elapsedMs = 0;

  function bestTimeKey() {
    var childId = typeof ChildStore !== "undefined" && ChildStore.getActive();
    return "haingMazeBest_" + (childId ? childId + "_" : "guest_") + currentDifficulty;
  }

  function formatTime(ms) {
    var totalTenths = Math.floor(ms / 100);
    var minutes = Math.floor(totalTenths / 600);
    var seconds = Math.floor((totalTenths % 600) / 10);
    var tenths = totalTenths % 10;
    return minutes + ":" + (seconds < 10 ? "0" : "") + seconds + "." + tenths;
  }

  function showBestTime() {
    var best = parseInt(localStorage.getItem(bestTimeKey()), 10);
    bestEl.textContent = best ? formatTime(best) : "-";
  }

  function makeCell(x, y) {
    return { x: x, y: y, visited: false, open: { N: false, S: false, E: false, W: false } };
  }

  function generateMaze() {
    cells = [];
    for (var x = 0; x < size; x++) {
      var col = [];
      for (var y = 0; y < size; y++) col.push(makeCell(x, y));
      cells.push(col);
    }

    var stack = [cells[0][0]];
    cells[0][0].visited = true;

    while (stack.length > 0) {
      var current = stack[stack.length - 1];
      var neighbors = [];
      Object.keys(DIRS).forEach(function (dir) {
        var d = DIRS[dir];
        var nx = current.x + d.dx;
        var ny = current.y + d.dy;
        if (nx >= 0 && nx < size && ny >= 0 && ny < size && !cells[nx][ny].visited) {
          neighbors.push({ dir: dir, cell: cells[nx][ny] });
        }
      });

      if (neighbors.length === 0) {
        stack.pop();
        continue;
      }

      var pick = neighbors[Math.floor(Math.random() * neighbors.length)];
      current.open[pick.dir] = true;
      pick.cell.open[DIRS[pick.dir].opposite] = true;
      pick.cell.visited = true;
      stack.push(pick.cell);
    }
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
    elapsedMs = 0;
    timerEl.textContent = formatTime(0);
    timerId = setInterval(function () {
      elapsedMs = Date.now() - startTime;
      timerEl.textContent = formatTime(elapsedMs);
    }, 100);
  }

  function reachGoal() {
    isDone = true;
    stopTimer();
    elapsedMs = Date.now() - startTime;
    timerEl.textContent = formatTime(elapsedMs);

    var best = parseInt(localStorage.getItem(bestTimeKey()), 10);
    var isNewBest = !best || elapsedMs < best;
    if (isNewBest) localStorage.setItem(bestTimeKey(), String(elapsedMs));
    showBestTime();

    overlayScoreEl.textContent =
      DIFFICULTIES[currentDifficulty].label + " · 기록 " + formatTime(elapsedMs) + (isNewBest ? " 🎉 신기록!" : "");
    overlayEl.hidden = false;
  }

  function draw() {
    var tile = BOARD_PX / size;
    boardCtx.clearRect(0, 0, BOARD_PX, BOARD_PX);
    boardCtx.fillStyle = "#2a2a3a";
    boardCtx.fillRect(0, 0, BOARD_PX, BOARD_PX);

    var wallW = Math.max(2, tile * 0.09);
    boardCtx.strokeStyle = "#f4f6fb";
    boardCtx.lineWidth = wallW;
    boardCtx.lineCap = "square";

    for (var x = 0; x < size; x++) {
      for (var y = 0; y < size; y++) {
        var c = cells[x][y];
        var px = x * tile;
        var py = y * tile;
        if (!c.open.N) {
          boardCtx.beginPath();
          boardCtx.moveTo(px, py);
          boardCtx.lineTo(px + tile, py);
          boardCtx.stroke();
        }
        if (!c.open.W) {
          boardCtx.beginPath();
          boardCtx.moveTo(px, py);
          boardCtx.lineTo(px, py + tile);
          boardCtx.stroke();
        }
        if (x === size - 1 && !c.open.E) {
          boardCtx.beginPath();
          boardCtx.moveTo(px + tile, py);
          boardCtx.lineTo(px + tile, py + tile);
          boardCtx.stroke();
        }
        if (y === size - 1 && !c.open.S) {
          boardCtx.beginPath();
          boardCtx.moveTo(px, py + tile);
          boardCtx.lineTo(px + tile, py + tile);
          boardCtx.stroke();
        }
      }
    }

    // 도착 지점
    boardCtx.font = Math.floor(tile * 0.7) + "px sans-serif";
    boardCtx.textAlign = "center";
    boardCtx.textBaseline = "middle";
    boardCtx.fillText("🏁", goal.x * tile + tile / 2, goal.y * tile + tile / 2);

    // 플레이어
    boardCtx.beginPath();
    boardCtx.arc(player.x * tile + tile / 2, player.y * tile + tile / 2, tile * 0.3, 0, Math.PI * 2);
    boardCtx.fillStyle = "#ffd93d";
    boardCtx.fill();
    boardCtx.strokeStyle = "#e0a72f";
    boardCtx.lineWidth = 2;
    boardCtx.stroke();
  }

  function tryMove(dir) {
    if (isDone) return;
    var cell = cells[player.x][player.y];
    if (!cell.open[dir]) return;
    var d = DIRS[dir];
    player.x += d.dx;
    player.y += d.dy;
    draw();
    if (player.x === goal.x && player.y === goal.y) reachGoal();
  }

  function resetGame() {
    size = DIFFICULTIES[currentDifficulty].size;
    generateMaze();
    player = { x: 0, y: 0 };
    goal = { x: size - 1, y: size - 1 };
    isDone = false;
    overlayEl.hidden = true;
    showBestTime();
    startTimer();
    draw();
  }

  function setDifficulty(key) {
    currentDifficulty = key;
    DIFFICULTY_ORDER.forEach(function (k) {
      difficultyTabs[k].classList.toggle("active", k === key);
    });
    resetGame();
  }

  DIFFICULTY_ORDER.forEach(function (key) {
    difficultyTabs[key].addEventListener("click", function () {
      setDifficulty(key);
    });
  });

  upBtn.addEventListener("click", function () {
    tryMove("N");
  });
  downBtn.addEventListener("click", function () {
    tryMove("S");
  });
  leftBtn.addEventListener("click", function () {
    tryMove("W");
  });
  rightBtn.addEventListener("click", function () {
    tryMove("E");
  });

  document.addEventListener("keydown", function (e) {
    switch (e.key) {
      case "ArrowLeft":
        tryMove("W");
        e.preventDefault();
        break;
      case "ArrowRight":
        tryMove("E");
        e.preventDefault();
        break;
      case "ArrowUp":
        tryMove("N");
        e.preventDefault();
        break;
      case "ArrowDown":
        tryMove("S");
        e.preventDefault();
        break;
    }
  });

  retryBtn.addEventListener("click", resetGame);

  setDifficulty("easy");
})();
