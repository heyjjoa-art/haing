(function () {
  "use strict";

  function currentUnitParam() {
    var unit = DataStore.getCurrentUnit();
    return unit ? "?unit=" + encodeURIComponent(unit) : "";
  }

  function renderCards() {
    var suffix = currentUnitParam();
    // 초등 단어장 단계(초등1, 초등2...)는 본문이 없어서 스토리북 카드 자체를 숨기고
    // 2~4번(단어 학습 · 매칭 · 스펠링)만 보여준다.
    var isElementary = DataStore.isElementaryUnit();
    var cards = document.querySelectorAll(".home-card[data-step]");
    var guideEl = document.getElementById("stepGuideText");
    if (guideEl) {
      guideEl.textContent = isElementary
        ? "📌 순서대로 완료하면 다음 단계가 열려요!"
        : "📌 1번부터 순서대로 완료하면 다음 단계가 열려요!";
    }

    cards.forEach(function (card) {
      var step = card.getAttribute("data-step");

      if (step === "storybook") {
        // .home-card가 display:flex를 지정해서 hidden 속성만으로는 안 숨겨진다.
        card.hidden = isElementary;
        card.style.display = isElementary ? "none" : "";
        if (isElementary) return;
      } else {
        card.hidden = false;
        card.style.display = "";
      }

      var statusEl = card.querySelector("[data-status]");
      var baseHref = card.getAttribute("data-href") || card.getAttribute("href").split("?")[0];
      card.setAttribute("data-href", baseHref);
      card.setAttribute("href", baseHref + suffix);

      var done = ProgressStore.isDone(step);
      var unlocked = ProgressStore.isUnlocked(step);
      // 스토리북은 이번 주 단어/본문이 채워져야만 열린다(사진만 올라온 상태로는 안 열림).
      if (step === "storybook" && !DataStore.hasCustomData()) {
        unlocked = false;
      }

      card.classList.remove("done", "locked");

      // 잠금 여부를 완료 배지보다 먼저 본다 - 한 번 완주한 유닛도(=복습 모드) 이번
      // 복습 한 바퀴에서 이전 단계를 안 밟았으면 순서대로 잠겨 있어야 한다.
      if (!unlocked) {
        card.classList.add("locked");
        statusEl.textContent =
          step === "storybook"
            ? "🔒 아직 단어·본문이 준비되지 않았어요"
            : "🔒 이전 단계를 먼저 완료하세요";
      } else if (done) {
        card.classList.add("done");
        statusEl.textContent = "✅ 완료";
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
    linkEl.textContent = "📔 내가 획득한 단어 도감 (" + WordCardStore.getCount() + ")";
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

  // 초등 필수 단어 단계 선택 목록 - 매주 올리는 유닛과 달리 항상 고정으로 존재한다.
  function renderElementaryLevels() {
    var selectEl = document.getElementById("elementaryLevelSelect");
    var sectionEl = document.getElementById("elementaryLevelSection");
    if (!selectEl || !sectionEl) return;

    var levels = DataStore.getElementaryLevels();
    if (levels.length === 0) {
      sectionEl.hidden = true;
      return;
    }

    sectionEl.hidden = false;
    var currentUnit = DataStore.getCurrentUnit();

    selectEl.innerHTML = '<option value="">단계를 선택하세요</option>';
    levels.forEach(function (entry) {
      var option = document.createElement("option");
      option.value = entry.level;
      option.textContent = entry.level + " (" + entry.count + "개)" + (entry.level === currentUnit ? " (현재)" : "");
      selectEl.appendChild(option);
    });
  }

  // 초등 단계는 본문이 없어서 스토리북이 아니라 바로 단어 학습(2번)으로 보낸다.
  (function setupElementaryLevelControls() {
    var selectEl = document.getElementById("elementaryLevelSelect");
    var goBtn = document.getElementById("elementaryLevelGoBtn");
    if (!selectEl || !goBtn) return;

    goBtn.addEventListener("click", function () {
      var chosen = selectEl.value;
      if (!chosen) return;
      DataStore.setCurrentUnit(chosen);
      location.href = "flashcards.html?unit=" + encodeURIComponent(chosen);
    });
  })();

  renderCards();
  renderWordCardLink();
  renderUnitHistory();
  renderElementaryLevels();

  window.__haingRenderHome = function () {
    renderCards();
    renderWordCardLink();
    renderUnitHistory();
    renderElementaryLevels();
  };
})();
