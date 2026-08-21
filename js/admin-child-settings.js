// 관리자 탭의 "계정 비밀번호" / "게임 기회 관리" 두 섹션을 그린다. 둘 다 특정
// 아이 하나가 아니라 하정/하진 모두를 대상으로 다루는 화면이라 ChildStore.getActive()에
// 기대지 않고 각 아이 id를 직접 다룬다.
(function () {
  "use strict";

  var pinListEl = document.getElementById("adminChildPinList");
  var creditListEl = document.getElementById("adminGameCreditsList");
  if (typeof ChildStore === "undefined") return;

  // 아이 비밀번호는 이제 로그인 화면(이름을 누를 때)에서 직접 설정한다 - 여기서는
  // 잊어버렸을 때 지워주는 것만 한다(지우면 다음 로그인 때 다시 설정할 수 있음).
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

      var clearBtn = document.createElement("button");
      clearBtn.type = "button";
      clearBtn.className = "danger-btn";
      clearBtn.textContent = "비밀번호 지우기";
      clearBtn.hidden = !hasPin;
      clearBtn.addEventListener("click", function () {
        if (confirm(child.name + "의 비밀번호를 지울까요? 다음 로그인 때 다시 설정할 수 있어요.")) {
          ChildAuthStore.setPin(child.id, "");
          renderPinList();
        }
      });

      row.appendChild(label);
      row.appendChild(status);
      row.appendChild(clearBtn);
      pinListEl.appendChild(row);
    });
  }

  // 관리자 탭 자체를 지키는 비밀번호. 관리자 탭 안(=이미 인증된 상태)에서만
  // 바꿀 수 있으니 예전 비밀번호를 다시 물어보지 않는다.
  function setupAdminPinControls() {
    var input = document.getElementById("adminPinChangeInput");
    var saveBtn = document.getElementById("adminPinChangeSaveBtn");
    var clearBtn = document.getElementById("adminPinChangeClearBtn");
    if (!input || !saveBtn || !clearBtn || typeof AdminAuthStore === "undefined") return;

    saveBtn.addEventListener("click", function () {
      if (!input.value) return;
      AdminAuthStore.setPin(input.value);
      input.value = "";
      alert("관리자 비밀번호를 저장했어요.");
    });

    clearBtn.addEventListener("click", function () {
      if (confirm("관리자 비밀번호를 없앨까요? 다음부터는 관리자 탭에 비밀번호 없이 들어올 수 있어요.")) {
        AdminAuthStore.setPin("");
        input.value = "";
      }
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
  setupAdminPinControls();

  window.__haingRenderAdminChildSettings = function () {
    renderPinList();
    renderCreditsList();
  };
})();
