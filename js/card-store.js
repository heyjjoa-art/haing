// 1~4번 중 하나를 처음 완료할 때마다 스텔라이브 멤버 카드를 한 장씩 무작위로 모은다.
var CardStore = (function () {
  var KEY = "haingCardCollection";
  var PENDING_KEY = "haingPendingCard";

  function getCollected() {
    var raw = localStorage.getItem(KEY);
    if (!raw) return [];
    try {
      return JSON.parse(raw) || [];
    } catch (e) {
      return [];
    }
  }

  function isCollected(id) {
    return getCollected().indexOf(id) !== -1;
  }

  function awardRandomCard() {
    var collected = getCollected();
    var remaining = MEMBER_CARDS.filter(function (c) {
      return collected.indexOf(c.id) === -1;
    });
    if (remaining.length === 0) return null;

    var card = remaining[Math.floor(Math.random() * remaining.length)];
    collected.push(card.id);
    localStorage.setItem(KEY, JSON.stringify(collected));
    localStorage.setItem(PENDING_KEY, card.id);
    return card;
  }

  function getPendingCard() {
    var id = localStorage.getItem(PENDING_KEY);
    if (!id) return null;
    return MEMBER_CARDS.find(function (c) {
      return c.id === id;
    }) || null;
  }

  function clearPending() {
    localStorage.removeItem(PENDING_KEY);
  }

  return {
    getCollected: getCollected,
    isCollected: isCollected,
    awardRandomCard: awardRandomCard,
    getPendingCard: getPendingCard,
    clearPending: clearPending
  };
})();
