// 저니스는 같은 유닛을 한 달 정도 반복해서 공부한다. 그래서 스탬프는 "한 번 깨면 끝"이
// 아니라 하루 단위 미션으로 동작한다: 오늘 1.음원 듣기 / 2.따라 읽기 / 3.혼자 읽기를
// 모두 끝내면 도장을 하나 받고, 도장은 월~금 도장 모음판에 쌓인다.
// 하루에 여러 번 다 끝낼 수도 있다: 평일에 처음 끝내면 오늘 칸에 도장이 찍히고,
// 같은 날 또 다 끝내거나 오늘이 주말이면(도장판엔 월~금 칸밖에 없어서 주말은
// "오늘 칸" 자체가 없다) 가장 앞선(오래된) 빈 칸부터 채워진다.
// 세 단계 체크(1·2·3번 버튼)는 도장을 하나 받을 때마다 다시 빈 상태로 돌아가서
// 바로 다음 번 도장을 향해 새로 시작할 수 있다.
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

  // 도장이 실제로 찍힌 날짜 목록은 unitRecords._stamps에 따로 보관한다(날짜 문자열
  // 키와 안 겹치게 밑줄 붙은 이름을 씀) - 그래야 "오늘 진행 상태"(1·2·3번 체크)와
  // "도장판에 실제로 찍힌 날"을 분리해서, 오늘 다 끝낸 뒤 체크를 다시 비워도(하루에
  // 여러 번 찍을 수 있게) 이미 찍힌 도장은 그대로 남는다.
  // 이 필드가 아직 없는 예전 기록은, 그때까지 완료된 날짜를 그대로 도장으로 옮겨서
  // 한 번만 마이그레이션한다.
  function ensureStampsMigrated(unitRecords) {
    if (!unitRecords._stamps) {
      var stamps = [];
      Object.keys(unitRecords).forEach(function (dateStr) {
        if (dateStr !== "_stamps" && isDayComplete(unitRecords[dateStr])) stamps.push(dateStr);
      });
      unitRecords._stamps = stamps;
    }
    fixMisplacedWeekendStamps(unitRecords);
  }

  // 8/27~8/29 사이엔 주말에 미션을 다 끝내면 그날 날짜(토/일) 그대로 도장을 찍었는데,
  // 도장판은 월~금 칸밖에 없어서 그렇게 찍힌 도장은 화면 어디에도 보이지 않았다(같은
  // 버그로 그 이전 옛 기록에도 주말 날짜가 섞여 들어갔을 수 있다 - isDayComplete만
  // 보고 옮기던 예전 마이그레이션도 요일을 안 가렸다). 이미 그렇게 묻혀버린 주말
  // 도장을 찾으면, 원래 의도(주말에 하면 그 주의 빈 평일 칸부터 채워짐)대로 옮겨준다.
  // 옮길 빈 평일 칸이 없으면(그 주가 이미 다 채워진 상태) 그냥 버린다 - 어차피 표시될
  // 칸이 없었으니 잃는 건 없다.
  function fixMisplacedWeekendStamps(unitRecords) {
    var stamps = unitRecords._stamps;
    var weekendStamps = stamps.filter(function (d) {
      return !isWeekday(d);
    });
    if (!weekendStamps.length) return;
    weekendStamps.sort().forEach(function (d) {
      var idx = stamps.indexOf(d);
      if (idx !== -1) stamps.splice(idx, 1);
      var earliest = findEarliestMissingWeekday(unitRecords, stamps, d);
      if (earliest) stamps.push(earliest);
    });
  }

  // 이미 기록이 있는 가장 이른 날짜의 그 주 월요일부터 오늘까지, 아직 도장이 안 찍힌
  // 월~금 중 가장 이른 날을 찾는다 - "또 하면 앞에서부터 채워지게" 하는 부분.
  function findEarliestMissingWeekday(unitRecords, stamps, todayKey) {
    var dateKeys = Object.keys(unitRecords).filter(function (k) {
      return k !== "_stamps";
    });
    var candidates = dateKeys.concat(stamps, [todayKey]);
    var earliestKey = candidates.reduce(function (min, s) {
      return s < min ? s : min;
    }, todayKey);

    var cursor = mondayOf(new Date(earliestKey + "T00:00:00"));
    var today = todayDate();
    while (cursor <= today) {
      for (var i = 0; i < 5; i++) {
        var d = new Date(cursor);
        d.setDate(cursor.getDate() + i);
        if (d > today) return null;
        var dStr = toDateStr(d);
        if (dStr !== todayKey && stamps.indexOf(dStr) === -1) return dStr;
      }
      cursor.setDate(cursor.getDate() + 7);
    }
    return null;
  }

  function isWeekday(dateStr) {
    var day = new Date(dateStr + "T00:00:00").getDay(); // 0 Sun .. 6 Sat
    return day >= 1 && day <= 5;
  }

  // 오늘이 평일(월~금)이고 오늘 도장이 아직 없으면 오늘 칸에 찍는다. 오늘이 주말이거나
  // (도장판엔 월~금 칸밖에 없어서 주말 날짜로 찍으면 어디에도 표시가 안 된다), 오늘
  // 이미 찍혀 있으면(같은 날 두 번째 이상 다 끝낸 것) 가장 앞선 빈 칸을 찾아 채운다.
  // 채울 칸이 없으면(이미 오늘까지 다 채워진 상태) 아무것도 안 하고 null을 돌려준다.
  function creditStamp(unitRecords, todayKey) {
    var stamps = unitRecords._stamps;
    if (isWeekday(todayKey) && stamps.indexOf(todayKey) === -1) {
      stamps.push(todayKey);
      return todayKey;
    }
    var earliest = findEarliestMissingWeekday(unitRecords, stamps, todayKey);
    if (earliest) {
      stamps.push(earliest);
      return earliest;
    }
    return null;
  }

  function getTodayStamps(childId, unitId) {
    if (!childId) return { listen: false, follow: false, alone: false };
    ensureCloudSync(childId);
    var entry = (loadAll(childId)[unitId] || {})[todayStr()] || {};
    return { listen: !!entry.listen, follow: !!entry.follow, alone: !!entry.alone };
  }

  // 반환값: 이번 호출로 "오늘의 미션"을 다 채웠으면 justCompletedAll이 true, 그때
  // 실제로 도장이 찍힌 날짜가 creditedDate(오늘이거나, 이미 오늘 걸 찍었다면 밀린
  // 날 중 가장 이른 날). 다 채운 순간 1·2·3번 체크는 다시 비워서, 오늘 안에 또
  // 끝내면 그것도 새 완료로 잡히게 한다.
  function markStageDone(childId, unitId, stage) {
    ensureCloudSync(childId);
    var all = loadAll(childId);
    var unitRecords = all[unitId] || {};
    ensureStampsMigrated(unitRecords);
    var today = todayStr();
    var entry = unitRecords[today] || {};
    var wasAllDoneBefore = isDayComplete(entry);

    entry[stage] = true;
    unitRecords[today] = entry;

    var allDoneNow = isDayComplete(entry);
    var justCompletedAll = allDoneNow && !wasAllDoneBefore;
    var creditedDate = null;
    if (justCompletedAll) {
      creditedDate = creditStamp(unitRecords, today);
      unitRecords[today] = { listen: false, follow: false, alone: false };
    }

    all[unitId] = unitRecords;
    saveAll(childId, all);
    syncToCloud(childId);
    return {
      stamps: { listen: !!entry.listen, follow: !!entry.follow, alone: !!entry.alone },
      allDone: allDoneNow,
      justCompletedAll: justCompletedAll,
      creditedDate: creditedDate
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
      weeks.push({ weekStart: toDateStr(cursor), days: days });
      cursor.setDate(cursor.getDate() + 7);
    }
    return weeks;
  }

  function getWeekGrid(childId, unitId) {
    if (childId) ensureCloudSync(childId);
    var unitRecords = childId ? loadAll(childId)[unitId] || {} : {};
    ensureStampsMigrated(unitRecords);
    var stamps = unitRecords._stamps || [];
    var recordedDateStrs = Object.keys(unitRecords)
      .filter(function (k) {
        return k !== "_stamps";
      })
      .concat(stamps);
    return buildWeekGrid(recordedDateStrs, function (dStr) {
      return stamps.indexOf(dStr) !== -1;
    });
  }

  // 특정 유닛이 아니라 "오늘 어느 유닛이든 하루 미션을 다 끝냈는지"로 채워지는
  // 도장판. Journeys 메뉴 맨 위에 유닛과 무관하게 하나만 보여줄 때 쓴다.
  function getWeekGridAny(childId) {
    if (childId) ensureCloudSync(childId);
    var all = childId ? loadAll(childId) : {};
    var dateStrs = [];
    var stampedSet = {};
    Object.keys(all).forEach(function (unitId) {
      var unitRecords = all[unitId] || {};
      ensureStampsMigrated(unitRecords);
      Object.keys(unitRecords).forEach(function (d) {
        if (d !== "_stamps" && dateStrs.indexOf(d) === -1) dateStrs.push(d);
      });
      (unitRecords._stamps || []).forEach(function (d) {
        stampedSet[d] = true;
        if (dateStrs.indexOf(d) === -1) dateStrs.push(d);
      });
    });
    function isStampedAny(dStr) {
      return !!stampedSet[dStr];
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
    ensureStampsMigrated(unitRecords);
    return (unitRecords._stamps || []).length;
  }

  // 오늘 어느 유닛이든 하루 미션(1.음원 듣기·2.따라 읽기·3.혼자 읽기)을 하나라도
  // 끝냈는지 - Word 쪽 "오늘 저니스 먼저 하기" 게임 잠금 해제 조건에 쓴다. 첫 완료는
  // 항상 오늘 칸에 찍히므로, 오늘 칸에 도장이 있는지만 보면 된다.
  function hasCompletedAnyToday(childId) {
    if (!childId) return false;
    ensureCloudSync(childId);
    var all = loadAll(childId);
    var today = todayStr();
    return Object.keys(all).some(function (unitId) {
      var unitRecords = all[unitId] || {};
      ensureStampsMigrated(unitRecords);
      return (unitRecords._stamps || []).indexOf(today) !== -1;
    });
  }

  // 관리자 진행 달력용 - 특정 날짜(오늘이 아니어도)에 이 아이가 어느 유닛이든
  // 도장을 받았는지. hasCompletedAnyToday와 같은 로직이지만 날짜를 직접 받는다.
  function isDayCompleteFor(childId, dateStr) {
    if (!childId) return false;
    ensureCloudSync(childId);
    var all = loadAll(childId);
    return Object.keys(all).some(function (unitId) {
      var unitRecords = all[unitId] || {};
      ensureStampsMigrated(unitRecords);
      return (unitRecords._stamps || []).indexOf(dateStr) !== -1;
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
