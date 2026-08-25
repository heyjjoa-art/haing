// 도감 게임칸에서 들어오는 클래식 스네이크. 관리자 계정에서만 테스트하는
// 개발 중 게임이라 WordGameStore(게임 기회) 연동은 아직 하지 않는다.
(function () {
  "use strict";

  var COLS = 20;
  var ROWS = 20;
  var BLOCK = 16;

  var DIFFICULTIES = {
    easy: { label: "쉬움", startInterval: 160, minInterval: 90, speedupPerFood: 2 },
    normal: { label: "보통", startInterval: 120, minInterval: 70, speedupPerFood: 3 },
    hard: { label: "어려움", startInterval: 90, minInterval: 50, speedupPerFood: 4 }
  };
  var DIFFICULTY_ORDER = ["easy", "normal", "hard"];
  var difficultyTabs = {
    easy: document.getElementById("snakeEasyTab"),
    normal: document.getElementById("snakeNormalTab"),
    hard: document.getElementById("snakeHardTab")
  };
  var currentDifficulty = "easy";

  var boardCanvas = document.getElementById("snakeBoard");
  var boardCtx = boardCanvas.getContext("2d");
  var pauseVeilEl = document.getElementById("snakePauseVeil");
  var pauseBtn = document.getElementById("snakePauseBtn");
  var scoreEl = document.getElementById("snakeScore");
  var bestEl = document.getElementById("snakeBest");

  var overlayEl = document.getElementById("snakeOverlay");
  var overlayScoreEl = document.getElementById("snakeOverlayScore");
  var retryBtn = document.getElementById("snakeRetryBtn");

  var upBtn = document.getElementById("snakeUpBtn");
  var downBtn = document.getElementById("snakeDownBtn");
  var leftBtn = document.getElementById("snakeLeftBtn");
  var rightBtn = document.getElementById("snakeRightBtn");

  var snake = [];
  var direction = { x: 1, y: 0 };
  var pendingDirection = null;
  var food = null;
  var score = 0;
  var moveInterval = 160;
  var moveCounter = 0;
  var lastTime = 0;
  var paused = false;
  var isGameOver = false;

  function cellKey(p) {
    return p.x + "_" + p.y;
  }

  function randomEmptyCell() {
    var occupied = {};
    snake.forEach(function (seg) {
      occupied[cellKey(seg)] = true;
    });
    var free = [];
    for (var x = 0; x < COLS; x++) {
      for (var y = 0; y < ROWS; y++) {
        var p = { x: x, y: y };
        if (!occupied[cellKey(p)]) free.push(p);
      }
    }
    if (free.length === 0) return null;
    return free[Math.floor(Math.random() * free.length)];
  }

  function spawnFood() {
    food = randomEmptyCell();
  }

  function bestScoreKey() {
    var childId = typeof ChildStore !== "undefined" && ChildStore.getActive();
    return "haingSnakeBest_" + (childId ? childId + "_" : "guest_") + currentDifficulty;
  }

  var bestScore = 0;

  function showBestScore() {
    bestScore = parseInt(localStorage.getItem(bestScoreKey()), 10) || 0;
    bestEl.textContent = String(bestScore);
  }

  function updateStatsUI() {
    scoreEl.textContent = String(score);
    if (score > bestScore) {
      bestScore = score;
      localStorage.setItem(bestScoreKey(), String(bestScore));
    }
    bestEl.textContent = String(bestScore);
  }

  function setDirection(dx, dy) {
    if (paused || isGameOver) return;
    // 지금 진행 방향의 정반대로는 못 돌린다(그 자리에서 바로 몸통에 부딪히므로).
    // 이번 틱에 이미 다른 방향을 예약해뒀으면 그 기준으로 반대 여부를 판단한다.
    var base = pendingDirection || direction;
    if (base.x === -dx && base.y === -dy) return;
    pendingDirection = { x: dx, y: dy };
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
    overlayScoreEl.textContent =
      DIFFICULTIES[currentDifficulty].label + " · 점수 " + score + (isNewBest ? " 🎉 신기록!" : "");
    overlayEl.hidden = false;
  }

  function step() {
    if (pendingDirection) {
      direction = pendingDirection;
      pendingDirection = null;
    }

    var head = snake[0];
    var next = { x: head.x + direction.x, y: head.y + direction.y };

    if (next.x < 0 || next.x >= COLS || next.y < 0 || next.y >= ROWS) {
      gameOver();
      return;
    }
    var hitsSelf = snake.some(function (seg, i) {
      return i < snake.length - 1 && seg.x === next.x && seg.y === next.y;
    });
    if (hitsSelf) {
      gameOver();
      return;
    }

    snake.unshift(next);

    var ateFood = food && next.x === food.x && next.y === food.y;
    if (ateFood) {
      score += 10;
      updateStatsUI();
      var conf = DIFFICULTIES[currentDifficulty];
      moveInterval = Math.max(conf.minInterval, moveInterval - conf.speedupPerFood);
      spawnFood();
      if (!food) {
        // 빈 칸이 더 없다 - 보드를 다 채웠으니 승리로 취급하고 게임을 끝낸다.
        gameOver();
        return;
      }
    } else {
      snake.pop();
    }
  }

  function drawCell(x, y, color) {
    boardCtx.fillStyle = color;
    boardCtx.fillRect(x * BLOCK + 1, y * BLOCK + 1, BLOCK - 2, BLOCK - 2);
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

    if (food) drawCell(food.x, food.y, "#ff6b6b");
    snake.forEach(function (seg, i) {
      drawCell(seg.x, seg.y, i === 0 ? "#ffd93d" : "#6bcb77");
    });
  }

  function resetGame() {
    var startX = Math.floor(COLS / 2);
    var startY = Math.floor(ROWS / 2);
    snake = [
      { x: startX, y: startY },
      { x: startX - 1, y: startY },
      { x: startX - 2, y: startY }
    ];
    direction = { x: 1, y: 0 };
    pendingDirection = null;
    score = 0;
    moveInterval = DIFFICULTIES[currentDifficulty].startInterval;
    moveCounter = 0;
    isGameOver = false;
    paused = false;
    pauseVeilEl.hidden = true;
    pauseBtn.textContent = "⏸";
    overlayEl.hidden = true;
    spawnFood();
    showBestScore();
    updateStatsUI();
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

  function tick(timestamp) {
    if (!lastTime) lastTime = timestamp;
    var delta = timestamp - lastTime;
    lastTime = timestamp;

    if (!paused && !isGameOver) {
      moveCounter += delta;
      if (moveCounter > moveInterval) {
        moveCounter = 0;
        step();
      }
    }
    draw();
    requestAnimationFrame(tick);
  }

  upBtn.addEventListener("click", function () {
    setDirection(0, -1);
  });
  downBtn.addEventListener("click", function () {
    setDirection(0, 1);
  });
  leftBtn.addEventListener("click", function () {
    setDirection(-1, 0);
  });
  rightBtn.addEventListener("click", function () {
    setDirection(1, 0);
  });
  pauseBtn.addEventListener("click", function () {
    setPaused(!paused);
  });

  document.addEventListener("keydown", function (e) {
    if (isGameOver) return;
    switch (e.key) {
      case "ArrowLeft":
        setDirection(-1, 0);
        e.preventDefault();
        break;
      case "ArrowRight":
        setDirection(1, 0);
        e.preventDefault();
        break;
      case "ArrowUp":
        setDirection(0, -1);
        e.preventDefault();
        break;
      case "ArrowDown":
        setDirection(0, 1);
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

  retryBtn.addEventListener("click", resetGame);

  setDifficulty("easy");
  requestAnimationFrame(tick);
})();
