// 저니스는 같은 유닛을 한 달 정도 반복해서 공부한다. 그래서 스탬프는 "한 번 깨면 끝"이
// 아니라 하루 단위 미션으로 동작한다: 오늘 1.음원 듣기 / 2.따라 읽기 / 3.혼자 읽기를
// 모두 끝내면 그날의 도장을 하나 받고, 도장은 월~금 도장 모음판에 쌓인다.
// 자정이 지나면 세 단계 체크는 다시 빈 상태로 시작한다.
// 아이(child id)별로 따로 저장해서 하정이와 하진이의 기록이 섞이지 않게 한다.
var StampStore = (function () {
  var STAGES = ["listen", "follow", "alone"];
  var WEEKDAY_LABELS = ["월", "화", "수", "목", "금"];

  function key(childId) {
    return "journeysStamps_" + childId;
  }

  function loadAll(childId) {
    var raw = localStorage.getItem(key(childId));
    if (!raw) return {};
    try {
      return JSON.parse(raw) || {};
    } catch (e) {
      return {};
    }
  }

  function saveAll(childId, data) {
    localStorage.setItem(key(childId), JSON.stringify(data));
  }

  // 아이별 스탬프 기록을 클라우드 문서 하나(stamps/{아이})와 그대로 맞춘다. 이 스토어는
  // ChildStore를 직접 들여다보지 않고 호출하는 쪽이 넘겨주는 childId만 쓰므로, 어떤
  // 아이가 지금 활성인지는 신경 쓰지 않고 "이 childId는 한 번은 구독해봤는지"만 기억한다.
  var watchedChildren = {};

  function cloudPath(childId) {
    return childId ? "stamps/" + childId : null;
  }

  function syncToCloud(childId) {
    if (typeof HaingCloud === "undefined" || !HaingCloud.enabled) return;
    var path = cloudPath(childId);
    if (!path) return;
    HaingCloud.writeDoc(path, loadAll(childId));
  }

  function ensureCloudSync(childId) {
    if (!childId || watchedChildren[childId]) return;
    if (typeof HaingCloud === "undefined" || !HaingCloud.enabled) return;
    watchedChildren[childId] = true;
    var path = cloudPath(childId);
    HaingCloud.getDocOnce(path).then(function (remote) {
      if (remote && Object.keys(remote).length > 0) {
        saveAll(childId, remote);
      } else {
        syncToCloud(childId);
      }
      HaingCloud.watchDoc(path, function (data) {
        if (!data) return;
        saveAll(childId, data);
        if (window.__journeysRenderStamps) window.__journeysRenderStamps();
        if (window.__journeysRenderHome) window.__journeysRenderHome();
      });
    });
  }

  function pad2(n) {
    return n < 10 ? "0" + n : String(n);
  }

  function toDateStr(d) {
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
  }

  function todayDate() {
    var d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function todayStr() {
    return toDateStr(todayDate());
  }

  function isDayComplete(entry) {
    return !!entry && STAGES.every(function (s) {
      return !!entry[s];
    });
  }

  function getTodayStamps(childId, unitId) {
    if (!childId) return { listen: false, follow: false, alone: false };
    ensureCloudSync(childId);
    var entry = (loadAll(childId)[unitId] || {})[todayStr()] || {};
    return { listen: !!entry.listen, follow: !!entry.follow, alone: !!entry.alone };
  }

  // 반환값: 이번 호출로 "오늘의 미션"을 처음 다 채웠으면 justCompletedAll이 true.
  function markStageDone(childId, unitId, stage) {
    ensureCloudSync(childId);
    var all = loadAll(childId);
    var unitRecords = all[unitId] || {};
    var today = todayStr();
    var entry = unitRecords[today] || {};
    var wasAllDoneBefore = isDayComplete(entry);

    entry[stage] = true;
    unitRecords[today] = entry;
    all[unitId] = unitRecords;
    saveAll(childId, all);

    var allDoneNow = isDayComplete(entry);
    syncToCloud(childId);
    return {
      stamps: { listen: !!entry.listen, follow: !!entry.follow, alone: !!entry.alone },
      allDone: allDoneNow,
      justCompletedAll: allDoneNow && !wasAllDoneBefore
    };
  }

  function mondayOf(d) {
    var day = d.getDay(); // 0 Sun .. 6 Sat
    var diffFromMonday = (day + 6) % 7;
    var monday = new Date(d);
    monday.setDate(d.getDate() - diffFromMonday);
    monday.setHours(0, 0, 0, 0);
    return monday;
  }

  // 그 주 월~금 중 못 채운 날이 있어도, 같은 주 토·일에 미션을 끝냈으면 그만큼
  // 앞에서부터(가장 이른 미완료 요일부터) 순서대로 도장을 채워준다 - 진짜 그날
  // 한 것과 구분하도록 day.isMakeup으로 표시한다("성공" 대신 "주말"). isStampedFn은
  // 날짜 문자열을 받아 그날이 채워진 날인지 돌려주는 함수 - 유닛 하나만 볼 때와
  // 어떤 유닛이든 볼 때가 이 함수 하나만 다르게 넘기면 되도록 분리해뒀다.
  function applyWeekendMakeup(days, weekStart, isStampedFn) {
    var satDate = new Date(weekStart);
    satDate.setDate(weekStart.getDate() + 5);
    var sunDate = new Date(weekStart);
    sunDate.setDate(weekStart.getDate() + 6);

    var makeupCount = 0;
    if (isStampedFn(toDateStr(satDate))) makeupCount++;
    if (isStampedFn(toDateStr(sunDate))) makeupCount++;

    for (var i = 0; i < days.length && makeupCount > 0; i++) {
      if (!days[i].stamped) {
        days[i].stamped = true;
        days[i].isMakeup = true;
        makeupCount--;
      }
    }
  }

  // 기록이 시작된 주부터 이번 주까지, 월~금 5칸씩 주 단위로 묶어서 돌려준다. 기록이
  // 없으면 최소 이번 주 한 줄은 항상 보여준다. recordedDateStrs는 그리드의 시작 주(가장
  // 이른 기록)를 정하는 데만 쓰고, 실제 칸 채움은 isStampedFn(dateStr)로 판단한다.
  function buildWeekGrid(recordedDateStrs, isStampedFn) {
    var today = todayDate();
    var todayKey = toDateStr(today);
    var dateStrs = recordedDateStrs.slice();
    if (dateStrs.indexOf(todayKey) === -1) dateStrs.push(todayKey);

    var earliestKey = dateStrs.reduce(function (min, s) {
      return s < min ? s : min;
    }, todayKey);

    var startMonday = mondayOf(new Date(earliestKey + "T00:00:00"));
    var endMonday = mondayOf(today);

    var weeks = [];
    var cursor = new Date(startMonday);
    while (cursor <= endMonday) {
      var days = [];
      for (var i = 0; i < 5; i++) {
        var d = new Date(cursor);
        d.setDate(cursor.getDate() + i);
        var dStr = toDateStr(d);
        days.push({
          date: dStr,
          label: WEEKDAY_LABELS[i],
          stamped: isStampedFn(dStr),
          isToday: dStr === todayKey,
          isFuture: d > today
        });
      }
      applyWeekendMakeup(days, cursor, isStampedFn);
      weeks.push({ weekStart: toDateStr(cursor), days: days });
      cursor.setDate(cursor.getDate() + 7);
    }
    return weeks;
  }

  function getWeekGrid(childId, unitId) {
    if (childId) ensureCloudSync(childId);
    var unitRecords = childId ? loadAll(childId)[unitId] || {} : {};
    return buildWeekGrid(Object.keys(unitRecords), function (dStr) {
      return isDayComplete(unitRecords[dStr]);
    });
  }

  // 특정 유닛이 아니라 "오늘 어느 유닛이든 하루 미션을 다 끝냈는지"로 채워지는
  // 도장판. Journeys 메뉴 맨 위에 유닛과 무관하게 하나만 보여줄 때 쓴다.
  function getWeekGridAny(childId) {
    if (childId) ensureCloudSync(childId);
    var all = childId ? loadAll(childId) : {};
    var dateStrs = [];
    Object.keys(all).forEach(function (unitId) {
      Object.keys(all[unitId] || {}).forEach(function (d) {
        if (dateStrs.indexOf(d) === -1) dateStrs.push(d);
      });
    });
    function isStampedAny(dStr) {
      return Object.keys(all).some(function (unitId) {
        return isDayComplete((all[unitId] || {})[dStr]);
      });
    }
    return buildWeekGrid(dateStrs, isStampedAny);
  }

  // 트로피 카드에 적을 "8월 4주" 같은 표시용 라벨. 그 주 월요일이 그 달의 몇 번째
  // 주(1~5)인지를 날짜/7 올림으로 정한다.
  function weekLabel(weekStartStr) {
    var d = new Date(weekStartStr + "T00:00:00");
    var weekNum = Math.ceil(d.getDate() / 7);
    return (d.getMonth() + 1) + "월 " + weekNum + "주";
  }

  // 홈 화면 유닛 카드에 쓸 간단한 누적 도장 개수.
  function getTotalStampedDays(childId, unitId) {
    if (!childId) return 0;
    ensureCloudSync(childId);
    var unitRecords = loadAll(childId)[unitId] || {};
    return Object.keys(unitRecords).filter(function (dStr) {
      return isDayComplete(unitRecords[dStr]);
    }).length;
  }

  // 오늘 어느 유닛이든 하루 미션(1.음원 듣기·2.따라 읽기·3.혼자 읽기)을 하나라도
  // 끝냈는지 - Word 쪽 "오늘 저니스 먼저 하기" 게임 잠금 해제 조건에 쓴다.
  function hasCompletedAnyToday(childId) {
    if (!childId) return false;
    ensureCloudSync(childId);
    var all = loadAll(childId);
    var today = todayStr();
    return Object.keys(all).some(function (unitId) {
      return isDayComplete((all[unitId] || {})[today]);
    });
  }

  // 관리자 진행 달력용 - 특정 날짜(오늘이 아니어도)에 이 아이가 어느 유닛이든
  // 하루 미션을 끝냈는지. hasCompletedAnyToday와 같은 로직이지만 날짜를 직접 받는다.
  function isDayCompleteFor(childId, dateStr) {
    if (!childId) return false;
    ensureCloudSync(childId);
    var all = loadAll(childId);
    return Object.keys(all).some(function (unitId) {
      return isDayComplete((all[unitId] || {})[dateStr]);
    });
  }

  // 관리자 진행 달력에 그대로 그릴 수 있게, year-month(1~12) 한 달치 날짜를
  // 하루씩 돌려준다. 유닛과 무관하게 그날 어느 유닛이든 미션을 끝냈으면 completed.
  function getMonthDays(childId, year, month) {
    var daysInMonth = new Date(year, month, 0).getDate();
    var today = todayDate();
    var days = [];
    for (var d = 1; d <= daysInMonth; d++) {
      var date = new Date(year, month - 1, d);
      var dStr = toDateStr(date);
      days.push({
        date: dStr,
        day: d,
        weekday: date.getDay(),
        isFuture: date > today,
        completed: isDayCompleteFor(childId, dStr)
      });
    }
    return days;
  }

  return {
    STAGES: STAGES,
    WEEKDAY_LABELS: WEEKDAY_LABELS,
    getTodayStamps: getTodayStamps,
    markStageDone: markStageDone,
    getWeekGrid: getWeekGrid,
    getWeekGridAny: getWeekGridAny,
    weekLabel: weekLabel,
    getTotalStampedDays: getTotalStampedDays,
    hasCompletedAnyToday: hasCompletedAnyToday,
    getMonthDays: getMonthDays
  };
})();
