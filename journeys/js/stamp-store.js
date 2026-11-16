// 저니스는 같은 유닛을 한 달 정도 반복해서 공부한다. 그래서 스탬프는 "한 번 깨면 끝"이
// 아니라 하루 단위 미션으로 동작한다: 오늘 1.음원 듣기 / 2.따라 읽기 / 3.혼자 읽기를
// 모두 끝내면 도장을 하나 받고, 도장은 월~금 도장 모음판에 쌓인다.
// 하루에 여러 번 다 끝낼 수도 있다: 평일에 처음 끝내면 오늘 칸에 도장이 찍히고,
// 같은 날 또 다 끝내거나 오늘이 주말이면(도장판엔 월~금 칸밖에 없어서 주말은
// "오늘 칸" 자체가 없다) 그 주(월~금)의 빈 칸 중 가장 이른 날에 찍힌다.
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

  // 실제 도장 데이터(stamps/{아이})와 별도로, "이 기기가 마지막으로 언제 로컬을
  // 바꿨는지"만 작은 문서(stampsMeta/{아이})에 따로 둔다. 도장 문서 자체의 모양은
  // (유닛id → 날짜별 기록) 그대로 바뀌지 않아야 기존 클라우드 데이터와 계속 호환된다.
  function updatedAtKey(childId) {
    return "journeysStampsUpdatedAt_" + childId;
  }

  function getUpdatedAt(childId) {
    return parseInt(localStorage.getItem(updatedAtKey(childId)), 10) || 0;
  }

  function touchUpdatedAt(childId) {
    localStorage.setItem(updatedAtKey(childId), String(Date.now()));
  }

  // 아이별 스탬프 기록을 클라우드 문서 하나(stamps/{아이})와 그대로 맞춘다. 이 스토어는
  // ChildStore를 직접 들여다보지 않고 호출하는 쪽이 넘겨주는 childId만 쓰므로, 어떤
  // 아이가 지금 활성인지는 신경 쓰지 않고 "이 childId는 한 번은 구독해봤는지"만 기억한다.
  var watchedChildren = {};

  function cloudPath(childId) {
    return childId ? "stamps/" + childId : null;
  }

  function metaCloudPath(childId) {
    return childId ? "stampsMeta/" + childId : null;
  }

  // 도장 문서는 기기 두 대가 같이 쓰기 때문에 통째로 덮어쓰면(set) 안 된다 - 로컬이
  // 조금이라도 오래된 기기가 쓰는 순간 다른 기기가 먼저 올린 도장이 사라진다(2026-11-15
  // 하진 사례: 일요일에 받은 도장과 지난주 기록이 이렇게 날아갔다). 그래서 날짜별
  // 기록은 merge로 넘겨 안 넘긴 날짜는 서버에 그대로 두고, 도장 날짜 배열은
  // arrayUnion으로 "더하기"만 해서 양쪽 도장이 둘 다 남게 한다.
  function cloudPayload(childId) {
    var all = loadAll(childId);
    var payload = {};
    Object.keys(all).forEach(function (unitId) {
      var rec = all[unitId] || {};
      var out = {};
      Object.keys(rec).forEach(function (k) {
        if (k !== "_stamps") out[k] = rec[k];
      });
      var stamps = rec._stamps || [];
      // 도장이 하나도 없으면 _stamps는 아예 넘기지 않는다 - 빈 배열을 넘기면 merge가
      // 서버에 있던 도장 목록을 빈 배열로 갈아버린다(더할 게 없으면 안 건드리는 게 맞다).
      if (stamps.length) {
        out._stamps = HaingCloud.arrayUnion ? HaingCloud.arrayUnion(stamps) : stamps;
      }
      payload[unitId] = out;
    });
    return payload;
  }

  function syncToCloud(childId) {
    if (typeof HaingCloud === "undefined" || !HaingCloud.enabled) return;
    var path = cloudPath(childId);
    if (!path) return;
    var write = HaingCloud.writeDocMerge || HaingCloud.writeDoc;
    write(path, cloudPayload(childId));
    // stampsMeta는 이제 합치기 판단에 쓰지 않지만(아래 applyRemote가 합집합으로
    // 처리한다), 예전 코드가 캐시된 기기는 아직 이 값으로 "내 로컬이 더 최신인가"를
    // 따진다 - 계속 갱신해줘야 그 기기가 자기 옛 기록을 통째로 올려 덮어쓰지 않는다.
    var metaPath = metaCloudPath(childId);
    if (metaPath) HaingCloud.writeDoc(metaPath, { updatedAt: getUpdatedAt(childId) });
  }

  // 같은 아이 기록을 기기 두 대가 번갈아 쓸 때를 위한 합치기 규칙. 어느 쪽이 "더
  // 최신"인지 시계로 따지지 않고 합집합으로 합친다 - 순서나 횟수에 상관없이 늘 같은
  // 결과가 나와야, 두 기기가 서로의 변경을 받아 다시 올려도 한 값으로 모이고 끝없이
  // 번갈아 쓰지 않는다.
  // - 유닛과 날짜는 합집합: 한쪽에만 있는 기록은 절대 지우지 않는다.
  // - 도장(_stamps)도 합집합: 한 번 받은 도장은 사라지지 않는 기록이다.
  // - 같은 날짜의 1·2·3번 체크는 둘 다 true일 때만 true: 도장을 받는 순간 체크는 전부
  //   false로 초기화되므로, 한쪽이 false면 그쪽이 더 나중 상태로 보는 게 맞다.
  function cloneRecords(rec) {
    return JSON.parse(JSON.stringify(rec || {}));
  }

  function mergeUnitRecords(a, b) {
    var ra = cloneRecords(a);
    var rb = cloneRecords(b);
    // 예전(도장 배열이 없던) 기록이 섞여 있어도 양쪽 다 같은 기준으로 맞춘 뒤 합친다.
    ensureStampsMigrated(ra);
    ensureStampsMigrated(rb);
    var out = {};
    Object.keys(ra)
      .concat(Object.keys(rb))
      .forEach(function (k) {
        if (k === "_stamps" || Object.prototype.hasOwnProperty.call(out, k)) return;
        var ea = ra[k];
        var eb = rb[k];
        if (!ea || !eb) {
          out[k] = ea || eb;
          return;
        }
        var entry = {};
        STAGES.forEach(function (stage) {
          entry[stage] = !!ea[stage] && !!eb[stage];
        });
        out[k] = entry;
      });
    var stamps = (ra._stamps || []).slice();
    (rb._stamps || []).forEach(function (d) {
      if (stamps.indexOf(d) === -1) stamps.push(d);
    });
    out._stamps = stamps.sort();
    return out;
  }

  function mergeAllRecords(localAll, remoteAll) {
    var a = localAll || {};
    var b = remoteAll || {};
    var out = {};
    Object.keys(a)
      .concat(Object.keys(b))
      .forEach(function (unitId) {
        if (Object.prototype.hasOwnProperty.call(out, unitId)) return;
        out[unitId] = mergeUnitRecords(a[unitId], b[unitId]);
      });
    return out;
  }

  // 두 기록이 내용상 같은지(키 순서·배열 순서 무시) 비교한다. 합친 결과가 클라우드에
  // 있는 것과 같으면 다시 올릴 필요가 없다 - 이 비교가 기기 사이 무한 되쓰기를 막는다.
  function canonicalRecords(all) {
    var data = all || {};
    return JSON.stringify(
      Object.keys(data)
        .sort()
        .map(function (unitId) {
          var rec = data[unitId] || {};
          var dates = Object.keys(rec)
            .filter(function (k) {
              return k !== "_stamps";
            })
            .sort();
          return [
            unitId,
            (rec._stamps || []).slice().sort(),
            dates.map(function (d) {
              var e = rec[d] || {};
              return [d].concat(
                STAGES.map(function (stage) {
                  return !!e[stage];
                })
              );
            })
          ];
        })
    );
  }

  // 클라우드(최초 1회 읽기 또는 다른 기기의 변경)에서 온 기록을 이 기기 기록과 합쳐
  // 저장한다. 합친 결과가 클라우드에 있는 것과 다르면(이 기기에만 있던 도장이 있었다는
  // 뜻 - 저장이 페이지 이동으로 끊긴 경우 포함) 바로 다시 올려 양쪽을 맞춘다.
  function applyRemote(childId, remote) {
    var merged = mergeAllRecords(loadAll(childId), remote);
    saveAll(childId, merged);
    if (canonicalRecords(merged) !== canonicalRecords(remote)) {
      touchUpdatedAt(childId);
      syncToCloud(childId);
    }
  }

  function ensureCloudSync(childId) {
    if (!childId || watchedChildren[childId]) return;
    if (typeof HaingCloud === "undefined" || !HaingCloud.enabled) return;
    watchedChildren[childId] = true;
    var path = cloudPath(childId);
    HaingCloud.getDocOnce(path).then(function (remote) {
      applyRemote(childId, remote);
      HaingCloud.watchDoc(path, function (data) {
        if (!data) return;
        applyRemote(childId, data);
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
      var earliest = findMissingWeekdayInWeek(stamps, d);
      if (earliest) stamps.push(earliest);
    });
  }

  // 주말에 다 끝냈거나(도장판엔 월~금 칸만 있다) 같은 날 두 번째로 다 끝냈을 때 채울
  // 칸을 찾는다: 그 날이 속한 주(월~금)에서 아직 도장이 없고 오늘을 넘지 않은 가장
  // 이른 평일. 주말(토·일)은 mondayOf가 그 주 월요일을 돌려주므로 같은 주로 들어간다.
  // 예전에는 기록이 있는 가장 이른 주부터 거슬러 올라가 빈 칸을 찾았는데, 그 때문에
  // 2026-11-15(일) 하진이가 끝낸 공부가 한 달 전인 10/14 칸으로 밀려 들어가 그 주
  // 도장판에도, 학습달력에도 아무 표시가 안 남는 일이 있었다. 지난 주 도장판을 뒤늦게
  // 채우는 건(그 주 개근 트로피까지 소급되는 일) 의도한 동작이 아니라서, 채울 칸은
  // 그 주 안에서만 찾고 그 주가 이미 다 찼으면 아무 데도 찍지 않는다.
  function findMissingWeekdayInWeek(stamps, dateKey) {
    var monday = mondayOf(new Date(dateKey + "T00:00:00"));
    var today = todayDate();
    for (var i = 0; i < 5; i++) {
      var d = new Date(monday);
      d.setDate(monday.getDate() + i);
      if (d > today) return null;
      var dStr = toDateStr(d);
      if (dStr !== dateKey && stamps.indexOf(dStr) === -1) return dStr;
    }
    return null;
  }

  function isWeekday(dateStr) {
    var day = new Date(dateStr + "T00:00:00").getDay(); // 0 Sun .. 6 Sat
    return day >= 1 && day <= 5;
  }

  // 오늘이 평일(월~금)이고 오늘 도장이 아직 없으면 오늘 칸에 찍는다. 오늘이 주말이거나
  // (도장판엔 월~금 칸밖에 없어서 주말 날짜로 찍으면 어디에도 표시가 안 된다), 오늘
  // 이미 찍혀 있으면(같은 날 두 번째 이상 다 끝낸 것) 그 주의 빈 칸을 찾아 채운다.
  // 채울 칸이 없으면(그 주가 오늘까지 이미 다 찬 상태) 아무것도 안 하고 null을 돌려준다.
  function creditStamp(unitRecords, todayKey) {
    var stamps = unitRecords._stamps;
    if (isWeekday(todayKey) && stamps.indexOf(todayKey) === -1) {
      stamps.push(todayKey);
      return todayKey;
    }
    var earliest = findMissingWeekdayInWeek(stamps, todayKey);
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
    touchUpdatedAt(childId);
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

  // 관리자 "오늘의 학습" 요약용 - isDayCompleteFor와 같은 조건이지만, true/false
  // 대신 그 날짜에 도장을 받은 유닛 id들을 그대로 돌려준다.
  function getUnitsCompletedOnDate(childId, dateStr) {
    if (!childId) return [];
    ensureCloudSync(childId);
    var all = loadAll(childId);
    return Object.keys(all).filter(function (unitId) {
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
    isDayCompleteFor: isDayCompleteFor,
    getUnitsCompletedOnDate: getUnitsCompletedOnDate,
    getMonthDays: getMonthDays
  };
})();
