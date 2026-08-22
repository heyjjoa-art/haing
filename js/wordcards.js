(function () {
  "use strict";

  var tabWordsBtn = document.getElementById("wcTabWords");
  var tabTrophiesBtn = document.getElementById("wcTabTrophies");
  var tabGamesBtn = document.getElementById("wcTabGames");

  var statLineEl = document.getElementById("wcStatLine");
  var countEl = document.getElementById("wcCount");
  var countLabelEl = document.getElementById("wcCountLabel");
  var emptyEl = document.getElementById("wcEmpty");
  var emptyLine1El = document.getElementById("wcEmptyLine1");
  var emptyLine2El = document.getElementById("wcEmptyLine2");
  var gridEl = document.getElementById("wcGrid");

  var gamesPanelEl = document.getElementById("wcGamesPanel");
  var gameCreditsEl = document.getElementById("wcGameCredits");
  var gamesLockedEl = document.getElementById("wcGamesLocked");
  var gamesLockedTitleEl = document.getElementById("wcGamesLockedTitle");
  var gamesLockedHintEl = document.getElementById("wcGamesLockedHint");
  var gamesGridEl = document.getElementById("wcGamesGrid");
  var gameTetrisBtn = document.getElementById("wcGameTetris");
  var gameSudokuBtn = document.getElementById("wcGameSudoku");
  var gameCrosswordBtn = document.getElementById("wcGameCrossword");

  var lightboxEl = document.getElementById("wcLightbox");
  var lightboxBodyEl = document.getElementById("wcLightboxBody");
  var lightboxCloseBtn = document.getElementById("wcLightboxClose");
  var lightboxReplayBtn = document.getElementById("wcLightboxReplayBtn");

  var unitLightboxEl = document.getElementById("wcUnitLightbox");
  var unitTitleEl = document.getElementById("wcUnitDetailTitle");
  var unitGridEl = document.getElementById("wcUnitDetailGrid");
  var unitLightboxCloseBtn = document.getElementById("wcUnitLightboxClose");

  var currentTab = "words"; // "words" | "trophies" | "games"

  function speakDefinition(record) {
    if (typeof Tts === "undefined" || !record || !record.definition) return;
    Tts.stop();
    Tts.speak(record.definition);
  }

  function openLightbox(record) {
    lightboxBodyEl.innerHTML = WordCardView.cardHtml(record, { large: true });
    var hasDefinition = !!(record && record.definition);
    lightboxReplayBtn.hidden = !hasDefinition;
    lightboxReplayBtn.onclick = hasDefinition ? function () { speakDefinition(record); } : null;
    lightboxEl.classList.add("open");
    speakDefinition(record);
  }

  function closeLightbox() {
    lightboxEl.classList.remove("open");
    if (typeof Tts !== "undefined") Tts.stop();
  }

  lightboxCloseBtn.addEventListener("click", closeLightbox);
  lightboxEl.addEventListener("click", function (e) {
    if (e.target === lightboxEl) closeLightbox();
  });

  // 트로피 카드를 누르면 그 유닛에서 모은 단어 카드 전체를 보여준다.
  function openUnitDetail(trophyRecord) {
    var words = WordCardStore.getUnitWordCards(trophyRecord.unit);
    unitTitleEl.textContent = "🏆 " + WordCardView.unitLabel(trophyRecord) + " 완전정복!";
    unitGridEl.innerHTML = "";
    words.forEach(function (record) {
      var el = WordCardView.cardEl(record);
      el.addEventListener("click", function () {
        openLightbox(record);
      });
      unitGridEl.appendChild(el);
    });
    unitLightboxEl.classList.add("open");
  }

  function closeUnitDetail() {
    unitLightboxEl.classList.remove("open");
  }

  unitLightboxCloseBtn.addEventListener("click", closeUnitDetail);
  unitLightboxEl.addEventListener("click", function (e) {
    if (e.target === unitLightboxEl) closeUnitDetail();
  });

  function renderGames() {
    var credits = typeof WordGameStore !== "undefined" ? WordGameStore.syncCredits() : 0;
    gameCreditsEl.textContent = typeof WordGameStore !== "undefined" ? WordGameStore.getCreditsLabel() : String(credits);

    // 기회가 있어도, 오늘 단어 1세트를 먼저 끝내야 게임을 열어준다.
    var studiedToday = typeof WordGameStore !== "undefined" ? WordGameStore.hasStudiedTodayForGames() : false;
    var unlocked = credits > 0 && studiedToday;

    gamesLockedEl.hidden = unlocked;
    gamesGridEl.hidden = !unlocked;

    if (!unlocked) {
      if (credits > 0 && !studiedToday) {
        gamesLockedTitleEl.textContent = "🔒 오늘 공부를 먼저 끝내야 해요.";
        gamesLockedHintEl.innerHTML = "단어 1세트를<br>오늘 안에 끝내면 게임이 열려요!";
      } else {
        gamesLockedTitleEl.textContent = "🔒 아직 게임 기회가 없어요.";
        gamesLockedHintEl.innerHTML = "트로피 카드를 모으거나<br>복습에서 별 스티커를 모아보세요!";
      }
    }
  }

  function render() {
    if (currentTab === "games") {
      statLineEl.hidden = true;
      emptyEl.hidden = true;
      gridEl.hidden = true;
      gamesPanelEl.hidden = false;
      renderGames();
      return;
    }

    statLineEl.hidden = false;
    gamesPanelEl.hidden = true;

    var pending = WordCardStore.getPendingWords();
    var isTrophyTab = currentTab === "trophies";
    var cards = (isTrophyTab ? WordCardStore.getTrophyCards() : WordCardStore.getInProgressCards())
      .slice()
      .reverse();

    countLabelEl.textContent = isTrophyTab ? "개 유닛을 완전정복했어요" : "개 모았어요";
    if (isTrophyTab) {
      emptyLine1El.textContent = "아직 완전정복한 유닛이 없어요.";
      emptyLine2El.textContent = "한 유닛의 단어를 모두 모으면 트로피 카드를 받아요!";
    } else {
      emptyLine1El.textContent = "아직 모으는 중인 단어 카드가 없어요.";
      emptyLine2El.textContent = "1~4번 공부를 끝내면 카드를 한 장씩 받아요!";
    }

    countEl.textContent = String(cards.length);
    emptyEl.hidden = cards.length > 0;
    gridEl.hidden = cards.length === 0;

    gridEl.innerHTML = "";
    cards.forEach(function (record) {
      var isNew = pending.indexOf(String(record.word || "").toLowerCase()) !== -1;
      var el = WordCardView.cardEl(record, { isNew: isNew });
      el.addEventListener("click", function () {
        if (record.isTrophy && !record.journeysTrophy) {
          openUnitDetail(record);
        } else {
          openLightbox(record);
        }
      });
      gridEl.appendChild(el);
    });

    WordCardStore.clearPending();
  }

  function activateTab(tab) {
    currentTab = tab;
    tabWordsBtn.classList.toggle("active", tab === "words");
    tabWordsBtn.setAttribute("aria-selected", tab === "words" ? "true" : "false");
    tabTrophiesBtn.classList.toggle("active", tab === "trophies");
    tabTrophiesBtn.setAttribute("aria-selected", tab === "trophies" ? "true" : "false");
    tabGamesBtn.classList.toggle("active", tab === "games");
    tabGamesBtn.setAttribute("aria-selected", tab === "games" ? "true" : "false");
    render();
  }

  tabWordsBtn.addEventListener("click", function () {
    activateTab("words");
  });
  tabTrophiesBtn.addEventListener("click", function () {
    activateTab("trophies");
  });
  tabGamesBtn.addEventListener("click", function () {
    activateTab("games");
  });

  function startGame(url) {
    if (typeof WordGameStore === "undefined" || !WordGameStore.spendCredit()) return;
    window.location.href = url;
  }

  gameTetrisBtn.addEventListener("click", function () {
    startGame("tetris.html");
  });
  gameSudokuBtn.addEventListener("click", function () {
    startGame("sudoku.html");
  });
  gameCrosswordBtn.addEventListener("click", function () {
    startGame("crossword.html");
  });

  activateTab("words");
  window.__haingRenderWordCards = render;
})();
