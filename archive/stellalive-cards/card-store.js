// 1~4번 중 하나를 처음 완료할 때마다 스텔라이브 멤버 카드를 한 장씩 무작위로 모은다.
var CardStore = (function () {
  // 카드 컬렉션은 아이(하정/하진)별 보상이라 로그인한 아이 id로 키를 나눈다.
  function childPrefix() {
    var childId = typeof ChildStore !== "undefined" && ChildStore.getActive();
    return childId ? childId + "_" : "guest_";
  }

  function keyName() {
    return "haingCardCollection_" + childPrefix();
  }

  function pendingKeyName() {
    return "haingPendingCard_" + childPrefix();
  }

  function getCollected() {
    var raw = localStorage.getItem(keyName());
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
    localStorage.setItem(keyName(), JSON.stringify(collected));
    localStorage.setItem(pendingKeyName(), card.id);
    return card;
  }

  function getPendingCard() {
    var id = localStorage.getItem(pendingKeyName());
    if (!id) return null;
    return MEMBER_CARDS.find(function (c) {
      return c.id === id;
    }) || null;
  }

  function clearPending() {
    localStorage.removeItem(pendingKeyName());
  }

  return {
    getCollected: getCollected,
    isCollected: isCollected,
    awardRandomCard: awardRandomCard,
    getPendingCard: getPendingCard,
    clearPending: clearPending
  };
})();
