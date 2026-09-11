// 아이 한 명의 학습 현황(이번 달 달력/트로피·별 스티커·무지개)을 그려주는
// 공용 렌더러(GlanceView)와, 그걸 써서 "관리자 > 학습"
// 탭(아이 선택 탭 있음)을 그리는 코드. 같은 렌더러를 js/my-glance.js가 그대로
// 재사용해서, 아이가 직접 로그인했을 때 보는 "학습" 탭(본인 것만)도 만든다.
// 예전에는 유닛별 상세 진행률(Word 진행 관리)과 달력(Journeys 진행 관리)이
// 따로 있었는데, 트로피·별·무지개만으로도 유닛별 확인이 되고 달력도 여기
// 아이별로 들어와 있어서 둘 다 여기로 흡수했다.
var GlanceView = (function () {
  "use strict";

  var WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

  function pad2(n) {
    return n < 10 ? "0" + n : String(n);
  }

  function todayDateStr() {
    var d = new Date();
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
  }

  function dayStrFromTimestamp(ts) {
    var d = new Date(ts);
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
  }

  // admin-word-progress.js의 getAllTrackedUnits()와 같은 목록 - 유닛번호별로
  // 트로피/별 스티커를 보여주려면 등록된 유닛 전체 목록이 먼저 있어야 한다.
  function getAllTrackedUnits() {
    var units = [];
    (DataStore.getAllUnits() || []).forEach(function (entry) {
      var words = DataStore.getWords(entry.unit) || [];
      if (words.length === 0) return;
      units.push({
        key: entry.unit,
        label: entry.unit === "unspecified" ? "이름 없는 자료" : "Unit " + entry.unit,
        total: words.length
      });
    });
    (DataStore.getElementaryLevels() || []).forEach(function (entry) {
      units.push({ key: entry.level, label: entry.level, total: entry.count });
    });
    return units;
  }

  // 유닛별로 (트로피 여부 / 모은 단어 수 / 별 스티커 합) - 진행 중이거나 트로피를
  // 받은 유닛만 추려서 "지금 볼만한 것"만 남긴다.
  function unitSummaries(childId) {
    var units = getAllTrackedUnits();
    var cards = WordCardStore.getCollectedForChild(childId);
    var map = {};
    cards.forEach(function (r) {
      var key = String(r.unit);
      if (!map[key]) map[key] = { wordCount: 0, starSum: 0, hasTrophy: false, hasRainbow: false };
      if (r.rainbowCard) map[key].hasRainbow = true;
      else if (r.isTrophy) map[key].hasTrophy = true;
      else {
        map[key].wordCount += 1;
        map[key].starSum += r.stars || 0;
      }
    });
    return units
      .map(function (u) {
        var m = map[String(u.key)] || { wordCount: 0, starSum: 0, hasTrophy: false, hasRainbow: false };
        return {
          key: u.key,
          label: u.label,
          total: u.total,
          wordCount: m.wordCount,
          starSum: m.starSum,
          hasTrophy: m.hasTrophy,
          hasRainbow: m.hasRainbow
        };
      })
      .filter(function (u) {
        return u.hasTrophy || u.hasRainbow || u.wordCount > 0;
      });
  }

  // 무지개까지 다 모으지 않은(=아직 더 모을 게 남은) 유닛 칩을 누르면 그
  // 유닛으로 바로 이동해서 이어서 공부할 수 있게 한다. Word 탭의 진행률은
  // ChildStore.getActive()에 묶여 있어서, 지금 그 아이로 실제 로그인해
  // 있을 때(=아이 본인의 "학습" 탭)만 의미가 있다 - 관리자가 다른 아이를
  // 골라 보는 화면에서는 이동시키지 않는다(canNavigate로 구분).
  function goToUnitStudy(unitKey) {
    if (typeof DataStore !== "undefined" && DataStore.setCurrentUnit) {
      DataStore.setCurrentUnit(unitKey);
    }
    if (window.__haingRenderHome) window.__haingRenderHome();
    var wordTabBtn = document.getElementById("tabBtnWord");
    if (wordTabBtn) wordTabBtn.click();
  }

  function buildUnitList(childId, canNavigate) {
    var summaries = unitSummaries(childId);
    var wrap = document.createElement("div");
    wrap.className = "admin-glance-units";

    if (summaries.length === 0) {
      var empty = document.createElement("p");
      empty.className = "hint";
      empty.textContent = "아직 모은 단어나 트로피가 없어요.";
      wrap.appendChild(empty);
      return wrap;
    }

    summaries.forEach(function (u) {
      var clickable = canNavigate && !u.hasRainbow;
      var line = document.createElement(clickable ? "button" : "span");
      if (clickable) line.type = "button";
      line.className = "admin-glance-unit-chip";
      if (u.hasTrophy) line.classList.add("trophy");
      if (u.hasRainbow) line.classList.add("rainbow");
      // 🏆 트로피 → ⭐ 별 스티커 → 🌈 무지개 순서로 통일(섹션 제목과 같은 순서).
      var parts = [];
      if (u.hasTrophy) parts.push("🏆");
      if (u.starSum > 0) parts.push("⭐" + u.starSum);
      if (u.hasRainbow) parts.push("🌈");
      var suffix = parts.length > 0 ? " " + parts.join(" ") : " " + u.wordCount + "/" + u.total;
      line.textContent = u.label + suffix;
      if (clickable) {
        line.addEventListener("click", function () {
          goToUnitStudy(u.key);
        });
      }
      wrap.appendChild(line);
    });
    return wrap;
  }

  // 오늘 단어 쪽에서 뭘 했는지 - 카드가 새로 생긴 순간(collectedAt)이 곧 그
  // 유닛을 공부한 순간이라, 오늘 날짜로 필터링하면 "오늘 한 일"이 된다.
  // 트로피/무지개/저니스 주간 트로피는 각각 한 줄로, 나머지 일반 단어
  // 카드는 유닛별로 묶어서 "3장: cat, dog, apple" 식으로 보여준다.
  function todayWordSummary(childId) {
    var today = todayDateStr();
    var cards = WordCardStore.getCollectedForChild(childId).filter(function (r) {
      return r.collectedAt && dayStrFromTimestamp(r.collectedAt) === today;
    });
    if (cards.length === 0) return [];

    var unitLabels = {};
    getAllTrackedUnits().forEach(function (u) {
      unitLabels[String(u.key)] = u.label;
    });
    function unitLabel(key) {
      return unitLabels[String(key)] || String(key);
    }

    var lines = [];
    var wordsByUnit = {};
    cards.forEach(function (r) {
      if (r.rainbowCard) {
        lines.push("🌈 " + unitLabel(r.unit) + " 무지개 카드 획득!");
      } else if (r.journeysTrophy) {
        lines.push("🏆 저니스 " + (r.unitLabel || "") + " 주간 트로피 획득!");
      } else if (r.isTrophy) {
        lines.push("🏆 " + unitLabel(r.unit) + " 완전정복!");
      } else {
        var key = String(r.unit);
        (wordsByUnit[key] = wordsByUnit[key] || []).push(r.word);
      }
    });
    Object.keys(wordsByUnit).forEach(function (key) {
      var words = wordsByUnit[key];
      lines.push("🐣 " + unitLabel(key) + " 단어 카드 " + words.length + "장: " + words.join(", "));
    });
    return lines;
  }

  // 저니스 유닛 제목은 journeys/js/data-store.js(JourneysStore)가 관리하지만,
  // 그 모듈을 여기서도 로드하면 클라우드 구독이 하나 더 생겨서(이미 저니스
  // iframe이 따로 갖고 있음) 중복이 된다 - 같은 origin의 localStorage를 직접
  // 읽기만 한다(제목이 아직 없으면 유닛 id를 그대로 보여준다).
  function journeysUnitLabel(unitId) {
    var units = {};
    try {
      units = JSON.parse(localStorage.getItem("journeysUnits") || "{}") || {};
    } catch (e) {
      units = {};
    }
    var unit = units[unitId];
    if (!unit) return unitId;
    return unit.level ? unit.level + " · " + unit.title : unit.title || unitId;
  }

  function todayJourneysSummary(childId) {
    if (typeof StampStore === "undefined" || !StampStore.getUnitsCompletedOnDate) return [];
    var unitIds = StampStore.getUnitsCompletedOnDate(childId, todayDateStr());
    return unitIds.map(function (id) {
      return "📘 " + journeysUnitLabel(id) + " 도장 획득";
    });
  }

  function buildTodaySummary(childId) {
    var wrap = document.createElement("div");
    var lines = todayWordSummary(childId).concat(todayJourneysSummary(childId));

    if (lines.length === 0) {
      var empty = document.createElement("p");
      empty.className = "hint";
      empty.textContent = "오늘은 아직 학습 기록이 없어요.";
      wrap.appendChild(empty);
      return wrap;
    }

    var list = document.createElement("ul");
    list.className = "admin-glance-today-list";
    lines.forEach(function (line) {
      var li = document.createElement("li");
      li.textContent = line;
      list.appendChild(li);
    });
    wrap.appendChild(list);
    return wrap;
  }

  // 렌더러 하나를 만든다 - 달력 이동(연/월) 상태를 이 인스턴스가 따로 들고
  // 있어서, 관리자 쪽과 아이 본인 쪽이 서로 다른 달을 보고 있어도 안 꼬인다.
  // canNavigate: 유닛 칩을 눌러 그 유닛 공부로 이동할 수 있게 할지 - 아이 본인이
  // 보는 화면(my-glance.js)에서만 true로 넘어온다.
  function createRenderer(bodyEl, canNavigate) {
    var today = new Date();
    var viewYear = today.getFullYear();
    var viewMonth = today.getMonth() + 1; // 1~12
    var currentChildId = null;

    function isCurrentMonthView() {
      return viewYear === today.getFullYear() && viewMonth === today.getMonth() + 1;
    }

    // 이번 달(또는 이전 달) 날짜마다 저니스 완료 여부와 단어 공부 완료 여부를
    // 같이 표기하는 달력. 둘 다 한 날짜 문자열(YYYY-MM-DD) 기준으로 비교
    // 가능해서 같은 칸에 나란히 표시할 수 있다.
    function buildCalendar(childId) {
      var journeysDays = StampStore.getMonthDays(childId, viewYear, viewMonth);
      var days = journeysDays.map(function (d) {
        return {
          date: d.date,
          day: d.day,
          weekday: d.weekday,
          isFuture: d.isFuture,
          journeysDone: d.completed,
          wordDone: ProgressStore.isWordDoneForDay(childId, d.date)
        };
      });
      var bothCount = days.filter(function (d) {
        return !d.isFuture && d.journeysDone && d.wordDone;
      }).length;

      var wrap = document.createElement("div");
      wrap.className = "admin-glance-calendar-wrap";

      var nav = document.createElement("div");
      nav.className = "admin-glance-calendar-nav";

      var prevBtn = document.createElement("button");
      prevBtn.type = "button";
      prevBtn.className = "secondary-btn";
      prevBtn.textContent = "◀";
      prevBtn.addEventListener("click", function () {
        viewMonth -= 1;
        if (viewMonth < 1) {
          viewMonth = 12;
          viewYear -= 1;
        }
        render(currentChildId);
      });
      nav.appendChild(prevBtn);

      var label = document.createElement("span");
      label.className = "admin-glance-calendar-month-label";
      label.textContent = viewYear + "년 " + viewMonth + "월";
      nav.appendChild(label);

      var nextBtn = document.createElement("button");
      nextBtn.type = "button";
      nextBtn.className = "secondary-btn";
      nextBtn.textContent = "▶";
      nextBtn.disabled = isCurrentMonthView();
      nextBtn.addEventListener("click", function () {
        viewMonth += 1;
        if (viewMonth > 12) {
          viewMonth = 1;
          viewYear += 1;
        }
        render(currentChildId);
      });
      nav.appendChild(nextBtn);
      wrap.appendChild(nav);

      var summary = document.createElement("p");
      summary.className = "admin-glance-calendar-summary";
      summary.textContent = "둘 다 완료한 날 " + bothCount + "/" + days.length + "일";
      wrap.appendChild(summary);

      wrap.appendChild(document.createRange().createContextualFragment(
        '<p class="admin-glance-calendar-legend">' +
        '<span class="legend-swatch journeys-done"></span>저니스 ' +
        '<span class="legend-swatch word-done"></span>단어 ' +
        '<span class="legend-swatch journeys-done word-done"></span>둘 다' +
        "</p>"
      ));

      var grid = document.createElement("div");
      grid.className = "admin-glance-calendar";

      WEEKDAY_LABELS.forEach(function (wd) {
        var head = document.createElement("div");
        head.className = "admin-glance-calendar-weekday";
        head.textContent = wd;
        grid.appendChild(head);
      });

      var leadingBlank = days.length > 0 ? days[0].weekday : 0;
      for (var i = 0; i < leadingBlank; i++) {
        var blank = document.createElement("div");
        blank.className = "admin-glance-calendar-day empty";
        grid.appendChild(blank);
      }

      days.forEach(function (d) {
        var cell = document.createElement("div");
        cell.className = "admin-glance-calendar-day";
        if (d.isFuture) {
          cell.classList.add("future");
        } else {
          if (d.journeysDone) cell.classList.add("journeys-done");
          if (d.wordDone) cell.classList.add("word-done");
        }
        if (isCurrentMonthView() && d.day === today.getDate()) {
          cell.classList.add("today");
        }
        cell.textContent = String(d.day);
        grid.appendChild(cell);
      });

      wrap.appendChild(grid);
      return wrap;
    }

    function render(childId) {
      currentChildId = childId;
      bodyEl.innerHTML = "";
      if (!childId) return;

      var calendarSection = document.createElement("div");
      calendarSection.className = "admin-glance-section";
      calendarSection.appendChild(buildCalendar(childId));
      bodyEl.appendChild(calendarSection);

      var trophySection = document.createElement("div");
      trophySection.className = "admin-glance-section";
      trophySection.innerHTML = '<h3 class="admin-glance-trophy-title">🏆 트로피 · ⭐ 별 스티커 · 🌈 무지개</h3>';
      trophySection.appendChild(buildUnitList(childId, canNavigate));
      bodyEl.appendChild(trophySection);

      var todaySection = document.createElement("div");
      todaySection.className = "admin-glance-section";
      todaySection.innerHTML = "<h3>📅 오늘 한 학습</h3>";
      todaySection.appendChild(buildTodaySummary(childId));
      bodyEl.appendChild(todaySection);
    }

    return { render: render };
  }

  return { createRenderer: createRenderer };
})();

