(function () {
  "use strict";

  var listEl = document.getElementById("levelList");
  var emptyEl = document.getElementById("emptyState");
  var tabsEl = document.getElementById("levelTabs");

  var topRowEl = document.getElementById("topStampSpeedRow");
  var stampBoardWeeksEl = document.getElementById("stampBoardWeeks");

  var activeBook = null;

  // 도장 칸 하나하나에 서로 다른 응원 캐릭터(동물)를 색깔별로 찍어준다 - 월~금 요일
  // 순서(day 배열 인덱스)로 그대로 매겨서, 한 주 안에서는 5개가 겹치지 않고 고르게
  // 나오고, 새로고침해도 같은 요일엔 항상 같은 캐릭터가 나온다(랜덤이면 볼 때마다
  // 바뀌어서 오히려 어수선함). 통통하고 동글동글한 인상의 동물로만 골랐다.
  var CHEER_CHARACTERS = ["🐹", "🐼", "🐧", "🐷", "🐻"];

  // 도장판은 특정 유닛이 아니라 "오늘 어느 유닛이든 하루 미션(듣기·따라읽기·혼자읽기)을
  // 다 끝냈는지"로 채워진다 - 유닛마다 따로 보던 걸 Journeys 메뉴 맨 위에 하나로
  // 모아서, 어느 책을 펴서 읽어도 오늘 몫을 채운 걸로 쳐준다.
  function renderStampBoard() {
    if (typeof StampStore === "undefined") return;
    var childId = typeof ChildStore !== "undefined" ? ChildStore.getActive() : null;
    topRowEl.hidden = false;
    if (!childId) {
      // 관리자로 로그인하면 선택된 아이가 없어서 도장판을 채울 수 없다 - 그렇다고
      // 자리를 통째로 없애버리면 아이 화면과 레이아웃이 달라져서 헷갈리니, 같은
      // 자리에 안내 문구만 넣어 자리는 그대로 유지한다.
      stampBoardWeeksEl.innerHTML = '<p class="stamp-board-empty">학습자로 로그인하면 여기에 도장판이 보여요.</p>';
      return;
    }

    // 메뉴 맨 위에서는 지난 주 기록까지 다 볼 필요는 없어서, 이번 주 월~금 한 줄만 보여준다.
    var weeks = StampStore.getWeekGridAny(childId);
    var thisWeek = weeks[weeks.length - 1];
    stampBoardWeeksEl.innerHTML = "";
    if (!thisWeek) return;

    var row = document.createElement("div");
    row.className = "stamp-week-row";
    var weekComplete = thisWeek.days.every(function (day) {
      return day.stamped;
    });
    if (weekComplete) row.classList.add("trophy");

    thisWeek.days.forEach(function (day, idx) {
      var cell = document.createElement("div");
      cell.className = "stamp-day-cell";
      if (day.stamped) cell.classList.add("stamped");
      if (day.isToday) cell.classList.add("today");
      if (day.isFuture) cell.classList.add("future");

      var iconClass = "stamp-day-icon";
      var iconContent = "";
      if (day.stamped) {
        iconClass += " char-" + (idx % CHEER_CHARACTERS.length);
        iconContent = CHEER_CHARACTERS[idx % CHEER_CHARACTERS.length];
      }

      cell.innerHTML =
        '<span class="stamp-day-label">' + day.label + "</span>" +
        '<span class="' + iconClass + '">' + iconContent + "</span>";
      row.appendChild(cell);
    });
    stampBoardWeeksEl.appendChild(row);
  }

  // 읽는 속도 조절 버튼은 실제로 쓰이는 화면(reader.html, journeys/js/reader.js)으로
  // 옮겨갔다 - 여기(목록 화면)엔 더 이상 없다.

  // 하정/하진이 각자 다른 책을 대표로 골라둘 수 있도록 아이별로 따로 저장한다.
  function defaultBookKey() {
    var childId = typeof ChildStore !== "undefined" && ChildStore.getActive();
    return "journeysDefaultBook_" + (childId ? childId + "_" : "guest_");
  }

  // 체크해둔 책은 다음에 Journeys에 들어왔을 때 그 책부터 보여준다(탭 순서는 그대로 둠).
  var defaultBook = localStorage.getItem(defaultBookKey()) || null;

  function escapeHtml(s) {
    var div = document.createElement("div");
    div.textContent = s;
    return div.innerHTML;
  }

  // "1.1", "1.2" 같은 레벨 문자열의 앞자리(책 번호)만 뽑아서 탭 단위로 묶는다.
  function bookKey(level) {
    var s = String(level || "미분류");
    return s.split(".")[0] || "미분류";
  }

  function renderTabs(bookKeys) {
    tabsEl.innerHTML = "";
    tabsEl.hidden = bookKeys.length <= 1;
    bookKeys.forEach(function (key) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "level-tab-btn" + (key === activeBook ? " active" : "");
      btn.setAttribute("role", "tab");
      btn.setAttribute("aria-selected", key === activeBook ? "true" : "false");

      // 관리자 화면에서는 콘텐츠 관리가 목적이라 "대표 탭" 설정은 필요 없다.
      if (!window.JOURNEYS_ADMIN_MODE) {
        var check = document.createElement("span");
        check.className = "level-tab-check";
        check.textContent = key === defaultBook ? "☑" : "☐";
        check.title = "대표 탭으로 설정";
        check.addEventListener("click", function (e) {
          e.stopPropagation();
          defaultBook = key;
          localStorage.setItem(defaultBookKey(), key);
          activeBook = key;
          render();
        });
        btn.appendChild(check);
      }
      var label = document.createElement("span");
      label.className = "level-tab-label";
      label.textContent = "Journeys " + key;
      btn.appendChild(label);

      btn.addEventListener("click", function () {
        activeBook = key;
        render();
      });
      tabsEl.appendChild(btn);
    });
  }

  // 지금 로그인한 아이가 이 유닛에서 모은 도장 개수를 작게 보여준다.
  function buildStampBadgeHtml(unitId) {
    if (typeof ChildStore === "undefined" || typeof StampStore === "undefined") return "";
    var childId = ChildStore.getActive();
    if (!childId) return "";
    var count = StampStore.getTotalStampedDays(childId, unitId);
    if (count === 0) return "";
    return '<span class="unit-stamp-badge">🟩 ' + count + "일</span>";
  }

  function render() {
    renderStampBoard();

    var groups = JourneysStore.getGroupedByLevel();
    listEl.innerHTML = "";

    if (groups.length === 0) {
      emptyEl.textContent = "아직 등록된 유닛이 없어요.";
      emptyEl.hidden = false;
      tabsEl.hidden = true;
      tabsEl.innerHTML = "";
      return;
    }
    emptyEl.hidden = true;

    var bookKeys = [];
    groups.forEach(function (group) {
      var key = bookKey(group.level);
      if (bookKeys.indexOf(key) === -1) bookKeys.push(key);
    });
    if (!activeBook || bookKeys.indexOf(activeBook) === -1) {
      activeBook = defaultBook && bookKeys.indexOf(defaultBook) !== -1 ? defaultBook : bookKeys[0];
    }
    renderTabs(bookKeys);

    var visibleGroups = groups.filter(function (group) {
      return bookKey(group.level) === activeBook;
    });

    visibleGroups.forEach(function (group) {
      var section = document.createElement("section");
      section.className = "level-group";

      var heading = document.createElement("h2");
      heading.className = "level-heading";
      heading.textContent = "Journeys " + group.level;
      section.appendChild(heading);

      var grid = document.createElement("div");
      grid.className = "unit-grid";

      group.units.forEach(function (unit) {
        var card = document.createElement("div");
        card.className = "unit-card-wrap";

        var link = document.createElement("a");
        link.className = "unit-card";
        link.href = "reader.html?id=" + encodeURIComponent(unit.id) + (window.JOURNEYS_ADMIN_MODE ? "&admin=1" : "");
        link.innerHTML =
          '<span class="unit-emoji">📘</span>' +
          '<span class="unit-title">' + escapeHtml(unit.title || "제목 없음") + "</span>" +
          buildStampBadgeHtml(unit.id);
        card.appendChild(link);

        // 수정/삭제는 관리자 탭(?admin=1)에서만 보여준다 - 아이들이 그냥 읽으러
        // 들어온 Journeys 탭에서는 실수로 지우지 못하게 숨긴다.
        if (window.JOURNEYS_ADMIN_MODE) {
          var manageRow = document.createElement("div");
          manageRow.className = "unit-manage-row";

          var editBtn = document.createElement("a");
          editBtn.className = "unit-manage-btn";
          editBtn.href = "add.html?admin=1&id=" + encodeURIComponent(unit.id);
          editBtn.textContent = "✏️ 수정";
          manageRow.appendChild(editBtn);

          var delBtn = document.createElement("button");
          delBtn.type = "button";
          delBtn.className = "unit-manage-btn danger";
          delBtn.textContent = "🗑 삭제";
          delBtn.addEventListener("click", function () {
            if (confirm('"' + (unit.title || "이 유닛") + '"을(를) 삭제할까요? 되돌릴 수 없어요.')) {
              JourneysStore.deleteUnit(unit.id);
              render();
            }
          });
          manageRow.appendChild(delBtn);

          card.appendChild(manageRow);
        }

        grid.appendChild(card);
      });

      section.appendChild(grid);
      listEl.appendChild(section);
    });
  }

  render();
  window.__journeysRenderHome = render;
})();
