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
      guideEl.textContent = "📌 순서대로 완료하면 다음 단계가 열려요!";
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

  // "주간 유닛"(매주 올리는 본문+단어)과 "초등영단어"(본문 없는 고정 단어장)를
  // 카테고리 하나로 합쳐서 고르게 한다 - 카테고리를 먼저 고르면 그에 맞는 번호 목록이 뜬다.
  // 번호까지 고르면(별도 "이동" 버튼 없이) 바로 그 유닛으로 바뀌고 이 화면에 그대로
  // 남아 단계 카드를 보여준다 - 몇 번부터 시작할지는 카드를 눌러 직접 고른다.
  function renderUnitHistory() {
    var categorySelect = document.getElementById("unitCategorySelect");
    var numberSelect = document.getElementById("unitNumberSelect");
    var sectionEl = document.getElementById("unitHistorySection");
    if (!categorySelect || !numberSelect) return;

    // getAllUnits()는 최신순(내림차순)으로 오는데, 이 드롭다운은 보기 편하게 오름차순으로 뒤집는다.
    var weeklyUnits = DataStore.getAllUnits().slice().sort(function (a, b) {
      var na = parseFloat(a.unit);
      var nb = parseFloat(b.unit);
      if (!isNaN(na) && !isNaN(nb)) return na - nb;
      return a.unit < b.unit ? -1 : 1;
    });
    var elementaryLevels = DataStore.getElementaryLevels();

    if (weeklyUnits.length === 0 && elementaryLevels.length === 0) {
      sectionEl.hidden = true;
      return;
    }
    sectionEl.hidden = false;

    var currentUnit = DataStore.getCurrentUnit();

    // 트로피(완전정복)를 받은 유닛만 복습이 의미가 있다 - 그 전엔 별이 아직 하나도
    // 안 붙는다. 유닛 전체가 "몇 바퀴째 복습 중"인지는 단어 하나하나의 별 개수가
    // 다 똑같이 올라가지 않으므로(제일 늦게 따라오는 단어 기준), 가장 적게 모은
    // 단어의 별 개수를 그 유닛의 복습 진행으로 본다 - isStarLimitReached와 같은 논리.
    function reviewStarsLabel(unitKey) {
      if (typeof WordCardStore === "undefined" || !WordCardStore.hasTrophy(unitKey)) return "";
      var cards = WordCardStore.getUnitWordCards(unitKey);
      if (cards.length === 0) return "";
      var minStars = cards.reduce(function (min, r) {
        return Math.min(min, r.stars || 0);
      }, 5);
      return " -복습 " + minStars + "/5";
    }

    function populateNumberOptions() {
      var category = categorySelect.value;
      numberSelect.innerHTML = '<option value="">번호선택</option>';
      var list = category === "elementary" ? elementaryLevels : weeklyUnits;
      var currentInThisCategory = false;
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
        label += reviewStarsLabel(key);
        option.textContent = label + (key === currentUnit ? " (현재)" : "");
        numberSelect.appendChild(option);
        if (key === currentUnit) currentInThisCategory = true;
      });
      // 지금 보고 있는 유닛이 이 카테고리 소속이면 선택된 상태로 고정한다(뒤로 돌아와도
      // 유지). 다른 카테고리로 보면 값이 없으니 빈칸이 아니라 "번호선택" placeholder로
      // 돌아가야 한다 - value를 "" 로 명시해야 placeholder 옵션이 실제로 선택된다.
      numberSelect.value = currentInThisCategory ? currentUnit : "";
    }

    // 카테고리 목록에는 실제로 고를 게 있는 종류만 보여준다.
    categorySelect.innerHTML = "";
    if (weeklyUnits.length > 0) {
      var weeklyOpt = document.createElement("option");
      weeklyOpt.value = "weekly";
      weeklyOpt.textContent = "주간 유닛";
      categorySelect.appendChild(weeklyOpt);
    }
    if (elementaryLevels.length > 0) {
      var elemOpt = document.createElement("option");
      elemOpt.value = "elementary";
      elemOpt.textContent = "초등영단어";
      categorySelect.appendChild(elemOpt);
    }

    // 지금 보고 있는 유닛이 속한 카테고리를 기본으로 보여준다.
    categorySelect.value = DataStore.isElementaryUnit(currentUnit) ? "elementary" : "weekly";
    if (!categorySelect.value) categorySelect.selectedIndex = 0;

    categorySelect.onchange = populateNumberOptions;
    populateNumberOptions();
  }

  // 유닛 삭제는 관리자 탭에서만 한다 - 여기서는 고르는 것만 가능하다.
  // 번호를 고르는 즉시(별도 버튼 없이) 그 유닛으로 바뀌고 단계 카드가 새로 그려진다.
  (function setupUnitHistoryControls() {
    var numberSelect = document.getElementById("unitNumberSelect");
    if (!numberSelect) return;

    numberSelect.addEventListener("change", function () {
      var chosen = numberSelect.value;
      if (!chosen) return;
      // 복습(2~4번 반복)으로 받는 별 스티커는 단어마다 5개가 한도다. 이 유닛의
      // 단어가 전부 5개씩 다 찼으면 더 복습해도 얻을 게 없으니 안내해준다.
      if (typeof WordCardStore !== "undefined" && WordCardStore.isStarLimitReached(chosen)) {
        alert("별 5개가 모두 지급되었어요\n\n다른 단어도 공부해보아요!");
      }
      DataStore.setCurrentUnit(chosen);
      if (window.__haingRenderHome) window.__haingRenderHome();
    });
  })();

  renderCards();
  renderUnitHistory();

  window.__haingRenderHome = function () {
    renderCards();
    renderUnitHistory();
  };
})();
