(function () {
  "use strict";

  function $(sel) {
    return document.querySelector(sel);
  }

  function fileToDataURL(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        resolve(reader.result);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // localStorage 용량(보통 5~10MB)을 넘지 않도록, 저장용으로는 축소·재압축한 사본을 사용한다.
  // QR 인식은 원본 화질 그대로 시도해서 인식률을 유지한다.
  function compressDataUrl(dataUrl, maxDim, quality) {
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () {
        var scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        var canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = function () {
        resolve(dataUrl);
      };
      img.src = dataUrl;
    });
  }

  var weekPhotosInput = $("#weekPhotosInput");
  var storyPhotoPreview = $("#storyPhotoPreview");
  var wordsPhotoPreview = $("#wordsPhotoPreview");
  var saveWeekBtn = $("#saveWeekBtn");
  var saveStatus = $("#saveStatus");
  var manualUnitInput = $("#manualUnitInput");

  var pendingStoryPhotoDataUrl = null;
  var pendingWordsPhotoDataUrl = null;
  var pendingStoryAudioLink = null;
  var pendingWordsAudioLink = null;

  function setPreview(boxEl, dataUrl) {
    if (dataUrl) {
      boxEl.innerHTML = '<img src="' + dataUrl + '" alt="업로드한 사진">';
    } else {
      boxEl.innerHTML = '<span class="placeholder">사진 미리보기</span>';
    }
  }

  function processPhoto(file, previewEl) {
    return fileToDataURL(file).then(function (originalDataUrl) {
      return decodeQrFromDataUrl(originalDataUrl).then(function (link) {
        return compressDataUrl(originalDataUrl, 1400, 0.7).then(function (compactDataUrl) {
          setPreview(previewEl, compactDataUrl);
          return { dataUrl: compactDataUrl, originalDataUrl: originalDataUrl, link: link };
        });
      });
    });
  }

  weekPhotosInput.addEventListener("change", function () {
    var files = Array.from(weekPhotosInput.files).slice(0, 2);
    if (files.length === 0) return;

    saveStatus.style.color = "";
    saveStatus.textContent = "사진 불러오는 중...";

    var tasks = [];

    if (files[0]) {
      tasks.push(
        processPhoto(files[0], storyPhotoPreview).then(function (result) {
          pendingStoryPhotoDataUrl = result.dataUrl;
          pendingStoryAudioLink = result.link;
        })
      );
    }
    if (files[1]) {
      tasks.push(
        processPhoto(files[1], wordsPhotoPreview).then(function (result) {
          pendingWordsPhotoDataUrl = result.dataUrl;
          pendingWordsAudioLink = result.link;
        })
      );
    }

    Promise.all(tasks).then(function () {
      saveStatus.textContent = "사진을 불러왔어요. Unit 번호를 입력하고 저장해주세요.";
      manualUnitInput.focus();
    });
  });

  saveWeekBtn.addEventListener("click", function () {
    var unit = manualUnitInput.value.trim();
    if (!unit) {
      saveStatus.style.color = "#b3261e";
      saveStatus.textContent = "⚠️ Unit 번호를 입력해주세요.";
      manualUnitInput.focus();
      return;
    }

    var payload = {};
    if (pendingStoryPhotoDataUrl) payload.storyPhotoDataUrl = pendingStoryPhotoDataUrl;
    if (pendingWordsPhotoDataUrl) payload.wordsPhotoDataUrl = pendingWordsPhotoDataUrl;
    if (pendingStoryAudioLink) payload.storyAudioLink = pendingStoryAudioLink;
    if (pendingWordsAudioLink) payload.wordsAudioLink = pendingWordsAudioLink;

    try {
      DataStore.saveUnitData(unit, payload);
      saveStatus.style.color = "";
      saveStatus.textContent = "✅ 저장했어요! 1~4번 기능에 바로 반영됩니다.";
      if (window.__haingRenderHome) window.__haingRenderHome();
      if (window.__haingRenderAdminWordUnits) window.__haingRenderAdminWordUnits();
    } catch (e) {
      saveStatus.textContent = "❌ 저장 실패 (용량 초과 가능성): " + e.message;
      saveStatus.style.color = "#b3261e";
    }
  });

  function loadExisting() {
    var data = DataStore.load();
    var currentUnit = DataStore.getCurrentUnit();

    if (currentUnit) manualUnitInput.value = currentUnit;

    if (data.storyPhotoDataUrl) {
      setPreview(storyPhotoPreview, data.storyPhotoDataUrl);
      pendingStoryPhotoDataUrl = data.storyPhotoDataUrl;
    }
    if (data.wordsPhotoDataUrl) {
      setPreview(wordsPhotoPreview, data.wordsPhotoDataUrl);
      pendingWordsPhotoDataUrl = data.wordsPhotoDataUrl;
    }
    if (data.storyAudioLink) pendingStoryAudioLink = data.storyAudioLink;
    if (data.wordsAudioLink) pendingWordsAudioLink = data.wordsAudioLink;
  }

  loadExisting();
})();
