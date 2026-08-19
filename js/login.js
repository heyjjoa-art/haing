// 하정/하진 중 누구인지 이름만 골라서 표시하는 아주 단순한 로그인.
// 비밀번호는 없다 - 화면에서 이름을 탭하면 그 아이 기록으로 바로 전환된다.
(function () {
  "use strict";

  var gate = document.getElementById("loginGate");
  var grid = document.getElementById("loginChildGrid");
  var switchBtn = document.getElementById("childSwitchBtn");

  function renderGrid() {
    grid.innerHTML = "";
    ChildStore.CHILDREN.forEach(function (child) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "login-child-btn";
      btn.innerHTML =
        '<span class="login-child-emoji">' + child.zodiacEmoji + "</span>" +
        '<span class="login-child-name">' + child.name + "</span>";
      btn.addEventListener("click", function () {
        ChildStore.setActive(child.id);
        applyActive();
      });
      grid.appendChild(btn);
    });
  }

  function applyActive() {
    var info = ChildStore.getActiveInfo();
    if (info) {
      gate.hidden = true;
      switchBtn.hidden = false;
      switchBtn.textContent = info.zodiacEmoji + " " + info.name;
    } else {
      gate.hidden = false;
      switchBtn.hidden = true;
    }
    // 로그인한 아이가 바뀌면 진행 상황/카드 컬렉션도 그 아이 것으로 다시 그린다.
    if (window.__haingRenderHome) window.__haingRenderHome();
  }

  switchBtn.addEventListener("click", function () {
    if (confirm("다른 친구로 바꿀까요?")) {
      ChildStore.setActive(null);
      applyActive();
    }
  });

  renderGrid();
  applyActive();
})();
