// 단어 미니카드를 그리는 곳은 세 군데(획득 팝업 · 도감 그리드 · 확대보기)라
// 마크업을 한 곳에서만 만들어서 어디서 봐도 카드가 똑같이 생기게 한다.
var WordCardView = (function () {
  var TONE_COUNT = 4;

  function escapeHtml(s) {
    var div = document.createElement("div");
    div.textContent = s == null ? "" : String(s);
    return div.innerHTML;
  }

  // 단어 글자 자체로 톤을 고정해서, 같은 단어는 팝업/도감/확대보기 어디서나 같은 색.
  function toneIndex(record) {
    var text = (record && record.word) || "";
    var sum = 0;
    for (var i = 0; i < text.length; i++) sum += text.charCodeAt(i);
    return sum % TONE_COUNT;
  }

  function unitLabel(record) {
    var unit = record && record.unit;
    if (!unit || unit === "unspecified") return "기본 단어";
    return "Unit " + unit;
  }

  function cardHtml(record, opts) {
    opts = opts || {};
    var tone = toneIndex(record);
    var classes = "wc-card wc-tone-" + tone + (opts.large ? " wc-card-lg" : "");

    var html = '<article class="' + classes + '">';
    if (opts.isNew) html += '<span class="wc-card-new">NEW</span>';
    html +=
      '<div class="wc-card-band"><span class="wc-card-emoji">' + escapeHtml(record.emoji || "📘") + "</span></div>" +
      '<div class="wc-card-body">' +
      '<strong class="wc-card-word">' + escapeHtml(record.word) + "</strong>" +
      '<span class="wc-card-meaning">' + escapeHtml(record.meaningKo) + "</span>";
    if (opts.large && record.definition) {
      html += '<p class="wc-card-def">' + escapeHtml(record.definition) + "</p>";
    }
    html +=
      "</div>" +
      '<span class="wc-card-unit">' + escapeHtml(unitLabel(record)) + "</span>" +
      "</article>";
    return html;
  }

  function cardEl(record, opts) {
    var wrap = document.createElement("div");
    wrap.innerHTML = cardHtml(record, opts);
    return wrap.firstElementChild;
  }

  return {
    toneIndex: toneIndex,
    unitLabel: unitLabel,
    cardHtml: cardHtml,
    cardEl: cardEl
  };
})();
