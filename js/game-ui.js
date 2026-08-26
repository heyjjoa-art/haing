// 게임 방향 패드 공용 헬퍼 - 패드에서 버튼을 꾹 누르면 계속 반복 동작하게 한다.
// js/tetris.js의 bindHold()를 그대로 옮긴 것. click만 걸려 있던 스네이크/미로/
// 팩맨 d-pad에도 같은 방식으로 적용한다.
var GameUI = (function () {
  function bindHold(el, action, interval) {
    if (!el) return;
    var intervalId = null;
    function start(e) {
      e.preventDefault();
      action();
      intervalId = setInterval(action, interval || 130);
    }
    function stop() {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    }
    el.addEventListener("pointerdown", start);
    el.addEventListener("pointerup", stop);
    el.addEventListener("pointerleave", stop);
    el.addEventListener("pointercancel", stop);
  }

  return { bindHold: bindHold };
})();
