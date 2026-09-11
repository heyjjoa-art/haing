// 관리자 > 학습 > 계정 탭의 "게임 공개" 섹션. 아이별로 2026-08-24부터 오늘까지
// 저니스+단어를 둘 다 완료한 날이 며칠인지 세어서 보여주고, 관리자가 그 숫자를
// 보고 직접 게임을 열어준다 - "며칠이면 자동으로 연다" 같은 규칙은 코드에 없다.
// 다음 달에 3개를 더 열 때도 기준이 다시 정해질 수 있어서다.
(function () {
  "use strict";

  var listEl = document.getElementById("adminGameOpenList");
  if (!listEl) return;
  if (typeof ChildStore === "undefined" || typeof WordGameStore === "undefined") return;

  // 이번 1차 공개를 위해 세는 시작일(2026-08-24, 이번 공개 한정 값). 다음
  // 공개 때 기준일이 달라지면 이 상수도 그때 새로 맞추면 된다 - 계산 로직
  // 자체는 그대로 재사용할 수 있다.
  var COUNT_START_DATE = new Date(2026, 7, 24);
  var PROMOTED_GAMES = ["smileyfind", "hanoi", "snake"];

  var dataReady = false;

  function pad2(n) {
    return n < 10 ? "0" + n : String(n);
  }

  function dateStr(d) {
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
  }

  // COUNT_START_DATE부터 오늘까지 하루씩, 저니스+단어를 둘 다 끝낸 날짜만 골라
  // 돌려준다. admin-glance.js의 학습달력과 같은 두 조건(StampStore.isDayCompleteFor
  // + ProgressStore.isWordDoneForDay)을 그대로 쓴다.
  function computeBothDays(childId) {
    var days = [];
    var cur = new Date(COUNT_START_DATE.getTime());
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    while (cur <= today) {
      var ds = dateStr(cur);
      var wordDone = typeof ProgressStore !== "undefined" && ProgressStore.isWordDoneForDay(childId, ds);
      var journeyDone = typeof StampStore !== "undefined" && StampStore.isDayCompleteFor(childId, ds);
      if (wordDone && journeyDone) days.push(ds);
      cur.setDate(cur.getDate() + 1);
    }
    return days;
  }

  function buildGameToggles(child) {
    var wrap = document.createElement("div");
    wrap.className = "admin-game-open-toggles";
    WordGameStore.GAME_REGISTRY.forEach(function (meta) {
      var row = document.createElement("label");
      row.className = "admin-game-open-toggle-row";

      var checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = WordGameStore.isOpened(child.id, meta.key);
      checkbox.addEventListener("change", function () {
        WordGameStore.adminSetGameOpened(child.id, meta.key, checkbox.checked);
      });
      row.appendChild(checkbox);

      var label = document.createElement("span");
      label.textContent = meta.emoji + " " + meta.label;
      row.appendChild(label);

      wrap.appendChild(row);
    });
    return wrap;
  }

  function buildChildCard(child) {
    var card = document.createElement("div");
    card.className = "admin-credits-child-card";

    var heading = document.createElement("div");
    heading.className = "admin-credits-child-heading";
    heading.textContent = child.zodiacEmoji + " " + child.name;
    card.appendChild(heading);

    var bothDays = computeBothDays(child.id);
    var countLine = document.createElement("p");
    countLine.className = "hint";
    countLine.textContent = dataReady
      ? "2026-08-24부터 지금까지 둘 다 완료한 날: " + bothDays.length + "일"
      : "2026-08-24부터 지금까지 둘 다 완료한 날: 불러오는 중…";
    card.appendChild(countLine);

    if (dataReady && bothDays.length > 0) {
      var datesLine = document.createElement("p");
      datesLine.className = "admin-game-open-dates";
      datesLine.textContent = bothDays.join(", ");
      card.appendChild(datesLine);
    }

    var alreadyOpen = PROMOTED_GAMES.every(function (g) {
      return WordGameStore.isOpened(child.id, g);
    });

    var openBtn = document.createElement("button");
    openBtn.type = "button";
    openBtn.className = "secondary-btn";
    openBtn.textContent = alreadyOpen ? "🔓 이미 열려 있어요" : "🔓 해피피·하노이·스네이크 열어주기";
    openBtn.disabled = !dataReady || alreadyOpen;
    openBtn.addEventListener("click", function () {
      if (!window.confirm(child.name + "에게 해피피 찾기·하노이의 탑·스네이크를 열어줄까요?")) return;
      PROMOTED_GAMES.forEach(function (game) {
        WordGameStore.adminSetGameOpened(child.id, game, true);
      });
      render();
    });
    card.appendChild(openBtn);

    var togglesTitle = document.createElement("p");
    togglesTitle.className = "hint";
    togglesTitle.textContent = "게임별 열림/닫힘 (다음 공개 때도 여기서 켜고 끄면 돼요)";
    card.appendChild(togglesTitle);
    card.appendChild(buildGameToggles(child));

    return card;
  }

  function render() {
    listEl.innerHTML = "";
    ChildStore.CHILDREN.forEach(function (child) {
      listEl.appendChild(buildChildCard(child));
    });
  }

  render();

  // 비활성 아이(지금 로그인 안 한 쪽)는 클라우드에서 데이터를 받아오는 동안
  // 순간적으로 0일로 보일 수 있어, 성급하게 버튼을 누르지 못하도록 잠깐은
  // 버튼을 막아둔다. progress-store.js가 데이터를 늦게 받아오면
  // window.__haingRenderAdminGlance를 부르므로 여기도 체이닝해서 같이
  // 다시 그리고, 혹시 그 신호를 못 받는 경우를 대비해 고정 지연 후에도
  // 한 번 더 그린다.
  var prevRenderAdminGlance = window.__haingRenderAdminGlance;
  window.__haingRenderAdminGlance = function () {
    if (prevRenderAdminGlance) prevRenderAdminGlance();
    render();
  };

  setTimeout(function () {
    dataReady = true;
    render();
  }, 1500);

  window.__haingRenderAdminGameOpen = render;
})();
