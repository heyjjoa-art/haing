// 1~4번 중 한 단계를 완료했을 때, 새로 받은 스텔라이브 카드(1장 또는 보너스 포함 여러 장)를
// 보여주고 "확인"을 누르면 다음 단계로 이동시키는 공용 팝업.
var CardPopup = (function () {
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

  function show(cardOrCards, nextUrl, nextLabel, opts) {
    opts = opts || {};
    var cards = Array.isArray(cardOrCards) ? cardOrCards : [cardOrCards];

    var overlay = document.createElement("div");
    overlay.className = "card-popup-overlay";

    var title = opts.title || (cards.length > 1 ? "🎉 카드 " + cards.length + "장 획득!" : "🎉 새 카드 획득!");

    var cardsHtml = cards
      .map(function (card) {
        return (
          '<div class="card-popup-item">' +
          '<img class="card-popup-img" src="' +
          card.image +
          '" alt="' +
          card.name +
          '">' +
          '<p class="card-popup-name">' +
          card.name +
          " (" +
          card.gen +
          ")</p>" +
          "</div>"
        );
      })
      .join("");

    overlay.innerHTML =
      '<div class="card-popup-box">' +
      '<p class="card-popup-title">' +
      title +
      "</p>" +
      (opts.subtitle ? '<p class="card-popup-subtitle">' + opts.subtitle + "</p>" : "") +
      '<div class="card-popup-cards">' +
      cardsHtml +
      "</div>" +
      '<button type="button" class="card-popup-btn" id="cardPopupConfirmBtn">' +
      (nextLabel || "확인") +
      "</button>" +
      "</div>";
    document.body.appendChild(overlay);

    document.getElementById("cardPopupConfirmBtn").addEventListener("click", function () {
      overlay.remove();
      if (nextUrl) {
        location.href = withUnitParam(nextUrl);
      }
    });
  }

  return { show: show, withUnitParam: withUnitParam };
})();
