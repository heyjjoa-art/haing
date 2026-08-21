// 하정/하진 중 누구인지, 또는 관리자로 로그인한다. 셋 다 같은 방식으로 동작한다 -
// 처음 누르면 비밀번호를 설정하고(건너뛰기도 가능), 이미 설정해뒀으면 물어본다.
// 관리자로 로그인해야만 관리자 탭이 보인다(js/tabs.js 참고).
(function () {
  "use strict";

  var gate = document.getElementById("loginGate");
  var grid = document.getElementById("loginChildGrid");
  var adminBtn = document.getElementById("loginAdminBtn");
  var pinStep = document.getElementById("loginPinStep");
  var pinTitle = document.getElementById("loginPinTitle");
  var pinInput = document.getElementById("loginPinInput");
  var pinError = document.getElementById("loginPinError");
  var pinBackBtn = document.getElementById("loginPinBackBtn");
  var pinSubmitBtn = document.getElementById("loginPinSubmitBtn");
  var pinSkipBtn = document.getElementById("loginPinSkipBtn");

  var pendingTarget = null;
  var pendingMode = null; // "verify" | "set-first" | "set-confirm"
  var pendingFirstEntry = null;

  function makeChildTarget(child) {
    return {
      label: child.zodiacEmoji + " " + child.name,
      hasPin: function () {
        return ChildAuthStore.hasPin(child.id);
      },
      verify: function (v) {
        return ChildAuthStore.verifyPin(child.id, v);
      },
      setPin: function (v) {
        ChildAuthStore.setPin(child.id, v);
      },
      onSuccess: function () {
        AdminAuthStore.setActive(false);
        ChildStore.setActive(child.id);
      }
    };
  }

  function makeAdminTarget() {
    return {
      label: "🛠️ 관리자",
      hasPin: function () {
        return AdminAuthStore.hasPin();
      },
      verify: function (v) {
        return AdminAuthStore.verifyPin(v);
      },
      setPin: function (v) {
        AdminAuthStore.setPin(v);
      },
      onSuccess: function () {
        // AdminAuthStore를 먼저 켜야, 뒤이은 ChildStore.setActive(null)이
        // 부르는 onChange 리스너(헤더 부제목 등)가 "관리자 모드"로 바로 그려진다.
        AdminAuthStore.setActive(true);
        ChildStore.setActive(null);
      }
    };
  }

  function startLogin(target) {
    pendingTarget = target;
    grid.hidden = true;
    adminBtn.hidden = true;
    pinStep.hidden = false;
    pinError.hidden = true;
    pinInput.value = "";

    if (target.hasPin()) {
      pendingMode = "verify";
      pinTitle.textContent = target.label + " 비밀번호를 입력하세요";
      pinSkipBtn.hidden = true;
    } else {
      pendingMode = "set-first";
      pendingFirstEntry = null;
      pinTitle.textContent = target.label + " 비밀번호를 설정해주세요";
      pinSkipBtn.hidden = false;
    }
    pinInput.focus();
  }

  function hidePinStep() {
    pendingTarget = null;
    pendingMode = null;
    pendingFirstEntry = null;
    pinStep.hidden = true;
    grid.hidden = false;
    adminBtn.hidden = false;
  }

  function finishLogin(target) {
    hidePinStep();
    target.onSuccess();
    applyActive();
  }

  function submitPin() {
    if (!pendingTarget) return;
    var target = pendingTarget;
    var value = pinInput.value;

    if (pendingMode === "verify") {
      if (target.verify(value)) {
        finishLogin(target);
      } else {
        pinError.textContent = "비밀번호가 틀렸어요. 다시 입력해주세요.";
        pinError.hidden = false;
        pinInput.value = "";
        pinInput.focus();
      }
      return;
    }

    if (pendingMode === "set-first") {
      if (!value) {
        pinError.textContent = "비밀번호를 입력하거나, 아래 '비밀번호 없이 시작할래요'를 눌러주세요.";
        pinError.hidden = false;
        return;
      }
      pendingFirstEntry = value;
      pendingMode = "set-confirm";
      pinTitle.textContent = "비밀번호를 한 번 더 입력해주세요";
      pinError.hidden = true;
      pinInput.value = "";
      pinSkipBtn.hidden = true;
      pinInput.focus();
      return;
    }

    if (pendingMode === "set-confirm") {
      if (value === pendingFirstEntry) {
        target.setPin(value);
        finishLogin(target);
      } else {
        pendingMode = "set-first";
        pendingFirstEntry = null;
        pinTitle.textContent = target.label + " 비밀번호를 설정해주세요";
        pinError.textContent = "비밀번호가 서로 달라요. 다시 설정해주세요.";
        pinError.hidden = false;
        pinInput.value = "";
        pinSkipBtn.hidden = false;
        pinInput.focus();
      }
      return;
    }
  }

  function skipPin() {
    if (!pendingTarget) return;
    finishLogin(pendingTarget);
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
        startLogin(makeChildTarget(child));
      });
      grid.appendChild(btn);
    });
  }

  function applyActive() {
    var info = ChildStore.getActiveInfo();
    var isAdmin = typeof AdminAuthStore !== "undefined" && AdminAuthStore.isActive();
    gate.hidden = !!(info || isAdmin);
    if (!info && !isAdmin) hidePinStep();

    // 로그인한 아이가 바뀌면 진행 상황/카드 컬렉션도 그 아이 것으로 다시 그린다.
    if (window.__haingRenderHome) window.__haingRenderHome();
    // 관리자로 로그인했을 때만 관리자 탭이 보이게 한다(js/tabs.js).
    if (window.__haingUpdateAdminAccess) window.__haingUpdateAdminAccess();

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

  adminBtn.addEventListener("click", function () {
    startLogin(makeAdminTarget());
  });

  pinBackBtn.addEventListener("click", hidePinStep);
  pinSubmitBtn.addEventListener("click", submitPin);
  pinSkipBtn.addEventListener("click", skipPin);
  pinInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") submitPin();
  });

  renderGrid();
  applyActive();
})();
