(function () {
  "use strict";

  function currentUnitParam() {
    var unit = DataStore.getCurrentUnit();
    return unit ? "?unit=" + encodeURIComponent(unit) : "";
  }

  function renderCards() {
    var suffix = currentUnitParam();
    var cards = document.querySelectorAll(".home-card[data-step]");
    cards.forEach(function (card) {
      var step = card.getAttribute("data-step");
      var statusEl = card.querySelector("[data-status]");
      var baseHref = card.getAttribute("data-href") || card.getAttribute("href").split("?")[0];
      card.setAttribute("data-href", baseHref);
      card.setAttribute("href", baseHref + suffix);

      var done = ProgressStore.isDone(step);
      var unlocked = ProgressStore.isUnlocked(step);
      // 스토리북은 이번 주 사진을 올리고 "저장하고 반영하기"를 눌러야만 열린다.
      if (step === "storybook" && !DataStore.hasCustomData()) {
        unlocked = false;
      }

      card.classList.remove("done", "locked");

      if (done) {
        card.classList.add("done");
        statusEl.textContent = "✅ 완료";
      } else if (!unlocked) {
        card.classList.add("locked");
        statusEl.textContent =
          step === "storybook"
            ? "🔒 사진을 올리고 저장해 주세요"
            : "🔒 이전 단계를 먼저 완료하세요";
      } else {
        var progress = ProgressStore.getStepProgress(step);
        if (progress && progress.done > 0 && progress.done < progress.total) {
          var percent = Math.round((progress.done / progress.total) * 100);
          statusEl.textContent =
            "🕓 진행 중 " + progress.done + "/" + progress.total + " (" + percent + "%)";
        } else {
          statusEl.textContent = "▶ 시작하기";
        }
      }
    });
  }

  function openCardLightbox(imageUrl, name) {
    var lightbox = document.getElementById("cardLightbox");
    document.getElementById("cardLightboxImg").src = imageUrl;
    var caption = document.getElementById("cardLightboxName");
    if (caption) caption.textContent = name || "";
    lightbox.classList.add("open");
  }

  (function setupLightbox() {
    var lightbox = document.getElementById("cardLightbox");
    if (!lightbox) return;
    document.getElementById("cardLightboxClose").addEventListener("click", function () {
      lightbox.classList.remove("open");
    });
    lightbox.addEventListener("click", function (e) {
      if (e.target === lightbox) lightbox.classList.remove("open");
    });
  })();

  function renderCardCollection() {
    var section = document.getElementById("cardCollectionSection");
    var collected = CardStore.getCollected();

    document.getElementById("collectionCount").textContent = String(collected.length);
    document.getElementById("collectionTotal").textContent = String(MEMBER_CARDS.length);

    var gridEl = document.getElementById("cardGrid");
    gridEl.innerHTML = "";
    MEMBER_CARDS.forEach(function (member) {
      var isOwned = collected.indexOf(member.id) !== -1;

      var wrap = document.createElement("div");
      wrap.className = "member-card-wrap" + (isOwned ? " owned" : " locked-card");

      var imgEl = document.createElement("img");
      imgEl.className = "member-card";
      imgEl.alt = isOwned ? member.name + " 카드" : "아직 모으지 않은 카드";
      imgEl.src = isOwned ? member.image : buildLockedCardImageUrl();
      wrap.appendChild(imgEl);

      if (isOwned) {
        var nameTag = document.createElement("span");
        nameTag.className = "member-card-name";
        nameTag.textContent = member.name;
        wrap.appendChild(nameTag);

        wrap.addEventListener("click", function () {
          openCardLightbox(member.image, member.name);
        });
      }

      gridEl.appendChild(wrap);
    });

    section.hidden = collected.length === 0;

    var pending = CardStore.getPendingCard();
    var revealEl = document.getElementById("cardReveal");
    if (pending) {
      section.hidden = false;
      revealEl.hidden = false;
      document.getElementById("cardRevealText").textContent =
        "🎉 새 카드 획득! " + pending.name + " (" + pending.gen + ")";
      document.getElementById("cardRevealCloseBtn").addEventListener(
        "click",
        function () {
          CardStore.clearPending();
          revealEl.hidden = true;
        },
        { once: true }
      );
    } else {
      revealEl.hidden = true;
    }
  }

  function renderUnitHistory() {
    var selectEl = document.getElementById("unitHistorySelect");
    var sectionEl = document.getElementById("unitHistorySection");
    if (!selectEl) return;

    var units = DataStore.getAllUnits();

    if (units.length === 0) {
      sectionEl.hidden = true;
      return;
    }
    sectionEl.hidden = false;

    var currentUnit = DataStore.getCurrentUnit();

    selectEl.innerHTML = '<option value="">유닛을 선택하세요</option>';
    units.forEach(function (entry) {
      var option = document.createElement("option");
      option.value = entry.unit;
      var label = entry.unit === "unspecified" ? "이름 없는 자료" : "Unit " + entry.unit;
      option.textContent = label + (entry.unit === currentUnit ? " (현재)" : "");
      selectEl.appendChild(option);
    });
  }

  (function setupUnitHistoryControls() {
    var selectEl = document.getElementById("unitHistorySelect");
    var goBtn = document.getElementById("unitGoBtn");
    var deleteBtn = document.getElementById("unitDeleteBtn");
    if (!selectEl || !goBtn || !deleteBtn) return;

    goBtn.addEventListener("click", function () {
      var chosen = selectEl.value;
      if (!chosen) return;
      DataStore.setCurrentUnit(chosen);
      location.href = "storybook.html?unit=" + encodeURIComponent(chosen);
    });

    deleteBtn.addEventListener("click", function () {
      var chosen = selectEl.value;
      if (!chosen) return;
      var label = chosen === "unspecified" ? "이름 없는 자료" : "Unit " + chosen;
      if (confirm(label + "을(를) 삭제할까요? (모은 카드는 그대로 남아요)")) {
        DataStore.deleteUnit(chosen);
        renderUnitHistory();
        renderCards();
      }
    });
  })();

  var resetAllBtn = document.getElementById("resetAllBtn");
  if (resetAllBtn) {
    resetAllBtn.addEventListener("click", function () {
      if (confirm("이 기기에 저장된 사진, 카드, 진행 상황을 모두 지울까요? 되돌릴 수 없어요.")) {
        localStorage.clear();
        location.reload();
      }
    });
  }

  renderCards();
  renderCardCollection();
  renderUnitHistory();

  window.__haingRenderHome = function () {
    renderCards();
    renderCardCollection();
    renderUnitHistory();
  };
})();
