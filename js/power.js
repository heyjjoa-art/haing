// 거듭제곱(2의 2승, 2의 3승, 2의 4승...) 연습을 스네이크로 만든 게임. 밑(base)이
// 정해지면 base² → base³ → base⁴ 순서로 자라는 숫자만 골라 먹어야 한다 - 다른
// 숫자를 먹거나 벽/몸통에 부딪히면 그 판은 끝. 조작은 클래식 스네이크와 똑같이
// 방향키/버튼 한 번 누르면 그 방향으로 계속 가는 방식이라(연속 드래그 없음)
// 손이 편하다. 레벨은 하노이의 탑처럼 순서대로 깨야 다음 밑(3, 4, 5...)이
// 열리고, 밑 2~19까지 18단계다. 관리자 계정에서만 테스트하는 개발 중 게임이라
// WordGameStore(게임 기회) 연동은 하지 않는다.
(function () {
  "use strict";

  var COLS = 10;
  var ROWS = 14;
  var BLOCK = 28;
  var BASE_START = 2;
  var BASE_END = 19;
  var LEVEL_COUNT = BASE_END - BASE_START + 1; // 18
  var MIN_EXP = 2;
  var MAX_EXP = 4;
  var EXP_SUP = { 2: "²", 3: "³", 4: "⁴" };
  var SPEEDUP_PER_EAT = 8;

  // 레벨마다 밑(base) 하나를 맡는다(2~19). 목표 사슬은 항상 base²→base³→base⁴
  // 3단계. 뒤로 갈수록(밑이 커질수록) 미끼 숫자가 늘고 속도도 빨라진다.
  var LEVELS = (function () {
    var arr = [];
    for (var base = BASE_START; base <= BASE_END; base++) {
      var idx = base - BASE_START; // 0..17
      var decoys = idx < 6 ? 2 : idx < 12 ? 3 : 4;
      var startInterval = 220 - idx * 6; // 220ms(밑2) ~ 118ms(밑19)
      var minInterval = Math.max(90, startInterval - 70);
      arr.push({ base: base, decoys: decoys, startInterval: startInterval, minInterval: minInterval });
    }
    return arr;
  })();

  var levelNumEl = document.getElementById("powLevelNum");
  var levelTotalEl = document.getElementById("powLevelTotal");
  var baseNumEl = document.getElementById("powBaseNum");
  var levelPickerEl = document.getElementById("powLevelPicker");
  var bestEl = document.getElementById("powBest");
  var timerEl = document.getElementById("powTimer");
  var scoreEl = document.getElementById("powScore");
  var chainEl = document.getElementById("powChain");
  var hintEl = document.getElementById("powHint");

  var boardCanvas = document.getElementById("powBoard");
  var boardCtx = boardCanvas.getContext("2d");
  var pauseBtn = document.getElementById("powPauseBtn");
  var pauseVeilEl = document.getElementById("powPauseVeil");
  var upBtn = document.getElementById("powUpBtn");
  var downBtn = document.getElementById("powDownBtn");
  var leftBtn = document.getElementById("powLeftBtn");
  var rightBtn = document.getElementById("powRightBtn");

  var overlayEl = document.getElementById("powOverlay");
  var overlayTitleEl = document.getElementById("powOverlayTitle");
  var overlayDescEl = document.getElementById("powOverlayDesc");
  var nextBtn = document.getElementById("powNextBtn");
  var retryBtn = document.getElementById("powRetryBtn");

  var DEFAULT_HINT = "거듭제곱 숫자만 순서대로 먹어보세요! 다른 숫자를 먹으면 게임이 끝나요.";

  var currentLevel = 1;
  var targets = []; // [{ exp, value }, ...] base¹..base⁴
  var targetIndex = 0;
  var snake = [];
  var direction = { x: 1, y: 0 };
  var pendingDirection = null;
  var foods = []; // { x, y, value, correct }
  var score = 0;
  var moveInterval = 200;
  var moveCounter = 0;
  var lastTime = 0;
  var paused = false;
  var isLevelOver = false;
  var elapsedMs = 0;
  var lastTimerSecond = -1;

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

  function updateStatsUI() {
    scoreEl.textContent = String(score);
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

  // base²부터 base⁴까지 이번 레벨에서 순서대로 먹어야 할 사슬을 만든다.
  function buildTargets(base) {
    var arr = [];
    for (var exp = MIN_EXP; exp <= MAX_EXP; exp++) {
      arr.push({ exp: exp, value: Math.pow(base, exp) });
    }
    return arr;
  }

  // 지금 목표(밑,지수,정답)를 기준으로 흔한 실수 값을 미끼로 만든다 -
  // 정답·중복·0 이하는 제외하고, 모자라면 정답 근처 값으로 채운다.
  function makeDistractors(base, exp, answer, count) {
    var raw = [
      base * exp,
      Math.pow(base, exp - 1), // exp=1이면 base^0=1 - 그것도 정답과 다른 유효한 미끼
      Math.pow(base, exp + 1),
      Math.pow(base + 1, exp),
      Math.pow(base - 1, exp),
      answer + base,
      answer - base
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
      var magnitude = Math.max(1, Math.round(answer * 0.2));
      var delta = 1 + Math.floor(Math.random() * magnitude);
      var v = Math.random() < 0.5 ? answer + delta : answer - delta;
      if (v > 0 && !seen[v]) {
        seen[v] = true;
        picked.push(v);
      }
    }
    return picked;
  }

  function cellKey(p) {
    return p.x + "_" + p.y;
  }

  function randomEmptyCell(occupied) {
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

  // 정답 1개(다음 목표) + 미끼 여러 개를 서로 다른 빈 칸에 뿌린다. 색은
  // 전부 똑같이 둬서(정답만 다른 색이면 계산 없이 풀림) 숫자를 직접 읽어야
  // 고를 수 있게 한다.
  function spawnFoods() {
    var conf = LEVELS[currentLevel - 1];
    var target = targets[targetIndex];
    var distractors = makeDistractors(conf.base, target.exp, target.value, conf.decoys);
    var values = [target.value].concat(distractors);

    var occupied = {};
    snake.forEach(function (seg) {
      occupied[cellKey(seg)] = true;
    });

    foods = [];
    values.forEach(function (v) {
      var cell = randomEmptyCell(occupied);
      if (!cell) return; // 보드가 거의 꽉 찬 극단적인 경우 - 그냥 덜 뿌린다
      occupied[cellKey(cell)] = true;
      foods.push({ x: cell.x, y: cell.y, value: v, correct: v === target.value });
    });
  }

  function updateChainUI() {
    var conf = LEVELS[currentLevel - 1];
    var parts = targets.map(function (t, i) {
      var cls = i < targetIndex ? "pow-chain-done" : i === targetIndex ? "pow-chain-current" : "pow-chain-todo";
      var label = conf.base + (EXP_SUP[t.exp] || "^" + t.exp) + "=" + t.value;
      return '<span class="' + cls + '">' + label + "</span>";
    });
    chainEl.innerHTML = parts.join('<span class="pow-chain-arrow">→</span>');
  }

  function setDirection(dx, dy) {
    if (paused || isLevelOver) return;
    // 지금 진행 방향의 정반대로는 못 돌린다(그 자리에서 바로 몸통에 부딪히므로).
    var base = pendingDirection || direction;
    if (base.x === -dx && base.y === -dy) return;
    pendingDirection = { x: dx, y: dy };
  }

  function setPaused(next) {
    if (isLevelOver) return;
    paused = next;
    pauseVeilEl.hidden = !paused;
    pauseBtn.textContent = paused ? "▶" : "⏸";
  }

  function levelClear() {
    isLevelOver = true;

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
    var chainText = targets.map(function (t) { return t.value; }).join(" → ");
    overlayTitleEl.textContent = isFinal ? "🏆 모든 단계 클리어!" : "🎉 레벨 " + currentLevel + " 클리어!";
    overlayDescEl.textContent =
      "밑 " + conf.base + "의 거듭제곱(" + chainText + ")을 " + formatTime(sec) + "만에 다 먹었어요!" +
      (isNewBest ? " 🎉 신기록!" : "") +
      (justUnlockedNext ? " 다음 레벨이 열렸어요!" : "");

    nextBtn.hidden = isFinal;
    retryBtn.textContent = "🔄 같은 단계 다시";
    overlayEl.hidden = false;
  }

  function levelFail(reason) {
    isLevelOver = true;
    var conf = LEVELS[currentLevel - 1];
    overlayTitleEl.textContent = "😵 아쉬워요!";
    overlayDescEl.textContent =
      reason + " 밑 " + conf.base + " · " + targetIndex + "/" + targets.length + "단계까지 먹었어요. 다시 도전해볼까요?";
    nextBtn.hidden = true;
    retryBtn.textContent = "🔄 다시 하기";
    overlayEl.hidden = false;
  }

  function onCorrectEat() {
    score += 10;
    updateStatsUI();
    targetIndex++;
    updateChainUI();
    hintEl.textContent = "🎉 정답이에요! 다음 숫자를 찾아보세요.";

    var conf = LEVELS[currentLevel - 1];
    moveInterval = Math.max(conf.minInterval, moveInterval - SPEEDUP_PER_EAT);

    if (targetIndex >= targets.length) {
      levelClear();
      return;
    }
    spawnFoods();
  }

  function step() {
    if (pendingDirection) {
      direction = pendingDirection;
      pendingDirection = null;
    }

    var head = snake[0];
    var next = { x: head.x + direction.x, y: head.y + direction.y };

    if (next.x < 0 || next.x >= COLS || next.y < 0 || next.y >= ROWS) {
      levelFail("벽에 부딪혔어요!");
      return;
    }
    var hitsSelf = snake.some(function (seg, i) {
      return i < snake.length - 1 && seg.x === next.x && seg.y === next.y;
    });
    if (hitsSelf) {
      levelFail("몸통에 부딪혔어요!");
      return;
    }

    snake.unshift(next);

    var eatenIndex = -1;
    for (var i = 0; i < foods.length; i++) {
      if (foods[i].x === next.x && foods[i].y === next.y) {
        eatenIndex = i;
        break;
      }
    }

    if (eatenIndex === -1) {
      snake.pop();
      return;
    }

    var eaten = foods[eatenIndex];
    if (!eaten.correct) {
      levelFail("숫자 " + eaten.value + "을(를) 먹었어요 - 정답이 아니에요.");
      return;
    }

    foods.splice(eatenIndex, 1);
    onCorrectEat();
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

    foods.forEach(function (f) {
      var boxSize = BLOCK - 4;
      var left = f.x * BLOCK + 2;
      var top = f.y * BLOCK + 2;
      boardCtx.fillStyle = "#ffb454";
      boardCtx.fillRect(left, top, boxSize, boxSize);

      var text = String(f.value);
      var size = text.length <= 2 ? 14 : text.length === 3 ? 12 : text.length === 4 ? 10 : text.length === 5 ? 8 : 7;
      boardCtx.font = "bold " + size + "px 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif";
      boardCtx.fillStyle = "#3a2e26";
      boardCtx.textAlign = "center";
      boardCtx.textBaseline = "middle";
      boardCtx.fillText(text, left + boxSize / 2, top + boxSize / 2 + 1);
    });

    snake.forEach(function (seg, i) {
      drawCell(seg.x, seg.y, i === 0 ? "#ffd93d" : "#6bcb77");
    });
  }

  function newGame(level) {
    currentLevel = level;
    var conf = LEVELS[currentLevel - 1];

    targets = buildTargets(conf.base);
    targetIndex = 0;
    score = 0;
    moveInterval = conf.startInterval;
    moveCounter = 0;
    isLevelOver = false;
    paused = false;
    elapsedMs = 0;
    lastTimerSecond = -1;

    var startX = Math.floor(COLS / 2);
    var startY = Math.floor(ROWS / 2);
    snake = [
      { x: startX, y: startY },
      { x: startX - 1, y: startY },
      { x: startX - 2, y: startY }
    ];
    direction = { x: 1, y: 0 };
    pendingDirection = null;

    levelNumEl.textContent = String(level);
    baseNumEl.textContent = String(conf.base);
    updateStatsUI();
    timerEl.textContent = "0:00";
    hintEl.textContent = DEFAULT_HINT;
    overlayEl.hidden = true;
    pauseVeilEl.hidden = true;
    pauseBtn.textContent = "⏸";

    showBest();
    renderLevelPicker();
    updateChainUI();
    spawnFoods();
    draw();
  }

  function tick(timestamp) {
    if (!lastTime) lastTime = timestamp;
    var delta = timestamp - lastTime;
    lastTime = timestamp;

    if (!paused && !isLevelOver) {
      elapsedMs += delta;
      var sec = Math.floor(elapsedMs / 1000);
      if (sec !== lastTimerSecond) {
        lastTimerSecond = sec;
        timerEl.textContent = formatTime(sec);
      }
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
    if (isLevelOver) return;
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
