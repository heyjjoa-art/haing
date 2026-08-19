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

  // 도감 버튼에 지금까지 모은 단어 카드 수를 보여준다. 자세한 목록은 wordcards.html에서.
  function renderWordCardLink() {
    var linkEl = document.getElementById("wordCardLink");
    if (!linkEl) return;
    linkEl.textContent = "📔 단어 도감 (" + WordCardStore.getCount() + ")";
  }

  function renderUnitHistory() {
    var selectEl = document.getElementById("unitHistorySelect");
    var sectionEl = document.getElementById("unitHistorySection");
    var goBtn = document.getElementById("unitGoBtn");
    if (!selectEl) return;

    var units = DataStore.getAllUnits();

    if (units.length === 0) {
      // 유닛이 하나도 없어도 지금까지 모은 단어 카드가 있으면 도감 버튼은 보여준다.
      sectionEl.hidden = WordCardStore.getCount() === 0;
      selectEl.disabled = true;
      goBtn.disabled = true;
      return;
    }

    selectEl.disabled = false;
    goBtn.disabled = false;
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

  // 유닛 삭제는 관리자 탭에서만 한다 - 여기서는 이동만 가능하다.
  (function setupUnitHistoryControls() {
    var selectEl = document.getElementById("unitHistorySelect");
    var goBtn = document.getElementById("unitGoBtn");
    if (!selectEl || !goBtn) return;

    goBtn.addEventListener("click", function () {
      var chosen = selectEl.value;
      if (!chosen) return;
      DataStore.setCurrentUnit(chosen);
      location.href = "storybook.html?unit=" + encodeURIComponent(chosen);
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
  renderWordCardLink();
  renderUnitHistory();

  window.__haingRenderHome = function () {
    renderCards();
    renderWordCardLink();
    renderUnitHistory();
  };
})();
