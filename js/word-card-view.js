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

  function trophyCardHtml(record, opts) {
    var classes = "wc-card wc-card-trophy" + (opts.large ? " wc-card-lg" : "");
    var label = unitLabel(record);

    var html = '<article class="' + classes + '">';
    if (opts.isNew) html += '<span class="wc-card-new">NEW</span>';
    html +=
      '<div class="wc-card-band"><span class="wc-card-emoji">🏆</span></div>' +
      '<div class="wc-card-body">' +
      '<strong class="wc-card-word">단어정복!</strong>' +
      '<span class="wc-card-meaning">' + escapeHtml(label) + "<br>단어를 다 모았어요</span>";
    if (opts.large) {
      html += '<p class="wc-card-def">이 유닛의 단어를 전부 완벽하게 외웠어요. 정말 대단해요!</p>';
    }
    html +=
      "</div>" +
      '<span class="wc-card-unit">' + escapeHtml(label) + "</span>" +
      "</article>";
    return html;
  }

  // TEST 페이지(1~4단계 20개 다 맞히기)를 통과하면 받는 무지개 카드. 완전정복
  // 트로피와 같은 모양(.wc-card-trophy)에 무지개 톤만 덧씌운다(.wc-card-trophy-rainbow).
  function rainbowCardHtml(record, opts) {
    var classes = "wc-card wc-card-trophy wc-card-trophy-rainbow" + (opts.large ? " wc-card-lg" : "");
    var label = unitLabel(record);

    var html = '<article class="' + classes + '">';
    if (opts.isNew) html += '<span class="wc-card-new">NEW</span>';
    html +=
      '<div class="wc-card-band"><span class="wc-card-emoji">🌈</span></div>' +
      '<div class="wc-card-body">' +
      '<strong class="wc-card-word">TEST정복!</strong>' +
      '<span class="wc-card-meaning">' + escapeHtml(label) + "<br>4단계를 모두 통과했어요</span>";
    if (opts.large) {
      html += '<p class="wc-card-def">이 유닛의 단어를 시험 4단계 모두 20개씩 맞혔어요. 최고예요!</p>';
    }
    html +=
      "</div>" +
      '<span class="wc-card-unit">' + escapeHtml(label) + "</span>" +
      "</article>";
    return html;
  }

  // Journeys 트로피 카드를 확대해서 볼 때 보여주는 꾸준함/성실 명언. 카드마다 하나로
  // 고정돼야 해서(볼 때마다 바뀌면 안 됨) 매번 랜덤으로 고르지 않는다 - 트로피를 줄 때
  // word-card-store.js가 record.quoteIndex를 순서대로 매겨서(0,1,2...) 저장해두면,
  // 다음 트로피는 자동으로 다음 명언을 받아 같은 걸 연달아 보지 않는다. quoteIndex가
  // 없는 옛날 기록(이 필드가 생기기 전에 만들어진 트로피)은 카드 고유 키로 고정 인덱스를
  // 만들어서, 최소한 "매번 안 바뀌는" 성질만은 지킨다.
  var PERSEVERANCE_QUOTES = [
    "꾸준함은 성공의 지름길이다.",
    "천 리 길도 한 걸음부터.",
    "작은 노력이 쌓여 큰 결과를 만든다.",
    "포기하지 않는 자가 결국 이긴다.",
    "매일 조금씩, 꾸준히 하는 것이 가장 빠른 길이다.",
    "습관이 실력을 만든다.",
    "느려도 꾸준히 가는 것이 멈추는 것보다 낫다.",
    "오늘 하루도 최선을 다한 너는 이미 성공한 거야.",
    "성실함은 배신하지 않는다.",
    "한 걸음씩, 그러나 쉬지 않고."
  ];

  function perseveranceQuoteFor(record) {
    if (record && typeof record.quoteIndex === "number") {
      return PERSEVERANCE_QUOTES[record.quoteIndex % PERSEVERANCE_QUOTES.length];
    }
    var key = (record && record.word) || "";
    var sum = 0;
    for (var i = 0; i < key.length; i++) sum += key.charCodeAt(i);
    return PERSEVERANCE_QUOTES[sum % PERSEVERANCE_QUOTES.length];
  }

  // Journeys 쪽에서 한 주(월~금) 도장을 다 채우면 받는 트로피 카드. Word의
  // "완전정복!" 트로피 카드와 같은 모양(.wc-card-trophy)을 그대로 쓰되 문구만 다르다.
  function journeysTrophyCardHtml(record, opts) {
    var classes = "wc-card wc-card-trophy wc-card-trophy-silver" + (opts.large ? " wc-card-lg" : "");

    var html = '<article class="' + classes + '">';
    if (opts.isNew) html += '<span class="wc-card-new">NEW</span>';
    html +=
      '<div class="wc-card-band"><span class="wc-card-emoji">🏆</span></div>' +
      '<div class="wc-card-body">' +
      '<strong class="wc-card-word">Journeys</strong>' +
      '<span class="wc-card-meaning">1 Week<br>' + escapeHtml(record.resultLabel || "Success") + "</span>";
    if (opts.large) {
      html += '<p class="wc-card-def">"' + escapeHtml(perseveranceQuoteFor(record)) + '"</p>';
    }
    html +=
      "</div>" +
      '<span class="wc-card-unit">' + escapeHtml(record.unitLabel || "") + "</span>" +
      "</article>";
    return html;
  }

  // 별 스티커 자리는 카드마다 5개 고정. 트로피 받은 유닛의 단어를 복습에서 또
  // 맞히면 빈 별 자리가 하나씩 채워진다(최대 5개).
  function starsHtml(record) {
    var stars = Math.min(5, (record && record.stars) || 0);
    var html = '<span class="wc-card-stars">';
    for (var i = 0; i < 5; i++) {
      html += i < stars
        ? '<span class="wc-star wc-star-filled">⭐</span>'
        : '<span class="wc-star wc-star-empty">☆</span>';
    }
    return html + "</span>";
  }

  function cardHtml(record, opts) {
    opts = opts || {};
    if (record && record.journeysTrophy) return journeysTrophyCardHtml(record, opts);
    if (record && record.rainbowCard) return rainbowCardHtml(record, opts);
    if (record && record.isTrophy) return trophyCardHtml(record, opts);

    var tone = toneIndex(record);
    var classes = "wc-card wc-tone-" + tone + (opts.large ? " wc-card-lg" : "");

    var html = '<article class="' + classes + '">';
    if (opts.isNew) html += '<span class="wc-card-new">NEW</span>';
    html +=
      '<div class="wc-card-band"><span class="wc-card-emoji">' + escapeHtml(record.emoji || "📘") + "</span></div>" +
      '<div class="wc-card-body">' +
      '<strong class="wc-card-word">' + escapeHtml(record.word) + "</strong>" +
      '<span class="wc-card-meaning">' + escapeHtml(record.meaningKo) + "</span>" +
      starsHtml(record);
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
