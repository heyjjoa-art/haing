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

  function buildUnitList(childId) {
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
      var line = document.createElement("span");
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
      wrap.appendChild(line);
    });
    return wrap;
  }

  // 렌더러 하나를 만든다 - 달력 이동(연/월) 상태를 이 인스턴스가 따로 들고
  // 있어서, 관리자 쪽과 아이 본인 쪽이 서로 다른 달을 보고 있어도 안 꼬인다.
  function createRenderer(bodyEl) {
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
      var considered = days.filter(function (d) {
        return !d.isFuture;
      });
      var bothCount = considered.filter(function (d) {
        return d.journeysDone && d.wordDone;
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
      summary.textContent = "둘 다 완료한 날 " + bothCount + "/" + considered.length + "일";
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
      trophySection.innerHTML = "<h3>🏆 트로피 · ⭐ 별 스티커 · 🌈 무지개</h3>";
      trophySection.appendChild(buildUnitList(childId));
      bodyEl.appendChild(trophySection);
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
