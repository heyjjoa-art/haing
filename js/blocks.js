// 쌓기나무 - 정육면체를 쌓아 만든 입체 모양을 앞·옆·위에서 본 평면도와 잇는
// 초등 수학 단원 게임. 목표로 주어진 세 방향 평면도를 보고 직접 쌓기나무를
// 놓아 똑같은 모양을 만들면 클리어된다. 채점은 "출제된 것과 같은 배치인가"가
// 아니라 "내가 쌓은 모양의 세 평면도가 목표와 같은가"로 한다 - 같은 세 평면도를
// 만드는 쌓기 방법은 여러 가지일 수 있고, 그 전부가 수학적으로 정답이기 때문.
// 관리자 계정에서만 테스트하는 개발 중 게임이라 WordGameStore(게임 기회)
// 연동은 아직 하지 않는다.
(function () {
  "use strict";

  var SVG_NS = "http://www.w3.org/2000/svg";

  // 아이소메트릭 투영 상수 - 칸 하나(TILE_W x TILE_H 마름모)와 정육면체 높이(CUBE_H).
  var TILE_W = 28;
  var TILE_H = 16;
  var CUBE_H = 32;

  var DIFFICULTIES = {
    easy: { label: "쉬움", size: 2, maxHeight: 2, minCount: 3, maxCount: 5 },
    medium: { label: "보통", size: 3, maxHeight: 3, minCount: 6, maxCount: 12 },
    hard: { label: "어려움", size: 4, maxHeight: 4, minCount: 12, maxCount: 24 }
  };
  var DIFFICULTY_ORDER = ["easy", "medium", "hard"];
  var difficultyTabs = {
    easy: document.getElementById("blocksEasyTab"),
    medium: document.getElementById("blocksMediumTab"),
    hard: document.getElementById("blocksHardTab")
  };
  var currentDifficulty = "easy";

  var timerEl = document.getElementById("blocksTimer");
  var bestEl = document.getElementById("blocksBest");
  var countEl = document.getElementById("blocksCount");

  var frontGridEl = document.getElementById("blocksFrontGrid");
  var frontBadgeEl = document.getElementById("blocksFrontBadge");
  var sideGridEl = document.getElementById("blocksSideGrid");
  var sideBadgeEl = document.getElementById("blocksSideBadge");
  var topGridEl = document.getElementById("blocksTopGrid");
  var topBadgeEl = document.getElementById("blocksTopBadge");

  var boardSvg = document.getElementById("blocksBoard");

  var stackModeBtn = document.getElementById("blocksStackModeBtn");
  var removeModeBtn = document.getElementById("blocksRemoveModeBtn");
  var restartBtn = document.getElementById("blocksRestartBtn");

  var overlayEl = document.getElementById("blocksOverlay");
  var overlayTitleEl = document.getElementById("blocksOverlayTitle");
  var overlayDescEl = document.getElementById("blocksOverlayDesc");
  var nextBtn = document.getElementById("blocksNextBtn");

  var size = 2;
  var maxHeight = 2;
  var current = [];        // 지금 아이가 쌓고 있는 높이 지도
  var targetViews = null;  // 목표 세 평면도 (front/side/top) - 정답 판정 기준
  var mode = "stack";      // "stack" | "remove"
  var solved = false;
  var startTime = 0;
  var timerId = null;

  function childKeyPart() {
    var childId = typeof ChildStore !== "undefined" && ChildStore.getActive();
    return childId ? childId + "_" : "guest_";
  }

  function bestTimeKey() {
    return "haingBlocksBest_" + childKeyPart() + currentDifficulty;
  }

  function formatTime(ms) {
    var totalSec = Math.floor(ms / 1000);
    var m = Math.floor(totalSec / 60);
    var s = totalSec % 60;
    return m + ":" + (s < 10 ? "0" : "") + s;
  }

  function showBestTime() {
    var saved = parseInt(localStorage.getItem(bestTimeKey()), 10);
    bestEl.textContent = saved ? formatTime(saved) : "-";
  }

  function maybeSaveBestTime(elapsedMs) {
    var key = bestTimeKey();
    var saved = parseInt(localStorage.getItem(key), 10);
    var isNewBest = !saved || elapsedMs < saved;
    if (isNewBest) localStorage.setItem(key, String(elapsedMs));
    showBestTime();
    return isNewBest;
  }

  function startTimer() {
    startTime = Date.now();
    if (timerId) clearInterval(timerId);
    timerEl.textContent = "0:00";
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

  // ── 높이 지도 <-> 세 평면도 ────────────────────────────────────────
  function emptyHeightMap(n) {
    var g = [];
    for (var r = 0; r < n; r++) {
      var row = [];
      for (var c = 0; c < n; c++) row.push(0);
      g.push(row);
    }
    return g;
  }

  function countBlocks(h, n) {
    var total = 0;
    for (var r = 0; r < n; r++) {
      for (var c = 0; c < n; c++) total += h[r][c];
    }
    return total;
  }

  // r=0이 맨 뒤 줄, r=n-1이 맨 앞 줄. 옆에서(오른쪽에서) 보면 맨 앞 줄이
  // 화면 왼쪽에 오므로 side[i]는 뒤집힌 순서로 뽑는다.
  function computeViews(h, n) {
    var front = [];
    var side = [];
    var top = [];
    var c, r;
    for (c = 0; c < n; c++) {
      var maxFront = 0;
      for (r = 0; r < n; r++) {
        if (h[r][c] > maxFront) maxFront = h[r][c];
      }
      front.push(maxFront);
    }
    for (var i = 0; i < n; i++) {
      var srcRow = n - 1 - i;
      var maxSide = 0;
      for (c = 0; c < n; c++) {
        if (h[srcRow][c] > maxSide) maxSide = h[srcRow][c];
      }
      side.push(maxSide);
    }
    for (r = 0; r < n; r++) {
      var row = [];
      for (c = 0; c < n; c++) row.push(h[r][c] > 0);
      top.push(row);
    }
    return { front: front, side: side, top: top };
  }

  function arraysEqual(a, b) {
    if (a.length !== b.length) return false;
    for (var i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }

  function topsEqual(a, b, n) {
    for (var r = 0; r < n; r++) {
      for (var c = 0; c < n; c++) {
        if (a[r][c] !== b[r][c]) return false;
      }
    }
    return true;
  }

  // ── 문제 출제 ────────────────────────────────────────────────────
  function randomHeightMap(n, maxH) {
    var g = emptyHeightMap(n);
    for (var r = 0; r < n; r++) {
      for (var c = 0; c < n; c++) {
        g[r][c] = Math.random() < 0.15 ? 0 : 1 + Math.floor(Math.random() * maxH);
      }
    }
    return g;
  }

  // 위에서 봤을 때 채워진 칸들이 상하좌우로 다 이어져 있는지 - 구멍 난 모양 방지.
  function isConnected(h, n) {
    var start = null;
    for (var r = 0; r < n && !start; r++) {
      for (var c = 0; c < n; c++) {
        if (h[r][c] > 0) {
          start = [r, c];
          break;
        }
      }
    }
    if (!start) return false;

    var seen = {};
    seen[start[0] + "_" + start[1]] = true;
    var stack = [start];
    var visitedCount = 0;
    var deltas = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    while (stack.length > 0) {
      var pos = stack.pop();
      visitedCount++;
      for (var i = 0; i < deltas.length; i++) {
        var nr = pos[0] + deltas[i][0];
        var nc = pos[1] + deltas[i][1];
        var key = nr + "_" + nc;
        if (nr >= 0 && nr < n && nc >= 0 && nc < n && h[nr][nc] > 0 && !seen[key]) {
          seen[key] = true;
          stack.push([nr, nc]);
        }
      }
    }

    var totalFilled = 0;
    for (var r2 = 0; r2 < n; r2++) {
      for (var c2 = 0; c2 < n; c2++) {
        if (h[r2][c2] > 0) totalFilled++;
      }
    }
    return visitedCount === totalFilled;
  }

  // 채워진 칸이 전부 같은 높이인 직육면체는 너무 쉬우니 제외.
  function isUniformBlock(h, n) {
    var first = null;
    for (var r = 0; r < n; r++) {
      for (var c = 0; c < n; c++) {
        if (first === null) first = h[r][c];
        else if (h[r][c] !== first) return false;
      }
    }
    return true;
  }

  function generatePuzzle(n, maxH, minCount, maxCount) {
    var fallback = null;
    for (var attempt = 0; attempt < 200; attempt++) {
      var g = randomHeightMap(n, maxH);
      fallback = g;
      var count = countBlocks(g, n);
      if (count < minCount || count > maxCount) continue;

      var hasMaxHeight = false;
      for (var r = 0; r < n; r++) {
        for (var c = 0; c < n; c++) {
          if (g[r][c] === maxH) hasMaxHeight = true;
        }
      }
      if (!hasMaxHeight) continue;
      if (!isConnected(g, n)) continue;
      if (isUniformBlock(g, n)) continue;

      return g;
    }
    return fallback;
  }

  // ── 평면도 미니 격자 렌더링 (목표만 그린다 - 현재 상태는 배지로만 알려준다) ──
  function renderLinearView(el, heights, n, maxH) {
    el.innerHTML = "";
    el.style.gridTemplateColumns = "repeat(" + n + ", 1fr)";
    el.style.gridTemplateRows = "repeat(" + maxH + ", 1fr)";
    for (var levelFromTop = 0; levelFromTop < maxH; levelFromTop++) {
      var level = maxH - levelFromTop;
      for (var i = 0; i < n; i++) {
        var cell = document.createElement("div");
        cell.className = "blocks-view-cell" + (heights[i] >= level ? " filled" : "");
        el.appendChild(cell);
      }
    }
  }

  function renderTopView(el, top, n) {
    el.innerHTML = "";
    el.style.gridTemplateColumns = "repeat(" + n + ", 1fr)";
    el.style.gridTemplateRows = "repeat(" + n + ", 1fr)";
    for (var r = 0; r < n; r++) {
      for (var c = 0; c < n; c++) {
        var cell = document.createElement("div");
        cell.className = "blocks-view-cell" + (top[r][c] ? " filled" : "");
        el.appendChild(cell);
      }
    }
  }

  function setBadge(el, ok) {
    el.textContent = ok ? "✓" : "✗";
    el.className = "blocks-view-badge" + (ok ? " ok" : " no");
  }

  function updateBadges() {
    var cv = computeViews(current, size);
    var frontOk = arraysEqual(cv.front, targetViews.front);
    var sideOk = arraysEqual(cv.side, targetViews.side);
    var topOk = topsEqual(cv.top, targetViews.top, size);
    setBadge(frontBadgeEl, frontOk);
    setBadge(sideBadgeEl, sideOk);
    setBadge(topBadgeEl, topOk);
    return frontOk && sideOk && topOk;
  }

  // ── 아이소메트릭 보드 (SVG) ──────────────────────────────────────
  function boardGeometry() {
    var originX = size * TILE_W;
    var originY = TILE_H + maxHeight * CUBE_H;
    var width = 2 * size * TILE_W;
    var height = originY + (2 * size - 1) * TILE_H + CUBE_H + TILE_H;
    return { originX: originX, originY: originY, width: width, height: height };
  }

  function cubeCenter(r, c, k, geo) {
    return {
      x: geo.originX + (c - r) * TILE_W,
      y: geo.originY + (c + r) * TILE_H - k * CUBE_H
    };
  }

  function createPolygon(points, cls, r, c) {
    var poly = document.createElementNS(SVG_NS, "polygon");
    poly.setAttribute("points", points.join(" "));
    poly.setAttribute("class", cls);
    if (r !== undefined) {
      poly.setAttribute("data-r", String(r));
      poly.setAttribute("data-c", String(c));
    }
    return poly;
  }

  function topFacePoints(x, y) {
    return [x + "," + (y - TILE_H), (x + TILE_W) + "," + y, x + "," + (y + TILE_H), (x - TILE_W) + "," + y];
  }

  function leftFacePoints(x, y) {
    return [
      (x - TILE_W) + "," + y,
      x + "," + (y + TILE_H),
      x + "," + (y + TILE_H + CUBE_H),
      (x - TILE_W) + "," + (y + CUBE_H)
    ];
  }

  function rightFacePoints(x, y) {
    return [
      (x + TILE_W) + "," + y,
      x + "," + (y + TILE_H),
      x + "," + (y + TILE_H + CUBE_H),
      (x + TILE_W) + "," + (y + CUBE_H)
    ];
  }

  // 뒤에서 앞으로(d = r+c 오름차순), 아래에서 위로(k 오름차순) 그려야 앞쪽
  // 큐브가 뒤쪽 큐브를 자연스럽게 가린다. 같은 d의 칸들은 화면에서 겹치지
  // 않으므로 그 안의 순서는 상관없다. 맨 위 면(또는 빈 칸의 바닥 타일)만
  // data-r/data-c를 달아 클릭 대상으로 삼는다.
  function renderBoard() {
    var geo = boardGeometry();
    boardSvg.setAttribute("viewBox", "0 0 " + geo.width + " " + geo.height);
    while (boardSvg.firstChild) boardSvg.removeChild(boardSvg.firstChild);

    var maxD = 2 * (size - 1);
    for (var d = 0; d <= maxD; d++) {
      for (var r = 0; r < size; r++) {
        var c = d - r;
        if (c < 0 || c >= size) continue;
        var h = current[r][c];
        if (h === 0) {
          var floorCenter = cubeCenter(r, c, 0, geo);
          boardSvg.appendChild(
            createPolygon(topFacePoints(floorCenter.x, floorCenter.y), "blocks-floor blocks-hit", r, c)
          );
          continue;
        }
        for (var k = 0; k < h; k++) {
          var center = cubeCenter(r, c, k, geo);
          boardSvg.appendChild(createPolygon(leftFacePoints(center.x, center.y), "blocks-face-left"));
          boardSvg.appendChild(createPolygon(rightFacePoints(center.x, center.y), "blocks-face-right"));
          if (k === h - 1) {
            boardSvg.appendChild(
              createPolygon(topFacePoints(center.x, center.y), "blocks-face-top blocks-hit", r, c)
            );
          }
        }
      }
    }
  }

  // ── 조작 ────────────────────────────────────────────────────────
  function onCellActivate(r, c) {
    if (solved) return;
    if (mode === "remove") {
      if (current[r][c] > 0) current[r][c]--;
    } else if (current[r][c] < maxHeight) {
      current[r][c]++;
    }
    renderBoard();
    countEl.textContent = String(countBlocks(current, size));
    var allMatch = updateBadges();
    if (allMatch) onWin();
  }

  boardSvg.addEventListener("click", function (e) {
    if (solved) return;
    var r = e.target.getAttribute("data-r");
    var c = e.target.getAttribute("data-c");
    if (r === null || c === null) return;
    onCellActivate(parseInt(r, 10), parseInt(c, 10));
  });

  function onWin() {
    solved = true;
    stopTimer();
    var elapsed = Date.now() - startTime;
    var isNewBest = maybeSaveBestTime(elapsed);
    overlayTitleEl.textContent = "🎉 완성했어요!";
    overlayDescEl.textContent =
      DIFFICULTIES[currentDifficulty].label + " · 쌓기나무 " + countBlocks(current, size) + "개 · 시간 " +
      formatTime(elapsed) + (isNewBest ? " 🎉 신기록!" : "");
    overlayEl.hidden = false;
  }

  function resetBoard() {
    current = emptyHeightMap(size);
    solved = false;
    overlayEl.hidden = true;
    countEl.textContent = "0";
    renderBoard();
    updateBadges();
    startTimer();
  }

  function newGame() {
    var conf = DIFFICULTIES[currentDifficulty];
    size = conf.size;
    maxHeight = conf.maxHeight;
    var target = generatePuzzle(size, maxHeight, conf.minCount, conf.maxCount);
    targetViews = computeViews(target, size);

    renderLinearView(frontGridEl, targetViews.front, size, maxHeight);
    renderLinearView(sideGridEl, targetViews.side, size, maxHeight);
    renderTopView(topGridEl, targetViews.top, size);

    showBestTime();
    resetBoard();
  }

  function setDifficulty(key) {
    currentDifficulty = key;
    DIFFICULTY_ORDER.forEach(function (k) {
      difficultyTabs[k].classList.toggle("active", k === key);
    });
    newGame();
  }

  function setMode(next) {
    mode = next;
    stackModeBtn.classList.toggle("active", mode === "stack");
    removeModeBtn.classList.toggle("active", mode === "remove");
  }

  DIFFICULTY_ORDER.forEach(function (key) {
    difficultyTabs[key].addEventListener("click", function () {
      setDifficulty(key);
    });
  });

  stackModeBtn.addEventListener("click", function () {
    setMode("stack");
  });
  removeModeBtn.addEventListener("click", function () {
    setMode("remove");
  });
  restartBtn.addEventListener("click", resetBoard);
  nextBtn.addEventListener("click", newGame);

  document.addEventListener("visibilitychange", function () {
    if (document.hidden && !solved) stopTimer();
    else if (!document.hidden && !solved) startTimer();
  });

  setDifficulty("easy");
})();
