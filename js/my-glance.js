// "학습" 탭 - 하정이/하진이가 직접 로그인했을 때 자기 것만 보는 화면.
// 관리자 "한눈에 보기"와 완전히 같은 내용(이번주 저니스/오늘 단어 공부/트로피·
// 별 스티커·무지개/이번 달 달력)을 GlanceView(js/admin-glance.js)로 그대로
// 재사용하되, 아이 선택 탭 없이 지금 로그인한 아이 것만 곧바로 보여준다.
(function () {
  "use strict";

  var bodyEl = document.getElementById("myGlanceBody");
  if (!bodyEl) return;

  var renderer = null;

  function render() {
    if (
      typeof ChildStore === "undefined" ||
      typeof GlanceView === "undefined" ||
      typeof StampStore === "undefined" ||
      typeof ProgressStore === "undefined" ||
      typeof WordCardStore === "undefined" ||
      typeof DataStore === "undefined"
    ) {
      return;
    }
    if (!renderer) renderer = GlanceView.createRenderer(bodyEl);
    renderer.render(ChildStore.getActive());
  }

  render();
  if (ChildStore.onChange) ChildStore.onChange(render);
  window.__haingRenderMyGlance = render;
})();
