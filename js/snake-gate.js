// 스네이크는 아직 개발 중이라 관리자 계정에서만 열어본다. 이 스크립트는
// <body> 맨 앞, 나머지 화면 요소가 그려지기 전에 실행돼서 관리자가 아니면
// 바로 홈으로 돌려보낸다(화면이 잠깐이라도 보이는 걸 막기 위해 최대한 먼저 실행).
(function () {
  "use strict";
  if (typeof AdminAuthStore === "undefined" || !AdminAuthStore.isActive()) {
    window.location.replace("index.html");
  }
})();
