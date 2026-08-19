// 1~4번 완료 시 "단어 카드를 얻었어요!" 화면을 띄운다. 예전 CardPopup(스텔라이브
// 카드용)과 쓰는 방법은 똑같이 맞춰서(show/withUnitParam) 게임 페이지 쪽 코드는
// 거의 그대로 두고 이 모듈만 바꿔 끼우면 되게 했다.
var WordCardPopup = (function () {
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

  // cardOrCards: 카드 하나 또는 배열(4번 보너스일 때 2장)
  function show(cardOrCards, nextUrl, nextLabel, opts) {
    opts = opts || {};
    var cards = Array.isArray(cardOrCards) ? cardOrCards : [cardOrCards];
    if (cards.length === 0) return;

    var title =
      opts.title ||
      (cards.length > 1 ? "🎉 단어 카드 " + cards.length + "장 획득!" : "🎉 새 단어 카드를 얻었어요!");

    var overlay = document.createElement("div");
    overlay.className = "wc-popup-overlay";

    var box = document.createElement("div");
    box.className = "wc-popup-box";

    var titleEl = document.createElement("p");
    titleEl.className = "wc-popup-title";
    titleEl.textContent = title;
    box.appendChild(titleEl);

    if (opts.subtitle) {
      var subtitleEl = document.createElement("p");
      subtitleEl.className = "wc-popup-subtitle";
      subtitleEl.textContent = opts.subtitle;
      box.appendChild(subtitleEl);
    }

    var cardsWrap = document.createElement("div");
    cardsWrap.className = "wc-popup-cards";
    cards.forEach(function (card) {
      cardsWrap.appendChild(WordCardView.cardEl(card));
    });
    box.appendChild(cardsWrap);

    var confirmBtn = document.createElement("button");
    confirmBtn.type = "button";
    confirmBtn.id = "wordCardPopupConfirmBtn";
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
