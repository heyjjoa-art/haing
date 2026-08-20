// 관리자 탭에서 등록된 Word 유닛을 목록으로 보여주고 삭제할 수 있게 한다.
// 유닛 이동은 Word 탭의 "지난 UNIT 다시하기"에서만 하고, 삭제는 여기서만 한다.
(function () {
  "use strict";

  var listEl = document.getElementById("adminWordUnitList");
  if (!listEl) return;

  function render() {
    var units = DataStore.getAllUnits();
    listEl.innerHTML = "";

    if (units.length === 0) {
      var empty = document.createElement("p");
      empty.className = "hint";
      empty.textContent = "등록된 유닛이 없어요.";
      listEl.appendChild(empty);
      return;
    }

    units.forEach(function (entry) {
      var row = document.createElement("div");
      row.className = "admin-unit-row";

      var label = document.createElement("span");
      label.className = "admin-unit-label";
      label.textContent = entry.unit === "unspecified" ? "이름 없는 자료" : "Unit " + entry.unit;
      row.appendChild(label);

      var actions = document.createElement("div");
      actions.className = "admin-unit-actions";

      var editTextBtn = document.createElement("a");
      editTextBtn.className = "secondary-btn";
      editTextBtn.href = "word-edit.html?unit=" + encodeURIComponent(entry.unit);
      editTextBtn.textContent = "📝 본문 수정";
      actions.appendChild(editTextBtn);

      var editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "secondary-btn";
      editBtn.textContent = "✏️ 번호 수정";
      editBtn.addEventListener("click", function () {
        var next = prompt("새 Unit 번호를 입력하세요.", entry.unit === "unspecified" ? "" : entry.unit);
        if (next === null) return;
        next = next.trim();
        if (!next || next === entry.unit) return;
        if (!DataStore.renameUnit(entry.unit, next)) {
          alert("Unit " + next + "번은 이미 등록되어 있어요. 다른 번호를 입력해주세요.");
          return;
        }
        render();
        if (window.__haingRenderHome) window.__haingRenderHome();
      });
      actions.appendChild(editBtn);

      var delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "danger-btn";
      delBtn.textContent = "🗑 삭제";
      delBtn.addEventListener("click", function () {
        if (confirm(label.textContent + "을(를) 삭제할까요? (모은 카드는 그대로 남아요)")) {
          DataStore.deleteUnit(entry.unit);
          render();
          if (window.__haingRenderHome) window.__haingRenderHome();
        }
      });
      actions.appendChild(delBtn);

      row.appendChild(actions);

      listEl.appendChild(row);
    });
  }

  render();
  window.__haingRenderAdminWordUnits = render;
})();
