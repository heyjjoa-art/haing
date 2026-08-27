// 거듭제곱(5³ = ?) 연습을 낙하/충돌형 아케이드로 만든 게임. 위에서 떨어지는 숫자
// 블록 중 정답만 바구니로 받는다. 밑 2~12 · 지수 2~4를 10개 레벨에 나눠 담고,
// 하노이의 탑처럼 앞 레벨을 깨야 다음 레벨이 열린다. 관리자 계정에서만 테스트
// 하는 개발 중 게임이라 WordGameStore(게임 기회) 연동은 하지 않는다.
(function () {
  "use strict";

  var BOARD_W = 320;
  var BOARD_H = 460;
  var BLOCK_W = 58;
  var BLOCK_H = 34;
  var LANES = 5;
  var LANE_W = BOARD_W / LANES;
  var STAGGER = 80; // 한 문제 안에서 블록끼리 시작 y를 이만큼씩 어긋나게 둔다
  var BASKET_W = 76;
  var BASKET_H = 14;
  var BASKET_Y = BOARD_H - 26; // 판정선(바구니 윗면)
  var BASKET_SPEED = 300; // px/s
  var LEVEL_COUNT = 10;
  var MAX_LIVES = 3;
  var NEXT_PROBLEM_DELAY = 600; // ms
  var FLASH_MS = 400;
  var EXP_SUP = { 2: "²", 3: "³", 4: "⁴" };

  // 레벨마다 어떤 (지수, 밑 범위) 조합에서 문제를 뽑을지, 블록 개수·낙하속도·
  // 클리어에 필요한 문제 수를 정한다. 밑 2~12 · 지수 2~4 전 범위를 레벨 10에서
  // 종합적으로 다룬다.
  var LEVELS = [
    { specs: [{ exp: 2, minBase: 2, maxBase: 5 }], blocks: 3, speed: 70, goal: 5 },
    { specs: [{ exp: 2, minBase: 2, maxBase: 9 }], blocks: 3, speed: 78, goal: 5 },
    { specs: [{ exp: 2, minBase: 2, maxBase: 12 }], blocks: 4, speed: 86, goal: 5 },
    { specs: [{ exp: 3, minBase: 2, maxBase: 5 }], blocks: 3, speed: 84, goal: 5 },
    {
      specs: [
        { exp: 2, minBase: 2, maxBase: 12 },
        { exp: 3, minBase: 2, maxBase: 6 }
      ],
      blocks: 4,
      speed: 94,
      goal: 6
    },
    { specs: [{ exp: 3, minBase: 2, maxBase: 9 }], blocks: 4, speed: 102, goal: 6 },
    { specs: [{ exp: 3, minBase: 2, maxBase: 12 }], blocks: 4, speed: 110, goal: 6 },
    { specs: [{ exp: 4, minBase: 2, maxBase: 5 }], blocks: 4, speed: 106, goal: 6 },
    { specs: [{ exp: 4, minBase: 2, maxBase: 8 }], blocks: 5, speed: 118, goal: 7 },
    {
      specs: [
        { exp: 2, minBase: 2, maxBase: 12 },
        { exp: 3, minBase: 2, maxBase: 12 },
        { exp: 4, minBase: 2, maxBase: 12 }
      ],
      blocks: 5,
      speed: 130,
      goal: 7
    }
  ];

  var levelNumEl = document.getElementById("powLevelNum");
  var levelTotalEl = document.getElementById("powLevelTotal");
  var levelPickerEl = document.getElementById("powLevelPicker");
  var bestEl = document.getElementById("powBest");
  var timerEl = document.getElementById("powTimer");
  var livesEl = document.getElementById("powLives");
  var solvedEl = document.getElementById("powSolved");
  var goalEl = document.getElementById("powGoal");
  var questionEl = document.getElementById("powQuestion");
  var hintEl = document.getElementById("powHint");

  var boardCanvas = document.getElementById("powBoard");
  var boardCtx = boardCanvas.getContext("2d");
  var pauseBtn = document.getElementById("powPauseBtn");
  var pauseVeilEl = document.getElementById("powPauseVeil");
  var leftBtn = document.getElementById("powLeftBtn");
  var rightBtn = document.getElementById("powRightBtn");

  var overlayEl = document.getElementById("powOverlay");
  var overlayTitleEl = document.getElementById("powOverlayTitle");
  var overlayDescEl = document.getElementById("powOverlayDesc");
  var nextBtn = document.getElementById("powNextBtn");
  var retryBtn = document.getElementById("powRetryBtn");

  var DEFAULT_HINT = "정답이 적힌 블록을 바구니로 받아보세요!";

  var currentLevel = 1;
  var solvedCount = 0;
  var lives = MAX_LIVES;
  var blocks = []; // { value, correct, x, y }
  var basketX = (BOARD_W - BASKET_W) / 2;
  var leftPressed = false;
  var rightPressed = false;
  var dragging = false;
  var paused = false;
  var isLevelOver = false;
  var elapsedMs = 0;
  var lastTimerSecond = -1;
  var nextSpawnAt = 0;
  var needNewProblem = true;
  var problem = null; // { base, exp, answer }
  var lastTime = 0;
  var questionFlashTimer = null;

  function childKeyPart() {
    var childId = typeof ChildStore !== "undefined" && ChildStore.getActive();
    return childId ? childId + "_" : "guest_";
  }

  function unlockedLevelKey() {
    return "haingPowerUnlockedLevel_" + childKeyPart();
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
    return "haingPowerBestTime_" + childKeyPart() + level;
  }

  function formatTime(totalSeconds) {
    var m = Math.floor(totalSeconds / 60);
    var s = totalSeconds % 60;
    return m + ":" + (s < 10 ? "0" : "") + s;
  }

  function showBest() {
    var raw = localStorage.getItem(bestTimeKey(currentLevel));
    bestEl.textContent = raw ? formatTime(parseInt(raw, 10)) : "-";
  }

  function updateLivesUI() {
    var hearts = "";
    for (var i = 0; i < MAX_LIVES; i++) hearts += i < lives ? "❤️" : "🤍";
    livesEl.textContent = hearts;
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
        else if (localStorage.getItem(bestTimeKey(lv))) classes.push("cleared");
        btn.className = classes.join(" ");
        btn.textContent = locked ? "🔒" : String(lv);
        btn.disabled = locked;
        btn.addEventListener("click", function () {
          if (isLevelOver) return;
          newGame(lv);
        });
        levelPickerEl.appendChild(btn);
      })(level);
    }
  }

  function pickSpec(specs) {
    return specs[Math.floor(Math.random() * specs.length)];
  }

  // 이번 레벨 설정에서 (밑, 지수) 하나를 뽑아 새 문제를 만든다.
  function makeProblem() {
    var conf = LEVELS[currentLevel - 1];
    var spec = pickSpec(conf.specs);
    var base = spec.minBase + Math.floor(Math.random() * (spec.maxBase - spec.minBase + 1));
    var exp = spec.exp;
    problem = { base: base, exp: exp, answer: Math.pow(base, exp) };
    questionEl.innerHTML = base + "<sup>" + exp + "</sup> = ?";
  }

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i];
      a[i] = a[j];
      a[j] = tmp;
    }
    return a;
  }

  // 실제로 아이가 하기 쉬운 실수(곱셈 혼동, 지수/밑 하나 어긋남 등)를 우선
  // 후보로 쓰고, 모자라면 정답 근처 값으로 채운다. 정답·중복·0 이하는 제외.
  function makeDistractors(count) {
    var b = problem.base;
    var e = problem.exp;
    var answer = problem.answer;
    var raw = [
      b * e,
      Math.pow(b, e - 1),
      Math.pow(b, e + 1),
      Math.pow(b + 1, e),
      Math.pow(b - 1, e),
      answer + b,
      answer - b
    ];
    var seen = {};
    seen[answer] = true;
    var picked = [];
    raw.forEach(function (v) {
      v = Math.round(v);
      if (v > 0 && !seen[v] && picked.length < count) {
        seen[v] = true;
        picked.push(v);
      }
    });
    var guard = 0;
    while (picked.length < count && guard < 40) {
      guard++;
      var magnitude = Math.max(1, Math.round(answer * 0.15));
      var delta = 1 + Math.floor(Math.random() * magnitude);
      var v = Math.random() < 0.5 ? answer + delta : answer - delta;
      if (v > 0 && !seen[v]) {
        seen[v] = true;
        picked.push(v);
      }
    }
    return picked;
  }

  // 정답 1개 + 오답들을 서로 다른 레인에, 시작 y를 어긋나게 배치한다 - 전부
  // 같은 높이로 떨어지면 좌우 이동만으로 구분이 안 되고, 하나씩 스폰하면
  // 대기 시간이 늘어진다.
  function spawnProblemBlocks() {
    var conf = LEVELS[currentLevel - 1];
    var distractors = makeDistractors(conf.blocks - 1);
    var values = shuffle([problem.answer].concat(distractors));
    var lanes = shuffle([0, 1, 2, 3, 4]).slice(0, values.length);
    blocks = values.map(function (v, i) {
      return {
        value: v,
        correct: v === problem.answer,
        x: lanes[i] * LANE_W + (LANE_W - BLOCK_W) / 2,
        y: -BLOCK_H - i * STAGGER
      };
    });
  }

  // 레벨 안에서도 문제를 맞힐수록 조금씩 빨라진다.
  function currentFallSpeed() {
    var conf = LEVELS[currentLevel - 1];
    return conf.speed * (1 + 0.05 * solvedCount);
  }

  function flashQuestion(cls) {
    questionEl.classList.remove("correct", "wrong");
    questionEl.classList.add(cls);
    if (questionFlashTimer) clearTimeout(questionFlashTimer);
    questionFlashTimer = setTimeout(function () {
      questionEl.classList.remove(cls);
    }, FLASH_MS);
  }

  // 목숨을 하나 잃는다. 0이 되면 레벨 실패로 넘어가고 true를 돌려준다.
  function loseLife() {
    lives--;
    updateLivesUI();
    if (lives <= 0) {
      levelFail();
      return true;
    }
    return false;
  }

  function onCorrect() {
    blocks = [];
    solvedCount++;
    solvedEl.textContent = String(solvedCount);
    var sup = EXP_SUP[problem.exp] || "^" + problem.exp;
    hintEl.textContent = "🎉 정답! " + problem.base + sup + " = " + problem.answer;
    flashQuestion("correct");

    var conf = LEVELS[currentLevel - 1];
    if (solvedCount >= conf.goal) {
      levelClear();
      return;
    }
    needNewProblem = true;
    nextSpawnAt = Date.now() + NEXT_PROBLEM_DELAY;
  }

  function onWrongCatch() {
    hintEl.textContent = "❌ 아니에요! 다시 잘 보세요";
    flashQuestion("wrong");
    loseLife();
  }

  function onMissed() {
    blocks = [];
    hintEl.textContent = "😢 놓쳤어요! 한 번 더!";
    flashQuestion("wrong");
    var ended = loseLife();
    if (ended) return;
    needNewProblem = false; // 같은 문제를 새 블록으로 재출제
    nextSpawnAt = Date.now() + NEXT_PROBLEM_DELAY;
  }

  function updateBasket(dt) {
    var d = BASKET_SPEED * dt;
    if (leftPressed) basketX -= d;
    if (rightPressed) basketX += d;
    basketX = Math.max(0, Math.min(BOARD_W - BASKET_W, basketX));
  }

  // dt가 크면(탭 전환 복귀 등) 블록이 한 프레임에 판정선을 건너뛸 수 있으니,
  // 좌표 비교가 아니라 "이번 프레임에 판정선을 넘었는가"로 잡는다.
  function updateBlocks(dt) {
    if (blocks.length === 0) {
      if (nextSpawnAt && Date.now() >= nextSpawnAt) {
        nextSpawnAt = 0;
        if (needNewProblem) makeProblem();
        spawnProblemBlocks();
      }
      return;
    }

    var speed = currentFallSpeed();
    for (var i = blocks.length - 1; i >= 0; i--) {
      var b = blocks[i];
      var prevBottom = b.y + BLOCK_H;
      b.y += speed * dt;
      var nextBottom = b.y + BLOCK_H;

      if (prevBottom < BASKET_Y && nextBottom >= BASKET_Y) {
        var overlap = b.x < basketX + BASKET_W && b.x + BLOCK_W > basketX;
        if (overlap) {
          if (b.correct) {
            onCorrect();
            return; // onCorrect가 blocks를 통째로 비웠으니 나머지 순회는 무의미
          }
          blocks.splice(i, 1);
          onWrongCatch();
          continue;
        }
      }

      if (b.y > BOARD_H) {
        blocks.splice(i, 1);
        if (b.correct) {
          onMissed();
          return;
        }
      }
    }
  }

  function draw() {
    boardCtx.clearRect(0, 0, BOARD_W, BOARD_H);

    boardCtx.strokeStyle = "rgba(255, 255, 255, 0.15)";
    boardCtx.setLineDash([4, 4]);
    boardCtx.beginPath();
    boardCtx.moveTo(0, BASKET_Y);
    boardCtx.lineTo(BOARD_W, BASKET_Y);
    boardCtx.stroke();
    boardCtx.setLineDash([]);

    blocks.forEach(function (b) {
      boardCtx.fillStyle = "#4d96ff";
      boardCtx.fillRect(b.x, b.y, BLOCK_W, BLOCK_H);
      var text = String(b.value);
      var size = text.length <= 3 ? 18 : text.length === 4 ? 15 : 13;
      boardCtx.font = "bold " + size + "px 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif";
      boardCtx.fillStyle = "#ffffff";
      boardCtx.textAlign = "center";
      boardCtx.textBaseline = "middle";
      boardCtx.fillText(text, b.x + BLOCK_W / 2, b.y + BLOCK_H / 2);
    });

    boardCtx.fillStyle = "#ffd93d";
    boardCtx.fillRect(basketX, BASKET_Y, BASKET_W, BASKET_H);
    boardCtx.fillStyle = "#e0a72f";
    boardCtx.fillRect(basketX, BASKET_Y, BASKET_W, 4);
  }

  function levelClear() {
    isLevelOver = true;
    blocks = [];

    var sec = Math.floor(elapsedMs / 1000);
    var key = bestTimeKey(currentLevel);
    var prevBest = parseInt(localStorage.getItem(key), 10);
    var isNewBest = isNaN(prevBest) || sec < prevBest;
    if (isNewBest) localStorage.setItem(key, String(sec));
    showBest();

    var isFinal = currentLevel === LEVEL_COUNT;
    var justUnlockedNext = currentLevel === getUnlockedLevel() && !isFinal;
    if (justUnlockedNext) unlockLevel(currentLevel + 1);
    renderLevelPicker();

    var conf = LEVELS[currentLevel - 1];
    var noMiss = lives === MAX_LIVES;
    overlayTitleEl.textContent = isFinal ? "🏆 모든 단계 클리어!" : "🎉 레벨 " + currentLevel + " 클리어!";
    overlayDescEl.textContent =
      conf.goal + "문제를 " + formatTime(sec) + "만에 다 맞혔어요!" +
      (isNewBest ? " 🎉 신기록!" : "") +
      (justUnlockedNext ? " 다음 레벨이 열렸어요!" : "") +
      (noMiss ? " 목숨을 하나도 안 잃었어요! 💯" : "");

    nextBtn.hidden = isFinal;
    retryBtn.textContent = "🔄 같은 단계 다시";
    overlayEl.hidden = false;
  }

  function levelFail() {
    isLevelOver = true;
    blocks = [];

    var conf = LEVELS[currentLevel - 1];
    overlayTitleEl.textContent = "😵 아쉬워요!";
    overlayDescEl.textContent =
      "레벨 " + currentLevel + " - " + solvedCount + "/" + conf.goal + "문제까지 맞혔어요. 다시 도전해볼까요?";
    nextBtn.hidden = true;
    retryBtn.textContent = "🔄 다시 하기";
    overlayEl.hidden = false;
  }

  function newGame(level) {
    currentLevel = level;
    var conf = LEVELS[currentLevel - 1];

    solvedCount = 0;
    lives = MAX_LIVES;
    blocks = [];
    needNewProblem = true;
    nextSpawnAt = 0;
    isLevelOver = false;
    paused = false;
    elapsedMs = 0;
    lastTimerSecond = -1;
    basketX = (BOARD_W - BASKET_W) / 2;

    levelNumEl.textContent = String(level);
    solvedEl.textContent = "0";
    goalEl.textContent = String(conf.goal);
    updateLivesUI();
    timerEl.textContent = "0:00";
    hintEl.textContent = DEFAULT_HINT;
    questionEl.classList.remove("correct", "wrong");
    overlayEl.hidden = true;
    pauseVeilEl.hidden = true;
    pauseBtn.textContent = "⏸";

    showBest();
    renderLevelPicker();

    makeProblem();
    spawnProblemBlocks();
    draw();
  }

  function setPaused(next) {
    if (isLevelOver) return;
    paused = next;
    pauseVeilEl.hidden = !paused;
    pauseBtn.textContent = paused ? "▶" : "⏸";
  }

  function tick(timestamp) {
    if (!lastTime) lastTime = timestamp;
    var dt = Math.min(0.05, (timestamp - lastTime) / 1000);
    lastTime = timestamp;

    if (!paused && !isLevelOver) {
      elapsedMs += dt * 1000;
      var sec = Math.floor(elapsedMs / 1000);
      if (sec !== lastTimerSecond) {
        lastTimerSecond = sec;
        timerEl.textContent = formatTime(sec);
      }
      updateBasket(dt);
      updateBlocks(dt);
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
  });
  boardCanvas.addEventListener("pointermove", function (e) {
    if (!dragging) return;
    var rect = boardCanvas.getBoundingClientRect();
    var scale = BOARD_W / rect.width;
    var x = (e.clientX - rect.left) * scale;
    basketX = Math.max(0, Math.min(BOARD_W - BASKET_W, x - BASKET_W / 2));
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
    if (isLevelOver) return;
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
        setPaused(!paused);
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

  retryBtn.addEventListener("click", function () {
    newGame(currentLevel);
  });
  nextBtn.addEventListener("click", function () {
    newGame(Math.min(currentLevel + 1, LEVEL_COUNT));
  });

  levelTotalEl.textContent = String(LEVEL_COUNT);
  newGame(getUnlockedLevel());
  requestAnimationFrame(tick);
})();
