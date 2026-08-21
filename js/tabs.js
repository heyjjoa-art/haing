// 홈 화면 상단의 Word / Journeys / 관리자 탭 전환.
// 마지막으로 본 탭을 기억해서, 다음에 열었을 때도 그 탭이 먼저 보이게 한다.
// 관리자 탭은 관리자로 로그인했을 때만 보인다(js/login.js가 로그인/전환 시마다
// window.__haingUpdateAdminAccess를 불러준다).
(function () {
  "use strict";

  var STORAGE_KEY = "haingActiveTab";

  var tabs = [
    { id: "journeys", btn: document.getElementById("tabBtnJourneys"), panel: document.getElementById("panelJourneys") },
    { id: "word", btn: document.getElementById("tabBtnWord"), panel: document.getElementById("panelWord") },
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
      activate(t.id);
    });
  });

  var adminTab = tabs[2];

  function updateAdminAccess() {
    var isAdmin = typeof AdminAuthStore !== "undefined" && AdminAuthStore.isActive();
    adminTab.btn.hidden = !isAdmin;
    // 관리자 탭을 보고 있었는데 관리자 로그인이 풀렸으면(다른 아이로 전환 등)
    // 그 탭에 그대로 남지 않도록 다른 탭으로 옮겨준다.
    if (!isAdmin && currentActiveId() === "admin") {
      activate("journeys");
    }
  }

  window.__haingUpdateAdminAccess = updateAdminAccess;

  var validIds = tabs.map(function (t) {
    return t.id;
  });
  var saved = localStorage.getItem(STORAGE_KEY);
  activate(validIds.indexOf(saved) !== -1 ? saved : "journeys");
  updateAdminAccess();
})();
