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

  // "주간 유닛"(매주 올리는 본문+단어)과 "초등 필수 단어"(본문 없는 고정 단어장)를
  // 카테고리 하나로 합쳐서 고르게 한다 - 카테고리를 먼저 고르면 그에 맞는 번호 목록이 뜬다.
  function renderUnitHistory() {
    var categorySelect = document.getElementById("unitCategorySelect");
    var numberSelect = document.getElementById("unitNumberSelect");
    var sectionEl = document.getElementById("unitHistorySection");
    var hintEl = document.getElementById("unitHistoryHint");
    if (!categorySelect || !numberSelect) return;

    var weeklyUnits = DataStore.getAllUnits();
    var elementaryLevels = DataStore.getElementaryLevels();

    if (weeklyUnits.length === 0 && elementaryLevels.length === 0) {
      sectionEl.hidden = true;
      return;
    }
    sectionEl.hidden = false;

    var currentUnit = DataStore.getCurrentUnit();

    function populateNumberOptions() {
      var category = categorySelect.value;
      hintEl.hidden = category !== "elementary";
      numberSelect.innerHTML = '<option value="">번호를 선택하세요</option>';
      var list = category === "elementary" ? elementaryLevels : weeklyUnits;
      list.forEach(function (entry) {
        var key = category === "elementary" ? entry.level : entry.unit;
        var option = document.createElement("option");
        option.value = key;
        var label =
          category === "elementary"
            ? entry.level + " (" + entry.count + "개)"
            : entry.unit === "unspecified"
              ? "이름 없는 자료"
              : "Unit " + entry.unit;
        option.textContent = label + (key === currentUnit ? " (현재)" : "");
        numberSelect.appendChild(option);
      });
    }

    // 카테고리 목록에는 실제로 고를 게 있는 종류만 보여준다.
    categorySelect.innerHTML = "";
    if (weeklyUnits.length > 0) {
      var weeklyOpt = document.createElement("option");
      weeklyOpt.value = "weekly";
      weeklyOpt.textContent = "📚 주간 유닛";
      categorySelect.appendChild(weeklyOpt);
    }
    if (elementaryLevels.length > 0) {
      var elemOpt = document.createElement("option");
      elemOpt.value = "elementary";
      elemOpt.textContent = "📗 초등 필수 단어";
      categorySelect.appendChild(elemOpt);
    }

    // 지금 보고 있는 유닛이 속한 카테고리를 기본으로 보여준다.
    categorySelect.value = DataStore.isElementaryUnit(currentUnit) ? "elementary" : "weekly";
    if (!categorySelect.value) categorySelect.selectedIndex = 0;

    categorySelect.onchange = populateNumberOptions;
    populateNumberOptions();
  }

  // 유닛 삭제는 관리자 탭에서만 한다 - 여기서는 이동만 가능하다.
  // "이동"은 바로 어떤 단계로 뛰어들지 않고, 고른 유닛/단계를 현재 유닛으로 바꾼 뒤
  // 이 화면에 그대로 남아 단계 목록(카드)을 보여준다 - 그래야 몇 번을 시작할지
  // 직접 고를 수 있고, 다시 다른 유닛을 고르고 싶을 때도 선택 UI가 계속 남아있다.
  (function setupUnitHistoryControls() {
    var numberSelect = document.getElementById("unitNumberSelect");
    var goBtn = document.getElementById("unitGoBtn");
    if (!numberSelect || !goBtn) return;

    goBtn.addEventListener("click", function () {
      var chosen = numberSelect.value;
      if (!chosen) return;
      DataStore.setCurrentUnit(chosen);
      if (window.__haingRenderHome) window.__haingRenderHome();
    });
  })();

  renderCards();
  renderWordCardLink();
  renderUnitHistory();

  window.__haingRenderHome = function () {
    renderCards();
    renderWordCardLink();
    renderUnitHistory();
  };
})();
