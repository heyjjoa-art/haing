// 1~4번 기능을 순서대로 완료했는지 유닛별로 추적하는 저장소.
// 새 유닛을 시작하면 그 유닛만 다시 1번부터 잠기고, 예전에 깬 유닛의 완료 기록은 그대로 남는다.
var ProgressStore = (function () {
  var STEPS = ["storybook", "flashcards", "memory", "hangman"];
  // 초등 단어장 단계(초등1, 초등2...)는 본문이 없어서 스토리북을 건너뛰고 2~4번만 밟는다.
  var VOCAB_ONLY_STEPS = ["flashcards", "memory", "hangman"];

  function unitKey() {
    return (typeof DataStore !== "undefined" && DataStore.resolveUnitKey()) || "unspecified";
  }

  function currentSteps() {
    if (typeof DataStore !== "undefined" && DataStore.isElementaryUnit && DataStore.isElementaryUnit(unitKey())) {
      return VOCAB_ONLY_STEPS;
    }
    return STEPS;
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

  // 이 유닛을 한 번 완주한 뒤(=복습 모드)에도 1~4번을 순서대로 다시 밟게 하기 위한
  // "이번 복습 한 바퀴" 진행 기록. 한 바퀴(1~4번)를 다 돌면 바로 비워서, 다음에
  // 또 복습하려면 다시 1번부터 순서대로 밟아야 한다.
  function reviewProgressKey() {
    return "haingReviewProgress_" + childPrefix() + unitKey();
  }

  // 하루에 몇 바퀴(=세트)나 단어 공부를 끝냈는지 - 유닛과 무관하게 아이 하나당 하루
  // 단위로 센다. 1~4번(또는 초등의 2~4번)을 처음 다 끝내거나, 복습을 한 바퀴 다시
  // 돌 때마다 1세트로 친다. 하루 3세트까지만 별/카드/게임 기회 같은 보상이 쌓이고,
  // 그 이상은 공부 자체는 계속할 수 있지만 보상은 더 안 쌓인다(word-card-store.js 참고).
  var WORD_SETS_DAILY_CAP = 3;

  function pad2(n) {
    return n < 10 ? "0" + n : String(n);
  }

  function todayStr() {
    var d = new Date();
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
  }

  function wordSetsTodayKey() {
    return "haingWordSetsToday_" + childPrefix();
  }

  function getTodaySetInfo() {
    var raw = localStorage.getItem(wordSetsTodayKey());
    if (raw) {
      try {
        var parsed = JSON.parse(raw);
        if (parsed && parsed.date === todayStr()) {
          return { date: parsed.date, count: parsed.count || 0 };
        }
      } catch (e) {
        // no-op - 아래에서 오늘치로 새로 시작한다
      }
    }
    return { date: todayStr(), count: 0 };
  }

  function recordWordSetCompleted() {
    var info = getTodaySetInfo();
    if (info.count < WORD_SETS_DAILY_CAP) {
      info.count += 1;
      localStorage.setItem(wordSetsTodayKey(), JSON.stringify(info));
    }
  }

  // 오늘 단어 공부를 한 세트라도 끝냈는지 - 게임 잠금 해제 조건에 쓴다.
  function hasCompletedSetToday() {
    return getTodaySetInfo().count > 0;
  }

  // 오늘 하루치 보상 한도(3세트)를 다 채웠는지 - word-card-store.js가 별/카드
  // 지급 여부를 결정할 때 쓴다.
  function reachedDailyWordCap() {
    return getTodaySetInfo().count >= WORD_SETS_DAILY_CAP;
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
    // 이 단계를 끝내면서 유닛을 처음으로 다 끝냈다면(1~4번 완주) 오늘의 첫 세트로 센다.
    if (currentSteps().every(function (s) { return !!data[s]; })) {
      recordWordSetCompleted();
    }
    syncToCloud();
    return true;
  }

  function isDone(step) {
    return !!load()[step];
  }

  function isAllDone() {
    var data = load();
    return currentSteps().every(function (s) {
      return !!data[s];
    });
  }

  function loadReviewProgress() {
    var raw = localStorage.getItem(reviewProgressKey());
    if (!raw) return {};
    try {
      return JSON.parse(raw) || {};
    } catch (e) {
      return {};
    }
  }

  // 복습 한 바퀴 중 한 단계를 마칠 때마다 호출한다. 4번까지 다 마치면(=한 바퀴 완주)
  // 바로 기록을 비워, 다음 복습도 다시 1번부터 순서대로 밟도록 한다.
  function markReviewStep(step) {
    var review = loadReviewProgress();
    review[step] = true;
    var lapDone = currentSteps().every(function (s) {
      return !!review[s];
    });
    if (lapDone) {
      review = {};
      // 복습 한 바퀴를 다 돌았으니 오늘의 세트로 센다.
      recordWordSetCompleted();
    }
    localStorage.setItem(reviewProgressKey(), JSON.stringify(review));
    syncToCloud();
  }

  function isUnlocked(step) {
    var steps = currentSteps();
    var idx = steps.indexOf(step);
    if (idx <= 0) return true;
    // 한 번 완주한 유닛은(=복습 모드) 예전 완료 기록이 아니라 "이번 복습 한 바퀴"
    // 진행 기록을 기준으로 순서를 따진다 - 그래야 복습할 때도 순서대로 밟는다.
    if (isAllDone()) {
      var review = loadReviewProgress();
      return !!review[steps[idx - 1]];
    }
    var data = load();
    return !!data[steps[idx - 1]];
  }

  function reset() {
    localStorage.removeItem(progressKey());
    localStorage.removeItem(reviewProgressKey());
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
        key.indexOf("haingReviewProgress_" + prefix) === 0 ||
        key.indexOf("haingWordSetsToday_" + prefix) === 0 ||
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

  // 클라우드 entries를 그대로 반영한다 - 클라우드에 없는 키는 이 기기에서도 지운다.
  // (예전엔 클라우드에 있는 키만 덮어쓰고 없는 키는 안 지워서, 관리자가 진행률을
  // 초기화해도 클라우드가 빈 상태로 반영되면 오히려 이 기기의 예전 값을 다시
  // 클라우드로 밀어올려 초기화가 무효화되는 문제가 있었다.)
  function applyCloudEntries(data) {
    var prefix = childPrefix();
    Object.keys(localStorage).forEach(function (key) {
      var isProgressKey =
        key.indexOf("haingProgress_" + prefix) === 0 ||
        key.indexOf("haingStepProgress_" + prefix) === 0 ||
        key.indexOf("haingReviewProgress_" + prefix) === 0 ||
        key.indexOf("haingWordSetsToday_" + prefix) === 0 ||
        (key.indexOf("haingCustom_") === 0 && key.indexOf("_" + prefix) !== -1);
      if (isProgressKey && (!data || !data.entries || !(key in data.entries))) {
        localStorage.removeItem(key);
      }
    });
    if (data && data.entries) {
      Object.keys(data.entries).forEach(function (key) {
        localStorage.setItem(key, data.entries[key]);
      });
    }
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
      // 클라우드에 문서 자체가 없으면(이 아이가 클라우드에 처음 연결) 이 기기 값을
      // 시작점으로 올린다. 문서가 있으면 entries가 비어있어도(=관리자가 초기화한
      // 경우 포함) 클라우드를 그대로 따른다 - "비어있음"과 "아직 없음"을 구분해야
      // 초기화가 이 기기에도 실제로 반영된다.
      if (remote) {
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
    markReviewStep: markReviewStep,
    reset: reset,
    setStepProgress: setStepProgress,
    getStepProgress: getStepProgress,
    setCustomState: setCustomState,
    getCustomState: getCustomState,
    hasCompletedSetToday: hasCompletedSetToday,
    reachedDailyWordCap: reachedDailyWordCap
  };
})();
