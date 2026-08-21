// 모든 페이지 헤더 부제목에 "영어를 좋아하는 [아이콘+이름 버튼]"을 보여준다.
// 예전엔 계정 전환이 헤더 우측의 별도 버튼이었는데, 이제 그 버튼 자리는 단어도감
// 아이콘이 차지하고, 계정 전환은 부제목 안 아이 이름을 누르면 되도록 옮겨왔다.
// 실제 "누구로 바꿀지 고르는" 화면은 index.html에만 있어서, 여기서 누르면 지금
// 아이를 로그아웃시키고 index.html로 보내 거기서 새로 고르게 한다.
(function () {
  "use strict";

  var subtitleEl = document.getElementById("appSubtitle");
  if (!subtitleEl || typeof ChildStore === "undefined") return;

  function switchChild() {
    if (confirm("다른 친구로 바꿀까요?")) {
      ChildStore.setActive(null);
      window.location.href = "index.html";
    }
  }

  function render() {
    var info = ChildStore.getActiveInfo();
    subtitleEl.textContent = "";
    subtitleEl.appendChild(document.createTextNode("영어를 좋아하는 "));
    if (info) {
      var nameBtn = document.createElement("button");
      nameBtn.type = "button";
      nameBtn.className = "subtitle-child-btn";
      nameBtn.textContent = info.zodiacEmoji + " " + info.name;
      nameBtn.addEventListener("click", switchChild);
      subtitleEl.appendChild(nameBtn);
    }
  }

  render();
  // index.html에서는 로그인 화면(그리드)에서 아이를 고르면 새로고침 없이 바로
  // 전환되니, 부제목도 같이 실시간으로 다시 그려야 한다.
  if (ChildStore.onChange) ChildStore.onChange(render);
})();
