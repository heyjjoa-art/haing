// 하정/하진 중 누구인지 이름만 골라서 표시하는 아주 단순한 로그인.
// 비밀번호는 없다 - 화면에서 이름을 탭하면 그 아이 기록으로 바로 전환된다.
(function () {
  "use strict";

  var gate = document.getElementById("loginGate");
  var grid = document.getElementById("loginChildGrid");

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
    gate.hidden = !!info;
    // 로그인한 아이가 바뀌면 진행 상황/카드 컬렉션도 그 아이 것으로 다시 그린다.
    if (window.__haingRenderHome) window.__haingRenderHome();

    // Journeys는 iframe이라 ChildStore가 그 안에서 따로 실행돼서, 부모 창에서
    // 아이를 바꿔도 iframe 안 스크립트는 그걸 모른다 - Journeys 탭을 보고 있지
    // 않을 때 바꿨다면 다음에 들어갈 때 새로고침되게(탭 클릭 시 로직) 두고,
    // 지금 Journeys 탭이 보이는 중이면 바로 새로고침해서 그 아이 것으로 맞춘다.
    var journeysPanel = document.getElementById("panelJourneys");
    var journeysFrame = journeysPanel && journeysPanel.querySelector("iframe");
    if (journeysFrame && journeysPanel && !journeysPanel.hidden) {
      journeysFrame.src = journeysFrame.src;
    }
  }

  renderGrid();
  applyActive();
})();
