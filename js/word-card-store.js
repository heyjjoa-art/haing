// 1~4번 중 하나를 처음 완료할 때마다(4번은 매번) 그 유닛에서 배운 단어로 미니카드를
// 한 장씩 모은다. 스텔라이브 카드(고정 20장 롤스터)와 달리 실제로 공부한 단어가
// 그대로 카드가 되고, 새 유닛이 생길 때마다 모을 수 있는 단어도 계속 늘어난다.
// 카드는 "단어" 기준으로 중복 없이 모으는 개인 단어 사전 개념이라, 유닛이 삭제돼도
// 이미 모은 카드는 그대로 남도록 완전한 스냅샷(뜻·이모지 등)을 저장해둔다.
var WordCardStore = (function () {
  // 하루 3세트(ProgressStore.WORD_SETS_DAILY_CAP)를 넘긴 뒤에는 공부 자체는
  // 계속할 수 있지만, 별/카드/트로피 같은 보상은 더 안 쌓이게 막는다.
  function dailyWordCapReached() {
    return typeof ProgressStore !== "undefined" && ProgressStore.reachedDailyWordCap && ProgressStore.reachedDailyWordCap();
  }

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
    if (dailyWordCapReached()) return null;
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
    syncToCloud();
    return record;
  }

  // 이미 카드로 모은(=트로피까지 받은 유닛의) 단어를 복습에서 또 맞히면, 카드는 새로
  // 안 주는 대신 별 스티커를 하나 붙여준다. 최대 5개까지만 쌓인다.
  // 반환값: 붙인 뒤의 별 개수(카드가 없으면 null - 호출부가 헷갈리지 않게).
  function addStar(word) {
    if (dailyWordCapReached()) return null;
    var key = normalize(word);
    var collected = getCollected();
    var record = collected.filter(function (r) {
      return !r.isTrophy && normalize(r.word) === key;
    })[0];
    if (!record) return null;
    record.stars = Math.min(5, (record.stars || 0) + 1);
    saveCollected(collected);
    syncToCloud();
    if (typeof WordGameStore !== "undefined") WordGameStore.syncCredits();
    return record.stars;
  }

  // 특정 단어 하나를 콕 집어 카드로 만든다(4번 게임에서 실제로 맞힌 단어용).
  // 이미 모은 단어면 null - 중복으로 다시 주지 않는다.
  function awardWordCard(word, unitKey) {
    if (!word || !word.word) return null;
    if (hasWord(word.word)) return null;
    if (dailyWordCapReached()) return null;
    var collected = getCollected();
    var record = toRecord(word, unitKey);
    collected.push(record);
    saveCollected(collected);
    pushPending(record);
    syncToCloud();
    return record;
  }

  // 이 유닛 단어 중 아직 카드로 못 모은 것만 걸러준다(2~4번 복습에 사용).
  // 전부 다 모았으면(완전정복) 복습 자체가 의미 없으니 원래 목록을 그대로 돌려준다.
  function filterUncollected(words) {
    var collected = getCollected();
    var owned = {};
    collected.forEach(function (r) {
      owned[normalize(r.word)] = true;
    });
    var remaining = (words || []).filter(function (w) {
      return w && w.word && !owned[normalize(w.word)];
    });
    return remaining.length > 0 ? remaining : words;
  }

  // 트로피 카드는 일반 단어 카드와 같은 배열에 저장하되, 진짜 단어와 절대 안 겹치도록
  // "__trophy_유닛키" 형태의 가짜 word 값을 써서 구분한다(WordCardView가 isTrophy로 렌더링 분기).
  function trophyWordKey(unitKey) {
    return "__trophy_" + String(unitKey);
  }

  function hasTrophy(unitKey) {
    var resolvedUnit = typeof DataStore !== "undefined" ? DataStore.resolveUnitKey(unitKey) : unitKey;
    return hasWord(trophyWordKey(resolvedUnit));
  }

  function isUnitComplete(words) {
    return !!words && words.length > 0 && words.every(function (w) {
      return w && w.word && hasWord(w.word);
    });
  }

  // 이 유닛의 단어를 전부 모았으면(완전정복) 트로피 카드를 한 장 준다. 유닛당 한 번만.
  function awardTrophyIfComplete(unitKey) {
    if (typeof DataStore === "undefined") return null;
    var resolvedUnit = DataStore.resolveUnitKey(unitKey);
    var words = DataStore.getWords(unitKey);
    if (!isUnitComplete(words)) return null;
    if (hasTrophy(resolvedUnit)) return null;
    if (dailyWordCapReached()) return null;

    var record = {
      word: trophyWordKey(resolvedUnit),
      isTrophy: true,
      unit: resolvedUnit,
      collectedAt: Date.now()
    };
    var collected = getCollected();
    collected.push(record);
    saveCollected(collected);
    pushPending(record);
    syncToCloud();
    if (typeof WordGameStore !== "undefined") WordGameStore.syncCredits();
    return record;
  }

  // Journeys 쪽에서 한 주(월~금) 도장을 다 채웠을 때 트로피 카드를 하나 준다.
  // 같은 유닛의 같은 주는 한 번만(hasWord로 중복 방지 - 이 카드 자체가 "이미
  // 줬는지"의 기록이라 따로 상태를 안 둬도 된다). Word 쪽 트로피와 같은 배열에
  // 저장하되 journeysTrophy로 구분해서 WordCardView가 다르게 그리고,
  // WordGameStore의 트로피 개수 집계에서도 빠지게 한다(기회는 여기서 직접 준다).
  function journeysTrophyWordKey(unitId, weekStart) {
    return "__journeystrophy_" + String(unitId) + "_" + String(weekStart);
  }

  function awardJourneysTrophy(unitId, weekStart, weekLabel, unitLabel) {
    var key = journeysTrophyWordKey(unitId, weekStart);
    if (hasWord(key)) return null;

    var record = {
      word: key,
      isTrophy: true,
      journeysTrophy: true,
      unit: null,
      weekLabel: weekLabel || "1week",
      resultLabel: "Success",
      unitLabel: unitLabel || "",
      collectedAt: Date.now()
    };
    var collected = getCollected();
    collected.push(record);
    saveCollected(collected);
    pushPending(record);
    syncToCloud();
    if (typeof WordGameStore !== "undefined") WordGameStore.grantCredits(3);
    return record;
  }

  // 도감 화면의 "단어 카드" / "트로피 카드" 탭에 쓰는 조회 함수들.
  function getTrophyCards() {
    return getCollected().filter(function (r) {
      return r.isTrophy;
    });
  }

  // 이미 트로피를 받은(=완전정복한) 유닛 키 집합. 그 유닛의 단어 카드는 트로피
  // 안으로 "졸업"한 걸로 보고 단어 카드 탭에서는 더 이상 따로 보여주지 않는다.
  function getCompletedUnitKeys() {
    var keys = {};
    getTrophyCards().forEach(function (r) {
      keys[String(r.unit)] = true;
    });
    return keys;
  }

  // 단어 카드 탭용 - 아직 그 유닛을 완전정복하지 못한, 지금 모으는 중인 단어 카드만.
  function getInProgressCards() {
    var completedUnits = getCompletedUnitKeys();
    return getCollected().filter(function (r) {
      return !r.isTrophy && !completedUnits[String(r.unit)];
    });
  }

  // 트로피 카드를 눌렀을 때 - 그 유닛에서 모은 단어 카드 전체(완전정복이니 유닛 단어 수만큼).
  function getUnitWordCards(unitKey) {
    return getCollected().filter(function (r) {
      return !r.isTrophy && String(r.unit) === String(unitKey);
    });
  }

  // 트로피 받은 유닛의 단어 카드가 전부 별 5개(한도)까지 찼는지 본다 - 다 찼으면
  // 이 유닛을 더 복습해도 얻을 별이 없다는 뜻이라, 홈 화면에서 다른 유닛을 권해준다.
  function isStarLimitReached(unitKey) {
    var resolvedUnit = typeof DataStore !== "undefined" ? DataStore.resolveUnitKey(unitKey) : unitKey;
    if (!hasTrophy(resolvedUnit)) return false;
    var cards = getUnitWordCards(resolvedUnit);
    if (cards.length === 0) return false;
    return cards.every(function (r) {
      return (r.stars || 0) >= 5;
    });
  }

  // 유닛 번호를 바꿀 때, 모든 아이(로그인 안 한 guest 포함)가 이미 모은 카드의 unit
  // 필드도 같이 옮겨준다. 안 옮기면 도감에서 카드가 예전 번호로 남아 트로피와 어긋난다.
  function renameUnitInCards(oldUnit, newUnit) {
    var prefixes = ["guest_"];
    if (typeof ChildStore !== "undefined") {
      ChildStore.CHILDREN.forEach(function (c) {
        prefixes.push(c.id + "_");
      });
    }
    prefixes.forEach(function (prefix) {
      var key = "haingWordCards_" + prefix;
      var raw = localStorage.getItem(key);
      if (!raw) return;
      var cards;
      try {
        cards = JSON.parse(raw) || [];
      } catch (e) {
        return;
      }
      var changed = false;
      cards.forEach(function (r) {
        if (String(r.unit) !== String(oldUnit)) return;
        r.unit = newUnit;
        if (r.isTrophy) r.word = trophyWordKey(newUnit);
        changed = true;
      });
      if (changed) {
        localStorage.setItem(key, JSON.stringify(cards));
        if (prefix !== "guest_" && typeof HaingCloud !== "undefined" && HaingCloud.enabled) {
          var childId = prefix.slice(0, -1);
          HaingCloud.writeDoc("wordCards/" + childId, { cards: cards });
        }
      }
    });
  }

  // 지금 로그인한 아이의 카드만 클라우드와 맞춘다(guest 상태는 어느 아이 것인지 알 수
  // 없어 동기화하지 않는다). 다른 아이로 로그인을 바꾸면 구독을 새로 건다.
  function cloudPath() {
    var childId = typeof ChildStore !== "undefined" && ChildStore.getActive();
    return childId ? "wordCards/" + childId : null;
  }

  function syncToCloud() {
    if (typeof HaingCloud === "undefined" || !HaingCloud.enabled) return;
    var path = cloudPath();
    if (!path) return;
    HaingCloud.writeDoc(path, { cards: getCollected() });
  }

  function applyCloudCards(data) {
    if (!data || !data.cards) return;
    saveCollected(data.cards);
    if (window.__haingRenderHome) window.__haingRenderHome();
    if (window.__haingRenderWordCards) window.__haingRenderWordCards();
  }

  var unsubscribeCloud = null;
  function setupCloudSyncForActiveChild() {
    if (unsubscribeCloud) {
      unsubscribeCloud();
      unsubscribeCloud = null;
    }
    if (typeof HaingCloud === "undefined" || !HaingCloud.enabled) return;
    var path = cloudPath();
    if (!path) return;
    HaingCloud.getDocOnce(path).then(function (remote) {
      // 클라우드에 문서 자체가 없으면(이 아이가 클라우드에 처음 연결) 이 기기 카드를
      // 시작점으로 올린다. 문서가 있으면 카드가 0장이어도(=관리자가 삭제한 경우 포함)
      // 클라우드를 그대로 따른다 - "0장"과 "아직 연결 안 됨"을 구분해야 삭제가 이
      // 기기에도 실제로 반영된다.
      if (remote) {
        saveCollected(remote.cards || []);
        if (window.__haingRenderHome) window.__haingRenderHome();
        if (window.__haingRenderWordCards) window.__haingRenderWordCards();
      } else {
        syncToCloud();
      }
      unsubscribeCloud = HaingCloud.watchDoc(path, applyCloudCards);
    });
  }

  setupCloudSyncForActiveChild();
  if (typeof ChildStore !== "undefined" && ChildStore.onChange) {
    ChildStore.onChange(setupCloudSyncForActiveChild);
  }

  return {
    getCollected: getCollected,
    getCount: getCount,
    hasWord: hasWord,
    awardRandomWordCard: awardRandomWordCard,
    awardWordCard: awardWordCard,
    addStar: addStar,
    filterUncollected: filterUncollected,
    hasTrophy: hasTrophy,
    isStarLimitReached: isStarLimitReached,
    awardTrophyIfComplete: awardTrophyIfComplete,
    awardJourneysTrophy: awardJourneysTrophy,
    getTrophyCards: getTrophyCards,
    getInProgressCards: getInProgressCards,
    getUnitWordCards: getUnitWordCards,
    renameUnitInCards: renameUnitInCards,
    getPendingWords: getPendingWords,
    getPendingCards: getPendingCards,
    getPendingCard: getPendingCard,
    clearPending: clearPending
  };
})();
