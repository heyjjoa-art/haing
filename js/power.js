// 구구단(5단이면 5, 10, 15, 20...) 연습을 스네이크로 만든 게임. 단(N)이 정해지면
// N×1 → N×2 → N×3 → ... 순서로 커지는 숫자만 골라 먹어야 한다 - 다른 숫자를
// 먹거나 벽/몸통에 부딪히면 그 판은 끝. 한 판은 N×9에서 멈추지 않고 계속 갈 수
// 있는 만큼 무한히 이어진다(N×9까지 먹으면 다음 레벨은 이미 열리고, 그 뒤로도
// 원하는 만큼 더 먹어서 기록을 늘릴 수 있다). 조작은 클래식 스네이크와 똑같이
// 방향키/버튼 한 번 누르면 그 방향으로 계속 가는 방식이라(연속 드래그 없음)
// 손이 편하다. 레벨은 하노이의 탑처럼 순서대로 깨야 다음 단(3, 4, 5...)이
// 열리고, 2단(레벨1)부터 20단(레벨19)까지 19단계다. 관리자 계정에서만 테스트
// 하는 개발 중 게임이라 WordGameStore(게임 기회) 연동은 하지 않는다.
(function () {
  "use strict";

  var COLS = 10;
  var ROWS = 14;
  var BLOCK = 28;
  var DAN_START = 2;
  var LEVEL_COUNT = 19; // 2단(레벨1) ~ 20단(레벨19)
  var MIN_K = 1;
  var UNLOCK_K = 9; // 이 배수까지 먹으면 다음 레벨이 열린다(구구단 전통대로 9단)
  var CHAIN_WINDOW = 4; // 사슬 표시에 보여줄 최근 개수(무한히 늘어나므로 최근 것만)
  var SPEEDUP_PER_EAT = 6;
  var MIN_INTERVAL = 90;

  // 레벨마다 단(N) 하나를 맡는다(2단~20단) - dan이 클수록 시작 속도가 조금씩
  // 빨라진다. 미끼 개수는 레벨이 아니라 "이번 판에서 몇 번째를 먹고 있는지"에
  // 따라 늘어난다(spawnFoods 참고) - 오래 버틸수록 어려워지는 무한 모드라서.
  var LEVELS = (function () {
    var arr = [];
    for (var dan = DAN_START; dan < DAN_START + LEVEL_COUNT; dan++) {
      var startInterval = Math.max(120, 220 - (dan - DAN_START) * 6);
      arr.push({ dan: dan, startInterval: startInterval });
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

  var DEFAULT_HINT = "구구단 숫자만 순서대로 먹어보세요! 다른 숫자를 먹으면 게임이 끝나요.";

  var currentLevel = 1;
  var nextK = 1; // 지금 먹어야 할 배수(아직 안 먹음) - 무한히 늘어난다
  var unlockedThisRun = false;
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

  // 이 레벨(단)에서 지금까지 최고 몇 배수까지 먹었는지 - 무한 모드라 "클리어
  // 시간" 대신 "얼마나 멀리 갔는지"를 기록으로 삼는다.
  function bestKKey(level) {
    return "haingPowerBestK_" + childKeyPart() + level;
  }

  function formatTime(totalSeconds) {
    var m = Math.floor(totalSeconds / 60);
    var s = totalSeconds % 60;
    return m + ":" + (s < 10 ? "0" : "") + s;
  }

  function showBest() {
    var raw = parseInt(localStorage.getItem(bestKKey(currentLevel)), 10);
    bestEl.textContent = raw > 0 ? "×" + raw : "-";
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
        var bestK = parseInt(localStorage.getItem(bestKKey(lv)), 10) || 0;
        var classes = ["stage-tab", "stage-tab--level"];
        if (lv === currentLevel) classes.push("current");
        if (locked) classes.push("locked");
        else if (bestK >= UNLOCK_K) classes.push("cleared");
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

  // 지금 목표(단,몇 번째,정답)를 기준으로 흔한 구구단 실수 값을 미끼로 만든다:
  // 한 칸 앞/뒤 숫자(더하기/빼기 실수), 곱셈 대신 덧셈(dan+k), 옆 단으로
  // 착각(±1단), ±1 오타. 정답·중복·0 이하는 제외하고, 모자라면 정답 근처
  // 값으로 채운다.
  function makeDistractors(dan, k, answer, count) {
    var raw = [
      answer - dan, // 한 칸 전(dan×(k-1))
      answer + dan, // 한 칸 다음(dan×(k+1))
      dan + k, // 곱셈을 덧셈으로 착각
      (dan + 1) * k, // 옆 단(한 칸 위)으로 착각
      (dan - 1) * k, // 옆 단(한 칸 아래)으로 착각
      answer + 1,
      answer - 1
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
      var delta = 1 + Math.floor(Math.random() * dan * 2);
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

  // 정답 1개(다음 목표) + 미끼 여러 개를 서로 다른 빈 칸에 뿌린다. 색은 전부
  // 똑같이 둬서(정답만 다른 색이면 계산 없이 풀림) 숫자를 직접 읽어야 고를 수
  // 있게 한다. 미끼 개수는 이번 판에서 몇 번째를 먹는 중인지(nextK)에 따라
  // 늘어난다 - 오래 버틸수록 보드가 더 복잡해진다.
  function spawnFoods() {
    var conf = LEVELS[currentLevel - 1];
    var decoyCount = Math.min(6, 2 + Math.floor((nextK - 1) / 4));
    var answer = conf.dan * nextK;
    var distractors = makeDistractors(conf.dan, nextK, answer, decoyCount);
    var values = [answer].concat(distractors);

    var occupied = {};
    snake.forEach(function (seg) {
      occupied[cellKey(seg)] = true;
    });

    foods = [];
    values.forEach(function (v) {
      var cell = randomEmptyCell(occupied);
      if (!cell) return; // 보드가 거의 꽉 찬 극단적인 경우 - 그냥 덜 뿌린다
      occupied[cellKey(cell)] = true;
      foods.push({ x: cell.x, y: cell.y, value: v, correct: v === answer });
    });
  }

  // 사슬은 무한히 늘어나니 최근 몇 개만 보여준다 - 앞이 잘렸으면 "…"로 표시.
  function updateChainUI() {
    var conf = LEVELS[currentLevel - 1];
    var startK = Math.max(MIN_K, nextK - CHAIN_WINDOW);
    var htmlParts = [];
    if (startK > MIN_K) htmlParts.push('<span class="pow-chain-todo">…</span>');
    for (var k = startK; k <= nextK; k++) {
      var cls = k < nextK ? "pow-chain-done" : "pow-chain-current";
      htmlParts.push('<span class="' + cls + '">' + conf.dan + "×" + k + "=" + conf.dan * k + "</span>");
    }
    chainEl.innerHTML = htmlParts.join('<span class="pow-chain-arrow">→</span>');
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

  // 벽/몸통에 부딪히거나 다른 숫자를 먹으면 이번 판은 끝 - 클리어 지점이
  // 정해져 있지 않은 무한 모드라, 여기서 "이번 판 최종 기록"을 정리해서 보여준다.
  function endRun(reason) {
    isLevelOver = true;
    var conf = LEVELS[currentLevel - 1];
    var reachedK = nextK - 1; // 이번 판에서 실제로 다 먹은 마지막 배수

    var key = bestKKey(currentLevel);
    var prevBest = parseInt(localStorage.getItem(key), 10) || 0;
    var isNewBest = reachedK > prevBest;
    if (isNewBest) localStorage.setItem(key, String(reachedK));
    showBest();
    renderLevelPicker();

    var clearedNine = reachedK >= UNLOCK_K;
    var nextUnlocked = currentLevel < LEVEL_COUNT && currentLevel + 1 <= getUnlockedLevel();

    overlayTitleEl.textContent = clearedNine ? "🎉 " + conf.dan + "단 도전 완료!" : "😵 아쉬워요!";
    overlayDescEl.textContent =
      reason + " " + conf.dan + "×" + Math.max(reachedK, 0) + "까지 먹었어요." +
      (isNewBest && reachedK > 0 ? " 🎉 신기록!" : "") +
      (clearedNine ? "" : " " + conf.dan + "×" + UNLOCK_K + "까지 먹으면 다음 레벨이 열려요.");

    nextBtn.hidden = !nextUnlocked;
    retryBtn.textContent = "🔄 다시 하기";
    overlayEl.hidden = false;
  }

  function onCorrectEat() {
    score += 10;
    updateStatsUI();

    var conf = LEVELS[currentLevel - 1];
    if (nextK >= UNLOCK_K && !unlockedThisRun) {
      unlockedThisRun = true;
      var isFinal = currentLevel === LEVEL_COUNT;
      var justUnlockedNext = currentLevel === getUnlockedLevel() && !isFinal;
      if (justUnlockedNext) {
        unlockLevel(currentLevel + 1);
        renderLevelPicker();
        hintEl.textContent = "🎉 " + conf.dan + "×" + UNLOCK_K + " 완주! 다음 레벨이 열렸어요. 계속 도전해봐요!";
      } else {
        hintEl.textContent = "🎉 " + conf.dan + "×" + UNLOCK_K + " 완주! 계속 도전해봐요!";
      }
    } else {
      hintEl.textContent = "🎉 정답이에요! 다음 숫자를 찾아보세요.";
    }

    nextK++;
    updateChainUI();
    moveInterval = Math.max(MIN_INTERVAL, moveInterval - SPEEDUP_PER_EAT);
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
      endRun("벽에 부딪혔어요!");
      return;
    }
    var hitsSelf = snake.some(function (seg, i) {
      return i < snake.length - 1 && seg.x === next.x && seg.y === next.y;
    });
    if (hitsSelf) {
      endRun("몸통에 부딪혔어요!");
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
      endRun("숫자 " + eaten.value + "을(를) 먹었어요 - 정답이 아니에요.");
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
      var size = text.length <= 2 ? 14 : text.length === 3 ? 12 : 10;
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

    nextK = MIN_K;
    unlockedThisRun = false;
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
    baseNumEl.textContent = String(conf.dan);
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
