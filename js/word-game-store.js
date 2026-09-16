// 게임 기회 저장소. 게임은 총 12개(테트리스/스도쿠/가로세로 낱말 + 9개를 매달
// 3개씩 순차 공개)이고, 아이별로 "열린 게임 목록"(opened)을 관리자가
// 관리자 탭 > 게임 기회 관리의 체크박스로 직접 켜고 끈다 - "며칠 채우면
// 자동으로 열린다" 같은 규칙은 코드에 없다. 다음 공개 기준이 매번 달라질
// 수 있어서다.
//
// 기회를 줄 때는 그 아이의 열린 게임을 섞은 주머니(bag)에서 하나씩 뽑아
// 준다 - 트로피 1장이나 별 20개마다 3회뿐이다(저니스 주간 개근 트로피,
// 오늘 두 트랙 완료는 공부 자체가 보상이라 게임 기회를 별도로 주지 않는다).
// 주머니 방식이라 한 바퀴(열린 게임 수만큼) 안에는 모든 게임이 정확히
// 1번씩 나오고, 다 뽑히면 다시 섞어서 새 바퀴가 시작된다 - 특정 게임에만
// 기회가 몰리지 않는다.
var WordGameStore = (function () {
  var GAME_REGISTRY = [
    { key: "tetris", emoji: "🧱", label: "테트리스", url: "tetris.html", defaultOpen: true },
    { key: "sudoku", emoji: "🔢", label: "스도쿠", url: "sudoku.html", defaultOpen: true },
    { key: "crossword", emoji: "📝", label: "가로세로 낱말", url: "crossword.html", defaultOpen: true },
    { key: "smileyfind", emoji: "🙂", label: "해피피 찾기", url: "smileyfind.html", defaultOpen: false },
    { key: "hanoi", emoji: "🗼", label: "하노이의 탑", url: "hanoi.html", defaultOpen: false },
    { key: "snake", emoji: "🐍", label: "스네이크", url: "snake.html", defaultOpen: false },
    { key: "breakout", emoji: "🏓", label: "벽돌깨기", url: "breakout.html", defaultOpen: false },
    { key: "maze", emoji: "🌀", label: "미로찾기", url: "maze.html", defaultOpen: false },
    { key: "pacman", emoji: "👻", label: "팩맨", url: "pacman.html", defaultOpen: false },
    { key: "blocks", emoji: "🧊", label: "쌓기나무", url: "blocks.html", defaultOpen: false },
    { key: "power", emoji: "✖️", label: "구구단 스네이크", url: "power.html", defaultOpen: false },
    { key: "flag", emoji: "🚩", label: "청기백기", url: "flag.html", defaultOpen: false }
  ];
  var GAMES = GAME_REGISTRY.map(function (g) { return g.key; });

  function getGame(key) {
    for (var i = 0; i < GAME_REGISTRY.length; i++) {
      if (GAME_REGISTRY[i].key === key) return GAME_REGISTRY[i];
    }
    return null;
  }

  function defaultOpenedGames() {
    return GAME_REGISTRY.filter(function (g) { return g.defaultOpen; }).map(function (g) { return g.key; });
  }

  // 임시로 아이별 기회를 고정해두고 싶을 때 여기에 넣는다({ hajung: 3 } 처럼).
  // 하정은 실제로 완전정복 골드 카드를 받아서 고정을 풀고 이제부터는 실제로
  // 쌓이고 줄어드는 값을 그대로 보여준다.
  var PINNED_CREDITS = {};

  function pinnedCreditsForActiveChild() {
    var childId = typeof ChildStore !== "undefined" && ChildStore.getActive();
    return childId && PINNED_CREDITS.hasOwnProperty(childId) ? PINNED_CREDITS[childId] : null;
  }

  function childPrefix() {
    var childId = typeof ChildStore !== "undefined" && ChildStore.getActive();
    return childId ? childId + "_" : "guest_";
  }

  function stateKey() {
    return "haingGameCredits_" + childPrefix();
  }

  function emptyCredits() {
    var credits = {};
    GAMES.forEach(function (game) {
      credits[game] = 0;
    });
    return credits;
  }

  // 예전에는 기회를 숫자 하나(공용 주머니)로 저장했다. 그 값이 남아있는
  // 기기/클라우드 데이터를 만나면, 게임들에 고르게 나눠서 새 형식으로 바꿔준다.
  function normalizeCredits(raw) {
    var credits = emptyCredits();
    if (raw && typeof raw === "object") {
      GAMES.forEach(function (game) {
        credits[game] = raw[game] || 0;
      });
    } else if (typeof raw === "number" && raw > 0) {
      for (var i = 0; i < raw; i++) {
        credits[GAMES[i % GAMES.length]] += 1;
      }
    }
    return credits;
  }

  // opened 필드가 아예 없는(예전 데이터) 아이는 기존에 이미 열려 있던 3개
  // (테트리스/스도쿠/가로세로 낱말)만 연 상태로 취급한다 - 마이그레이션이
  // 저절로 된다. 필드가 있으면(빈 배열이라도) 관리자가 직접 정한 값이라
  // 그대로 존중한다.
  function normalizeOpened(raw) {
    if (!Array.isArray(raw)) return defaultOpenedGames();
    return raw.filter(function (g) { return GAMES.indexOf(g) !== -1; });
  }

  function normalizeBag(raw) {
    if (!Array.isArray(raw)) return [];
    return raw.filter(function (g) { return GAMES.indexOf(g) !== -1; });
  }

  function normalizeDex(raw) {
    var dex = {};
    if (raw && typeof raw === "object") {
      GAMES.forEach(function (game) {
        if (raw[game]) dex[game] = raw[game];
      });
    }
    return dex;
  }

  var MAX_PENDING_ENTRIES = 10;

  function normalizePending(raw) {
    if (!Array.isArray(raw)) return [];
    return raw.slice(-MAX_PENDING_ENTRIES);
  }

  // "어디에 썼는지" 확인용 - 실제로 기회를 하나 쓸 때마다 {game, spentAt}을 남긴다.
  // 문서가 한없이 커지지 않게 최근 것만 남긴다(오래된 기록은 그냥 잘려나감).
  var MAX_LOG_ENTRIES = 30;

  function normalizeLog(raw) {
    if (!Array.isArray(raw)) return [];
    return raw.slice(-MAX_LOG_ENTRIES);
  }

  function defaultState() {
    return {
      credits: emptyCredits(),
      opened: defaultOpenedGames(),
      bag: [],
      dex: {},
      pendingAnnounce: [],
      trophiesCounted: 0,
      starBlocksCounted: 0,
      updatedAt: 0,
      log: []
    };
  }

  // getState/getStateFor/applyCloudState가 각자 필드를 골라 담다가 하나라도
  // 빠뜨리면(특히 새 필드 추가할 때) 그 경로에서만 조용히 값이 사라지는
  // 사고가 난다 - 파싱을 한 곳으로 모아서 그 위험을 없앤다.
  function parseStateData(parsed) {
    parsed = parsed || {};
    return {
      credits: normalizeCredits(parsed.credits),
      opened: normalizeOpened(parsed.opened),
      bag: normalizeBag(parsed.bag),
      dex: normalizeDex(parsed.dex),
      pendingAnnounce: normalizePending(parsed.pendingAnnounce),
      trophiesCounted: parsed.trophiesCounted || 0,
      starBlocksCounted: parsed.starBlocksCounted || 0,
      updatedAt: parsed.updatedAt || 0,
      log: normalizeLog(parsed.log)
    };
  }

  function getState() {
    var raw = localStorage.getItem(stateKey());
    if (!raw) return defaultState();
    try {
      return parseStateData(JSON.parse(raw));
    } catch (e) {
      return defaultState();
    }
  }

  function saveState(state) {
    state.updatedAt = Date.now();
    localStorage.setItem(stateKey(), JSON.stringify(state));
    syncToCloud(state);
  }

  function pad2(n) {
    return n < 10 ? "0" + n : String(n);
  }

  function todayStr() {
    var d = new Date();
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
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

  // 열린 게임을 섞어 주머니에 담아두고 하나씩 꺼낸다. 한 바퀴(열린 게임 수만큼)
  // 안에서는 같은 게임이 두 번 안 나오고, 바퀴가 바뀔 때마다 순서가 달라진다.
  // 닫힌 게임은 매번 걸러내므로, 관리자가 방금 게임을 닫았어도 안전하다.
  function drawFromBag(state, n) {
    var picked = [];
    for (var i = 0; i < n; i++) {
      state.bag = state.bag.filter(function (g) { return state.opened.indexOf(g) !== -1; });
      if (state.bag.length === 0) {
        if (state.opened.length === 0) break;
        state.bag = shuffle(state.opened.slice());
      }
      picked.push(state.bag.pop());
    }
    return picked;
  }

  function totalStars() {
    if (typeof WordCardStore === "undefined") return 0;
    return WordCardStore.getCollected().reduce(function (sum, r) {
      return sum + (!r.isTrophy && r.stars ? r.stars : 0);
    }, 0);
  }

  // 트로피/별 상태가 바뀔 때마다(카드 저장소 쪽에서) 불러주면, 지난번에 이미 센
  // 트로피 수·별 20개 단위 수보다 늘어난 만큼만 3회씩 새로 얹는다. 여러 번 불러도
  // 안전(늘어난 만큼만 계산하므로 중복 지급 없음).
  function syncCredits() {
    if (typeof WordCardStore === "undefined") return getTotalCredits();
    var state = getState();
    var changed = false;

    // Journeys 주간 트로피는 여기서 안 센다 - 그 자체가 보상이라 게임 기회를
    // 따로 주지 않는다(있었다면 여기서도 같이 세면 두 번 주는 셈이 된다).
    var trophyCount = WordCardStore.getTrophyCards().filter(function (r) {
      return !r.journeysTrophy;
    }).length;
    var starBlocks = Math.floor(totalStars() / 20);

    var newTrophyMilestones = Math.max(0, trophyCount - state.trophiesCounted);
    var newStarMilestones = Math.max(0, starBlocks - state.starBlocksCounted);

    if (newTrophyMilestones > 0 || newStarMilestones > 0) {
      var games = drawFromBag(state, (newTrophyMilestones + newStarMilestones) * 3);
      games.forEach(function (g) { state.credits[g] += 1; });
      state.trophiesCounted = trophyCount;
      state.starBlocksCounted = starBlocks;
      if (games.length > 0) {
        state.pendingAnnounce = normalizePending(state.pendingAnnounce.concat([
          { kind: "milestone", games: games, at: Date.now() }
        ]));
      }
      changed = true;
    }

    if (changed) saveState(state);
    return getTotalCredits();
  }

  // 관리자로 로그인해 있으면 게임 기회를 무한으로 쳐서 계속 테스트할 수 있게 한다.
  function isAdminActive() {
    return typeof AdminAuthStore !== "undefined" && AdminAuthStore.isActive();
  }

  // 게임 하나에 남은 기회.
  function getCredits(game) {
    if (isAdminActive()) return Infinity;
    var pinned = pinnedCreditsForActiveChild();
    if (pinned !== null) return pinned;
    return getState().credits[game] || 0;
  }

  // 열린 게임들을 합친 전체 남은 기회(게임 탭 상단 표시, 잠금 여부 판단용).
  // 안 열린 게임에 남은 크레딧은 세지 않는다(잠금 해제 판정에 끼면 안 되므로).
  function getTotalCredits() {
    if (isAdminActive()) return Infinity;
    var pinned = pinnedCreditsForActiveChild();
    if (pinned !== null) return pinned;
    var state = getState();
    return state.opened.reduce(function (sum, game) {
      return sum + (state.credits[game] || 0);
    }, 0);
  }

  // 화면에 그대로 찍기 좋은 문자열. 관리자는 "Infinity"라는 영어 대신 "무제한"으로 보여준다.
  function getCreditsLabel(game) {
    var credits = getCredits(game);
    return credits === Infinity ? "무제한" : String(credits);
  }

  function getTotalCreditsLabel() {
    var credits = getTotalCredits();
    return credits === Infinity ? "무제한" : String(credits);
  }

  // 게임 기회가 있어도, 오늘 공부를 먼저 끝내야 게임을 할 수 있다 - 공부보다
  // 게임이 먼저가 되지 않도록. 평일(월~금)은 저니스 1세트 + 단어 1세트,
  // 주말(토·일)은 단어 1세트만 있으면 된다. (관리자는 테스트를 위해 예외.)
  function isWeekendToday() {
    var day = new Date().getDay();
    return day === 0 || day === 6;
  }

  function hasStudiedTodayForGames() {
    if (isAdminActive()) return true;
    var childId = typeof ChildStore !== "undefined" && ChildStore.getActive();
    if (!childId) return false;
    var wordDone = typeof ProgressStore !== "undefined" && ProgressStore.hasCompletedSetToday && ProgressStore.hasCompletedSetToday();
    if (isWeekendToday()) return !!wordDone;
    var journeyDone = typeof StampStore !== "undefined" && StampStore.hasCompletedAnyToday(childId);
    return !!journeyDone && !!wordDone;
  }

  // 게임을 하나 시작할 때 그 게임 몫의 기회를 1회 쓴다. 오늘 공부를 안 했거나,
  // 그 게임이 아직 안 열렸거나, 그 게임에 남은 기회가 없으면 false(다른 게임에
  // 기회가 남아 있어도 안 됨). 실제로 쓴 순간이 곧 "플레이 시작"이므로 게임
  // 도감(dex)의 그 게임 플레이 횟수도 여기서 같이 늘린다.
  function spendCredit(game) {
    if (isAdminActive()) return true;
    if (!hasStudiedTodayForGames()) return false;
    if (pinnedCreditsForActiveChild() !== null) return true;
    var state = getState();
    if (state.opened.indexOf(game) === -1) return false;
    if (!state.credits[game] || state.credits[game] <= 0) return false;
    state.credits[game] -= 1;
    state.log = normalizeLog(state.log.concat([{ game: game, spentAt: Date.now() }]));
    state.dex[game] = (state.dex[game] || 0) + 1;
    saveState(state);
    return true;
  }

  // 게임 도감의 "레벨" - 게임을 열었는지와 무관하게, 그 게임을 몇 번
  // 플레이했는지(dex의 판 수)만으로 매긴다. 문턱값은 대략 두 배씩 늘려서
  // 뒤로 갈수록 다음 레벨까지 더 오래 걸리게 했다.
  var DEX_LEVEL_THRESHOLDS = [1, 3, 6, 10, 15, 25, 40, 60, 90];

  function levelForPlays(plays) {
    var level = 0;
    for (var i = 0; i < DEX_LEVEL_THRESHOLDS.length; i++) {
      if (plays >= DEX_LEVEL_THRESHOLDS[i]) level = i + 1;
      else break;
    }
    return level;
  }

  function getDexLevel(game) {
    return levelForPlays(getState().dex[game] || 0);
  }

  // syncCredits(트로피/별 마일스톤)이 쓰는 공용 지급 함수 - 다른 계기로 기회를
  // 줘야 할 일이 생기면 여기를 그대로 재사용한다. 고정된 아이라도 실제 쌓이는
  // 값은 뒤에서 그대로 늘어난다(화면 표시만 고정).
  function grantCredits(n) {
    var state = getState();
    var games = drawFromBag(state, n);
    games.forEach(function (g) { state.credits[g] += 1; });
    if (games.length > 0) {
      state.pendingAnnounce = normalizePending(state.pendingAnnounce.concat([
        { kind: "milestone", games: games, at: Date.now() }
      ]));
    }
    saveState(state);
    return getTotalCredits();
  }

  // 지급 알림은 쌓아뒀다가(pendingAnnounce), 다음에 어떤 페이지가 열리든
  // 그때 꺼내서 보여주고 비운다 - 지급 순간 다른 팝업(단어카드 등)과 겹쳐
  // 가려지는 걸 막고, 어느 페이지에서 조건이 충족되든 안내를 놓치지 않는다.
  function consumePendingAnnouncements() {
    var state = getState();
    if (state.pendingAnnounce.length === 0) return [];
    var pending = state.pendingAnnounce;
    state.pendingAnnounce = [];
    saveState(state);
    return pending;
  }

  function getOpenedGames() {
    return getState().opened;
  }

  function getDex() {
    return getState().dex;
  }

  // 관리자 탭에서 "지금 로그인한 아이"와 무관하게 특정 아이의 기회를 직접
  // 확인/조정할 때 쓴다(예: 동기화 오류로 잘못 줄었을 때 손으로 복구).
  function stateKeyFor(childId) {
    return "haingGameCredits_" + (childId ? childId + "_" : "guest_");
  }

  function getStateFor(childId) {
    var raw = localStorage.getItem(stateKeyFor(childId));
    if (!raw) return defaultState();
    try {
      return parseStateData(JSON.parse(raw));
    } catch (e) {
      return defaultState();
    }
  }

  function getCreditsForChild(childId) {
    var state = getStateFor(childId);
    return state.opened.reduce(function (sum, game) {
      return sum + (state.credits[game] || 0);
    }, 0);
  }

  // 게임 하나에 남은 그 아이의 기회.
  function getCreditsForChildByGame(childId, game) {
    return getStateFor(childId).credits[game] || 0;
  }

  // 최근에 쓴 기회 기록 - {game, spentAt}, 오래된 순(가장 최근이 배열 맨 뒤).
  function getSpendLogForChild(childId) {
    return getStateFor(childId).log;
  }

  function getOpenedGamesForChild(childId) {
    return getStateFor(childId).opened;
  }

  function isOpened(childId, game) {
    return getOpenedGamesForChild(childId).indexOf(game) !== -1;
  }

  // 게임 하나의 기회를 1개 단위로 더하거나 뺀다(복구용으로는 양수, 되돌릴 땐
  // 음수 - 0 밑으로는 안 내려간다). 이후에도 트로피/별로 쌓이는 정상적인
  // 카운트는 그대로 이어진다(고정이 아니다).
  function adminAdjustGameCredit(childId, game, delta) {
    if (!childId) return 0;
    var state = getStateFor(childId);
    state.credits[game] = Math.max(0, (state.credits[game] || 0) + delta);
    state.updatedAt = Date.now();
    localStorage.setItem(stateKeyFor(childId), JSON.stringify(state));
    if (typeof HaingCloud !== "undefined" && HaingCloud.enabled) {
      HaingCloud.writeDoc("wordGameCredits/" + childId, state);
    }
    if (window.__haingRenderAdminChildSettings) window.__haingRenderAdminChildSettings();
    return state.credits[game];
  }

  // 관리자가 아이별로 게임을 열고 닫는다(관리자 탭 > 게임 기회 관리의
  // 체크박스에서 호출). "며칠 채우면 자동으로 열린다" 같은 규칙은 없다 -
  // 관리자가 직접 판단해서 이 함수를 부른다. 새로 여는 순간 주머니를 비워서,
  // 다음 지급부터 새 게임이 포함된 전체를 다시 섞게 한다(안 그러면 방금 연
  // 게임이 한 바퀴가 끝날 때까지, 최대 열린 게임 수만큼 뒤로 밀려서야
  // 처음 나온다).
  function adminSetGameOpened(childId, game, on) {
    if (!childId || GAMES.indexOf(game) === -1) return null;
    var state = getStateFor(childId);
    var idx = state.opened.indexOf(game);
    if (on && idx === -1) {
      state.opened = state.opened.concat([game]);
      state.bag = [];
    } else if (!on && idx !== -1) {
      state.opened = state.opened.filter(function (g) { return g !== game; });
      state.bag = [];
    } else {
      return state.opened;
    }
    state.updatedAt = Date.now();
    localStorage.setItem(stateKeyFor(childId), JSON.stringify(state));
    if (typeof HaingCloud !== "undefined" && HaingCloud.enabled) {
      HaingCloud.writeDoc("wordGameCredits/" + childId, state);
    }
    if (window.__haingRenderAdminChildSettings) window.__haingRenderAdminChildSettings();
    return state.opened;
  }

  function cloudPath() {
    var childId = typeof ChildStore !== "undefined" && ChildStore.getActive();
    return childId ? "wordGameCredits/" + childId : null;
  }

  function syncToCloud(state) {
    if (typeof HaingCloud === "undefined" || !HaingCloud.enabled) return;
    var path = cloudPath();
    if (!path) return;
    HaingCloud.writeDoc(path, state);
  }

  // 클라우드 값이 이 기기의 로컬 값보다 새것일 때만 덮어쓴다 - 예전엔 무조건
  // 덮어써서, 아직 동기화가 안 된(또는 느린) 기기가 최신 값을 받아오는 도중에
  // 화면을 그리면 순간적으로 옛날 값(심하면 0)이 보이거나, 그 옛날 로컬 값이
  // 오히려 클라우드로 다시 밀려 올라가 실제로 쌓인 기회가 사라지는 문제가 있었다.
  // childId를 fetch 시작 시점 값 그대로 인자로 받는다 - stateKey()는 지금
  // 로그인한 아이 기준이라, 응답이 오는 사이에 다른 아이로 로그인이 바뀌면
  // 그 새 아이의 기회 칸에 엉뚱한(이전 아이) 값을 덮어써버리는 사고가 날 수
  // 있어서 childId를 직접 넘겨 받는다(stateKeyFor는 관리자 조정용으로 이미 있던 것).
  function applyCloudState(childId, data) {
    if (!data) return;
    var local = getStateFor(childId);
    if ((data.updatedAt || 0) < (local.updatedAt || 0)) return;
    localStorage.setItem(stateKeyFor(childId), JSON.stringify(parseStateData(data)));
    if (window.__haingRenderWordCards) window.__haingRenderWordCards();
  }

  var unsubscribeCloud = null;
  function setupCloudSyncForActiveChild() {
    if (unsubscribeCloud) {
      unsubscribeCloud();
      unsubscribeCloud = null;
    }
    if (typeof HaingCloud === "undefined" || !HaingCloud.enabled) return;
    var path = cloudPath();
    if (!path) return;
    var syncedChildId = typeof ChildStore !== "undefined" && ChildStore.getActive();
    HaingCloud.getDocOnce(path).then(function (remote) {
      // 기회를 쓰자마자(spendCredit) 곧바로 게임 페이지로 이동하는 흐름 때문에
      // 그 클라우드 저장이 이동 중에 끊기는 일이 있다 - 로컬은 정확해도
      // 클라우드만 뒤처진 채 굳어버리므로, 원격이 이 기기 로컬보다 오래됐으면
      // (또는 아예 없으면) 로컬 값을 다시 올려서 스스로 맞춘다.
      var local = getStateFor(syncedChildId);
      if (remote && (remote.updatedAt || 0) >= (local.updatedAt || 0)) {
        applyCloudState(syncedChildId, remote);
      } else {
        syncToCloud(local);
      }
      unsubscribeCloud = HaingCloud.watchDoc(path, function (data) {
        applyCloudState(syncedChildId, data);
      });
    });
  }

  setupCloudSyncForActiveChild();
  if (typeof ChildStore !== "undefined" && ChildStore.onChange) {
    ChildStore.onChange(setupCloudSyncForActiveChild);
  }

  return {
    GAMES: GAMES,
    GAME_REGISTRY: GAME_REGISTRY,
    getGame: getGame,
    syncCredits: syncCredits,
    getCredits: getCredits,
    getTotalCredits: getTotalCredits,
    getCreditsLabel: getCreditsLabel,
    getTotalCreditsLabel: getTotalCreditsLabel,
    spendCredit: spendCredit,
    hasStudiedTodayForGames: hasStudiedTodayForGames,
    isWeekendToday: isWeekendToday,
    grantCredits: grantCredits,
    consumePendingAnnouncements: consumePendingAnnouncements,
    getOpenedGames: getOpenedGames,
    getDex: getDex,
    getDexLevel: getDexLevel,
    getCreditsForChild: getCreditsForChild,
    getCreditsForChildByGame: getCreditsForChildByGame,
    getSpendLogForChild: getSpendLogForChild,
    getOpenedGamesForChild: getOpenedGamesForChild,
    isOpened: isOpened,
    adminAdjustGameCredit: adminAdjustGameCredit,
    adminSetGameOpened: adminSetGameOpened
  };
})();
