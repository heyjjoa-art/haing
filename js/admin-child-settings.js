// 관리자 탭의 "계정 비밀번호" / "게임 기회 관리" 두 섹션을 그린다. 둘 다 특정
// 아이 하나가 아니라 하정/하진 모두를 대상으로 다루는 화면이라 ChildStore.getActive()에
// 기대지 않고 각 아이 id를 직접 다룬다.
(function () {
  "use strict";

  var pinListEl = document.getElementById("adminChildPinList");
  var creditListEl = document.getElementById("adminGameCreditsList");
  if (typeof ChildStore === "undefined") return;

  function renderPinList() {
    if (!pinListEl || typeof ChildAuthStore === "undefined") return;
    pinListEl.innerHTML = "";

    ChildStore.CHILDREN.forEach(function (child) {
      var row = document.createElement("div");
      row.className = "admin-child-settings-row";

      var label = document.createElement("span");
      label.className = "admin-child-settings-name";
      label.textContent = child.zodiacEmoji + " " + child.name;

      var status = document.createElement("span");
      status.className = "admin-child-settings-status";
      var hasPin = ChildAuthStore.hasPin(child.id);
      status.textContent = hasPin ? "🔒 설정됨" : "설정 안 됨";

      var input = document.createElement("input");
      input.type = "password";
      input.inputMode = "numeric";
      input.autocomplete = "off";
      input.className = "admin-child-settings-input";
      input.placeholder = "새 비밀번호";

      var saveBtn = document.createElement("button");
      saveBtn.type = "button";
      saveBtn.className = "secondary-btn";
      saveBtn.textContent = "저장";
      saveBtn.addEventListener("click", function () {
        ChildAuthStore.setPin(child.id, input.value);
        renderPinList();
      });

      var clearBtn = document.createElement("button");
      clearBtn.type = "button";
      clearBtn.className = "danger-btn";
      clearBtn.textContent = "삭제";
      clearBtn.hidden = !hasPin;
      clearBtn.addEventListener("click", function () {
        if (confirm(child.name + "의 비밀번호를 지울까요?")) {
          ChildAuthStore.setPin(child.id, "");
          renderPinList();
        }
      });

      row.appendChild(label);
      row.appendChild(status);
      row.appendChild(input);
      row.appendChild(saveBtn);
      row.appendChild(clearBtn);
      pinListEl.appendChild(row);
    });
  }

  function renderCreditsList() {
    if (!creditListEl || typeof WordGameStore === "undefined") return;
    creditListEl.innerHTML = "";

    ChildStore.CHILDREN.forEach(function (child) {
      var row = document.createElement("div");
      row.className = "admin-child-settings-row";

      var label = document.createElement("span");
      label.className = "admin-child-settings-name";
      label.textContent = child.zodiacEmoji + " " + child.name;

      var status = document.createElement("span");
      status.className = "admin-child-settings-status";
      status.textContent = "🎮 " + WordGameStore.getCreditsForChild(child.id) + "회";

      var plusBtn = document.createElement("button");
      plusBtn.type = "button";
      plusBtn.className = "secondary-btn";
      plusBtn.textContent = "+3 지급";
      plusBtn.addEventListener("click", function () {
        WordGameStore.adminAddCredits(child.id, 3);
        renderCreditsList();
      });

      var minusBtn = document.createElement("button");
      minusBtn.type = "button";
      minusBtn.className = "danger-btn";
      minusBtn.textContent = "-3";
      minusBtn.addEventListener("click", function () {
        WordGameStore.adminAddCredits(child.id, -3);
        renderCreditsList();
      });

      row.appendChild(label);
      row.appendChild(status);
      row.appendChild(plusBtn);
      row.appendChild(minusBtn);
      creditListEl.appendChild(row);
    });
  }

  renderPinList();
  renderCreditsList();

  window.__haingRenderAdminChildSettings = function () {
    renderPinList();
    renderCreditsList();
  };
})();
