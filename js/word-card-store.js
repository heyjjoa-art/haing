// 1~4번 중 하나를 처음 완료할 때마다(4번은 매번) 그 유닛에서 배운 단어로 미니카드를
// 한 장씩 모은다. 스텔라이브 카드(고정 20장 롤스터)와 달리 실제로 공부한 단어가
// 그대로 카드가 되고, 새 유닛이 생길 때마다 모을 수 있는 단어도 계속 늘어난다.
// 카드는 "단어" 기준으로 중복 없이 모으는 개인 단어 사전 개념이라, 유닛이 삭제돼도
// 이미 모은 카드는 그대로 남도록 완전한 스냅샷(뜻·이모지 등)을 저장해둔다.
var WordCardStore = (function () {
  function childPrefix() {
    var childId = typeof ChildStore !== "undefined" && ChildStore.getActive();
    return childId ? childId + "_" : "guest_";
  }

  function collectionKey() {
    return "haingWordCards_" + childPrefix();
  }

  function pendingKey() {
    return "haingPendingWordCard_" + childPrefix();
  }

  function normalize(word) {
    return String(word || "").trim().toLowerCase();
  }

  function getCollected() {
    var raw = localStorage.getItem(collectionKey());
    if (!raw) return [];
    try {
      return JSON.parse(raw) || [];
    } catch (e) {
      return [];
    }
  }

  function saveCollected(cards) {
    localStorage.setItem(collectionKey(), JSON.stringify(cards));
  }

  function getCount() {
    return getCollected().length;
  }

  function hasWord(word) {
    var key = normalize(word);
    return getCollected().some(function (r) {
      return normalize(r.word) === key;
    });
  }

  function getPendingWords() {
    var raw = localStorage.getItem(pendingKey());
    if (!raw) return [];
    try {
      return JSON.parse(raw) || [];
    } catch (e) {
      return [];
    }
  }

  function getPendingCards() {
    var pending = getPendingWords();
    if (pending.length === 0) return [];
    var collected = getCollected();
    return collected.filter(function (r) {
      return pending.indexOf(normalize(r.word)) !== -1;
    });
  }

  // 예전 CardStore.getPendingCard()와 자리를 맞추기 위한 단일 카드 버전.
  function getPendingCard() {
    var cards = getPendingCards();
    return cards.length > 0 ? cards[0] : null;
  }

  function pushPending(record) {
    var pending = getPendingWords();
    pending.push(normalize(record.word));
    if (pending.length > 10) pending = pending.slice(pending.length - 10);
    localStorage.setItem(pendingKey(), JSON.stringify(pending));
  }

  function clearPending() {
    localStorage.removeItem(pendingKey());
  }

  function toRecord(word, unitKey) {
    return {
      word: word.word,
      meaningKo: word.meaningKo || "",
      definition: word.definition || "",
      emoji: word.emoji || "📘",
      unit: (typeof DataStore !== "undefined" && DataStore.resolveUnitKey(unitKey)) || null,
      collectedAt: Date.now()
    };
  }

  // 이 유닛의 단어 중 아직 못 모은 단어를 하나 골라 카드로 만든다.
  // 이미 다 모았으면(예: 같은 유닛을 반복 완료) null - 호출하는 쪽은 이미
  // "카드가 있으면 팝업을 띄운다" 형태로 짜여 있어서 별도 처리가 필요 없다.
  function awardRandomWordCard(unitKey) {
    var words = (typeof DataStore !== "undefined" && DataStore.getWords(unitKey)) || [];
    var collected = getCollected();
    var owned = {};
    collected.forEach(function (r) {
      owned[normalize(r.word)] = true;
    });

    var remaining = words.filter(function (w) {
      return w && w.word && !owned[normalize(w.word)];
    });
    if (remaining.length === 0) return null;

    var picked = remaining[Math.floor(Math.random() * remaining.length)];
    var record = toRecord(picked, unitKey);
    collected.push(record);
    saveCollected(collected);
    pushPending(record);
    return record;
  }

  return {
    getCollected: getCollected,
    getCount: getCount,
    hasWord: hasWord,
    awardRandomWordCard: awardRandomWordCard,
    getPendingWords: getPendingWords,
    getPendingCards: getPendingCards,
    getPendingCard: getPendingCard,
    clearPending: clearPending
  };
})();
