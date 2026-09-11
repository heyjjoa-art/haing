// 게임 기회를 받았을 때 어떤 게임을 받았는지 알려주는 팝업. 단어카드 전용인
// WordCardPopup(카드가 없으면 아예 안 뜨고, 항상 WordCardView.cardEl을 그림)은
// 게임 팝업에 맞지 않아서 재사용할 수 없지만, 같은 CSS 클래스(css/word-card.css의
// .wc-popup-*)를 그대로 써서 시각적으로는 통일감을 유지한다.
var GameGrantPopup = (function () {
  function gameLabelWithEmoji(key) {
    var meta = typeof WordGameStore !== "undefined" ? WordGameStore.getGame(key) : null;
    return meta ? meta.emoji + " " + meta.label : key;
  }

  function gameChip(key) {
    var chip = document.createElement("span");
    chip.className = "wc-popup-game-chip";
    chip.textContent = gameLabelWithEmoji(key);
    return chip;
  }

  // games: 지급된 게임 키 배열(하루 1회는 1개, 트로피/별/도감 보너스는 3개).
  // kind: "daily"(오늘 할 일을 다 끝낸 날 1회) | "milestone"(트로피/별/저니스
  // 3회) | "dex"(게임 도감 완성 보너스 3회) - 문구만 다르고 구조는 같다.
  function show(games, kind) {
    if (!games || games.length === 0) return;

    var overlay = document.createElement("div");
    overlay.className = "wc-popup-overlay";

    var box = document.createElement("div");
    box.className = "wc-popup-box";

    if (kind === "daily") {
      // 저니스 + 단어를 오늘 둘 다 끝낸 바로 그 순간에만 뜨는 팝업이라,
      // 칭찬을 먼저 하고 그 아래 큰 글씨로 오늘 받은 게임을 공개한다.
      var praiseEl = document.createElement("p");
      praiseEl.className = "wc-popup-title";
      praiseEl.textContent = "오늘 할 일 다 했어요! 정말 잘했어요 🎉";
      box.appendChild(praiseEl);

      var revealEl = document.createElement("p");
      revealEl.className = "wc-popup-title-lg";
      revealEl.textContent = "오늘의 게임: " + gameLabelWithEmoji(games[0]) + " 1회!";
      box.appendChild(revealEl);

      var subtitleEl = document.createElement("p");
      subtitleEl.className = "wc-popup-subtitle";
      subtitleEl.textContent = "내일도 둘 다 끝내면 또 하나 열려요.";
      box.appendChild(subtitleEl);
    } else {
      // 트로피/별/저니스 마일스톤은 그 카드 팝업 자체가 이미 축하하는
      // 순간이라 여기서는 칭찬 문구 없이 받은 게임만 보여준다.
      var titleEl = document.createElement("p");
      titleEl.className = "wc-popup-title-lg";
      titleEl.textContent = kind === "dex"
        ? "🎉 게임 도감 완성! 보너스 " + games.length + "회!"
        : "🎮 게임 기회 " + games.length + "회!";
      box.appendChild(titleEl);

      var chipsWrap = document.createElement("div");
      chipsWrap.className = "wc-popup-games";
      games.forEach(function (g) {
        chipsWrap.appendChild(gameChip(g));
      });
      box.appendChild(chipsWrap);
    }

    var confirmBtn = document.createElement("button");
    confirmBtn.type = "button";
    confirmBtn.className = "wc-popup-btn";
    confirmBtn.textContent = "게임 하러 가기";
    confirmBtn.addEventListener("click", function () {
      overlay.remove();
      window.location.href = "wordcards.html?tab=games";
    });
    box.appendChild(confirmBtn);

    overlay.appendChild(box);
    document.body.appendChild(overlay);
  }

  return { show: show };
})();
