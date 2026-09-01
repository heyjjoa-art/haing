// 관리자 탭 - Word 진행 관리: 유닛별로 하정이와 하진이가 각각 단어를 몇 개
// 모았는지(진행율 + 개수) 한눈에 보여준다. 로그인한 아이와 무관하게 두 아이를
// 항상 같이 보여줘야 해서, ChildStore.getActive()에 묶인 WordCardStore의 기본
// 조회 함수 대신 getCollectedForChild로 아이별 카드를 직접 읽는다.
//
// 진행율은 단어를 처음 모은 것(1회)뿐 아니라 트로피를 받은 뒤의 복습(별 스티커,
// 단어당 최대 5개 - word-card-store.js의 addStar 참고)까지 합쳐서 센다. 단어 하나가
// 낼 수 있는 최대 회차는 1(최초 수집) + 5(복습 별) = 6회라서, 유닛 전체가 꽉 차면
// 진행율은 100%가 아니라 600%까지 올라간다.
(function () {
  "use strict";

  var MAX_ROUNDS_PER_WORD = 6;

  var listEl = document.getElementById("adminWordProgressList");
  if (!listEl) return;

  // getAllUnits()(매주 올리는 본문 유닛)와 getElementaryLevels()(고정 초등 단어장)를
  // 하나의 목록으로 합친다 - 둘 다 WordCardStore 카드의 unit 필드에 그대로 쓰인다.
  function getAllTrackedUnits() {
    var units = [];
    (DataStore.getAllUnits() || []).forEach(function (entry) {
      var words = DataStore.getWords(entry.unit) || [];
      if (words.length === 0) return;
      units.push({
        key: entry.unit,
        label: entry.unit === "unspecified" ? "이름 없는 자료" : "Unit " + entry.unit,
        total: words.length
      });
    });
    (DataStore.getElementaryLevels() || []).forEach(function (entry) {
      units.push({ key: entry.level, label: entry.level, total: entry.count });
    });
    return units;
  }

  // unit.key별 { roundsSum, hasTrophy } 맵을 이 아이의 카드 배열 하나만 훑어서 한 번에 만든다.
  // roundsSum은 그 유닛에서 모은 단어들의 (1 + 별 개수) 합 - 단어 하나당 최대 6.
  function buildUnitStatsMap(cards) {
    var map = {};
    cards.forEach(function (r) {
      var key = String(r.unit);
      if (!map[key]) map[key] = { roundsSum: 0, hasTrophy: false, hasRainbow: false };
      if (r.rainbowCard) map[key].hasRainbow = true;
      else if (r.isTrophy) map[key].hasTrophy = true;
      else map[key].roundsSum += 1 + (r.stars || 0);
    });
    return map;
  }

  function statsFor(unitStatsMap, unit) {
    var entry = unitStatsMap[String(unit.key)] || { roundsSum: 0, hasTrophy: false, hasRainbow: false };
    var maxRounds = unit.total * MAX_ROUNDS_PER_WORD;
    var roundsSum = Math.min(entry.roundsSum, maxRounds);
    var pct = unit.total > 0 ? Math.round((roundsSum / unit.total) * 100) : 0;
    return {
      total: unit.total,
      maxRounds: maxRounds,
      roundsSum: roundsSum,
      pct: pct,
      hasTrophy: entry.hasTrophy,
      hasRainbow: entry.hasRainbow
    };
  }

  function childLine(child, stats) {
    var line = document.createElement("div");
    line.className = "admin-progress-child-line";

    var name = document.createElement("span");
    name.className = "admin-progress-child-name";
    name.textContent = child.zodiacEmoji + " " + child.name;
    line.appendChild(name);

    var bar = document.createElement("div");
    bar.className = "admin-progress-bar";
    var fill = document.createElement("div");
    fill.className = "admin-progress-bar-fill";
    // 진행율 자체는 600%까지 가지만, 막대는 600%를 꽉 찬 것으로 보고 그 비율만큼만 채운다.
    fill.style.width = Math.min(100, (stats.pct / (MAX_ROUNDS_PER_WORD * 100)) * 100) + "%";
    bar.appendChild(fill);
    line.appendChild(bar);

    var count = document.createElement("span");
    count.className = "admin-progress-child-count";
    count.textContent =
      stats.roundsSum + "/" + stats.maxRounds + "회 · " + stats.pct + "%" +
      (stats.hasTrophy ? " 🏆" : "") + (stats.hasRainbow ? " 🌈" : "");
    line.appendChild(count);

    return line;
  }

  function render() {
    if (typeof DataStore === "undefined" || typeof WordCardStore === "undefined" || typeof ChildStore === "undefined") return;
    listEl.innerHTML = "";

    var units = getAllTrackedUnits();
    if (units.length === 0) {
      var empty = document.createElement("p");
      empty.className = "hint";
      empty.textContent = "아직 단어가 등록된 유닛이 없어요.";
      listEl.appendChild(empty);
      return;
    }

    // 아이별로 카드 배열을 한 번씩만 읽고 유닛별 집계도 한 번만 만들어서, 유닛
    // 목록을 두 번(요약 줄 + 유닛 카드) 도는 동안 localStorage를 다시 읽지 않는다.
    var statsMapByChild = {};
    ChildStore.CHILDREN.forEach(function (child) {
      statsMapByChild[child.id] = buildUnitStatsMap(WordCardStore.getCollectedForChild(child.id));
    });

    var summary = document.createElement("div");
    summary.className = "admin-progress-summary";
    ChildStore.CHILDREN.forEach(function (child) {
      var totalWords = 0;
      var roundsSum = 0;
      var trophyCount = 0;
      var rainbowCount = 0;
      units.forEach(function (unit) {
        var stats = statsFor(statsMapByChild[child.id], unit);
        totalWords += stats.total;
        roundsSum += stats.roundsSum;
        if (stats.hasTrophy) trophyCount++;
        if (stats.hasRainbow) rainbowCount++;
      });
      var pct = totalWords > 0 ? Math.round((roundsSum / totalWords) * 100) : 0;

      var line = document.createElement("p");
      line.className = "admin-progress-summary-line";
      line.textContent =
        child.zodiacEmoji + " " + child.name + " 전체 " +
        roundsSum + "/" + (totalWords * MAX_ROUNDS_PER_WORD) + "회 (" + pct + "%) · 🏆 " + trophyCount + "개 · 🌈 " + rainbowCount + "개";
      summary.appendChild(line);
    });
    listEl.appendChild(summary);

    units.forEach(function (unit) {
      var card = document.createElement("div");
      card.className = "admin-progress-unit-card";

      var title = document.createElement("div");
      title.className = "admin-progress-unit-title";
      title.textContent = unit.label + " (단어 " + unit.total + "개)";
      card.appendChild(title);

      ChildStore.CHILDREN.forEach(function (child) {
        card.appendChild(childLine(child, statsFor(statsMapByChild[child.id], unit)));
      });

      listEl.appendChild(card);
    });
  }

  render();
  window.__haingRenderAdminWordProgress = render;
})();
