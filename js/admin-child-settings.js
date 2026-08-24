// 관리자 탭의 "계정 비밀번호" / "게임 기회 관리" 두 섹션을 그린다. 둘 다 특정
// 아이 하나가 아니라 하정/하진 모두를 대상으로 다루는 화면이라 ChildStore.getActive()에
// 기대지 않고 각 아이 id를 직접 다룬다.
(function () {
  "use strict";

  var pinListEl = document.getElementById("adminChildPinList");
  var creditListEl = document.getElementById("adminGameCreditsList");
  if (typeof ChildStore === "undefined") return;

  // 아이 비밀번호는 이제 로그인 화면(이름을 누를 때)에서 직접 설정한다 - 여기서는
  // 잊어버렸을 때 지워주는 것만 한다(지우면 다음 로그인 때 다시 설정할 수 있음).
  function renderPinList() {
    if (!pinListEl || typeof ChildAuthStore === "undefined") return;
    pinListEl.innerHTML = "";

    ChildStore.CHILDREN.forEach(function (child) {
      var row = document.createElement("div");
      row.className = "admin-child-settings-row";

      var label = document.createElement("span");
      label.className = "admin-child-settings-name";
      label.textContent = child.zodiacEmoji + " " + child.name;

      var status = document.createElement("span");
      status.className = "admin-child-settings-status";
      var hasPin = ChildAuthStore.hasPin(child.id);
      status.textContent = hasPin ? "🔒 설정됨" : "설정 안 됨";

      var clearBtn = document.createElement("button");
      clearBtn.type = "button";
      clearBtn.className = "danger-btn";
      clearBtn.textContent = "비밀번호 지우기";
      clearBtn.hidden = !hasPin;
      clearBtn.addEventListener("click", function () {
        if (confirm(child.name + "의 비밀번호를 지울까요? 다음 로그인 때 다시 설정할 수 있어요.")) {
          ChildAuthStore.setPin(child.id, "");
          renderPinList();
        }
      });

      row.appendChild(label);
      row.appendChild(status);
      row.appendChild(clearBtn);
      pinListEl.appendChild(row);
    });
  }

  // 관리자 탭 자체를 지키는 비밀번호. 관리자 탭 안(=이미 인증된 상태)에서만
  // 바꿀 수 있으니 예전 비밀번호를 다시 물어보지 않는다.
  function setupAdminPinControls() {
    var input = document.getElementById("adminPinChangeInput");
    var saveBtn = document.getElementById("adminPinChangeSaveBtn");
    var clearBtn = document.getElementById("adminPinChangeClearBtn");
    if (!input || !saveBtn || !clearBtn || typeof AdminAuthStore === "undefined") return;

    saveBtn.addEventListener("click", function () {
      if (!input.value) return;
      AdminAuthStore.setPin(input.value);
      input.value = "";
      alert("관리자 비밀번호를 저장했어요.");
    });

    clearBtn.addEventListener("click", function () {
      if (confirm("관리자 비밀번호를 없앨까요? 다음부터는 관리자 탭에 비밀번호 없이 들어올 수 있어요.")) {
        AdminAuthStore.setPin("");
        input.value = "";
      }
    });
  }

  var GAME_LABELS = { tetris: "🧱 테트리스", sudoku: "🔢 스도쿠", crossword: "📝 가로세로 낱말" };

  function pad2(n) {
    return n < 10 ? "0" + n : String(n);
  }

  function formatSpentAt(ts) {
    var d = new Date(ts);
    return (d.getMonth() + 1) + "/" + d.getDate() + " " + pad2(d.getHours()) + ":" + pad2(d.getMinutes());
  }

  function buildGameRow(child, game) {
    var row = document.createElement("div");
    row.className = "admin-credits-game-row";

    var label = document.createElement("span");
    label.className = "admin-credits-game-label";
    label.textContent = GAME_LABELS[game];
    row.appendChild(label);

    var minusBtn = document.createElement("button");
    minusBtn.type = "button";
    minusBtn.className = "secondary-btn admin-credits-step-btn";
    minusBtn.textContent = "-1";
    minusBtn.addEventListener("click", function () {
      WordGameStore.adminAdjustGameCredit(child.id, game, -1);
      renderCreditsList();
    });
    row.appendChild(minusBtn);

    var count = document.createElement("span");
    count.className = "admin-credits-game-count";
    count.textContent = WordGameStore.getCreditsForChildByGame(child.id, game) + "회";
    row.appendChild(count);

    var plusBtn = document.createElement("button");
    plusBtn.type = "button";
    plusBtn.className = "secondary-btn admin-credits-step-btn";
    plusBtn.textContent = "+1";
    plusBtn.addEventListener("click", function () {
      WordGameStore.adminAdjustGameCredit(child.id, game, 1);
      renderCreditsList();
    });
    row.appendChild(plusBtn);

    return row;
  }

  // 최근에 어느 게임을 언제 썼는지 - 기본은 접혀 있고 눌러야 펼쳐진다(평소엔 안 봐도 되는 정보라).
  function buildHistorySection(child) {
    var wrap = document.createElement("div");
    wrap.className = "admin-credits-history";

    var toggleBtn = document.createElement("button");
    toggleBtn.type = "button";
    toggleBtn.className = "secondary-btn admin-credits-history-toggle";
    toggleBtn.textContent = "🕘 사용 기록 보기";

    var list = document.createElement("div");
    list.className = "admin-credits-history-list";
    list.hidden = true;

    var log = WordGameStore.getSpendLogForChild(child.id).slice().reverse();
    if (log.length === 0) {
      var empty = document.createElement("p");
      empty.className = "hint";
      empty.textContent = "아직 사용 기록이 없어요.";
      list.appendChild(empty);
    } else {
      log.forEach(function (entry) {
        var line = document.createElement("p");
        line.className = "admin-credits-history-line";
        line.textContent = formatSpentAt(entry.spentAt) + " · " + (GAME_LABELS[entry.game] || entry.game);
        list.appendChild(line);
      });
    }

    toggleBtn.addEventListener("click", function () {
      list.hidden = !list.hidden;
      toggleBtn.textContent = list.hidden ? "🕘 사용 기록 보기" : "🕘 사용 기록 숨기기";
    });

    wrap.appendChild(toggleBtn);
    wrap.appendChild(list);
    return wrap;
  }

  function renderCreditsList() {
    if (!creditListEl || typeof WordGameStore === "undefined") return;
    creditListEl.innerHTML = "";

    ChildStore.CHILDREN.forEach(function (child) {
      var card = document.createElement("div");
      card.className = "admin-credits-child-card";

      var heading = document.createElement("div");
      heading.className = "admin-credits-child-heading";
      heading.textContent = child.zodiacEmoji + " " + child.name;
      card.appendChild(heading);

      WordGameStore.GAMES.forEach(function (game) {
        card.appendChild(buildGameRow(child, game));
      });

      card.appendChild(buildHistorySection(child));

      creditListEl.appendChild(card);
    });
  }

  renderPinList();
  renderCreditsList();
  setupAdminPinControls();

  window.__haingRenderAdminChildSettings = function () {
    renderPinList();
    renderCreditsList();
  };
})();
