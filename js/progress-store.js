// 1~4번 기능을 순서대로 완료했는지 유닛별로 추적하는 저장소.
// 새 유닛을 시작하면 그 유닛만 다시 1번부터 잠기고, 예전에 깬 유닛의 완료 기록은 그대로 남는다.
var ProgressStore = (function () {
  var STEPS = ["storybook", "flashcards", "memory", "hangman"];

  function unitKey() {
    return (typeof DataStore !== "undefined" && DataStore.resolveUnitKey()) || "unspecified";
  }

  function progressKey() {
    return "haingProgress_" + unitKey();
  }

  function stepProgressKey() {
    return "haingStepProgress_" + unitKey();
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
  }

  function getStepProgress(step) {
    return loadStepProgress()[step] || null;
  }

  // 게임마다 필요한 잡다한 상태(예: 4번 게임에서 마지막으로 있던 단계)를
  // 유닛별로 저장해서, 다시 들어왔을 때 그 지점부터 이어갈 수 있게 한다.
  function customKey(name) {
    return "haingCustom_" + name + "_" + unitKey();
  }

  function setCustomState(name, value) {
    localStorage.setItem(customKey(name), JSON.stringify(value));
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
