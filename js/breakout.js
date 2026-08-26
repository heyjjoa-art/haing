// 도감 게임칸에서 들어오는 클래식 벽돌깨기. 관리자 계정에서만 테스트하는
// 개발 중 게임이라 WordGameStore(게임 기회) 연동은 아직 하지 않는다.
(function () {
  "use strict";

  var BOARD_W = 320;
  var BOARD_H = 420;
  var BRICK_COLS = 8;
  var BRICK_TOP = 40;
  var BRICK_GAP = 4;
  var BRICK_H = 16;
  var BRICK_COLORS = ["#ff6b6b", "#ffb454", "#ffd93d", "#6bcb77", "#4d96ff", "#c77dff"];
  var PADDLE_Y = 398;
  var PADDLE_H = 10;
  var BALL_R = 6;

  var DIFFICULTIES = {
    easy: { label: "쉬움", rows: 4, paddleW: 74, speed: 210 },
    normal: { label: "보통", rows: 5, paddleW: 62, speed: 250 },
    hard: { label: "어려움", rows: 6, paddleW: 52, speed: 290 }
  };
  var DIFFICULTY_ORDER = ["easy", "normal", "hard"];
  var difficultyTabs = {
    easy: document.getElementById("brkEasyTab"),
    normal: document.getElementById("brkNormalTab"),
    hard: document.getElementById("brkHardTab")
  };
  var currentDifficulty = "easy";

  var boardCanvas = document.getElementById("brkBoard");
  var boardCtx = boardCanvas.getContext("2d");
  var pauseVeilEl = document.getElementById("brkPauseVeil");
  var pauseBtn = document.getElementById("brkPauseBtn");
  var scoreEl = document.getElementById("brkScore");
  var livesEl = document.getElementById("brkLives");
  var bestEl = document.getElementById("brkBest");

  var overlayEl = document.getElementById("brkOverlay");
  var overlayTitleEl = document.getElementById("brkOverlayTitle");
  var overlayScoreEl = document.getElementById("brkOverlayScore");
  var retryBtn = document.getElementById("brkRetryBtn");

  var leftBtn = document.getElementById("brkLeftBtn");
  var rightBtn = document.getElementById("brkRightBtn");

  var bricks = [];
  var bricksLeft = 0;
  var paddleX = 0;
  var paddleW = 74;
  var ball = { x: 0, y: 0, dx: 0, dy: 0, launched: false };
  var score = 0;
  var lives = 3;
  var leftPressed = false;
  var rightPressed = false;
  var dragging = false;
  var paused = false;
  var isGameOver = false;
  var lastTime = 0;
  var launchAt = 0;

  function bestScoreKey() {
    var childId = typeof ChildStore !== "undefined" && ChildStore.getActive();
    return "haingBreakoutBest_" + (childId ? childId + "_" : "guest_") + currentDifficulty;
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

  function buildBricks() {
    var conf = DIFFICULTIES[currentDifficulty];
    var brickW = (BOARD_W - BRICK_GAP * (BRICK_COLS + 1)) / BRICK_COLS;
    bricks = [];
    for (var r = 0; r < conf.rows; r++) {
      var row = [];
      for (var c = 0; c < BRICK_COLS; c++) {
        row.push({
          x: BRICK_GAP + c * (brickW + BRICK_GAP),
          y: BRICK_TOP + r * (BRICK_H + BRICK_GAP),
          w: brickW,
          h: BRICK_H,
          color: BRICK_COLORS[r % BRICK_COLORS.length],
          hit: false
        });
      }
      bricks.push(row);
    }
    bricksLeft = conf.rows * BRICK_COLS;
  }

  function placeBallOnPaddle() {
    ball.x = paddleX + paddleW / 2;
    ball.y = PADDLE_Y - BALL_R;
    ball.dx = 0;
    ball.dy = 0;
    ball.launched = false;
  }

  function scheduleLaunch() {
    launchAt = Date.now() + 600;
  }

  function launchBall() {
    if (ball.launched || isGameOver || paused) return;
    var conf = DIFFICULTIES[currentDifficulty];
    var angle = (Math.random() * 0.6 - 0.3) - Math.PI / 2; // 위쪽 방향 근처로 살짝 랜덤
    ball.dx = Math.cos(angle) * conf.speed;
    ball.dy = Math.sin(angle) * conf.speed;
    ball.launched = true;
  }

  function setPaused(next) {
    if (isGameOver) return;
    paused = next;
    pauseVeilEl.hidden = !paused;
    pauseBtn.textContent = paused ? "▶" : "⏸";
  }

  function gameOver(won) {
    isGameOver = true;
    var isNewBest = score > 0 && score >= bestScore;
    overlayTitleEl.textContent = won ? "🎉 클리어!" : "게임 오버!";
    overlayScoreEl.textContent =
      DIFFICULTIES[currentDifficulty].label + " · 점수 " + score + (isNewBest ? " 🎉 신기록!" : "");
    overlayEl.hidden = false;
  }

  function loseLife() {
    lives--;
    updateStatsUI();
    if (lives <= 0) {
      gameOver(false);
      return;
    }
    placeBallOnPaddle();
    scheduleLaunch();
  }

  function updatePaddle(dt) {
    var speed = 320 * dt;
    if (leftPressed) paddleX -= speed;
    if (rightPressed) paddleX += speed;
    paddleX = Math.max(0, Math.min(BOARD_W - paddleW, paddleX));
    if (!ball.launched) placeBallOnPaddle();
  }

  function reflectOffPaddle() {
    var hitPos = (ball.x - (paddleX + paddleW / 2)) / (paddleW / 2); // -1..1
    hitPos = Math.max(-1, Math.min(1, hitPos));
    var conf = DIFFICULTIES[currentDifficulty];
    var angle = hitPos * (Math.PI / 3) - Math.PI / 2; // 최대 60도까지 좌우로 꺾인다
    ball.dx = Math.cos(angle) * conf.speed;
    ball.dy = Math.sin(angle) * conf.speed;
  }

  function updateBall(dt) {
    if (!ball.launched) return;

    ball.x += ball.dx * dt;
    ball.y += ball.dy * dt;

    if (ball.x - BALL_R < 0) {
      ball.x = BALL_R;
      ball.dx = Math.abs(ball.dx);
    } else if (ball.x + BALL_R > BOARD_W) {
      ball.x = BOARD_W - BALL_R;
      ball.dx = -Math.abs(ball.dx);
    }
    if (ball.y - BALL_R < 0) {
      ball.y = BALL_R;
      ball.dy = Math.abs(ball.dy);
    }

    // 패들 충돌 - 공이 내려가고 있을 때만, 패들 위쪽 근처에서 부딪힌 걸로 본다.
    if (
      ball.dy > 0 &&
      ball.y + BALL_R >= PADDLE_Y &&
      ball.y + BALL_R <= PADDLE_Y + PADDLE_H + 8 &&
      ball.x >= paddleX - BALL_R &&
      ball.x <= paddleX + paddleW + BALL_R
    ) {
      ball.y = PADDLE_Y - BALL_R;
      reflectOffPaddle();
    }

    // 벽돌 충돌 - 한 프레임에 하나만 처리해도 충분하다(공 속도가 크지 않음).
    outer: for (var r = 0; r < bricks.length; r++) {
      for (var c = 0; c < bricks[r].length; c++) {
        var b = bricks[r][c];
        if (b.hit) continue;
        var closestX = Math.max(b.x, Math.min(ball.x, b.x + b.w));
        var closestY = Math.max(b.y, Math.min(ball.y, b.y + b.h));
        var dx = ball.x - closestX;
        var dy = ball.y - closestY;
        if (dx * dx + dy * dy <= BALL_R * BALL_R) {
          b.hit = true;
          bricksLeft--;
          score += 10;
          updateStatsUI();
          // 어느 면에 부딪혔는지 대략 판단해서 그 축만 뒤집는다.
          if (Math.abs(dx) > Math.abs(dy)) {
            ball.dx = -ball.dx;
          } else {
            ball.dy = -ball.dy;
          }
          if (bricksLeft <= 0) {
            gameOver(true);
          }
          break outer;
        }
      }
    }

    if (ball.y - BALL_R > BOARD_H) {
      loseLife();
    }
  }

  function draw() {
    boardCtx.clearRect(0, 0, BOARD_W, BOARD_H);

    bricks.forEach(function (row) {
      row.forEach(function (b) {
        if (b.hit) return;
        boardCtx.fillStyle = b.color;
        boardCtx.fillRect(b.x, b.y, b.w, b.h);
      });
    });

    boardCtx.fillStyle = "#f4f6fb";
    boardCtx.fillRect(paddleX, PADDLE_Y, paddleW, PADDLE_H);

    boardCtx.beginPath();
    boardCtx.arc(ball.x, ball.y, BALL_R, 0, Math.PI * 2);
    boardCtx.fillStyle = "#ffd93d";
    boardCtx.fill();
  }

  function resetGame() {
    var conf = DIFFICULTIES[currentDifficulty];
    paddleW = conf.paddleW;
    paddleX = (BOARD_W - paddleW) / 2;
    buildBricks();
    score = 0;
    lives = 3;
    isGameOver = false;
    paused = false;
    pauseVeilEl.hidden = true;
    pauseBtn.textContent = "⏸";
    overlayEl.hidden = true;
    placeBallOnPaddle();
    scheduleLaunch();
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
    var dt = Math.min(0.05, (timestamp - lastTime) / 1000);
    lastTime = timestamp;

    if (!paused && !isGameOver) {
      updatePaddle(dt);
      updateBall(dt);
      if (!ball.launched && Date.now() >= launchAt) launchBall();
    }
    draw();
    requestAnimationFrame(tick);
  }

  function bindHold(btn, onChange) {
    btn.addEventListener("pointerdown", function (e) {
      e.preventDefault();
      onChange(true);
    });
    ["pointerup", "pointerleave", "pointercancel"].forEach(function (ev) {
      btn.addEventListener(ev, function () {
        onChange(false);
      });
    });
  }

  bindHold(leftBtn, function (v) {
    leftPressed = v;
  });
  bindHold(rightBtn, function (v) {
    rightPressed = v;
  });

  boardCanvas.addEventListener("pointerdown", function (e) {
    dragging = true;
    boardCanvas.setPointerCapture(e.pointerId);
    launchBall();
  });
  boardCanvas.addEventListener("pointermove", function (e) {
    if (!dragging) return;
    var rect = boardCanvas.getBoundingClientRect();
    var scale = BOARD_W / rect.width;
    var x = (e.clientX - rect.left) * scale;
    paddleX = Math.max(0, Math.min(BOARD_W - paddleW, x - paddleW / 2));
  });
  ["pointerup", "pointercancel", "pointerleave"].forEach(function (ev) {
    boardCanvas.addEventListener(ev, function () {
      dragging = false;
    });
  });

  pauseBtn.addEventListener("click", function () {
    setPaused(!paused);
  });

  document.addEventListener("keydown", function (e) {
    if (isGameOver) return;
    switch (e.key) {
      case "ArrowLeft":
        leftPressed = true;
        e.preventDefault();
        break;
      case "ArrowRight":
        rightPressed = true;
        e.preventDefault();
        break;
      case " ":
        if (!ball.launched) launchBall();
        else setPaused(!paused);
        e.preventDefault();
        break;
    }
  });
  document.addEventListener("keyup", function (e) {
    if (e.key === "ArrowLeft") leftPressed = false;
    if (e.key === "ArrowRight") rightPressed = false;
  });

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) setPaused(true);
  });

  retryBtn.addEventListener("click", resetGame);

  setDifficulty("easy");
  requestAnimationFrame(tick);
})();
