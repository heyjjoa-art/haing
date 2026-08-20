(function () {
  "use strict";

  var listEl = document.getElementById("levelList");
  var emptyEl = document.getElementById("emptyState");

  function escapeHtml(s) {
    var div = document.createElement("div");
    div.textContent = s;
    return div.innerHTML;
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
    var groups = JourneysStore.getGroupedByLevel();
    listEl.innerHTML = "";

    if (groups.length === 0) {
      emptyEl.textContent = window.JOURNEYS_ADMIN_MODE
        ? "아직 등록된 유닛이 없어요. 위의 “새 유닛 추가”로 첫 유닛을 올려주세요."
        : "아직 등록된 유닛이 없어요. Haing 홈의 “관리자” 탭에서 올려주세요.";
      emptyEl.hidden = false;
      return;
    }
    emptyEl.hidden = true;

    groups.forEach(function (group) {
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
