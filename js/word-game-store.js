// 트로피 카드 1장을 새로 받거나, 별 스티커가 20개씩 쌓일 때마다 미니게임 기회를
// 3회씩 준다(둘 다 계속 반복해서 쌓인다 - 트로피 2장이면 6회, 별 40개면 6회, 등).
// 기회는 게임 종류에 상관없이 공용으로 쓰는 하나의 주머니.
var WordGameStore = (function () {
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

  function defaultState() {
    return { credits: 0, trophiesCounted: 0, starBlocksCounted: 0 };
  }

  function getState() {
    var raw = localStorage.getItem(stateKey());
    if (!raw) return defaultState();
    try {
      var parsed = JSON.parse(raw);
      return {
        credits: parsed.credits || 0,
        trophiesCounted: parsed.trophiesCounted || 0,
        starBlocksCounted: parsed.starBlocksCounted || 0
      };
    } catch (e) {
      return defaultState();
    }
  }

  function saveState(state) {
    localStorage.setItem(stateKey(), JSON.stringify(state));
    syncToCloud(state);
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
    if (typeof WordCardStore === "undefined") return getState().credits;
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
      state.credits += (newTrophyMilestones + newStarMilestones) * 3;
      state.trophiesCounted = trophyCount;
      state.starBlocksCounted = starBlocks;
      saveState(state);
    }
    return getCredits();
  }

  // 관리자로 로그인해 있으면 게임 기회를 무한으로 쳐서 계속 테스트할 수 있게 한다.
  function isAdminActive() {
    return typeof AdminAuthStore !== "undefined" && AdminAuthStore.isActive();
  }

  function getCredits() {
    if (isAdminActive()) return Infinity;
    var pinned = pinnedCreditsForActiveChild();
    if (pinned !== null) return pinned;
    return getState().credits;
  }

  // 화면에 그대로 찍기 좋은 문자열. 관리자는 "Infinity"라는 영어 대신 "무제한"으로 보여준다.
  function getCreditsLabel() {
    var credits = getCredits();
    return credits === Infinity ? "무제한" : String(credits);
  }

  // 게임을 하나 시작할 때 기회를 1회 쓴다. 남은 기회가 없으면 false.
  function spendCredit() {
    if (isAdminActive()) return true;
    if (pinnedCreditsForActiveChild() !== null) return true;
    var state = getState();
    if (state.credits <= 0) return false;
    state.credits -= 1;
    saveState(state);
    return true;
  }

  // 트로피/별 말고 다른 곳(예: 저니스 한 주 개근)에서도 게임 기회를 줄 때 쓴다.
  // 고정된 아이라도 실제 쌓이는 값은 뒤에서 그대로 늘어난다(화면 표시만 고정).
  function grantCredits(n) {
    var state = getState();
    state.credits += n;
    saveState(state);
    return getCredits();
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
        credits: parsed.credits || 0,
        trophiesCounted: parsed.trophiesCounted || 0,
        starBlocksCounted: parsed.starBlocksCounted || 0
      };
    } catch (e) {
      return defaultState();
    }
  }

  function getCreditsForChild(childId) {
    return getStateFor(childId).credits;
  }

  // n을 더한다(복구용으로는 양수, 되돌릴 땐 음수도 가능 - 0 밑으로는 안 내려간다).
  // 이후에도 트로피/별로 쌓이는 정상적인 카운트는 그대로 이어진다(고정이 아니다).
  function adminAddCredits(childId, n) {
    if (!childId) return 0;
    var state = getStateFor(childId);
    state.credits = Math.max(0, state.credits + n);
    localStorage.setItem(stateKeyFor(childId), JSON.stringify(state));
    if (typeof HaingCloud !== "undefined" && HaingCloud.enabled) {
      HaingCloud.writeDoc("wordGameCredits/" + childId, state);
    }
    if (window.__haingRenderAdminChildSettings) window.__haingRenderAdminChildSettings();
    return state.credits;
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

  function applyCloudState(data) {
    if (!data) return;
    localStorage.setItem(stateKey(), JSON.stringify({
      credits: data.credits || 0,
      trophiesCounted: data.trophiesCounted || 0,
      starBlocksCounted: data.starBlocksCounted || 0
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
    HaingCloud.getDocOnce(path).then(function (remote) {
      if (remote) {
        applyCloudState(remote);
      } else {
        syncToCloud(getState());
      }
      unsubscribeCloud = HaingCloud.watchDoc(path, applyCloudState);
    });
  }

  setupCloudSyncForActiveChild();
  if (typeof ChildStore !== "undefined" && ChildStore.onChange) {
    ChildStore.onChange(setupCloudSyncForActiveChild);
  }

  return {
    syncCredits: syncCredits,
    getCredits: getCredits,
    getCreditsLabel: getCreditsLabel,
    spendCredit: spendCredit,
    grantCredits: grantCredits,
    getCreditsForChild: getCreditsForChild,
    adminAddCredits: adminAddCredits
  };
})();
