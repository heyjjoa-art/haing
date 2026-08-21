// index.html 말고 다른 페이지에서도 지금 누가 로그인했는지 헤더에 똑같이 보여준다.
// 실제 "누구로 바꿀지 고르는" 화면은 index.html에만 있어서, 여기서 누르면 지금
// 아이를 로그아웃시키고 index.html로 보내 거기서 새로 고르게 한다.
(function () {
  "use strict";

  var btn = document.getElementById("childSwitchBtn");
  if (!btn || typeof ChildStore === "undefined") return;

  function render() {
    var info = ChildStore.getActiveInfo();
    if (info) {
      btn.hidden = false;
      btn.textContent = info.zodiacEmoji + " " + info.name;
    } else {
      btn.hidden = true;
    }
  }

  btn.addEventListener("click", function () {
    if (confirm("다른 친구로 바꿀까요?")) {
      ChildStore.setActive(null);
      window.location.href = "index.html";
    }
  });

  render();
})();