// ── 관리자 > 학습 탭: 아이를 골라서 보는 화면(GlanceView + 아이 선택 탭) ──
(function () {
  "use strict";

  var tabsEl = document.getElementById("adminGlanceChildTabs");
  var bodyEl = document.getElementById("adminGlanceBody");
  if (!tabsEl || !bodyEl) return;

  var STORAGE_KEY = "haingAdminGlanceChild";
  var selectedChildId = null;
  var renderer = null;

  function selectChild(childId) {
    selectedChildId = childId;
    localStorage.setItem(STORAGE_KEY, childId);
    Array.prototype.forEach.call(tabsEl.children, function (btn) {
      btn.classList.toggle("active", btn.dataset.childId === childId);
    });
    renderer.render(childId);
  }

  function renderTabs() {
    tabsEl.innerHTML = "";
    ChildStore.CHILDREN.forEach(function (child) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "admin-glance-child-btn";
      btn.dataset.childId = child.id;
      btn.textContent = child.zodiacEmoji + " " + child.name;
      btn.addEventListener("click", function () {
        selectChild(child.id);
      });
      tabsEl.appendChild(btn);
    });
  }

  function render() {
    if (
      typeof ChildStore === "undefined" ||
      typeof StampStore === "undefined" ||
      typeof ProgressStore === "undefined" ||
      typeof WordCardStore === "undefined" ||
      typeof DataStore === "undefined"
    ) {
      return;
    }
    if (!renderer) renderer = GlanceView.createRenderer(bodyEl);
    renderTabs();
    var saved = localStorage.getItem(STORAGE_KEY);
    var validIds = ChildStore.CHILDREN.map(function (c) {
      return c.id;
    });
    selectChild(validIds.indexOf(saved) !== -1 ? saved : validIds[0]);
  }

  render();
  window.__haingRenderAdminGlance = render;
})();
