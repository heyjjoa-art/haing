// 1~3단계를 끝낼 때마다 보여주는 응원 메시지. 카드 보상은 이제 4번(행맨)에서
// 실제로 맞힌 단어에만 주어지므로, 그 전 단계들은 다양한 칭찬 문구로 동기부여한다.
var PraisePopup = (function () {
  var MESSAGES = [
    "🌟 정말 잘했어요!",
    "💪 대단한걸요!",
    "🎉 최고예요!",
    "✨ 잘하고 있어요!",
    "🥳 완전 짱이에요!",
    "👏 훌륭해요!",
    "🚀 쑥쑥 늘고 있어요!",
    "🏆 진짜 멋져요!",
    "😄 신나게 잘했어요!",
    "🌈 오늘도 성공!",
    "🎈 자랑스러워요!",
    "🔥 열심히 했어요!",
    "🦄 너는 대단해!",
    "🍀 오늘의 행운아!",
    "🎁 노력이 반짝반짝!",
    "🌻 한 걸음 더 성장했어요!",
    "🎯 정확하게 해냈어요!",
    "🥇 챔피언이에요!",
    "🐣 씩씩하게 잘했어요!",
    "💎 보석처럼 빛나요!"
  ];

  function withUnitParam(url) {
    try {
      var params = new URLSearchParams(window.location.search);
      var unit = params.get("unit");
      if (unit) return url + "?unit=" + encodeURIComponent(unit);
    } catch (e) {
      // no-op
    }
    return url;
  }

  function show(nextUrl, nextLabel) {
    var message = MESSAGES[Math.floor(Math.random() * MESSAGES.length)];

    var overlay = document.createElement("div");
    overlay.className = "wc-popup-overlay";

    var box = document.createElement("div");
    box.className = "wc-popup-box";

    var titleEl = document.createElement("p");
    titleEl.className = "wc-popup-title wc-popup-title-lg";
    titleEl.textContent = message;
    box.appendChild(titleEl);

    var confirmBtn = document.createElement("button");
    confirmBtn.type = "button";
    confirmBtn.className = "wc-popup-btn";
    confirmBtn.textContent = nextLabel || "확인";
    confirmBtn.addEventListener("click", function () {
      overlay.remove();
      if (nextUrl) window.location.href = withUnitParam(nextUrl);
    });
    box.appendChild(confirmBtn);

    overlay.appendChild(box);
    document.body.appendChild(overlay);
  }

  return {
    show: show,
    withUnitParam: withUnitParam
  };
})();
