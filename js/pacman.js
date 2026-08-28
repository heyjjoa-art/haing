// 도감 게임칸에서 들어오는 간단한 팩맨. 매판 랜덤 미로(recursive backtracker)
// 위에 콩을 깔고, 유령이 확률적으로 플레이어를 쫓아온다. 관리자 계정에서만
// 테스트하는 개발 중 게임이라 WordGameStore(게임 기회) 연동은 아직 하지 않는다.
(function () {
  "use strict";

  var BOARD_PX = 320;
  var GHOST_COLORS = ["#ff6b6b", "#ff9fe0", "#6bd9ff", "#ffb454"];

  var LEVELS = [
    { label: "쉬움", size: 7, ghosts: 1, interval: 480, chase: 0.4 },
    { label: "보통", size: 7, ghosts: 2, interval: 400, chase: 0.55 },
    { label: "어려움", size: 8, ghosts: 3, interval: 320, chase: 0.7 }
  ];
  var LEVEL_COUNT = LEVELS.length;

  var levelNumEl = document.getElementById("pacLevelNum");
  var levelTotalEl = document.getElementById("pacLevelTotal");
  var levelSelectEl = document.getElementById("pacLevelSelect");
  var currentLevel = 1;

  var boardCanvas = document.getElementById("pacBoard");
  var boardCtx = boardCanvas.getContext("2d");
  var pauseVeilEl = document.getElementById("pacPauseVeil");
  var pauseBtn = document.getElementById("pacPauseBtn");
  var scoreEl = document.getElementById("pacScore");
  var livesEl = document.getElementById("pacLives");
  var bestEl = document.getElementById("pacBest");

  var overlayEl = document.getElementById("pacOverlay");
  var overlayTitleEl = document.getElementById("pacOverlayTitle");
  var overlayScoreEl = document.getElementById("pacOverlayScore");
  var nextBtn = document.getElementById("pacNextBtn");
  var retryBtn = document.getElementById("pacRetryBtn");

  var upBtn = document.getElementById("pacUpBtn");
  var downBtn = document.getElementById("pacDownBtn");
  var leftBtn = document.getElementById("pacLeftBtn");
  var rightBtn = document.getElementById("pacRightBtn");

  var DIRS = {
    N: { dx: 0, dy: -1, opposite: "S" },
    S: { dx: 0, dy: 1, opposite: "N" },
    E: { dx: 1, dy: 0, opposite: "W" },
    W: { dx: -1, dy: 0, opposite: "E" }
  };
  var DIR_KEYS = Object.keys(DIRS);
  var FACING_ANGLE = { E: 0, S: Math.PI / 2, W: Math.PI, N: -Math.PI / 2 };
  var MOUTH_RAD = 0.28 * 0.8 * Math.PI;

  var size = 7;
  var cells = [];
  var dotEaten = [];
  var dotsLeft = 0;
  var player = { x: 0, y: 0, dir: "E" };
  var ghosts = [];
  var score = 0;
  var lives = 3;
  var paused = false;
  var isGameOver = false;
  var ghostTimerId = null;

  function childKeyPart() {
    var childId = typeof ChildStore !== "undefined" && ChildStore.getActive();
    return childId ? childId + "_" : "guest_";
  }

  function unlockedLevelKey() {
    return "haingPacmanUnlockedLevel_" + childKeyPart();
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

  // 잠긴 레벨은 셀렉트에 아예 안 보이게 - 이미 깬(해금된) 레벨 중에서만 고를 수 있다.
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

  function bestScoreKey() {
    return "haingPacmanBest_" + childKeyPart() + currentLevel;
  }

  var bestScore = 0;

  function showBestScore() {
    bestScore = parseInt(localStorage.getItem(bestScoreKey()), 10) || 0;
    bestEl.textContent = String(bestScore);
  }

  function updateStatsUI() {
    scoreEl.textContent = String(score);
    livesEl.textContent = String(lives);
    if (score > bestScore) {
      bestScore = score;
      localStorage.setItem(bestScoreKey(), String(bestScore));
    }
    bestEl.textContent = String(bestScore);
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
      DIR_KEYS.forEach(function (dir) {
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

  function placeDots() {
    dotEaten = [];
    for (var x = 0; x < size; x++) {
      var col = [];
      for (var y = 0; y < size; y++) col.push(x === 0 && y === 0);
      dotEaten.push(col);
    }
    dotsLeft = size * size - 1;
  }

  function ghostHomes(count) {
    var corners = [
      { x: size - 1, y: size - 1 },
      { x: 0, y: size - 1 },
      { x: size - 1, y: 0 }
    ];
    return corners.slice(0, count);
  }

  function resetPositions() {
    player = { x: 0, y: 0, dir: "E" };
    var conf = LEVELS[currentLevel - 1];
    ghosts = ghostHomes(conf.ghosts).map(function (home, i) {
      return { x: home.x, y: home.y, color: GHOST_COLORS[i % GHOST_COLORS.length], dir: null };
    });
  }

  function neighborsOf(x, y) {
    var cell = cells[x][y];
    var list = [];
    DIR_KEYS.forEach(function (dir) {
      if (!cell.open[dir]) return;
      var d = DIRS[dir];
      list.push({ dir: dir, x: x + d.dx, y: y + d.dy });
    });
    return list;
  }

  function moveGhost(ghost) {
    var options = neighborsOf(ghost.x, ghost.y);
    if (options.length === 0) return;

    var filtered = options;
    if (ghost.dir) {
      var noReverse = options.filter(function (o) {
        return o.dir !== DIRS[ghost.dir].opposite;
      });
      if (noReverse.length > 0) filtered = noReverse;
    }

    var conf = LEVELS[currentLevel - 1];
    var choice;
    if (Math.random() < conf.chase) {
      filtered.sort(function (a, b) {
        var da = Math.abs(a.x - player.x) + Math.abs(a.y - player.y);
        var db = Math.abs(b.x - player.x) + Math.abs(b.y - player.y);
        return da - db;
      });
      choice = filtered[0];
    } else {
      choice = filtered[Math.floor(Math.random() * filtered.length)];
    }

    ghost.dir = choice.dir;
    ghost.x = choice.x;
    ghost.y = choice.y;
  }

  function checkCollisions() {
    var caught = ghosts.some(function (g) {
      return g.x === player.x && g.y === player.y;
    });
    if (!caught) return;
    lives--;
    updateStatsUI();
    if (lives <= 0) {
      gameOver(false);
    } else {
      resetPositions();
    }
  }

  function gameOver(won) {
    isGameOver = true;
    stopGhostTimer();
    var isNewBest = score > 0 && score >= bestScore;

    var isFinalLevel = currentLevel === LEVEL_COUNT;
    var justUnlockedNext = won && currentLevel === getUnlockedLevel() && !isFinalLevel;
    if (justUnlockedNext) unlockLevel(currentLevel + 1);
    renderLevelChoice();

    overlayTitleEl.textContent = won ? "🎉 클리어!" : "게임 오버!";
    overlayScoreEl.textContent =
      LEVELS[currentLevel - 1].label + " · 점수 " + score + (isNewBest ? " 🎉 신기록!" : "") +
      (justUnlockedNext ? " · 다음 레벨이 열렸어요!" : "");
    nextBtn.hidden = !(won && !isFinalLevel);
    overlayEl.hidden = false;
    draw();
  }

  function setPaused(next) {
    if (isGameOver) return;
    paused = next;
    pauseVeilEl.hidden = !paused;
    pauseBtn.textContent = paused ? "▶" : "⏸";
  }

  function tryMove(dir) {
    if (paused || isGameOver) return;
    var cell = cells[player.x][player.y];
    if (!cell.open[dir]) return;
    var d = DIRS[dir];
    player.x += d.dx;
    player.y += d.dy;
    player.dir = dir;

    if (!dotEaten[player.x][player.y]) {
      dotEaten[player.x][player.y] = true;
      dotsLeft--;
      score += 10;
      updateStatsUI();
      if (dotsLeft <= 0) {
        gameOver(true);
        return;
      }
    }

    checkCollisions();
    draw();
  }

  function stopGhostTimer() {
    if (ghostTimerId) {
      clearInterval(ghostTimerId);
      ghostTimerId = null;
    }
  }

  function startGhostTimer() {
    stopGhostTimer();
    var conf = LEVELS[currentLevel - 1];
    ghostTimerId = setInterval(function () {
      if (paused || isGameOver) return;
      ghosts.forEach(moveGhost);
      checkCollisions();
      draw();
    }, conf.interval);
  }

  function draw() {
    var tile = BOARD_PX / size;
    boardCtx.clearRect(0, 0, BOARD_PX, BOARD_PX);
    boardCtx.fillStyle = "#0d0d1a";
    boardCtx.fillRect(0, 0, BOARD_PX, BOARD_PX);

    var wallW = Math.max(2, tile * 0.09);
    boardCtx.strokeStyle = "#2f5fd6";
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
        if (!dotEaten[x][y]) {
          boardCtx.beginPath();
          boardCtx.arc(px + tile / 2, py + tile / 2, Math.max(2, tile * 0.09), 0, Math.PI * 2);
          boardCtx.fillStyle = "#ffe066";
          boardCtx.fill();
        }
      }
    }

    ghosts.forEach(function (g) {
      boardCtx.beginPath();
      boardCtx.arc(g.x * tile + tile / 2, g.y * tile + tile / 2, tile * 0.32, 0, Math.PI * 2);
      boardCtx.fillStyle = g.color;
      boardCtx.fill();
    });

    var pcx = player.x * tile + tile / 2;
    var pcy = player.y * tile + tile / 2;
    var facing = FACING_ANGLE[player.dir] || 0;
    boardCtx.beginPath();
    boardCtx.moveTo(pcx, pcy);
    boardCtx.arc(pcx, pcy, tile * 0.36, facing + MOUTH_RAD, facing - MOUTH_RAD + Math.PI * 2, false);
    boardCtx.closePath();
    boardCtx.fillStyle = "#ffd93d";
    boardCtx.fill();
  }

  function newGame(level) {
    currentLevel = level;
    levelNumEl.textContent = String(level);
    renderLevelChoice();

    size = LEVELS[currentLevel - 1].size;
    generateMaze();
    placeDots();
    score = 0;
    lives = 3;
    isGameOver = false;
    paused = false;
    pauseVeilEl.hidden = true;
    pauseBtn.textContent = "⏸";
    overlayEl.hidden = true;
    resetPositions();
    showBestScore();
    updateStatsUI();
    draw();
    startGhostTimer();
  }

  levelSelectEl.addEventListener("change", function () {
    newGame(parseInt(levelSelectEl.value, 10));
  });

  GameUI.bindHold(upBtn, function () { tryMove("N"); });
  GameUI.bindHold(downBtn, function () { tryMove("S"); });
  GameUI.bindHold(leftBtn, function () { tryMove("W"); });
  GameUI.bindHold(rightBtn, function () { tryMove("E"); });
  pauseBtn.addEventListener("click", function () {
    setPaused(!paused);
  });

  document.addEventListener("keydown", function (e) {
    if (isGameOver) return;
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
      case " ":
        setPaused(!paused);
        e.preventDefault();
        break;
    }
  });

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) setPaused(true);
  });

  retryBtn.addEventListener("click", function () {
    newGame(currentLevel);
  });
  nextBtn.addEventListener("click", function () {
    newGame(Math.min(currentLevel + 1, LEVEL_COUNT));
  });

  levelTotalEl.textContent = String(LEVEL_COUNT);
  newGame(getUnlockedLevel());
})();
