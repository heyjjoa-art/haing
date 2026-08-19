// 홈 화면 상단의 Word / Journeys 탭 전환.
// 마지막으로 본 탭을 기억해서, 다음에 열었을 때도 그 탭이 먼저 보이게 한다.
(function () {
  "use strict";

  var STORAGE_KEY = "haingActiveTab";

  var tabs = [
    { id: "journeys", btn: document.getElementById("tabBtnJourneys"), panel: document.getElementById("panelJourneys") },
    { id: "word", btn: document.getElementById("tabBtnWord"), panel: document.getElementById("panelWord") },
    { id: "admin", btn: document.getElementById("tabBtnAdmin"), panel: document.getElementById("panelAdmin") }
  ];

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

  var validIds = tabs.map(function (t) {
    return t.id;
  });
  var saved = localStorage.getItem(STORAGE_KEY);
  activate(validIds.indexOf(saved) !== -1 ? saved : "journeys");
})();
