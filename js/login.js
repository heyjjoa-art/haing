// 하정/하진 중 누구인지 이름만 골라서 표시하는 아주 단순한 로그인.
// 계정마다 비밀번호를 정해뒀으면(ChildAuthStore, 관리자 탭에서 설정) 이름을
// 탭했을 때 비밀번호부터 물어보고, 맞아야 그 아이 기록으로 전환된다.
(function () {
  "use strict";

  var gate = document.getElementById("loginGate");
  var grid = document.getElementById("loginChildGrid");
  var pinStep = document.getElementById("loginPinStep");
  var pinTitle = document.getElementById("loginPinTitle");
  var pinInput = document.getElementById("loginPinInput");
  var pinError = document.getElementById("loginPinError");
  var pinBackBtn = document.getElementById("loginPinBackBtn");
  var pinSubmitBtn = document.getElementById("loginPinSubmitBtn");
  var pendingChild = null;

  function showPinStep(child) {
    pendingChild = child;
    grid.hidden = true;
    pinStep.hidden = false;
    pinTitle.textContent = child.zodiacEmoji + " " + child.name + " 비밀번호를 입력하세요";
    pinInput.value = "";
    pinError.hidden = true;
    pinInput.focus();
  }

  function hidePinStep() {
    pendingChild = null;
    pinStep.hidden = true;
    grid.hidden = false;
  }

  function submitPin() {
    if (!pendingChild) return;
    var child = pendingChild;
    if (ChildAuthStore.verifyPin(child.id, pinInput.value)) {
      hidePinStep();
      ChildStore.setActive(child.id);
      applyActive();
    } else {
      pinError.hidden = false;
      pinInput.value = "";
      pinInput.focus();
    }
  }

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
        if (typeof ChildAuthStore !== "undefined" && ChildAuthStore.hasPin(child.id)) {
          showPinStep(child);
        } else {
          ChildStore.setActive(child.id);
          applyActive();
        }
      });
      grid.appendChild(btn);
    });
  }

  function applyActive() {
    var info = ChildStore.getActiveInfo();
    gate.hidden = !!info;
    if (!info) hidePinStep();
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

  pinBackBtn.addEventListener("click", hidePinStep);
  pinSubmitBtn.addEventListener("click", submitPin);
  pinInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") submitPin();
  });

  renderGrid();
  applyActive();
})();
