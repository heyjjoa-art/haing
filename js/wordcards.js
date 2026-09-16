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
  var wcGamedexEl = document.getElementById("wcGamedex");
  // 아직 게임 기회 시스템에 연결되지 않은 개발 중 게임 6개 - 관리자로
  // 로그인했을 때만 보여준다(정식 오픈되면 다른 게임들처럼 data-game 속성을
  // 붙이고 이 목록에서 뺀다).
  var gameBreakoutBtn = document.getElementById("wcGameBreakout");
  var gameMazeBtn = document.getElementById("wcGameMaze");
  var gamePacmanBtn = document.getElementById("wcGamePacman");
  var gameBlocksBtn = document.getElementById("wcGameBlocks");
  var gamePowerBtn = document.getElementById("wcGamePower");
  var gameFlagBtn = document.getElementById("wcGameFlag");

  var lightboxEl = document.getElementById("wcLightbox");
  var lightboxBodyEl = document.getElementById("wcLightboxBody");
  var lightboxCloseBtn = document.getElementById("wcLightboxClose");
  var lightboxReplayBtn = document.getElementById("wcLightboxReplayBtn");

  var unitLightboxEl = document.getElementById("wcUnitLightbox");
  var unitTitleEl = document.getElementById("wcUnitDetailTitle");
  var unitGridEl = document.getElementById("wcUnitDetailGrid");
  var unitLightboxCloseBtn = document.getElementById("wcUnitLightboxClose");

  var currentTab = "words"; // "words" | "trophies" | "games"

  // 성장 레벨(GrowthStore)은 2026-08-27 16:48에 생겨서, 그 전날 하루(2026-08-27
  // 00:00~16:48) 동안 이미 한 게임 플레이는 XP로 못 셌다. WordGameStore의 소비
  // 로그({game, spentAt}, 최근 30건)에 그 시간대 기록이 남아있으니, 딱 그 구간만
  // 한 번씩 GrowthStore에 채워 넣는다. 그 이후(실기록 시작 이후) 기록은 당시
  // startGame()에서 이미 실시간으로 recordPlay가 불렸으므로 다시 넣으면 중복
  // 카운트가 되어 여기서는 건드리지 않는다. 아이별 1회 실행 후 플래그로 막아둔다.
  (function backfillYesterdayGrowthPlays() {
    if (typeof WordGameStore === "undefined" || typeof GrowthStore === "undefined") return;
    if (typeof ChildStore === "undefined") return;
    var FROM = new Date(2026, 7, 27, 0, 0, 0).getTime();
    var LIVE_SINCE = new Date(2026, 7, 27, 16, 48, 48).getTime();
    ChildStore.CHILDREN.forEach(function (child) {
      var flagKey = "haingGrowthBackfilled20260827_" + child.id;
      if (localStorage.getItem(flagKey)) return;
      var log = WordGameStore.getSpendLogForChild(child.id) || [];
      log.forEach(function (entry) {
        if (entry.spentAt >= FROM && entry.spentAt < LIVE_SINCE) {
          GrowthStore.recordPlay(child.id, entry.game);
        }
      });
      localStorage.setItem(flagKey, "1");
    });
  })();

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
    unitTitleEl.textContent = "🏆 " + WordCardView.unitLabel(trophyRecord) + " 단어정복!";
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
    gameCreditsEl.textContent = typeof WordGameStore !== "undefined" ? WordGameStore.getTotalCreditsLabel() : String(credits);

    // 기회가 있어도, 오늘 단어 1세트를 먼저 끝내야 게임을 열어준다.
    var studiedToday = typeof WordGameStore !== "undefined" ? WordGameStore.hasStudiedTodayForGames() : false;
    var unlocked = credits > 0 && studiedToday;

    gamesLockedEl.hidden = unlocked;
    gamesGridEl.hidden = !unlocked;

    if (!unlocked) {
      if (credits > 0 && !studiedToday) {
        var isWeekend = typeof WordGameStore !== "undefined" && WordGameStore.isWeekendToday && WordGameStore.isWeekendToday();
        gamesLockedTitleEl.textContent = "🔒 오늘 공부를 먼저 끝내야 해요.";
        gamesLockedHintEl.innerHTML = isWeekend
          ? "단어 1세트를<br>오늘 안에 끝내면 게임이 열려요!"
          : "저니스 1세트, 단어 1세트를<br>오늘 안에 끝내면 게임이 열려요!";
      } else {
        gamesLockedTitleEl.textContent = "🔒 아직 게임 기회가 없어요.";
        gamesLockedHintEl.innerHTML = "트로피 카드를 모으거나<br>복습에서 별 스티커를 모아보세요!";
      }
    } else {
      // 게임별로 남은 기회를 따로 보여주고, 그 게임 몫이 0이면 버튼을 눌러도
      // 못 들어가게 막는다(다른 게임에 기회가 남아있어도 이 게임엔 못 씀).
      // data-game이 붙은 타일(테트리스/스도쿠/가로세로 낱말 + 새로 정식
      // 오픈된 게임들)은 이 아이에게 "열린 게임"일 때만 보여준다 - 다음에
      // 게임을 더 열 때도 이 로직과 HTML은 그대로 두고 관리자 화면에서
      // opened 목록만 늘리면 된다.
      var opened = WordGameStore.getOpenedGames();
      gamesGridEl.querySelectorAll("[data-game]").forEach(function (tile) {
        var game = tile.getAttribute("data-game");
        var isOpen = opened.indexOf(game) !== -1;
        tile.hidden = !isOpen;
        if (!isOpen) return;
        var badge = tile.querySelector(".wc-game-credits");
        if (badge) badge.textContent = WordGameStore.getCreditsLabel(game) + "회";
        var left = WordGameStore.getCredits(game);
        tile.disabled = left !== Infinity && left <= 0;
      });
    }

    // 벽돌깨기 / 미로찾기 / 팩맨 / 쌓기나무 / 구구단 스네이크 / 청기백기는
    // 아직 게임 기회 시스템에 연결 안 된 개발 중 게임 - 관리자로 로그인했을
    // 때만 카드 자체를 보여준다(아이 계정에는 항상 숨김).
    var isAdmin = typeof AdminAuthStore !== "undefined" && AdminAuthStore.isActive();
    gameBreakoutBtn.hidden = !isAdmin;
    gameMazeBtn.hidden = !isAdmin;
    gamePacmanBtn.hidden = !isAdmin;
    gameBlocksBtn.hidden = !isAdmin;
    gamePowerBtn.hidden = !isAdmin;
    gameFlagBtn.hidden = !isAdmin;

    renderGameDex();
  }

  // 게임 도감 - "게임을 열었는지"가 아니라 "그 게임을 몇 번 했는지"로 칸을
  // 채운다. 이 아이가 실제로 크레딧을 소비(spendCredit)할 때마다
  // WordGameStore가 그 게임의 판 수(dex)를 늘리고, 그 판 수로 레벨을 매긴다
  // (WordGameStore.getDexLevel) - 게임마다 따로 레벨이 쌓인다.
  function renderGameDex() {
    if (!wcGamedexEl || typeof WordGameStore === "undefined") return;
    var opened = WordGameStore.getOpenedGames();
    var dex = WordGameStore.getDex();
    wcGamedexEl.innerHTML = "";
    WordGameStore.GAME_REGISTRY.forEach(function (meta) {
      var isOpen = opened.indexOf(meta.key) !== -1;
      var plays = dex[meta.key] || 0;
      var level = WordGameStore.getDexLevel(meta.key);

      var slot = document.createElement("div");
      slot.className = "wc-gamedex-slot";
      slot.classList.add(!isOpen ? "wc-gamedex-slot--locked" : plays > 0 ? "wc-gamedex-slot--played" : "wc-gamedex-slot--unplayed");

      var icon = document.createElement("span");
      icon.className = "wc-gamedex-icon";
      icon.textContent = isOpen ? meta.emoji : "🔒";
      slot.appendChild(icon);

      var label = document.createElement("span");
      label.className = "wc-gamedex-label";
      label.textContent = isOpen && level > 0 ? "Lv." + level + " · " + plays + "판" : meta.label;
      slot.appendChild(label);

      wcGamedexEl.appendChild(slot);
    });
  }

  // 게임 기회를 받은 순간 바로 팝업을 못 띄울 수 있어(다른 팝업과 겹치는
  // 경로) WordGameStore에 쌓아뒀던 알림을 꺼내 보여준다. 어느 탭에서 이
  // 함수가 불리든(단어/트로피/게임) 밀린 알림이 있으면 그때 보여준다.
  function showPendingGameAnnouncements() {
    if (typeof WordGameStore === "undefined" || typeof GameGrantPopup === "undefined") return;
    var pending = WordGameStore.consumePendingAnnouncements();
    pending.forEach(function (entry) {
      GameGrantPopup.show(entry.games);
    });
  }

  function render() {
    // 어느 탭을 보고 있든, 밀려있는 게임 지급 알림(트로피/별 마일스톤)이
    // 있으면 여기서 한 번 보여준다 - 단어 카드 탭을 먼저 열어도 놓치지 않는다.
    showPendingGameAnnouncements();

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
        if (record.isTrophy && !record.journeysTrophy && !record.rainbowCard) {
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

  function startGame(url, game) {
    if (typeof WordGameStore === "undefined" || !WordGameStore.spendCredit(game)) return;
    // 성장 레벨(브론즈~다이아몬드) XP는 공부 활동이 아니라 "게임을 실제로 한 판
    // 시작한 횟수"로만 쌓는다 - 크레딧을 쓰는 이 시점이 곧 그 순간이다.
    if (typeof GrowthStore !== "undefined" && typeof ChildStore !== "undefined") {
      GrowthStore.recordPlay(ChildStore.getActive(), game);
    }
    window.location.href = url;
  }

  // 게임 기회 시스템에 연결된 타일(data-game 속성이 붙은 것)은 한 핸들러로
  // 처리한다 - 새 게임이 더 열려도 여기는 그대로 두고 HTML에 data-game만
  // 붙이면 된다.
  gamesGridEl.addEventListener("click", function (e) {
    var tile = e.target.closest("[data-game]");
    if (!tile || tile.disabled) return;
    var game = tile.getAttribute("data-game");
    var meta = typeof WordGameStore !== "undefined" ? WordGameStore.getGame(game) : null;
    if (!meta) return;
    startGame(meta.url, game);
  });

  gameBreakoutBtn.addEventListener("click", function () {
    window.location.href = "breakout.html";
  });
  gameMazeBtn.addEventListener("click", function () {
    window.location.href = "maze.html";
  });
  gamePacmanBtn.addEventListener("click", function () {
    window.location.href = "pacman.html";
  });
  gameBlocksBtn.addEventListener("click", function () {
    window.location.href = "blocks.html";
  });
  gamePowerBtn.addEventListener("click", function () {
    window.location.href = "power.html";
  });
  gameFlagBtn.addEventListener("click", function () {
    window.location.href = "flag.html";
  });

  // 게임을 끝내고 "도감으로" 돌아올 때(?tab=games) 단어 탭이 아니라 게임 목록
  // 탭이 바로 보이게 한다 - 게임 하나 끝내고 다른 게임을 고르려는 건데 매번 단어
  // 탭에서 다시 게임 탭을 눌러야 하면 번거롭다.
  var initialTab = new URLSearchParams(location.search).get("tab") === "games" ? "games" : "words";
  activateTab(initialTab);
  window.__haingRenderWordCards = render;
})();
