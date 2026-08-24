(function () {
  "use strict";

  var ROUND_SIZES = [4, 8, 8];
  // 이미 카드로 모은(=완전히 외운) 단어는 복습에서 빼고, 아직 안 외운 단어 위주로 연습한다.
  var ACTIVE_WORDS = WordCardStore.filterUncollected(DataStore.getWords());
  var TOTAL_WORDS = ACTIVE_WORDS.length;
  var roundIndex = 0;

  // 1~2번째(=처음 완주 + 첫 복습 한 바퀴)는 한글 뜻으로 매칭하고, 3번째 바퀴(=두 번째
  // 복습)부터는 영영 설명으로 매칭한다 - 완주한 바퀴 수가 2 이상이면 지금이 3번째 이상.
  var USE_DEFINITION_MODE =
    typeof ProgressStore !== "undefined" && ProgressStore.getCompletedLapCount() >= 2;

  // 영영 설명 문장 안에 정답 단어 자체가 그대로 들어있으면 안 보고도 맞힐 수 있어서,
  // 단어(와 -s/-es/-ed/-ing 같은 흔한 변화형)를 빈칸으로 가려서 보여준다.
  function maskWordInDefinition(text, word) {
    if (!text) return "";
    if (!word) return text;
    var escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    var variants = [escaped];
    if (/e$/i.test(word)) {
      var stem = escaped.slice(0, -1);
      variants.push(stem + "ing", stem + "ed");
    }
    var pattern = new RegExp("\\b(" + variants.join("|") + ")(s|es|d|ed|ing|r|er|ers)?\\b", "gi");
    return text.replace(pattern, "____");
  }

  // 영영 설명이 없는 단어(옛날에 등록된 유닛 등)는 그 카드만 한글 뜻으로 대신한다.
  function meaningTextFor(w) {
    if (USE_DEFINITION_MODE && w.definition) {
      return maskWordInDefinition(w.definition, w.word);
    }
    return w.meaningKo;
  }

  var gridEl = document.getElementById("memoryGrid");
  var cardTemplate = document.getElementById("cardTemplate");
  var moveCountEl = document.getElementById("moveCount");
  var matchCountEl = document.getElementById("matchCount");
  var totalPairsEl = document.getElementById("totalPairs");
  var winBannerEl = document.getElementById("winBanner");
  var roundWinTextEl = document.getElementById("roundWinText");
  var nextRoundBtn = document.getElementById("nextRoundBtn");
  var restartBtn = document.getElementById("restartBtn");
  var overallProgressEl = document.getElementById("overallProgress");
  var overallTotalEl = document.getElementById("overallTotal");

  var flippedCards = [];
  var matchCount = 0;
  var moveCount = 0;
  var lockBoard = false;

  var wordQueue = [];
  var currentRoundWords = [];
  var completedWords = 0;

  overallTotalEl.textContent = String(TOTAL_WORDS);

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i];
      a[i] = a[j];
      a[j] = tmp;
    }
    return a;
  }

  function updateOverallProgress() {
    overallProgressEl.textContent = String(completedWords);
    ProgressStore.setStepProgress("memory", completedWords, TOTAL_WORDS);
  }

  function startNewCycle() {
    wordQueue = shuffle(ACTIVE_WORDS.slice());
    completedWords = 0;
    roundIndex = 0;
    updateOverallProgress();
    startRound();
  }

  function startRound() {
    var targetSize = ROUND_SIZES[Math.min(roundIndex, ROUND_SIZES.length - 1)];
    var roundSize = Math.min(targetSize, wordQueue.length);
    currentRoundWords = wordQueue.splice(0, roundSize);
    roundIndex++;
    renderRound(currentRoundWords);
  }

  function buildCards(words) {
    var cards = [];
    words.forEach(function (w, idx) {
      cards.push({ pairId: idx, type: "word", text: w.word });
      cards.push({ pairId: idx, type: "meaning", text: meaningTextFor(w) });
    });
    return shuffle(cards);
  }

  function renderRound(words) {
    gridEl.innerHTML = "";
    matchCount = 0;
    moveCount = 0;
    flippedCards = [];
    lockBoard = false;
    winBannerEl.hidden = true;

    var cards = buildCards(words);
    totalPairsEl.textContent = String(words.length);
    updateStats();

    cards.forEach(function (cardData) {
      var frag = cardTemplate.content.cloneNode(true);
      var cardEl = frag.querySelector(".memory-card");
      var frontEl = frag.querySelector(".card-front");

      frontEl.textContent = cardData.text;
      cardEl.dataset.pairId = String(cardData.pairId);
      cardEl.dataset.type = cardData.type;
      if (cardData.type === "word") {
        cardEl.classList.add("word");
      }
      // 영영 설명은 한글 뜻보다 훨씬 길어서, 길이에 맞춰 글자 크기를 줄여 카드 안에 들어오게 한다.
      if (cardData.type === "meaning" && cardData.text.length > 18) {
        var scale = Math.max(0.55, Math.min(0.85, (18 / cardData.text.length) * 0.85));
        frontEl.style.fontSize = scale.toFixed(2) + "rem";
      }

      cardEl.addEventListener("click", function () {
        onCardClick(cardEl);
      });

      gridEl.appendChild(cardEl);
    });
  }

  function updateStats() {
    moveCountEl.textContent = String(moveCount);
    matchCountEl.textContent = String(matchCount);
  }

  function onCardClick(cardEl) {
    if (lockBoard) return;
    if (cardEl.classList.contains("flipped") || cardEl.classList.contains("matched")) return;
    if (flippedCards.length === 2) return;

    cardEl.classList.add("flipped");
    flippedCards.push(cardEl);

    if (flippedCards.length === 2) {
      moveCount++;
      updateStats();
      checkMatch();
    }
  }

  function checkMatch() {
    var a = flippedCards[0];
    var b = flippedCards[1];
    var isMatch =
      a.dataset.pairId === b.dataset.pairId && a.dataset.type !== b.dataset.type;

    if (isMatch) {
      a.classList.add("matched");
      b.classList.add("matched");
      flippedCards = [];
      matchCount++;
      updateStats();

      // 이 유닛 트로피를 이미 받은 뒤(=복습 중)라면, 맞힌 단어 카드에 별 스티커를
      // 하나 붙여준다(최대 5개).
      if (WordCardStore.hasTrophy()) {
        var matchedWord = currentRoundWords[parseInt(a.dataset.pairId, 10)];
        if (matchedWord) WordCardStore.addStar(matchedWord.word);
      }

      if (matchCount === currentRoundWords.length) {
        onRoundComplete();
      }
    } else {
      lockBoard = true;
      a.classList.add("mismatch");
      b.classList.add("mismatch");
      setTimeout(function () {
        a.classList.remove("flipped", "mismatch");
        b.classList.remove("flipped", "mismatch");
        flippedCards = [];
        lockBoard = false;
      }, 800);
    }
  }

  function onRoundComplete() {
    completedWords += currentRoundWords.length;
    updateOverallProgress();

    if (wordQueue.length === 0) {
      roundWinTextEl.textContent =
        "🎉 20개 단어를 모두 익혔어요! 처음부터 다시 해볼까요?";
      nextRoundBtn.textContent = "처음부터 다시";
      nextRoundBtn.onclick = startNewCycle;
      var firstTime = ProgressStore.markDone("memory");
      ProgressStore.markReviewStep("memory");
      if (firstTime) {
        PraisePopup.show("hangman.html", "다음 단계로 ▶");
      }
    } else {
      roundWinTextEl.textContent =
        "🎉 이번 세트 완료! (" + completedWords + " / " + TOTAL_WORDS + ")";
      nextRoundBtn.textContent = "다음 세트 ▶";
      nextRoundBtn.onclick = startRound;
    }
    winBannerEl.hidden = false;
  }

  restartBtn.addEventListener("click", startNewCycle);

  startNewCycle();
})();
