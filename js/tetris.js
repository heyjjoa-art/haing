// 도감에서 게임 기회(트로피 1장 또는 별 20개마다 3회)를 쓰고 들어오는 보너스
// 테트리스. 클래식 가이드라인 테트로미노 7종 + 7-bag 랜덤 + 간단한 벽차기만
// 구현한 캐주얼 버전이라, 정식 SRS 회전 규칙까지는 따르지 않는다.
(function () {
  "use strict";

  var COLS = 10;
  var ROWS = 20;
  var BLOCK = 28;

  var SHAPES = {
    I: [
      [0, 0, 0, 0],
      [1, 1, 1, 1],
      [0, 0, 0, 0],
      [0, 0, 0, 0]
    ],
    O: [
      [1, 1],
      [1, 1]
    ],
    T: [
      [0, 1, 0],
      [1, 1, 1],
      [0, 0, 0]
    ],
    S: [
      [0, 1, 1],
      [1, 1, 0],
      [0, 0, 0]
    ],
    Z: [
      [1, 1, 0],
      [0, 1, 1],
      [0, 0, 0]
    ],
    J: [
      [1, 0, 0],
      [1, 1, 1],
      [0, 0, 0]
    ],
    L: [
      [0, 0, 1],
      [1, 1, 1],
      [0, 0, 0]
    ]
  };

  var COLORS = {
    I: "#4fd1e8",
    O: "#ffd93d",
    T: "#c77dff",
    S: "#6bcb77",
    Z: "#ff6b6b",
    J: "#5b8def",
    L: "#ffa94d"
  };

  var LINE_SCORE = [0, 100, 300, 500, 800];

  var boardCanvas = document.getElementById("tetrisBoard");
  var boardCtx = boardCanvas.getContext("2d");
  var nextCanvas = document.getElementById("tetrisNext");
  var nextCtx = nextCanvas.getContext("2d");
  var pauseVeilEl = document.getElementById("tetrisPauseVeil");
  var pauseBtn = document.getElementById("tetrisPauseBtn");

  var scoreEl = document.getElementById("tetrisScore");
  var levelEl = document.getElementById("tetrisLevel");
  var linesEl = document.getElementById("tetrisLines");
  var creditsEl = document.getElementById("tetrisCredits");
  var bestEl = document.getElementById("tetrisBest");

  var DIFFICULTIES = {
    easy: { label: "쉬움", startLevel: 1 },
    normal: { label: "보통", startLevel: 4 },
    hard: { label: "어려움", startLevel: 8 }
  };
  var DIFFICULTY_ORDER = ["easy", "normal", "hard"];
  var difficultyTabs = {
    easy: document.getElementById("tetrisEasyTab"),
    normal: document.getElementById("tetrisNormalTab"),
    hard: document.getElementById("tetrisHardTab")
  };
  var currentDifficulty = "easy";

  var overlayEl = document.getElementById("tetrisOverlay");
  var overlayTitleEl = document.getElementById("tetrisOverlayTitle");
  var overlayScoreEl = document.getElementById("tetrisOverlayScore");
  var overlayNoteEl = document.getElementById("tetrisOverlayNote");
  var retryBtn = document.getElementById("tetrisRetryBtn");

  var leftBtn = document.getElementById("tetrisLeftBtn");
  var rightBtn = document.getElementById("tetrisRightBtn");
  var downBtn = document.getElementById("tetrisDownBtn");
  var rotateBtn = document.getElementById("tetrisRotateBtn");
  var dropBtn = document.getElementById("tetrisDropBtn");

  var board = [];
  var bag = [];
  var current = null;
  var nextType = null;
  var score = 0;
  var level = 1;
  var linesTotal = 0;
  var dropInterval = 1000;
  var dropCounter = 0;
  var lastTime = 0;
  var paused = false;
  var isGameOver = false;

  function emptyBoard() {
    var rows = [];
    for (var r = 0; r < ROWS; r++) rows.push(new Array(COLS).fill(null));
    return rows;
  }

  function cloneMatrix(matrix) {
    return matrix.map(function (row) {
      return row.slice();
    });
  }

  function nextFromBag() {
    if (bag.length === 0) {
      bag = ["I", "O", "T", "S", "Z", "J", "L"];
      for (var i = bag.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var tmp = bag[i];
        bag[i] = bag[j];
        bag[j] = tmp;
      }
    }
    return bag.pop();
  }

  function isValidPosition(matrix, row, col) {
    for (var r = 0; r < matrix.length; r++) {
      for (var c = 0; c < matrix.length; c++) {
        if (!matrix[r][c]) continue;
        var nr = row + r;
        var nc = col + c;
        if (nc < 0 || nc >= COLS || nr >= ROWS) return false;
        if (nr >= 0 && board[nr][nc]) return false;
      }
    }
    return true;
  }

  function spawnPiece() {
    var type = nextType || nextFromBag();
    nextType = nextFromBag();
    var matrix = cloneMatrix(SHAPES[type]);
    var col = Math.floor((COLS - matrix.length) / 2);
    current = { type: type, matrix: matrix, row: 0, col: col };
    drawNext();
    if (!isValidPosition(current.matrix, current.row, current.col)) {
      gameOver();
    }
  }

  function tryMove(dr, dc) {
    if (isValidPosition(current.matrix, current.row + dr, current.col + dc)) {
      current.row += dr;
      current.col += dc;
      return true;
    }
    return false;
  }

  function rotateMatrixCW(matrix) {
    var n = matrix.length;
    var result = [];
    for (var r = 0; r < n; r++) result.push(new Array(n).fill(0));
    for (var r2 = 0; r2 < n; r2++) {
      for (var c2 = 0; c2 < n; c2++) {
        result[c2][n - 1 - r2] = matrix[r2][c2];
      }
    }
    return result;
  }

  function rotatePiece() {
    if (paused || isGameOver || current.type === "O") return;
    var rotated = rotateMatrixCW(current.matrix);
    var kicks = [0, -1, 1, -2, 2];
    for (var i = 0; i < kicks.length; i++) {
      if (isValidPosition(rotated, current.row, current.col + kicks[i])) {
        current.matrix = rotated;
        current.col += kicks[i];
        return;
      }
    }
  }

  function lockPiece() {
    var matrix = current.matrix;
    for (var r = 0; r < matrix.length; r++) {
      for (var c = 0; c < matrix.length; c++) {
        if (matrix[r][c]) board[current.row + r][current.col + c] = current.type;
      }
    }
    clearLines();
    spawnPiece();
  }

  function clearLines() {
    var cleared = 0;
    for (var row = ROWS - 1; row >= 0; row--) {
      var full = board[row].every(function (cell) {
        return !!cell;
      });
      if (full) {
        board.splice(row, 1);
        board.unshift(new Array(COLS).fill(null));
        cleared++;
        row++;
      }
    }
    if (cleared > 0) {
      score += (LINE_SCORE[cleared] || 0) * level;
      linesTotal += cleared;
      level = Math.floor(linesTotal / 10) + 1;
      dropInterval = Math.max(120, 1000 - (level - 1) * 80);
      updateStatsUI();
    }
  }

  function moveLeft() {
    if (paused || isGameOver) return;
    tryMove(0, -1);
  }

  function moveRight() {
    if (paused || isGameOver) return;
    tryMove(0, 1);
  }

  function softDrop() {
    if (paused || isGameOver) return;
    if (tryMove(1, 0)) {
      score += 1;
      updateStatsUI();
    } else {
      lockPiece();
    }
    dropCounter = 0;
  }

  function hardDrop() {
    if (paused || isGameOver) return;
    var dist = 0;
    while (tryMove(1, 0)) dist++;
    score += dist * 2;
    updateStatsUI();
    lockPiece();
    dropCounter = 0;
  }

  function bestScoreKey() {
    var childId = typeof ChildStore !== "undefined" && ChildStore.getActive();
    return "haingTetrisBest_" + (childId ? childId + "_" : "guest_") + currentDifficulty;
  }

  var bestScore = 0;

  function showBestScore() {
    bestScore = parseInt(localStorage.getItem(bestScoreKey()), 10) || 0;
    bestEl.textContent = String(bestScore);
  }

  function updateStatsUI() {
    scoreEl.textContent = String(score);
    levelEl.textContent = String(level);
    linesEl.textContent = String(linesTotal);
    if (score > bestScore) {
      bestScore = score;
      localStorage.setItem(bestScoreKey(), String(bestScore));
    }
    bestEl.textContent = String(bestScore);
  }

  function drawBlock(ctx, x, y, size, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x + 1, y + 1, size - 2, size - 2);
    ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
    ctx.fillRect(x + 1, y + 1, size - 2, Math.max(2, size * 0.16));
    ctx.fillStyle = "rgba(0, 0, 0, 0.18)";
    ctx.fillRect(x + 1, y + size - Math.max(2, size * 0.16) - 1, size - 2, Math.max(2, size * 0.16));
  }

  function draw() {
    boardCtx.clearRect(0, 0, boardCanvas.width, boardCanvas.height);

    boardCtx.strokeStyle = "rgba(255, 255, 255, 0.06)";
    boardCtx.lineWidth = 1;
    for (var gx = 0; gx <= COLS; gx++) {
      boardCtx.beginPath();
      boardCtx.moveTo(gx * BLOCK, 0);
      boardCtx.lineTo(gx * BLOCK, ROWS * BLOCK);
      boardCtx.stroke();
    }
    for (var gy = 0; gy <= ROWS; gy++) {
      boardCtx.beginPath();
      boardCtx.moveTo(0, gy * BLOCK);
      boardCtx.lineTo(COLS * BLOCK, gy * BLOCK);
      boardCtx.stroke();
    }

    for (var r = 0; r < ROWS; r++) {
      for (var c = 0; c < COLS; c++) {
        if (board[r][c]) drawBlock(boardCtx, c * BLOCK, r * BLOCK, BLOCK, COLORS[board[r][c]]);
      }
    }

    if (current) {
      var matrix = current.matrix;
      for (var mr = 0; mr < matrix.length; mr++) {
        for (var mc = 0; mc < matrix.length; mc++) {
          if (matrix[mr][mc]) {
            drawBlock(boardCtx, (current.col + mc) * BLOCK, (current.row + mr) * BLOCK, BLOCK, COLORS[current.type]);
          }
        }
      }
    }
  }

  function drawNext() {
    nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
    if (!nextType) return;
    var matrix = SHAPES[nextType];
    var n = matrix.length;
    var size = 12;
    var offsetX = (nextCanvas.width - n * size) / 2;
    var offsetY = (nextCanvas.height - n * size) / 2;
    for (var r = 0; r < n; r++) {
      for (var c = 0; c < n; c++) {
        if (matrix[r][c]) drawBlock(nextCtx, offsetX + c * size, offsetY + r * size, size, COLORS[nextType]);
      }
    }
  }

  function setPaused(next) {
    if (isGameOver) return;
    paused = next;
    pauseVeilEl.hidden = !paused;
    pauseBtn.textContent = paused ? "▶" : "⏸";
  }

  function gameOver() {
    isGameOver = true;
    var isNewBest = score > 0 && score >= bestScore;
    var creditsLeft = typeof WordGameStore !== "undefined" ? WordGameStore.getCredits("tetris") : 0;
    overlayTitleEl.textContent = "게임 오버!";
    overlayScoreEl.textContent =
      DIFFICULTIES[currentDifficulty].label + " · 점수 " + score + " · 지운 줄 " + linesTotal + "줄 · 레벨 " + level + (isNewBest ? " 🎉 신기록!" : "");
    retryBtn.hidden = creditsLeft <= 0;
    overlayNoteEl.hidden = creditsLeft > 0;
    overlayEl.hidden = false;
  }

  function resetGame() {
    board = emptyBoard();
    bag = [];
    nextType = null;
    score = 0;
    level = DIFFICULTIES[currentDifficulty].startLevel;
    linesTotal = 0;
    dropInterval = Math.max(120, 1000 - (level - 1) * 80);
    dropCounter = 0;
    isGameOver = false;
    paused = false;
    pauseVeilEl.hidden = true;
    pauseBtn.textContent = "⏸";
    overlayEl.hidden = true;
    showBestScore();
    updateStatsUI();
    spawnPiece();
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

  function tick(timestamp) {
    if (!lastTime) lastTime = timestamp;
    var delta = timestamp - lastTime;
    lastTime = timestamp;

    if (!paused && !isGameOver) {
      dropCounter += delta;
      if (dropCounter > dropInterval) {
        dropCounter = 0;
        if (!tryMove(1, 0)) lockPiece();
      }
    }
    draw();
    requestAnimationFrame(tick);
  }

  GameUI.bindHold(leftBtn, moveLeft);
  GameUI.bindHold(rightBtn, moveRight);
  GameUI.bindHold(downBtn, softDrop);
  rotateBtn.addEventListener("click", rotatePiece);
  dropBtn.addEventListener("click", hardDrop);
  pauseBtn.addEventListener("click", function () {
    setPaused(!paused);
  });

  document.addEventListener("keydown", function (e) {
    if (isGameOver) return;
    switch (e.key) {
      case "ArrowLeft":
        moveLeft();
        e.preventDefault();
        break;
      case "ArrowRight":
        moveRight();
        e.preventDefault();
        break;
      case "ArrowDown":
        softDrop();
        e.preventDefault();
        break;
      case "ArrowUp":
        rotatePiece();
        e.preventDefault();
        break;
      case " ":
        hardDrop();
        e.preventDefault();
        break;
    }
  });

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) setPaused(true);
  });

  retryBtn.addEventListener("click", function () {
    if (typeof WordGameStore === "undefined" || !WordGameStore.spendCredit("tetris")) return;
    creditsEl.textContent = WordGameStore.getCreditsLabel("tetris");
    resetGame();
  });

  creditsEl.textContent = typeof WordGameStore !== "undefined" ? WordGameStore.getCreditsLabel("tetris") : "0";
  resetGame();
  requestAnimationFrame(tick);
})();
