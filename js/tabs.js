// 홈 화면 상단의 Word / Journeys / 학습 / 관리자 탭 전환.
// 마지막으로 본 탭을 기억해서, 다음에 열었을 때도 그 탭이 먼저 보이게 한다.
// 학습 탭은 아이(하정/하진)로 로그인했을 때만, 관리자 탭은 관리자로 로그인했을
// 때만 보인다(js/login.js가 로그인/전환 시마다 window.__haingUpdateTabAccess를
// 불러준다).
(function () {
  "use strict";

  var STORAGE_KEY = "haingActiveTab";

  var tabs = [
    { id: "journeys", btn: document.getElementById("tabBtnJourneys"), panel: document.getElementById("panelJourneys") },
    { id: "word", btn: document.getElementById("tabBtnWord"), panel: document.getElementById("panelWord") },
    { id: "study", btn: document.getElementById("tabBtnStudy"), panel: document.getElementById("panelStudy") },
    { id: "admin", btn: document.getElementById("tabBtnAdmin"), panel: document.getElementById("panelAdmin") }
  ];

  function currentActiveId() {
    var found = tabs.filter(function (t) {
      return t.btn.classList.contains("active");
    })[0];
    return found ? found.id : null;
  }

  function activate(id) {
    tabs.forEach(function (t) {
      var active = t.id === id;
      t.btn.classList.toggle("active", active);
      t.btn.setAttribute("aria-selected", active ? "true" : "false");
      t.panel.hidden = !active;
    });
    localStorage.setItem(STORAGE_KEY, id);
  }

  var journeysFrame = document.querySelector("#panelJourneys iframe");

  tabs.forEach(function (t) {
    t.btn.addEventListener("click", function () {
      // 관리자 탭에서 새 유닛을 등록했을 수 있으니, Journeys 탭은 클릭할 때마다
      // iframe을 새로고침해서 목록이 항상 최신으로 보이게 한다.
      if (t.id === "journeys" && journeysFrame) {
        journeysFrame.src = journeysFrame.src;
      }
      // 학습 탭은 자정이 지나 새로 열었을 수도 있으니 매번 다시 그려서
      // "오늘"/달력 기준이 항상 최신이게 한다.
      if (t.id === "study" && window.__haingRenderMyGlance) {
        window.__haingRenderMyGlance();
      }
      activate(t.id);
    });
  });

  var studyTab = tabs[2];
  var adminTab = tabs[3];

  // 학습 탭은 아이(하정/하진)로 로그인했을 때만, 관리자 탭은 관리자로
  // 로그인했을 때만 보인다 - 로그아웃 상태에서는 둘 다 안 보인다.
  function updateTabAccess() {
    var isAdmin = typeof AdminAuthStore !== "undefined" && AdminAuthStore.isActive();
    var hasChild = typeof ChildStore !== "undefined" && !!ChildStore.getActive();
    studyTab.btn.hidden = !hasChild;
    adminTab.btn.hidden = !isAdmin;
    // 지금 보고 있던 탭에 대한 접근 권한이 사라졌으면(로그아웃/다른 계정 전환
    // 등) 그 탭에 그대로 남지 않도록 다른 탭으로 옮겨준다.
    var active = currentActiveId();
    if (!isAdmin && active === "admin") {
      activate("journeys");
    } else if (!hasChild && active === "study") {
      activate("journeys");
    }
  }

  window.__haingUpdateTabAccess = updateTabAccess;

  var validIds = tabs.map(function (t) {
    return t.id;
  });
  var saved = localStorage.getItem(STORAGE_KEY);
  activate(validIds.indexOf(saved) !== -1 ? saved : "journeys");
  updateTabAccess();
})();
