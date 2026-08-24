// 관리자 탭 - Journeys 진행 관리: 이번 달(또는 이전 달) 하정이와 하진이가 각각
// 며칠이나 미션(음원 듣기·따라 읽기·혼자 읽기)을 끝냈는지 달력으로 보여준다.
// 유닛 단위가 아니라 "그날 어느 유닛이든 끝냈는지"만 보는 하루 단위 출석 개념.
(function () {
  "use strict";

  var rootEl = document.getElementById("adminJourneysProgress");
  if (!rootEl) return;

  var WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

  var today = new Date();
  var viewYear = today.getFullYear();
  var viewMonth = today.getMonth() + 1; // 1~12

  function isCurrentMonthView() {
    return viewYear === today.getFullYear() && viewMonth === today.getMonth() + 1;
  }

  function buildCalendar(childId) {
    var days = StampStore.getMonthDays(childId, viewYear, viewMonth);
    var considered = days.filter(function (d) { return !d.isFuture; });
    var completed = considered.filter(function (d) { return d.completed; });
    var pct = considered.length > 0 ? Math.round((completed.length / considered.length) * 100) : 0;

    var wrap = document.createElement("div");
    wrap.className = "admin-journeys-progress-calendar-wrap";

    var summary = document.createElement("p");
    summary.className = "admin-journeys-progress-summary-line";
    summary.textContent = completed.length + "/" + considered.length + "일 (" + pct + "%)";
    wrap.appendChild(summary);

    var grid = document.createElement("div");
    grid.className = "admin-journeys-progress-calendar";

    WEEKDAY_LABELS.forEach(function (label) {
      var head = document.createElement("div");
      head.className = "admin-journeys-progress-calendar-weekday";
      head.textContent = label;
      grid.appendChild(head);
    });

    var leadingBlank = days.length > 0 ? days[0].weekday : 0;
    for (var i = 0; i < leadingBlank; i++) {
      var blank = document.createElement("div");
      blank.className = "admin-journeys-progress-calendar-day empty";
      grid.appendChild(blank);
    }

    days.forEach(function (d) {
      var cell = document.createElement("div");
      cell.className = "admin-journeys-progress-calendar-day";
      if (d.isFuture) cell.classList.add("future");
      else if (d.completed) cell.classList.add("completed");
      cell.textContent = String(d.day);
      grid.appendChild(cell);
    });

    wrap.appendChild(grid);
    return wrap;
  }

  function render() {
    if (typeof StampStore === "undefined" || typeof ChildStore === "undefined") return;
    rootEl.innerHTML = "";

    var nav = document.createElement("div");
    nav.className = "admin-journeys-progress-month-nav";

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
      render();
    });
    nav.appendChild(prevBtn);

    var label = document.createElement("span");
    label.className = "admin-journeys-progress-month-label";
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
      render();
    });
    nav.appendChild(nextBtn);

    rootEl.appendChild(nav);

    var childrenRow = document.createElement("div");
    childrenRow.className = "admin-journeys-progress-children";
    ChildStore.CHILDREN.forEach(function (child) {
      var col = document.createElement("div");
      col.className = "admin-journeys-progress-child-col";

      var heading = document.createElement("h3");
      heading.className = "admin-journeys-progress-child-heading";
      heading.textContent = child.zodiacEmoji + " " + child.name;
      col.appendChild(heading);

      col.appendChild(buildCalendar(child.id));
      childrenRow.appendChild(col);
    });
    rootEl.appendChild(childrenRow);
  }

  render();
  window.__haingRenderAdminJourneysProgress = render;
})();
