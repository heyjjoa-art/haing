// 트로피 카드 1장을 새로 받거나, 별 스티커가 20개씩 쌓일 때마다 미니게임 기회를
// 3회씩 준다(둘 다 계속 반복해서 쌓인다 - 트로피 2장이면 6회, 별 40개면 6회, 등).
// 기회는 게임 하나에 몰아쓰지 못하게, 생길 때마다 3개 게임(테트리스/스도쿠/
// 가로세로 낱말)에 1회씩 고르게 나눠 준다 - 게임별로 따로 쌓이고 따로 줄어든다.
var WordGameStore = (function () {
  var GAMES = ["tetris", "sudoku", "crossword"];

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
    return { tetris: 0, sudoku: 0, crossword: 0 };
  }

  // 예전에는 기회를 숫자 하나(공용 주머니)로 저장했다. 그 값이 남아있는
  // 기기/클라우드 데이터를 만나면, 게임 3개에 고르게 나눠서 새 형식으로 바꿔준다.
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

  // "어디에 썼는지" 확인용 - 실제로 기회를 하나 쓸 때마다 {game, spentAt}을 남긴다.
  // 문서가 한없이 커지지 않게 최근 것만 남긴다(오래된 기록은 그냥 잘려나감).
  var MAX_LOG_ENTRIES = 30;

  function normalizeLog(raw) {
    if (!Array.isArray(raw)) return [];
    return raw.slice(-MAX_LOG_ENTRIES);
  }

  function defaultState() {
    return { credits: emptyCredits(), trophiesCounted: 0, starBlocksCounted: 0, updatedAt: 0, log: [] };
  }

  function getState() {
    var raw = localStorage.getItem(stateKey());
    if (!raw) return defaultState();
    try {
      var parsed = JSON.parse(raw);
      return {
        credits: normalizeCredits(parsed.credits),
        trophiesCounted: parsed.trophiesCounted || 0,
        starBlocksCounted: parsed.starBlocksCounted || 0,
        updatedAt: parsed.updatedAt || 0,
        log: normalizeLog(parsed.log)
      };
    } catch (e) {
      return defaultState();
    }
  }

  function saveState(state) {
    state.updatedAt = Date.now();
    localStorage.setItem(stateKey(), JSON.stringify(state));
    syncToCloud(state);
  }

  function totalStars() {
    if (typeof WordCardStore === "undefined") return 0;
    return WordCardStore.getCollected().reduce(function (sum, r) {
      return sum + (!r.isTrophy && r.stars ? r.stars : 0);
    }, 0);
  }

  // n회를 게임 3개에 1회씩 돌아가며 나눠 담는다(3의 배수면 정확히 균등하게 나뉜다).
  function addCreditsRoundRobin(state, n) {
    for (var i = 0; i < n; i++) {
      var game = GAMES[i % GAMES.length];
      state.credits[game] += 1;
    }
  }

  // 트로피/별 상태가 바뀔 때마다(카드 저장소 쪽에서) 불러주면, 지난번에 이미 센
  // 트로피 수·별 20개 단위 수보다 늘어난 만큼만 3회씩 새로 얹는다. 여러 번 불러도
  // 안전(늘어난 만큼만 계산하므로 중복 지급 없음).
  function syncCredits() {
    if (typeof WordCardStore === "undefined") return getTotalCredits();
    var state = getState();
    // Journeys 주간 트로피는 여기서 안 센다 - 그건 받는 순간 grantCredits로 직접
    // 기회를 주므로, 여기서도 같이 세면 두 번 주는 셈이 된다.
    var trophyCount = WordCardStore.getTrophyCards().filter(function (r) {
      return !r.journeysTrophy;
    }).length;
    var starBlocks = Math.floor(totalStars() / 20);

    var newTrophyMilestones = Math.max(0, trophyCount - state.trophiesCounted);
    var newStarMilestones = Math.max(0, starBlocks - state.starBlocksCounted);

    if (newTrophyMilestones > 0 || newStarMilestones > 0) {
      addCreditsRoundRobin(state, (newTrophyMilestones + newStarMilestones) * 3);
      state.trophiesCounted = trophyCount;
      state.starBlocksCounted = starBlocks;
      saveState(state);
    }
    return getTotalCredits();
  }

  // 관리자로 로그인해 있으면 게임 기회를 무한으로 쳐서 계속 테스트할 수 있게 한다.
  function isAdminActive() {
    return typeof AdminAuthStore !== "undefined" && AdminAuthStore.isActive();
  }

  // 게임 하나(tetris/sudoku/crossword)에 남은 기회.
  function getCredits(game) {
    if (isAdminActive()) return Infinity;
    var pinned = pinnedCreditsForActiveChild();
    if (pinned !== null) return pinned;
    return getState().credits[game] || 0;
  }

  // 3개 게임을 합친 전체 남은 기회(게임 탭 상단 표시, 잠금 여부 판단용).
  function getTotalCredits() {
    if (isAdminActive()) return Infinity;
    var pinned = pinnedCreditsForActiveChild();
    if (pinned !== null) return pinned;
    var credits = getState().credits;
    return GAMES.reduce(function (sum, game) {
      return sum + (credits[game] || 0);
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

  // 게임을 하나 시작할 때 그 게임 몫의 기회를 1회 쓴다. 오늘 공부를 안 했거나
  // 그 게임에 남은 기회가 없으면 false(다른 게임에 기회가 남아 있어도 안 됨).
  function spendCredit(game) {
    if (isAdminActive()) return true;
    if (!hasStudiedTodayForGames()) return false;
    if (pinnedCreditsForActiveChild() !== null) return true;
    var state = getState();
    if (!state.credits[game] || state.credits[game] <= 0) return false;
    state.credits[game] -= 1;
    state.log = normalizeLog(state.log.concat([{ game: game, spentAt: Date.now() }]));
    saveState(state);
    return true;
  }

  // 트로피/별 말고 다른 곳(예: 저니스 한 주 개근)에서도 게임 기회를 줄 때 쓴다.
  // 고정된 아이라도 실제 쌓이는 값은 뒤에서 그대로 늘어난다(화면 표시만 고정).
  function grantCredits(n) {
    var state = getState();
    addCreditsRoundRobin(state, n);
    saveState(state);
    return getTotalCredits();
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
      var parsed = JSON.parse(raw);
      return {
        credits: normalizeCredits(parsed.credits),
        trophiesCounted: parsed.trophiesCounted || 0,
        starBlocksCounted: parsed.starBlocksCounted || 0,
        updatedAt: parsed.updatedAt || 0,
        log: normalizeLog(parsed.log)
      };
    } catch (e) {
      return defaultState();
    }
  }

  function getCreditsForChild(childId) {
    var credits = getStateFor(childId).credits;
    return GAMES.reduce(function (sum, game) {
      return sum + (credits[game] || 0);
    }, 0);
  }

  // 게임 하나(tetris/sudoku/crossword)에 남은 그 아이의 기회.
  function getCreditsForChildByGame(childId, game) {
    return getStateFor(childId).credits[game] || 0;
  }

  // 최근에 쓴 기회 기록 - {game, spentAt}, 오래된 순(가장 최근이 배열 맨 뒤).
  function getSpendLogForChild(childId) {
    return getStateFor(childId).log;
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
    localStorage.setItem(stateKeyFor(childId), JSON.stringify({
      credits: normalizeCredits(data.credits),
      trophiesCounted: data.trophiesCounted || 0,
      starBlocksCounted: data.starBlocksCounted || 0,
      updatedAt: data.updatedAt || 0,
      log: normalizeLog(data.log)
    }));
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
    syncCredits: syncCredits,
    getCredits: getCredits,
    getTotalCredits: getTotalCredits,
    getCreditsLabel: getCreditsLabel,
    getTotalCreditsLabel: getTotalCreditsLabel,
    spendCredit: spendCredit,
    hasStudiedTodayForGames: hasStudiedTodayForGames,
    isWeekendToday: isWeekendToday,
    grantCredits: grantCredits,
    getCreditsForChild: getCreditsForChild,
    getCreditsForChildByGame: getCreditsForChildByGame,
    getSpendLogForChild: getSpendLogForChild,
    adminAdjustGameCredit: adminAdjustGameCredit
  };
})();
