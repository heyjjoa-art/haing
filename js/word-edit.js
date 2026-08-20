(function () {
  "use strict";

  var unit = new URLSearchParams(location.search).get("unit");

  var pageSubtitleEl = document.getElementById("pageSubtitle");
  var storyTitleInput = document.getElementById("storyTitleInput");
  var storyTextInput = document.getElementById("storyTextInput");
  var saveStatus = document.getElementById("saveStatus");
  var saveBtn = document.getElementById("saveBtn");

  if (!unit) {
    document.querySelector("main").innerHTML =
      '<p class="hint">수정할 유닛을 찾을 수 없어요. <a href="index.html">관리자로 돌아가기</a></p>';
    return;
  }

  pageSubtitleEl.textContent = unit === "unspecified" ? "이름 없는 자료 본문 수정" : "Unit " + unit + " 본문 수정";

  var existing = DataStore.load(unit);
  storyTitleInput.value = existing.storyTitle || "";
  storyTextInput.value = existing.storyText || "";

  saveBtn.addEventListener("click", function () {
    var storyTitle = storyTitleInput.value.trim();
    var storyText = storyTextInput.value.trim();

    if (!storyTitle || !storyText) {
      saveStatus.style.color = "#b3261e";
      saveStatus.textContent = "⚠️ 본문 제목과 텍스트를 모두 입력해주세요.";
      return;
    }

    try {
      DataStore.saveUnitData(unit, { storyTitle: storyTitle, storyText: storyText });
      saveStatus.style.color = "";
      saveStatus.textContent = "✅ 저장했어요!";
    } catch (e) {
      saveStatus.style.color = "#b3261e";
      saveStatus.textContent = "❌ 저장 실패: " + e.message;
    }
  });
})();
