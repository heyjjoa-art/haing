// 관리자 탭 - 학습 한눈에 보기: 아이 하나를 골라서 이번주 저니스 도장, 오늘
// 단어 공부 여부, 유닛별 트로피/별 스티커 현황을 한 화면에 모아 보여준다.
// 상세 통계(유닛별 전체 비교, 달력)는 아래 Word/Journeys 진행 관리 카드가
// 그대로 맡고, 여기는 "지금 이 아이 상태만 빨리 훑어보기" 용도다.
(function () {
  "use strict";

  var tabsEl = document.getElementById("adminGlanceChildTabs");
  var bodyEl = document.getElementById("adminGlanceBody");
  if (!tabsEl || !bodyEl) return;

  var STORAGE_KEY = "haingAdminGlanceChild";
  var selectedChildId = null;

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
      if (!map[key]) map[key] = { wordCount: 0, starSum: 0, hasTrophy: false };
      if (r.isTrophy) map[key].hasTrophy = true;
      else {
        map[key].wordCount += 1;
        map[key].starSum += r.stars || 0;
      }
    });
    return units
      .map(function (u) {
        var m = map[String(u.key)] || { wordCount: 0, starSum: 0, hasTrophy: false };
        return {
          label: u.label,
          total: u.total,
          wordCount: m.wordCount,
          starSum: m.starSum,
          hasTrophy: m.hasTrophy
        };
      })
      .filter(function (u) {
        return u.hasTrophy || u.wordCount > 0;
      });
  }

  function buildWeekRow(childId) {
    var weeks = StampStore.getWeekGridAny(childId);
    var thisWeek = weeks[weeks.length - 1];

    var wrap = document.createElement("div");
    wrap.className = "admin-glance-week";

    var row = document.createElement("div");
    row.className = "admin-glance-week-row";
    if (thisWeek) {
      thisWeek.days.forEach(function (day) {
        var cell = document.createElement("div");
        cell.className = "admin-glance-day-cell";
        if (day.stamped) cell.classList.add("stamped");
        if (day.isToday) cell.classList.add("today");
        if (day.isFuture) cell.classList.add("future");
        cell.innerHTML =
          '<span class="admin-glance-day-label">' + day.label + "</span>" +
          '<span class="admin-glance-day-mark">' + (day.stamped ? "✅" : day.isFuture ? "" : "・") + "</span>";
        row.appendChild(cell);
      });
    }
    wrap.appendChild(row);
    return wrap;
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
      line.textContent =
        u.label + (u.hasTrophy ? " 🏆" : " " + u.wordCount + "/" + u.total) + (u.starSum > 0 ? " ⭐" + u.starSum : "");
      wrap.appendChild(line);
    });
    return wrap;
  }

  function renderBody() {
    bodyEl.innerHTML = "";
    if (!selectedChildId) return;

    var studiedToday = ProgressStore.hasCompletedSetTodayForChild(selectedChildId);

    var section1 = document.createElement("div");
    section1.className = "admin-glance-section";
    section1.innerHTML = "<h3>📅 이번주 저니스</h3>";
    section1.appendChild(buildWeekRow(selectedChildId));
    bodyEl.appendChild(section1);

    var section2 = document.createElement("div");
    section2.className = "admin-glance-section";
    section2.innerHTML =
      "<h3>✏️ 오늘 단어 공부</h3><p class=\"admin-glance-today-line\">" +
      (studiedToday ? "✅ 오늘 단어 공부를 끝냈어요." : "❌ 아직 안 했어요.") +
      "</p>";
    bodyEl.appendChild(section2);

    var section3 = document.createElement("div");
    section3.className = "admin-glance-section";
    section3.innerHTML = "<h3>🏆 트로피 · ⭐ 별 스티커 (유닛별)</h3>";
    section3.appendChild(buildUnitList(selectedChildId));
    bodyEl.appendChild(section3);
  }

  function selectChild(childId) {
    selectedChildId = childId;
    localStorage.setItem(STORAGE_KEY, childId);
    Array.prototype.forEach.call(tabsEl.children, function (btn) {
      btn.classList.toggle("active", btn.dataset.childId === childId);
    });
    renderBody();
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
