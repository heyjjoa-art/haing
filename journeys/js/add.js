(function () {
  "use strict";

  var params = new URLSearchParams(location.search);
  var editId = params.get("id");
  var isAdmin = params.get("admin") === "1";
  var editUnit = editId ? JourneysStore.getUnit(editId) : null;
  var listHref = "index.html" + (isAdmin ? "?admin=1" : "");

  var levelInput = document.getElementById("levelInput");
  var titleInput = document.getElementById("titleInput");
  var photoInput = document.getElementById("photoInput");
  var photoGrid = document.getElementById("photoGrid");
  var textInput = document.getElementById("textInput");
  var saveBtn = document.getElementById("saveBtn");
  var saveStatus = document.getElementById("saveStatus");
  var deleteBtn = document.getElementById("deleteBtn");
  var pageSubtitle = document.getElementById("pageSubtitle");
  var backLink = document.getElementById("backLink");

  backLink.href = listHref;

  // 책 페이지 사진을 순서대로 여러 장 쌓아둔다.
  var pendingPhotos = []; // { compactDataUrl }

  // 수정 모드면 기존 유닛 내용을 폼에 채워둔다.
  if (editUnit) {
    document.title = "유닛 수정 - Journeys";
    pageSubtitle.textContent = "유닛 수정";
    saveBtn.textContent = "💾 수정 내용 저장";
    deleteBtn.hidden = false;

    levelInput.value = editUnit.level || "";
    titleInput.value = editUnit.title || "";
    textInput.value = editUnit.text || "";
    pendingPhotos = (editUnit.photos || []).map(function (src) {
      return { compactDataUrl: src };
    });
  } else if (isAdmin) {
    document.title = "새 유닛 추가 - Journeys";
  }

  // renderPhotoGrid는 아래에서 정의되지만 함수 선언이라 호이스팅되어 여기서 먼저
  // 호출해도 안전하다 - 수정 모드에서 불러온 기존 사진을 바로 그려준다.
  renderPhotoGrid();

  deleteBtn.addEventListener("click", function () {
    if (!editUnit) return;
    if (confirm('"' + (editUnit.title || "이 유닛") + '"을(를) 삭제할까요? 되돌릴 수 없어요.')) {
      JourneysStore.deleteUnit(editUnit.id);
      window.location.href = listHref;
    }
  });

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

  // localStorage 용량을 넘지 않도록 저장용 사본은 줄여서 쓴다.
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

  function movePhoto(from, to) {
    var item = pendingPhotos.splice(from, 1)[0];
    pendingPhotos.splice(to, 0, item);
    renderPhotoGrid();
  }

  function removePhoto(idx) {
    pendingPhotos.splice(idx, 1);
    renderPhotoGrid();
  }

  function renderPhotoGrid() {
    photoGrid.innerHTML = "";
    pendingPhotos.forEach(function (photo, idx) {
      var thumb = document.createElement("div");
      thumb.className = "photo-thumb";

      var img = document.createElement("img");
      img.src = photo.compactDataUrl;
      img.alt = (idx + 1) + "페이지 미리보기";
      thumb.appendChild(img);

      var badge = document.createElement("span");
      badge.className = "photo-thumb-badge";
      badge.textContent = (idx + 1) + "페이지";
      thumb.appendChild(badge);

      var controls = document.createElement("div");
      controls.className = "photo-thumb-controls";

      var upBtn = document.createElement("button");
      upBtn.type = "button";
      upBtn.className = "photo-thumb-btn";
      upBtn.textContent = "▲";
      upBtn.disabled = idx === 0;
      upBtn.addEventListener("click", function () {
        movePhoto(idx, idx - 1);
      });
      controls.appendChild(upBtn);

      var downBtn = document.createElement("button");
      downBtn.type = "button";
      downBtn.className = "photo-thumb-btn";
      downBtn.textContent = "▼";
      downBtn.disabled = idx === pendingPhotos.length - 1;
      downBtn.addEventListener("click", function () {
        movePhoto(idx, idx + 1);
      });
      controls.appendChild(downBtn);

      var delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "photo-thumb-btn";
      delBtn.textContent = "✕";
      delBtn.addEventListener("click", function () {
        removePhoto(idx);
      });
      controls.appendChild(delBtn);

      thumb.appendChild(controls);
      photoGrid.appendChild(thumb);
    });
  }

  photoInput.addEventListener("change", function () {
    var files = Array.prototype.slice.call(photoInput.files || []);
    photoInput.value = ""; // 같은 파일을 다시 선택할 수 있도록 비워둔다.
    if (files.length === 0) return;

    Promise.all(
      files.map(function (file) {
        return fileToDataURL(file).then(function (originalDataUrl) {
          return compressDataUrl(originalDataUrl, 1400, 0.75).then(function (compactDataUrl) {
            return { compactDataUrl: compactDataUrl };
          });
        });
      })
    ).then(function (newPhotos) {
      pendingPhotos = pendingPhotos.concat(newPhotos);
      renderPhotoGrid();
    });
  });

  saveBtn.addEventListener("click", function () {
    var level = levelInput.value.trim();
    var title = titleInput.value.trim();
    var text = textInput.value.trim();

    if (!level || !title || !text) {
      saveStatus.style.color = "#b3261e";
      saveStatus.textContent = "⚠️ 레벨, 제목, 본문을 모두 입력해주세요.";
      return;
    }

    try {
      var payload = {
        level: level,
        title: title,
        text: text,
        photos: pendingPhotos.map(function (p) {
          return p.compactDataUrl;
        })
      };
      if (editUnit) payload.id = editUnit.id;
      var unit = JourneysStore.saveUnit(payload);
      saveStatus.style.color = "";
      saveStatus.textContent = "☁️ 클라우드에 저장 중...";
      saveBtn.disabled = true;

      // 클라우드 쓰기가 끝나기 전에 페이지를 이동하면 다음 페이지가 아직 이 쓰기를
      // 못 받은 예전 클라우드 스냅샷으로 로컬 데이터를 덮어써서 방금 저장한 내용이
      // 사라질 수 있다. 그래서 쓰기를 기다렸다가 이동한다 - 단, 오프라인 등으로 계속
      // 안 끝나면 로컬 저장은 이미 끝난 뒤이니 무한정 기다리지 않고 넘어간다.
      var cloudWaitTimeout = new Promise(function (resolve) {
        setTimeout(resolve, 5000);
      });
      Promise.race([Promise.resolve(unit.cloudSyncPromise), cloudWaitTimeout]).then(function () {
        saveStatus.textContent = "✅ 저장했어요!";
        // 수정한 경우엔 목록으로, 새로 만든 경우엔 방금 만든 유닛을 바로 미리보기.
        window.location.href = editUnit ? listHref : "reader.html?id=" + encodeURIComponent(unit.id);
      });
    } catch (e) {
      saveStatus.style.color = "#b3261e";
      saveStatus.textContent = "❌ 저장 실패 (용량 초과 가능성): " + e.message;
    }
  });
})();
