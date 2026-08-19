// 1~4번 기능을 순서대로 완료했는지 유닛별로 추적하는 저장소.
// 새 유닛을 시작하면 그 유닛만 다시 1번부터 잠기고, 예전에 깬 유닛의 완료 기록은 그대로 남는다.
var ProgressStore = (function () {
  var STEPS = ["storybook", "flashcards", "memory", "hangman"];

  function unitKey() {
    return (typeof DataStore !== "undefined" && DataStore.resolveUnitKey()) || "unspecified";
  }

  // 진행 상황은 아이(하정/하진)별로 따로 쌓인다. 유닛/단어 콘텐츠 자체는
  // ChildStore와 무관하게 두 아이가 공유한다.
  function childPrefix() {
    var childId = typeof ChildStore !== "undefined" && ChildStore.getActive();
    return childId ? childId + "_" : "guest_";
  }

  function progressKey() {
    return "haingProgress_" + childPrefix() + unitKey();
  }

  function stepProgressKey() {
    return "haingStepProgress_" + childPrefix() + unitKey();
  }

  function load() {
    var raw = localStorage.getItem(progressKey());
    if (!raw) return {};
    try {
      return JSON.parse(raw) || {};
    } catch (e) {
      return {};
    }
  }

  function markDone(step) {
    var data = load();
    if (data[step]) return false;
    data[step] = true;
    localStorage.setItem(progressKey(), JSON.stringify(data));
    syncToCloud();
    return true;
  }

  function isDone(step) {
    return !!load()[step];
  }

  function isAllDone() {
    var data = load();
    return STEPS.every(function (s) {
      return !!data[s];
    });
  }

  function isUnlocked(step) {
    // 이 유닛을 한 번 완주한 뒤에는 순서 상관없이 자유롭게 복습할 수 있다.
    if (isAllDone()) return true;
    var idx = STEPS.indexOf(step);
    if (idx <= 0) return true;
    var data = load();
    return !!data[STEPS[idx - 1]];
  }

  function reset() {
    localStorage.removeItem(progressKey());
  }

  // 중간에 나가도 홈 화면에서 얼마나 했는지 보여주기 위한 진행률(개수) 저장.
  function loadStepProgress() {
    var raw = localStorage.getItem(stepProgressKey());
    if (!raw) return {};
    try {
      return JSON.parse(raw) || {};
    } catch (e) {
      return {};
    }
  }

  function setStepProgress(step, done, total) {
    var data = loadStepProgress();
    data[step] = { done: done, total: total };
    localStorage.setItem(stepProgressKey(), JSON.stringify(data));
    syncToCloud();
  }

  function getStepProgress(step) {
    return loadStepProgress()[step] || null;
  }

  // 게임마다 필요한 잡다한 상태(예: 4번 게임에서 마지막으로 있던 단계)를
  // 유닛별로 저장해서, 다시 들어왔을 때 그 지점부터 이어갈 수 있게 한다.
  function customKey(name) {
    return "haingCustom_" + name + "_" + childPrefix() + unitKey();
  }

  function setCustomState(name, value) {
    localStorage.setItem(customKey(name), JSON.stringify(value));
    syncToCloud();
  }

  function getCustomState(name) {
    var raw = localStorage.getItem(customKey(name));
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  // 진행 상황은 아이별로 하나의 클라우드 문서에 몰아 저장한다(유닛/종류별로 문서를
  // 쪼개지 않고, 이 아이의 haingProgress_/haingStepProgress_/haingCustom_ 키를 통째로).
  // 로그인 안 한(guest) 상태는 어느 아이 것인지 알 수 없어 동기화하지 않는다.
  function cloudPath() {
    var childId = typeof ChildStore !== "undefined" && ChildStore.getActive();
    return childId ? "progress/" + childId : null;
  }

  function relevantLocalEntries() {
    var prefix = childPrefix();
    var entries = {};
    Object.keys(localStorage).forEach(function (key) {
      if (
        key.indexOf("haingProgress_" + prefix) === 0 ||
        key.indexOf("haingStepProgress_" + prefix) === 0 ||
        (key.indexOf("haingCustom_") === 0 && key.indexOf("_" + prefix) !== -1)
      ) {
        entries[key] = localStorage.getItem(key);
      }
    });
    return entries;
  }

  function syncToCloud() {
    if (typeof HaingCloud === "undefined" || !HaingCloud.enabled) return;
    var path = cloudPath();
    if (!path) return;
    HaingCloud.writeDoc(path, { entries: relevantLocalEntries() });
  }

  function applyCloudEntries(data) {
    if (!data || !data.entries) return;
    Object.keys(data.entries).forEach(function (key) {
      localStorage.setItem(key, data.entries[key]);
    });
    if (window.__haingRenderHome) window.__haingRenderHome();
  }

  // 지금 로그인한 아이의 진행 상황만 클라우드와 맞춘다. 다른 아이로 로그인을 바꾸면
  // (페이지 새로고침 없이 같은 화면에서 전환되므로) 구독을 새로 걸어야 한다.
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
      if (remote && remote.entries && Object.keys(remote.entries).length > 0) {
        applyCloudEntries(remote);
      } else {
        syncToCloud();
      }
      unsubscribeCloud = HaingCloud.watchDoc(path, applyCloudEntries);
    });
  }

  setupCloudSyncForActiveChild();
  if (typeof ChildStore !== "undefined" && ChildStore.onChange) {
    ChildStore.onChange(setupCloudSyncForActiveChild);
  }

  return {
    STEPS: STEPS,
    markDone: markDone,
    isDone: isDone,
    isUnlocked: isUnlocked,
    isAllDone: isAllDone,
    reset: reset,
    setStepProgress: setStepProgress,
    getStepProgress: getStepProgress,
    setCustomState: setCustomState,
    getCustomState: getCustomState
  };
})();
