// 세 번째 보너스 게임. 아이가 모은 단어카드가 아니라 초등/중등 교과서 수준별
// 단어은행(js/crossword-words.js)에서 골라 매번 새 낱말퍼즐을 짠다. 유일해나 최적
// 밀도는 신경쓰지 않는 캐주얼 배치 알고리즘 - 겹칠 자리를 못 찾은 단어는 그냥 건너뛴다.
//
// 초등/중등 각각 학년(레벨) 순서로 단어 더미를 하나씩 다 써야(=그 레벨 단어가 거의
// 다 나와야) 다음 레벨로 넘어간다. 그래서 한 판에서 실제로 칸에 놓인(=문제로 나온)
// 단어는 그 레벨의 "남은 단어 더미"에서 바로 빼서, 같은 레벨 안에서는 이미 나온
// 단어가 다시 안 나온다. 더미가 거의 바닥나면 다음 레벨로, 맨 마지막 레벨(중등이면
// 중3, 초등이면 5~6학년)에서 바닥나면 그 레벨 단어를 다시 섞어서 계속 반복한다.
(function () {
  "use strict";

  var MODE_ORDER = ["elementary", "middle"];
  var TARGET_WORDS = 12;
  var GENERATE_ATTEMPTS = 20;
  var GRID_SIZE = 15;
  // 레벨의 남은 단어 더미가 이 개수 이하로 줄어들면(=거의 다 나왔으면) 다음 레벨로
  // 넘어간다. 0이 될 때까지 기다리면 마지막 몇 개가 겹칠 자리를 못 찾아 영영 안
  // 뽑힐 수 있어서, 소진 기준을 조금 여유 있게 잡았다.
  var LEVEL_EXHAUST_THRESHOLD = 8;

  var creditsEl = document.getElementById("crosswordCredits");
  var bestEl = document.getElementById("crosswordBest");
  var timerEl = document.getElementById("crosswordTimer");
  var totalSolvedEl = document.getElementById("crosswordTotalSolved");
  var levelLabelEl = document.getElementById("crosswordLevelLabel");
  var emptyEl = document.getElementById("crosswordEmpty");
  var playEl = document.getElementById("crosswordPlay");
  var boardEl = document.getElementById("crosswordBoard");
  var acrossListEl = document.getElementById("crosswordAcrossList");
  var downListEl = document.getElementById("crosswordDownList");

  var overlayEl = document.getElementById("crosswordOverlay");
  var overlayDescEl = document.getElementById("crosswordOverlayDesc");
  var overlayNoteEl = document.getElementById("crosswordOverlayNote");
  var retryBtn = document.getElementById("crosswordRetryBtn");

  var tabs = {
    elementary: document.getElementById("crosswordElementaryTab"),
    middle: document.getElementById("crosswordMiddleTab")
  };

  var currentMode = "elementary";
  var pendingLevelUpLabel = null; // 이번 판 끝나고 다음 판부터는 다음 레벨이라는 걸 알려줄 문구
  var puzzle = null;
  var userGrid = [];
  var cellWordMap = [];
  var inputMap = {};
  var wrapMap = {};
  var clueElByIdx = {};
  var selected = null;
  var direction = "across";
  var isSolved = false;
  var startTime = 0;
  var timerId = null;
  var countedThisPuzzle = {};

  function bestTimeKey(mode) {
    var childId = typeof ChildStore !== "undefined" && ChildStore.getActive();
    return "haingCrosswordBest_" + (childId ? childId + "_" : "guest_") + mode;
  }

  function totalSolvedKey() {
    var childId = typeof ChildStore !== "undefined" && ChildStore.getActive();
    return "haingCrosswordTotalSolved_" + (childId ? childId + "_" : "guest_");
  }

  var totalSolved = parseInt(localStorage.getItem(totalSolvedKey()), 10) || 0;

  function formatTime(totalSeconds) {
    var m = Math.floor(totalSeconds / 60);
    var s = totalSeconds % 60;
    return m + ":" + (s < 10 ? "0" : "") + s;
  }

  function showBestTime() {
    var raw = localStorage.getItem(bestTimeKey(currentMode));
    bestEl.textContent = raw ? formatTime(parseInt(raw, 10)) : "-";
  }

  // 레벨(학년 단계) 진행과, 그 레벨에서 아직 안 나온 단어 더미를 아이·모드별로
  // 저장해둔다. 예전 haingCrosswordBest_*/haingCrosswordTotalSolved_* 기록은 이
  // 기능과 무관한 별도 키라 전혀 건드리지 않는다 - 새 키(haingCrosswordPool_*)만
  // 새로 쓴다.
  function poolKey(mode) {
    var childId = typeof ChildStore !== "undefined" && ChildStore.getActive();
    return "haingCrosswordPool_" + (childId ? childId + "_" : "guest_") + mode;
  }

  function levelsFor(mode) {
    return CROSSWORD_WORD_BANK[mode].levels;
  }

  function clampLevelIndex(mode, levelIndex) {
    var levels = levelsFor(mode);
    return Math.max(0, Math.min(levelIndex, levels.length - 1));
  }

  // 그 레벨의 단어 전체를 다시 섞어 "남은 단어 더미"로 삼는다 - 레벨을 처음 시작할
  // 때나, 맨 마지막 레벨에서 더미가 바닥나 다시 도는 경우에 쓴다.
  function freshPool(mode, levelIndex) {
    levelIndex = clampLevelIndex(mode, levelIndex);
    var words = levelsFor(mode)[levelIndex].words.map(function (w) {
      return w.word;
    });
    return { levelIndex: levelIndex, remaining: shuffle(words) };
  }

  function loadPoolState(mode) {
    var raw = localStorage.getItem(poolKey(mode));
    if (raw) {
      try {
        var parsed = JSON.parse(raw);
        if (parsed && typeof parsed.levelIndex === "number" && Array.isArray(parsed.remaining)) {
          parsed.levelIndex = clampLevelIndex(mode, parsed.levelIndex);
          return parsed;
        }
      } catch (e) {
        // no-op - 아래에서 새로 만든다
      }
    }
    return freshPool(mode, 0);
  }

  function savePoolState(mode, state) {
    localStorage.setItem(poolKey(mode), JSON.stringify(state));
  }

  function updateLevelLabel(mode, levelIndex) {
    var levels = levelsFor(mode);
    levelLabelEl.textContent = levels.length > 1 ? "📚 " + levels[clampLevelIndex(mode, levelIndex)].label : "";
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
    timerEl.textContent = "0:00";
    timerId = setInterval(function () {
      timerEl.textContent = formatTime(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
  }
  var pendingToggle = false;

  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  function canPlace(grid, size, word, row, col, dir) {
    for (var i = 0; i < word.length; i++) {
      var r = dir === "across" ? row : row + i;
      var c = dir === "across" ? col + i : col;
      if (r < 0 || r >= size || c < 0 || c >= size) return false;
      var existing = grid[r][c];
      if (existing !== null && existing !== word[i]) return false;
      if (existing === null) {
        if (dir === "across") {
          if (r > 0 && grid[r - 1][c] !== null) return false;
          if (r < size - 1 && grid[r + 1][c] !== null) return false;
        } else {
          if (c > 0 && grid[r][c - 1] !== null) return false;
          if (c < size - 1 && grid[r][c + 1] !== null) return false;
        }
      }
    }
    var beforeR = dir === "across" ? row : row - 1;
    var beforeC = dir === "across" ? col - 1 : col;
    var afterR = dir === "across" ? row : row + word.length;
    var afterC = dir === "across" ? col + word.length : col;
    if (beforeR >= 0 && beforeC >= 0 && beforeR < size && beforeC < size && grid[beforeR][beforeC] !== null) return false;
    if (afterR >= 0 && afterC >= 0 && afterR < size && afterC < size && grid[afterR][afterC] !== null) return false;
    return true;
  }

  function placeWord(grid, word, row, col, dir) {
    for (var i = 0; i < word.length; i++) {
      var r = dir === "across" ? row : row + i;
      var c = dir === "across" ? col + i : col;
      grid[r][c] = word[i];
    }
  }

  function generateCrossword(levelWords, targetCount) {
    var size = GRID_SIZE;
    var grid = [];
    for (var r = 0; r < size; r++) grid.push(new Array(size).fill(null));

    var shuffled = shuffle(levelWords.slice()).map(function (w) {
      return { word: w.word, clue: w.clue };
    });
    if (shuffled.length === 0) return null;

    // 시작 단어(맨 처음 놓는 닻 단어)를 매번 무작위로 골라야 "새 퍼즐"을 눌렀을 때
    // 정말 다른 퍼즐이 나온다 - 길이순으로만 고르면 가장 긴 단어가 거의 항상 같아서
    // (예: 초등 레벨엔 제일 긴 단어가 하나뿐) 매번 비슷한 퍼즐만 반복해서 나왔었다.
    var first = shuffled[0];
    // 닻 단어를 뺀 나머지는 긴 단어부터 시도해야 교차 자리를 더 잘 찾는다.
    var candidates = shuffled.slice(1).sort(function (a, b) {
      return b.word.length - a.word.length;
    });

    var placed = [];
    var startRow = Math.floor(size / 2);
    var startCol = Math.floor((size - first.word.length) / 2);
    placeWord(grid, first.word, startRow, startCol, "across");
    placed.push({ word: first.word, clue: first.clue, row: startRow, col: startCol, dir: "across" });

    // 한 번 훑어서 못 겹친 단어라도, 나중에 다른 단어가 놓이면 그제서야 겹칠 자리가
    // 생길 수 있다(예: "학생"이 먼저 시도될 때는 "학교"가 아직 없어 실패해도, "학교"가
    // 놓인 뒤 다시 시도하면 성공) - 더는 못 놓는 단어가 없을 때까지 계속 돌린다.
    var remaining = candidates;
    var progress = true;
    while (placed.length < targetCount && remaining.length > 0 && progress) {
      progress = false;
      for (var wi = 0; wi < remaining.length && placed.length < targetCount; wi++) {
        var cand = remaining[wi];
        var best = null;
        for (var pi = 0; pi < placed.length && !best; pi++) {
          var p = placed[pi];
          for (var a = 0; a < p.word.length && !best; a++) {
            for (var b = 0; b < cand.word.length && !best; b++) {
              if (p.word[a] !== cand.word[b]) continue;
              var newDir = p.dir === "across" ? "down" : "across";
              var interR = p.dir === "across" ? p.row : p.row + a;
              var interC = p.dir === "across" ? p.col + a : p.col;
              var row = newDir === "down" ? interR - b : interR;
              var col = newDir === "across" ? interC - b : interC;
              if (canPlace(grid, size, cand.word, row, col, newDir)) {
                best = { row: row, col: col, dir: newDir };
              }
            }
          }
        }
        if (best) {
          placeWord(grid, cand.word, best.row, best.col, best.dir);
          placed.push({ word: cand.word, clue: cand.clue, row: best.row, col: best.col, dir: best.dir });
          remaining.splice(wi, 1);
          wi--;
          progress = true;
        }
      }
    }

    if (placed.length === 0) return null;

    var minR = size, maxR = -1, minC = size, maxC = -1;
    for (var r2 = 0; r2 < size; r2++) {
      for (var c2 = 0; c2 < size; c2++) {
        if (grid[r2][c2] === null) continue;
        if (r2 < minR) minR = r2;
        if (r2 > maxR) maxR = r2;
        if (c2 < minC) minC = c2;
        if (c2 > maxC) maxC = c2;
      }
    }
    minR = Math.max(0, minR - 1);
    minC = Math.max(0, minC - 1);
    maxR = Math.min(size - 1, maxR + 1);
    maxC = Math.min(size - 1, maxC + 1);
    var rows = maxR - minR + 1;
    var cols = maxC - minC + 1;

    var trimmed = [];
    for (var tr = 0; tr < rows; tr++) {
      var rowArr = [];
      for (var tc = 0; tc < cols; tc++) rowArr.push(grid[minR + tr][minC + tc]);
      trimmed.push(rowArr);
    }
    placed.forEach(function (p) {
      p.row -= minR;
      p.col -= minC;
    });

    var cellNumber = {};
    var counter = 1;
    for (var nr = 0; nr < rows; nr++) {
      for (var nc = 0; nc < cols; nc++) {
        if (trimmed[nr][nc] === null) continue;
        var startsAcross = (nc === 0 || trimmed[nr][nc - 1] === null) && nc + 1 < cols && trimmed[nr][nc + 1] !== null;
        var startsDown = (nr === 0 || trimmed[nr - 1][nc] === null) && nr + 1 < rows && trimmed[nr + 1][nc] !== null;
        if (startsAcross || startsDown) cellNumber[nr + "," + nc] = counter++;
      }
    }
    placed.forEach(function (p) {
      p.number = cellNumber[p.row + "," + p.col];
    });

    return { rows: rows, cols: cols, grid: trimmed, placed: placed, cellNumber: cellNumber };
  }

  // 한 번의 시도는 셔플 운에 따라 겹치는 단어 수가 들쭉날쭉하다(2~3개만 놓일 때도
  // 있음) - 몇 번 더 만들어보고 그중 가장 단어가 많이 들어간 퍼즐을 골라 쓴다.
  function generateBestCrossword(levelWords, targetCount, attempts) {
    var best = null;
    for (var i = 0; i < attempts; i++) {
      var result = generateCrossword(levelWords, targetCount);
      if (!result) continue;
      // 단어 수가 같으면(동점) 항상 먼저 나온 걸 고르지 않고 절반 확률로 새 걸로
      // 바꿔서, 같은 판이 매번 반복되지 않고 동점 결과들 사이에서도 섞이게 한다.
      if (!best || result.placed.length > best.placed.length || (result.placed.length === best.placed.length && Math.random() < 0.5)) {
        best = result;
      }
      if (best && best.placed.length >= targetCount) break;
    }
    return best;
  }

  function buildCellWordMap() {
    var map = [];
    for (var r = 0; r < puzzle.rows; r++) {
      map.push([]);
      for (var c = 0; c < puzzle.cols; c++) map[r].push({ across: null, down: null });
    }
    puzzle.placed.forEach(function (p, idx) {
      for (var i = 0; i < p.word.length; i++) {
        var r = p.dir === "across" ? p.row : p.row + i;
        var c = p.dir === "across" ? p.col + i : p.col;
        map[r][c][p.dir] = idx;
      }
    });
    return map;
  }

  function moveTo(r, c) {
    var input = inputMap[r + "," + c];
    if (input) input.focus();
  }

  function advance(r, c) {
    if (direction === "across") moveTo(r, c + 1);
    else moveTo(r + 1, c);
  }

  function prevTarget(r, c) {
    return direction === "across" ? { r: r, c: c - 1 } : { r: r - 1, c: c };
  }

  function wireCell(input, r, c) {
    input.addEventListener("pointerdown", function () {
      pendingToggle = !!(selected && selected.r === r && selected.c === c);
    });
    input.addEventListener("focus", function () {
      selected = { r: r, c: c };
      var info = cellWordMap[r][c];
      if (pendingToggle && info.across !== null && info.down !== null) {
        direction = direction === "across" ? "down" : "across";
      } else if (info[direction] === null) {
        direction = info.across !== null ? "across" : "down";
      }
      pendingToggle = false;
      updateHighlights();
    });
    // 한글은 자모를 조합해서 음절이 완성되므로(예: ㅅ→사→사ㅏ...→사자 아님, 한
    // 음절씩), 조합이 끝나기 전(input 이벤트가 여러 번 옴)에 다음 칸으로 넘어가면
    // 아직 다 조합되지 않은 글자에서 커서가 튀어버린다 - compositionend까지 기다린다.
    var composing = false;
    function commitValue() {
      if (isSolved) {
        input.value = userGrid[r][c] || "";
        return;
      }
      var v = (input.value || "").slice(-1);
      input.value = v;
      userGrid[r][c] = v;
      updateProgress();
      if (checkWin()) onWin();
      if (v) {
        // compositionend 처리 도중 바로 포커스를 옮기면 일부 모바일 IME가 다음
        // 칸에서 두 번째 글자 조합을 놓친다 - 다음 이벤트 루프로 미뤄서 IME가
        // 완전히 정리된 뒤에 포커스를 옮긴다.
        setTimeout(function () {
          advance(r, c);
        }, 0);
      }
    }
    input.addEventListener("compositionstart", function () {
      composing = true;
    });
    input.addEventListener("compositionend", function () {
      composing = false;
      commitValue();
    });
    input.addEventListener("input", function () {
      if (composing) return;
      commitValue();
    });
    input.addEventListener("keydown", function (e) {
      if (isSolved) return;
      if (e.key === "Backspace" && input.value === "") {
        e.preventDefault();
        var prev = prevTarget(r, c);
        var prevInput = inputMap[prev.r + "," + prev.c];
        if (prevInput) {
          userGrid[prev.r][prev.c] = "";
          prevInput.value = "";
          prevInput.focus();
        }
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        moveTo(r, c - 1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        moveTo(r, c + 1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        moveTo(r - 1, c);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        moveTo(r + 1, c);
      } else if (e.key === " ") {
        // 스페이스는 글자를 안 채우고 지금 단어 안에서 다음 칸으로만 건너뛴다.
        e.preventDefault();
        advance(r, c);
      } else if (e.key === "Tab") {
        e.preventDefault();
        jumpToNextUnsolved();
      }
    });
  }

  function updateHighlights() {
    Object.keys(wrapMap).forEach(function (key) {
      wrapMap[key].classList.remove("selected", "in-word");
    });
    Object.keys(clueElByIdx).forEach(function (idx) {
      clueElByIdx[idx].classList.remove("active");
    });
    if (!selected) return;

    var info = cellWordMap[selected.r][selected.c];
    var idx = info[direction] !== null ? info[direction] : info.across !== null ? info.across : info.down;
    if (idx === null || idx === undefined) {
      var soloKey = selected.r + "," + selected.c;
      if (wrapMap[soloKey]) wrapMap[soloKey].classList.add("selected");
      return;
    }
    direction = info[direction] !== null ? direction : info.across !== null ? "across" : "down";

    var p = puzzle.placed[idx];
    for (var i = 0; i < p.word.length; i++) {
      var r = p.dir === "across" ? p.row : p.row + i;
      var c = p.dir === "across" ? p.col + i : p.col;
      var key = r + "," + c;
      if (!wrapMap[key]) continue;
      wrapMap[key].classList.add(r === selected.r && c === selected.c ? "selected" : "in-word");
    }
    if (clueElByIdx[idx]) clueElByIdx[idx].classList.add("active");
  }

  function selectWord(idx) {
    var p = puzzle.placed[idx];
    selected = { r: p.row, c: p.col };
    direction = p.dir;
    var input = inputMap[p.row + "," + p.col];
    if (input) input.focus();
    updateHighlights();
  }

  // 번호 순서대로(가로 먼저, 그다음 세로) 죽 훑는 순서.
  function orderedWordIndices() {
    var across = [];
    var down = [];
    puzzle.placed.forEach(function (p, idx) {
      (p.dir === "across" ? across : down).push(idx);
    });
    across.sort(function (a, b) {
      return puzzle.placed[a].number - puzzle.placed[b].number;
    });
    down.sort(function (a, b) {
      return puzzle.placed[a].number - puzzle.placed[b].number;
    });
    return across.concat(down);
  }

  function currentWordIndex() {
    if (!selected) return -1;
    var info = cellWordMap[selected.r][selected.c];
    if (info[direction] !== null) return info[direction];
    return info.across !== null ? info.across : info.down;
  }

  // Tab: 아직 다 못 맞힌 다음 단어의 첫 칸으로 바로 건너뛴다(다 맞힌 단어는 지나친다).
  function jumpToNextUnsolved() {
    var order = orderedWordIndices();
    if (order.length === 0) return;
    var pos = order.indexOf(currentWordIndex());
    for (var step = 1; step <= order.length; step++) {
      var idx = order[(pos + step) % order.length];
      if (!isWordSolved(puzzle.placed[idx])) {
        selectWord(idx);
        return;
      }
    }
    // 이미 다 맞혔으면(완성 직전) 그냥 다음 단어로 이동해준다.
    selectWord(order[(pos + 1) % order.length]);
  }

  function checkWin() {
    for (var r = 0; r < puzzle.rows; r++) {
      for (var c = 0; c < puzzle.cols; c++) {
        if (puzzle.grid[r][c] === null) continue;
        if (userGrid[r][c] !== puzzle.grid[r][c]) return false;
      }
    }
    return true;
  }

  function isWordSolved(p) {
    for (var i = 0; i < p.word.length; i++) {
      var r = p.dir === "across" ? p.row : p.row + i;
      var c = p.dir === "across" ? p.col + i : p.col;
      if (userGrid[r][c] !== p.word[i]) return false;
    }
    return true;
  }

  function isWordFilled(p) {
    for (var i = 0; i < p.word.length; i++) {
      var r = p.dir === "across" ? p.row : p.row + i;
      var c = p.dir === "across" ? p.col + i : p.col;
      if (!userGrid[r][c]) return false;
    }
    return true;
  }

  // 맞힌 단어 수를 세서 항상 보여주고, 다 맞힌 단어는 힌트 목록에서 취소선으로
  // 표시한다. 이번 퍼즐에서 처음으로 맞힌 단어는 누적 기록에도 하나씩 더한다
  // (지웠다 다시 맞혀도 이미 센 단어는 중복으로 안 센다). 칸을 다 채웠는데 틀린
  // 단어는 빨갛게 표시한다 - 다 채우기 전에는 글자 하나하나가 맞는지 안 알려줘야
  // 정답을 하나씩 유추하며 풀 수 있다.
  function updateProgress() {
    Object.keys(wrapMap).forEach(function (key) {
      wrapMap[key].classList.remove("wrong");
    });
    puzzle.placed.forEach(function (p, idx) {
      var ok = isWordSolved(p);
      var wrong = !ok && isWordFilled(p);
      if (ok && !countedThisPuzzle[idx]) {
        countedThisPuzzle[idx] = true;
        totalSolved++;
        localStorage.setItem(totalSolvedKey(), String(totalSolved));
      }
      if (clueElByIdx[idx]) {
        clueElByIdx[idx].classList.toggle("solved", ok);
        clueElByIdx[idx].classList.toggle("wrong", wrong);
      }
      if (wrong) {
        for (var i = 0; i < p.word.length; i++) {
          var r = p.dir === "across" ? p.row : p.row + i;
          var c = p.dir === "across" ? p.col + i : p.col;
          var cellKey = r + "," + c;
          if (wrapMap[cellKey]) wrapMap[cellKey].classList.add("wrong");
        }
      }
    });
    totalSolvedEl.textContent = String(totalSolved);
  }

  function onWin() {
    isSolved = true;
    stopTimer();
    var elapsed = Math.floor((Date.now() - startTime) / 1000);
    var key = bestTimeKey(currentMode);
    var prevBest = parseInt(localStorage.getItem(key), 10);
    var isNewBest = isNaN(prevBest) || elapsed < prevBest;
    if (isNewBest) localStorage.setItem(key, String(elapsed));
    showBestTime();

    var creditsLeft = typeof WordGameStore !== "undefined" ? WordGameStore.getCredits("crossword") : 0;
    overlayDescEl.textContent =
      CROSSWORD_WORD_BANK[currentMode].label + " 낱말퍼즐 " + puzzle.placed.length + "개 단어를 " + formatTime(elapsed) + "만에 다 맞혔어요!" + (isNewBest ? " 🎉 신기록!" : "") +
      (pendingLevelUpLabel ? " 🆙 다음 판부터 " + pendingLevelUpLabel + " 단계예요!" : "");
    retryBtn.hidden = creditsLeft <= 0;
    overlayNoteEl.hidden = creditsLeft > 0;
    overlayEl.hidden = false;
  }

  function renderBoard() {
    boardEl.innerHTML = "";
    boardEl.style.gridTemplateColumns = "repeat(" + puzzle.cols + ", 38px)";
    boardEl.style.gridTemplateRows = "repeat(" + puzzle.rows + ", 38px)";
    inputMap = {};
    wrapMap = {};

    for (var r = 0; r < puzzle.rows; r++) {
      for (var c = 0; c < puzzle.cols; c++) {
        if (puzzle.grid[r][c] === null) {
          var block = document.createElement("div");
          block.className = "cw-block";
          boardEl.appendChild(block);
          continue;
        }
        var wrap = document.createElement("div");
        wrap.className = "cw-cell-wrap";

        var num = puzzle.cellNumber[r + "," + c];
        if (num) {
          var numEl = document.createElement("span");
          numEl.className = "cw-cell-number";
          numEl.textContent = String(num);
          wrap.appendChild(numEl);
        }

        var input = document.createElement("input");
        input.type = "text";
        input.className = "cw-input";
        // maxlength=1을 주면 일부 브라우저(특히 모바일)에서 한글 자모가 조합되는
        // 도중에 글자가 잘려서 아예 입력이 안 되는 문제가 있다 - 길이 제한은
        // commitValue()에서 조합이 끝난 뒤 마지막 한 글자만 남기는 방식으로 처리한다.
        input.autocomplete = "off";
        input.value = userGrid[r][c] || "";
        wireCell(input, r, c);
        wrap.appendChild(input);

        boardEl.appendChild(wrap);
        inputMap[r + "," + c] = input;
        wrapMap[r + "," + c] = wrap;
      }
    }
  }

  function renderClues() {
    acrossListEl.innerHTML = "";
    downListEl.innerHTML = "";
    clueElByIdx = {};

    var across = [];
    var down = [];
    puzzle.placed.forEach(function (p, idx) {
      (p.dir === "across" ? across : down).push({ p: p, idx: idx });
    });
    across.sort(function (a, b) {
      return a.p.number - b.p.number;
    });
    down.sort(function (a, b) {
      return a.p.number - b.p.number;
    });

    function buildLi(entry, listEl) {
      var li = document.createElement("li");
      li.className = "crossword-clue-item";
      li.textContent = entry.p.number + ". " + entry.p.clue;
      li.addEventListener("click", function () {
        selectWord(entry.idx);
      });
      listEl.appendChild(li);
      clueElByIdx[entry.idx] = li;
    }
    across.forEach(function (entry) {
      buildLi(entry, acrossListEl);
    });
    down.forEach(function (entry) {
      buildLi(entry, downListEl);
    });
  }

  function poolCandidates(mode, state) {
    var words = levelsFor(mode)[state.levelIndex].words;
    var map = {};
    words.forEach(function (w) {
      map[w.word] = w;
    });
    var list = [];
    state.remaining.forEach(function (wstr) {
      if (map[wstr]) list.push(map[wstr]);
    });
    return list;
  }

  function newGame(mode) {
    currentMode = mode;
    MODE_ORDER.forEach(function (key) {
      tabs[key].classList.toggle("active", key === mode);
    });

    overlayEl.hidden = true;
    isSolved = false;
    selected = null;
    direction = "across";
    countedThisPuzzle = {};
    pendingLevelUpLabel = null;
    showBestTime();
    stopTimer();

    var state = loadPoolState(mode);
    var candidates = poolCandidates(mode, state);
    if (candidates.length === 0) {
      state = freshPool(mode, state.levelIndex);
      candidates = poolCandidates(mode, state);
    }
    var puzzleLevelIndex = state.levelIndex;
    updateLevelLabel(mode, puzzleLevelIndex);

    var result = generateBestCrossword(candidates, TARGET_WORDS, GENERATE_ATTEMPTS);

    if (!result || result.placed.length === 0) {
      emptyEl.hidden = false;
      playEl.hidden = true;
      return;
    }
    emptyEl.hidden = true;
    playEl.hidden = false;
    startTimer();

    // 이번 판에 실제로 칸에 놓인 단어는 이 레벨의 남은 더미에서 빼서, 같은 레벨
    // 안에서는 이미 나온 단어가 다시 안 나오게 한다.
    var placedWordSet = {};
    result.placed.forEach(function (p) {
      placedWordSet[p.word] = true;
    });
    state.remaining = state.remaining.filter(function (w) {
      return !placedWordSet[w];
    });

    var levels = levelsFor(mode);
    if (state.remaining.length <= LEVEL_EXHAUST_THRESHOLD) {
      if (puzzleLevelIndex < levels.length - 1) {
        var nextIndex = puzzleLevelIndex + 1;
        pendingLevelUpLabel = levels[nextIndex].label;
        state = freshPool(mode, nextIndex);
      } else {
        // 맨 마지막 레벨: 단어 더미를 새로 섞어서 계속 반복한다.
        state = freshPool(mode, puzzleLevelIndex);
      }
    }
    savePoolState(mode, state);

    puzzle = result;
    cellWordMap = buildCellWordMap();
    userGrid = [];
    for (var r = 0; r < puzzle.rows; r++) {
      var row = [];
      for (var c = 0; c < puzzle.cols; c++) row.push(puzzle.grid[r][c] === null ? null : "");
      userGrid.push(row);
    }

    renderBoard();
    renderClues();
    updateProgress();
  }

  MODE_ORDER.forEach(function (mode) {
    tabs[mode].addEventListener("click", function () {
      if (isSolved) return;
      newGame(mode);
    });
  });

  retryBtn.addEventListener("click", function () {
    if (typeof WordGameStore === "undefined" || !WordGameStore.spendCredit("crossword")) return;
    creditsEl.textContent = WordGameStore.getCreditsLabel("crossword");
    newGame(currentMode);
  });

  creditsEl.textContent = typeof WordGameStore !== "undefined" ? WordGameStore.getCreditsLabel("crossword") : "0";
  newGame("elementary");
})();
