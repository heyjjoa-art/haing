// 쌓기나무 - 정육면체를 쌓아 만든 입체 모양을 앞·옆·위에서 본 평면도와 잇는
// 초등 수학 단원 게임. 목표로 주어진 세 방향 평면도를 보고 직접 쌓기나무를
// 놓아 똑같은 모양을 만들면 클리어된다. 채점은 "출제된 것과 같은 배치인가"가
// 아니라 "내가 쌓은 모양의 세 평면도가 목표와 같은가"로 한다 - 같은 세 평면도를
// 만드는 쌓기 방법은 여러 가지일 수 있고, 그 전부가 수학적으로 정답이기 때문.
// 관리자 계정에서만 테스트하는 개발 중 게임이라 WordGameStore(게임 기회)
// 연동은 아직 하지 않는다.
//
// 쌓기나무는 전부 레고 2x2 블록 모양(스터드 4개)으로 그린다. 층(1층=바닥)마다
// 색이 다르고, 앞/옆/위 평면도도 같은 층 색으로 칠해서 색만 보고도 몇 층인지
// 짝지어볼 수 있게 했다(LEGO_COLORS·levelColor 참고).
(function () {
  "use strict";

  var SVG_NS = "http://www.w3.org/2000/svg";

  // 아이소메트릭 투영 상수 - 칸 하나(TILE_W x TILE_H 마름모)와 정육면체 높이(CUBE_H).
  // 난이도가 바뀌어도 나무토막 하나의 화면 크기는 항상 이 값 그대로다 - SVG를
  // width:100%로 컨테이너에 맞춰 늘이지 않고, 이 단위를 그대로 픽셀 크기로 써서
  // 그리기 때문에(renderBoard 참고) 난이도별로 달라지는 건 칸 개수뿐이다.
  var TILE_W = 36;
  var TILE_H = 20;
  var CUBE_H = 40;

  var LEVELS = [
    { label: "쉬움", size: 2, maxHeight: 2, minCount: 3, maxCount: 5 },
    { label: "보통", size: 3, maxHeight: 3, minCount: 6, maxCount: 12 },
    { label: "어려움", size: 4, maxHeight: 4, minCount: 12, maxCount: 24 }
  ];
  var LEVEL_COUNT = LEVELS.length;

  var levelNumEl = document.getElementById("blocksLevelNum");
  var levelTotalEl = document.getElementById("blocksLevelTotal");
  var levelSelectEl = document.getElementById("blocksLevelSelect");
  var currentLevel = 1;

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
  var restartBtn = document.getElementById("blocksRestartBtn");

  var overlayEl = document.getElementById("blocksOverlay");
  var overlayTitleEl = document.getElementById("blocksOverlayTitle");
  var overlayDescEl = document.getElementById("blocksOverlayDesc");
  var nextLevelBtn = document.getElementById("blocksNextLevelBtn");
  var newPuzzleBtn = document.getElementById("blocksNextBtn");

  var size = 2;
  var maxHeight = 2;
  var current = [];        // 지금 아이가 쌓고 있는 높이 지도
  var targetViews = null;  // 목표 세 평면도 (front/side/top) - 정답 판정 기준
  var targetHeights = null; // 위 평면도 색칠에 쓰는 목표 높이 원본(그 칸에서 가장 위에 보이는 층 색을 정하려면 높이 값이 필요해서 boolean인 targetViews.top과 별도로 갖고 있는다)
  var solved = false;
  var startTime = 0;
  var timerId = null;

  // 층(1층=바닥)마다 정해진 레고 컬러 - 보드의 정육면체, 앞/옆 평면도의 층별
  // 칸, 위 평면도의 칸(그 칸에서 가장 위에 보이는 층 기준) 모두 이 배열의
  // 같은 색을 써서 세 평면도와 실제로 쌓은 모양을 색으로도 맞춰볼 수 있게 한다.
  var LEGO_COLORS = ["#e2231a", "#f6c500", "#0055bf", "#237841"]; // 빨강·노랑·파랑·초록(어려움 4층까지 커버)

  function clamp255(v) {
    return Math.max(0, Math.min(255, v));
  }

  // percent>0이면 흰색 쪽으로, percent<0이면 검은색 쪽으로 색을 섞어 밝기를 조절한다.
  // 큐브의 옆면(어둡게)·윗면 하이라이트·스터드(밝게) 색을 컬러 하나로부터 계산할 때 쓴다.
  function shadeColor(hex, percent) {
    var num = parseInt(hex.replace("#", ""), 16);
    var r = (num >> 16) & 255, g = (num >> 8) & 255, b = num & 255;
    function adjust(v) {
      return percent < 0 ? clamp255(Math.round(v * (1 + percent))) : clamp255(Math.round(v + (255 - v) * percent));
    }
    r = adjust(r); g = adjust(g); b = adjust(b);
    return "rgb(" + r + "," + g + "," + b + ")";
  }

  function levelColor(level) {
    return LEGO_COLORS[(level - 1) % LEGO_COLORS.length];
  }

  // 평면도 미니 칸을 레고 스터드가 콕콕 박힌 것처럼 보이게 - 칸 배경은 층 색,
  // 그 위에 살짝 밝은 원 4개(2x2 스터드 하이라이트)를 겹쳐 그린다.
  function legoCellBackground(hex) {
    var studColor = "rgba(255,255,255,0.55)";
    return (
      "radial-gradient(circle at 30% 30%, " + studColor + " 0 22%, transparent 23%)," +
      "radial-gradient(circle at 70% 30%, " + studColor + " 0 22%, transparent 23%)," +
      "radial-gradient(circle at 30% 70%, " + studColor + " 0 22%, transparent 23%)," +
      "radial-gradient(circle at 70% 70%, " + studColor + " 0 22%, transparent 23%)," +
      hex
    );
  }

  function paintLegoCell(el, hex) {
    el.style.background = legoCellBackground(hex);
    el.style.border = "1px solid " + shadeColor(hex, -0.4);
  }

  function clearLegoCell(el) {
    el.style.background = "";
    el.style.border = "";
  }

  function childKeyPart() {
    var childId = typeof ChildStore !== "undefined" && ChildStore.getActive();
    return childId ? childId + "_" : "guest_";
  }

  function unlockedLevelKey() {
    return "haingBlocksUnlockedLevel_" + childKeyPart();
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

  function bestTimeKey() {
    return "haingBlocksBest_" + childKeyPart() + currentLevel;
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
  // 앞/옆 평면도: 행 하나가 "그 층"이므로 층 번호 그대로 LEGO_COLORS 색을 칠한다.
  function renderLinearView(el, heights, n, maxH) {
    el.innerHTML = "";
    el.style.gridTemplateColumns = "repeat(" + n + ", 1fr)";
    el.style.gridTemplateRows = "repeat(" + maxH + ", 1fr)";
    for (var levelFromTop = 0; levelFromTop < maxH; levelFromTop++) {
      var level = maxH - levelFromTop;
      for (var i = 0; i < n; i++) {
        var cell = document.createElement("div");
        var filled = heights[i] >= level;
        cell.className = "blocks-view-cell" + (filled ? " filled" : "");
        if (filled) paintLegoCell(cell, levelColor(level));
        else clearLegoCell(cell);
        el.appendChild(cell);
      }
    }
  }

  // 위 평면도: 위에서 내려다보면 그 칸에서 가장 위에 놓인 큐브만 보이므로,
  // 칸의 높이(target[r][c])에 해당하는 층 색을 칠한다 - 보드에서 그 칸의
  // 맨 위 큐브 색과 항상 같다.
  function renderTopView(el, heights, n) {
    el.innerHTML = "";
    el.style.gridTemplateColumns = "repeat(" + n + ", 1fr)";
    el.style.gridTemplateRows = "repeat(" + n + ", 1fr)";
    for (var r = 0; r < n; r++) {
      for (var c = 0; c < n; c++) {
        var cell = document.createElement("div");
        var h = heights[r][c];
        cell.className = "blocks-view-cell" + (h > 0 ? " filled" : "");
        if (h > 0) paintLegoCell(cell, levelColor(h));
        else clearLegoCell(cell);
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
    var originY = maxHeight * CUBE_H + 2 * TILE_H;
    var width = 2 * size * TILE_W;
    var height = originY + (2 * size - 1) * TILE_H;
    return { originX: originX, originY: originY, width: width, height: height };
  }

  // 바닥(빈 칸일 때 평평한 마름모가 놓이는 기준면)의 중심.
  function groundCenter(r, c, geo) {
    return {
      x: geo.originX + (c - r) * TILE_W,
      y: geo.originY + (c + r) * TILE_H
    };
  }

  // k번째(0부터) 정육면체 윗면의 중심 - 바닥에서 위로 (k+1)*CUBE_H만큼 떠 있다.
  // 큐브의 옆면은 이 점에서 아래로 CUBE_H만큼 그려 바닥(또는 그 아래 큐브의
  // 윗면)까지 맞닿게 한다(leftFacePoints/rightFacePoints 참고) - 그래서 쌓을수록
  // 화면에서 위로 자라지, 바닥 아래로 파고들지 않는다.
  function cubeTopCenter(r, c, k, geo) {
    var ground = groundCenter(r, c, geo);
    return { x: ground.x, y: ground.y - (k + 1) * CUBE_H };
  }

  function createPolygon(points, cls, r, c, action) {
    var poly = document.createElementNS(SVG_NS, "polygon");
    poly.setAttribute("points", points.join(" "));
    poly.setAttribute("class", cls);
    if (r !== undefined) {
      poly.setAttribute("data-r", String(r));
      poly.setAttribute("data-c", String(c));
      poly.setAttribute("data-action", action);
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

  // 레고 큐브 윗면(다이아몬드 x=u*TILE_W, y=v*TILE_H, |u|+|v|<=1)에 2x2 스터드를
  // 얹는다. 실제 레고 스터드처럼 표면 위로 살짝 튀어나온 원기둥으로 보이도록
  // 밑동 타원(어두운 색) + 옆면 사각형(어두운 색) + 윗면 타원(밝은 색), 세 조각을
  // 겹쳐 그린다 - 밋밋한 타원 하나만으로는 튀어나온 느낌이 나지 않기 때문.
  function appendLegoStuds(parent, x, y, r, c, color) {
    var studRx = TILE_W * 0.19;
    var studRy = TILE_H * 0.26;
    var studBump = 6;
    var topColor = shadeColor(color, 0.2);
    var sideColor = shadeColor(color, -0.3);
    var strokeColor = shadeColor(color, -0.55);
    // 나무토막의 윗면 다이아몬드 자체가 칸의 r축·c축을 따라 45도 돌아간
    // 모양이므로(topFacePoints 참고 - 위/오른쪽/아래/왼쪽 꼭짓점이 그 두 축
    // 방향이다), 2x2 스터드도 화면 가로세로가 아니라 그 두 축을 따라 배치해야
    // 나무 하나와 같은 방향으로 돌아간 것처럼 보인다. du/dc는 그 칸 안에서
    // 스터드가 앞/뒤(r), 왼/오(c) 중 어느 쪽에 있는지를 나타낸다. f가 작을수록
    // 네 스터드가 나무토막 중앙 쪽으로 모이면서도(대칭이라 네 변 간격은 항상
    // 똑같다) 실제 2x2 레고처럼 중앙에 옹기종기 모인 느낌이 난다.
    var f = 0.22;
    var axisOffsets = [
      { du: -1, dc: -1 }, // 뒤쪽 꼭짓점 방향
      { du: -1, dc: 1 },  // 오른쪽 꼭짓점 방향
      { du: 1, dc: -1 },  // 왼쪽 꼭짓점 방향
      { du: 1, dc: 1 }    // 앞쪽 꼭짓점 방향
    ];

    for (var i = 0; i < axisOffsets.length; i++) {
      var du = axisOffsets[i].du, dc = axisOffsets[i].dc;
      var sx = x + f * TILE_W * (dc - du);
      var sy = y + f * TILE_H * (du + dc);

      var base = document.createElementNS(SVG_NS, "ellipse");
      base.setAttribute("cx", String(sx));
      base.setAttribute("cy", String(sy));
      base.setAttribute("rx", String(studRx));
      base.setAttribute("ry", String(studRy));
      base.style.fill = sideColor;
      base.setAttribute("data-r", String(r));
      base.setAttribute("data-c", String(c));
      base.setAttribute("data-action", "add");
      parent.appendChild(base);

      var side = document.createElementNS(SVG_NS, "rect");
      side.setAttribute("x", String(sx - studRx));
      side.setAttribute("y", String(sy - studBump));
      side.setAttribute("width", String(studRx * 2));
      side.setAttribute("height", String(studBump));
      side.style.fill = sideColor;
      side.setAttribute("data-r", String(r));
      side.setAttribute("data-c", String(c));
      side.setAttribute("data-action", "add");
      parent.appendChild(side);

      var top = document.createElementNS(SVG_NS, "ellipse");
      top.setAttribute("cx", String(sx));
      top.setAttribute("cy", String(sy - studBump));
      top.setAttribute("rx", String(studRx));
      top.setAttribute("ry", String(studRy));
      top.style.fill = topColor;
      top.style.stroke = strokeColor;
      top.style.strokeWidth = "0.7";
      top.setAttribute("data-r", String(r));
      top.setAttribute("data-c", String(c));
      top.setAttribute("data-action", "add");
      parent.appendChild(top);
    }
  }

  // 뒤에서 앞으로(d = r+c 오름차순), 아래에서 위로(k 오름차순) 그려야 앞쪽
  // 큐브가 뒤쪽 큐브를 자연스럽게 가린다. 같은 d의 칸들은 화면에서 겹치지
  // 않으므로 그 안의 순서는 상관없다. 모드 버튼 없이 클릭한 면으로 동작을
  // 구분한다 - 맨 위 면(빈 칸의 바닥 타일 포함)을 누르면 쌓고(data-action="add"),
  // 이미 쌓인 큐브의 옆면(왼쪽·오른쪽)을 누르면 그 칸의 맨 위 큐브를 뺀다
  // (data-action="remove") - 어느 층의 옆면을 누르든 항상 맨 위 큐브가 빠진다.
  function renderBoard() {
    var geo = boardGeometry();
    boardSvg.setAttribute("viewBox", "0 0 " + geo.width + " " + geo.height);
    // width:100%로 컨테이너에 맞춰 늘이지 않고 실제 픽셀 크기를 그대로 준다 -
    // 그래야 난이도가 바뀌어도(칸 개수만 다름) 나무토막 하나의 화면 크기가 항상
    // 똑같이 유지된다.
    boardSvg.setAttribute("width", String(geo.width));
    boardSvg.setAttribute("height", String(geo.height));
    while (boardSvg.firstChild) boardSvg.removeChild(boardSvg.firstChild);

    var maxD = 2 * (size - 1);
    for (var d = 0; d <= maxD; d++) {
      for (var r = 0; r < size; r++) {
        var c = d - r;
        if (c < 0 || c >= size) continue;
        var h = current[r][c];
        if (h === 0) {
          var floorCenter = groundCenter(r, c, geo);
          boardSvg.appendChild(
            createPolygon(topFacePoints(floorCenter.x, floorCenter.y), "blocks-floor blocks-hit-add", r, c, "add")
          );
          continue;
        }
        for (var k = 0; k < h; k++) {
          var center = cubeTopCenter(r, c, k, geo);
          var isTop = k === h - 1;
          var color = levelColor(k + 1);
          var leftPoly = createPolygon(leftFacePoints(center.x, center.y), "blocks-hit-remove", r, c, "remove");
          leftPoly.style.fill = shadeColor(color, -0.35);
          leftPoly.style.stroke = shadeColor(color, -0.55);
          boardSvg.appendChild(leftPoly);
          var rightPoly = createPolygon(rightFacePoints(center.x, center.y), "blocks-hit-remove", r, c, "remove");
          rightPoly.style.fill = shadeColor(color, -0.15);
          rightPoly.style.stroke = shadeColor(color, -0.55);
          boardSvg.appendChild(rightPoly);
          if (isTop) {
            var topPoly = createPolygon(topFacePoints(center.x, center.y), "blocks-hit-add", r, c, "add");
            topPoly.style.fill = color;
            topPoly.style.stroke = shadeColor(color, -0.55);
            boardSvg.appendChild(topPoly);
            appendLegoStuds(boardSvg, center.x, center.y, r, c, color);
          }
        }
      }
    }
  }

  // ── 조작 ────────────────────────────────────────────────────────
  function onCellActivate(r, c, action) {
    if (solved) return;
    if (action === "remove") {
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
    var action = e.target.getAttribute("data-action");
    if (r === null || c === null || action === null) return;
    onCellActivate(parseInt(r, 10), parseInt(c, 10), action);
  });

  function onWin() {
    solved = true;
    stopTimer();
    var elapsed = Date.now() - startTime;
    var isNewBest = maybeSaveBestTime(elapsed);

    var isFinalLevel = currentLevel === LEVEL_COUNT;
    var justUnlockedNext = currentLevel === getUnlockedLevel() && !isFinalLevel;
    if (justUnlockedNext) unlockLevel(currentLevel + 1);
    renderLevelChoice();

    overlayTitleEl.textContent = "🎉 완성했어요!";
    overlayDescEl.textContent =
      LEVELS[currentLevel - 1].label + " · 쌓기나무 " + countBlocks(current, size) + "개 · 시간 " +
      formatTime(elapsed) + (isNewBest ? " 🎉 신기록!" : "") +
      (justUnlockedNext ? " · 다음 레벨이 열렸어요!" : "");
    nextLevelBtn.hidden = isFinalLevel;
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

  // level을 안 주면(예: "다음 문제" 버튼) 지금 레벨에서 새 문제만 다시 낸다.
  function newGame(level) {
    currentLevel = level || currentLevel;
    levelNumEl.textContent = String(currentLevel);
    renderLevelChoice();

    var conf = LEVELS[currentLevel - 1];
    size = conf.size;
    maxHeight = conf.maxHeight;
    var target = generatePuzzle(size, maxHeight, conf.minCount, conf.maxCount);
    targetViews = computeViews(target, size);
    targetHeights = target;

    renderLinearView(frontGridEl, targetViews.front, size, maxHeight);
    renderLinearView(sideGridEl, targetViews.side, size, maxHeight);
    renderTopView(topGridEl, targetHeights, size);

    showBestTime();
    resetBoard();
  }

  levelSelectEl.addEventListener("change", function () {
    newGame(parseInt(levelSelectEl.value, 10));
  });

  restartBtn.addEventListener("click", resetBoard);
  newPuzzleBtn.addEventListener("click", function () {
    newGame(currentLevel);
  });
  nextLevelBtn.addEventListener("click", function () {
    newGame(Math.min(currentLevel + 1, LEVEL_COUNT));
  });

  document.addEventListener("visibilitychange", function () {
    if (document.hidden && !solved) stopTimer();
    else if (!document.hidden && !solved) startTimer();
  });

  levelTotalEl.textContent = String(LEVEL_COUNT);
  newGame(getUnlockedLevel());
})();
