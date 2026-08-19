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
  var ocrBtn = document.getElementById("ocrBtn");
  var ocrStatus = document.getElementById("ocrStatus");
  var textInput = document.getElementById("textInput");
  var saveBtn = document.getElementById("saveBtn");
  var saveStatus = document.getElementById("saveStatus");
  var deleteBtn = document.getElementById("deleteBtn");
  var pageSubtitle = document.getElementById("pageSubtitle");
  var backLink = document.getElementById("backLink");

  backLink.href = listHref;

  // 책 페이지 사진을 순서대로 여러 장 쌓아둔다. recognized는 이 페이지의 텍스트를
  // 이미 인식해서 본문에 넣었는지 표시 - 나중에 페이지를 더 추가해도 이미 인식한
  // 페이지를 다시 인식하거나 사용자가 고친 본문을 덮어쓰지 않기 위함이다.
  var pendingPhotos = []; // { originalDataUrl, compactDataUrl, recognized }

  // 수정 모드면 기존 유닛 내용을 폼에 채워둔다. 기존 사진은 이미 다 인식된 걸로
  // 보고, 이번 편집에서 새로 추가한 사진만 OCR 대상이 되게 한다.
  if (editUnit) {
    document.title = "유닛 수정 - Journeys";
    pageSubtitle.textContent = "유닛 수정";
    saveBtn.textContent = "💾 수정 내용 저장";
    deleteBtn.hidden = false;

    levelInput.value = editUnit.level || "";
    titleInput.value = editUnit.title || "";
    textInput.value = editUnit.text || "";
    pendingPhotos = (editUnit.photos || []).map(function (src) {
      return { originalDataUrl: src, compactDataUrl: src, recognized: true };
    });
  } else if (isAdmin) {
    document.title = "새 유닛 추가 - Journeys";
  }

  // renderPhotoGrid/updateOcrBtnState는 아래에서 정의되지만 함수 선언이라 호이스팅되어
  // 여기서 먼저 호출해도 안전하다 - 수정 모드에서 불러온 기존 사진을 바로 그려준다.
  renderPhotoGrid();
  updateOcrBtnState();

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

  // localStorage 용량을 넘지 않도록 저장용 사본은 줄이고, OCR은 원본 화질로 시도한다.
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

  // 휴대폰으로 찍은 책 사진은 그림자·저대비 때문에 그대로 OCR을 돌리면 인식률이
  // 뚝 떨어진다. 흑백으로 바꾸고 명암 범위를 0~255로 늘려 펴주면(히스토그램 스트레치)
  // 배경 잡음이 줄고 글자 대비가 살아나서 인식률이 눈에 띄게 좋아진다.
  function preprocessForOcr(dataUrl) {
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () {
        var maxDim = 2000;
        var scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        var canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        var ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        var imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        var d = imgData.data;
        var pixelCount = d.length / 4;
        var grays = new Uint8ClampedArray(pixelCount);
        var min = 255;
        var max = 0;
        for (var i = 0, j = 0; i < d.length; i += 4, j++) {
          var gray = d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11;
          grays[j] = gray;
          if (gray < min) min = gray;
          if (gray > max) max = gray;
        }
        var range = max - min || 1;
        for (var i2 = 0, j2 = 0; i2 < d.length; i2 += 4, j2++) {
          var stretched = ((grays[j2] - min) / range) * 255;
          d[i2] = d[i2 + 1] = d[i2 + 2] = stretched;
        }
        ctx.putImageData(imgData, 0, 0);
        resolve(canvas.toDataURL("image/jpeg", 0.92));
      };
      img.onerror = function () {
        resolve(dataUrl);
      };
      img.src = dataUrl;
    });
  }

  function updateOcrBtnState() {
    ocrBtn.disabled = !pendingPhotos.some(function (p) {
      return !p.recognized;
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
    updateOcrBtnState();
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
            return { originalDataUrl: originalDataUrl, compactDataUrl: compactDataUrl, recognized: false };
          });
        });
      })
    ).then(function (newPhotos) {
      pendingPhotos = pendingPhotos.concat(newPhotos);
      renderPhotoGrid();
      updateOcrBtnState();
    });
  });

  ocrBtn.addEventListener("click", function () {
    var targets = pendingPhotos.filter(function (p) {
      return !p.recognized;
    });
    if (targets.length === 0) return;
    if (typeof Tesseract === "undefined") {
      ocrStatus.textContent = "❌ 인식 엔진을 불러오지 못했어요. 본문을 직접 입력해주세요.";
      return;
    }

    ocrBtn.disabled = true;
    var done = 0;
    ocrStatus.textContent = "텍스트 인식 중... (0/" + targets.length + " 페이지)";

    Tesseract.createWorker("eng")
      .then(function (worker) {
        var chain = worker.setParameters({ tessedit_pageseg_mode: "6" });
        targets.forEach(function (photo) {
          chain = chain
            .then(function () {
              return preprocessForOcr(photo.originalDataUrl);
            })
            .then(function (processedDataUrl) {
              return worker.recognize(processedDataUrl);
            })
            .then(function (result) {
              var text = (result && result.data && result.data.text) || "";
              text = text.replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim();
              if (text) {
                textInput.value = textInput.value
                  ? textInput.value.replace(/\s+$/, "") + "\n\n" + text
                  : text;
              }
            })
            .catch(function () {
              ocrStatus.textContent = "⚠️ 한 페이지 인식에 실패했어요. 계속 진행할게요...";
            })
            .then(function () {
              photo.recognized = true;
              done++;
              ocrStatus.textContent = "텍스트 인식 중... (" + done + "/" + targets.length + " 페이지)";
            });
        });
        return chain.then(function () {
          worker.terminate();
        });
      })
      .then(function () {
        ocrStatus.textContent = "✅ 인식 완료! 틀린 부분은 아래에서 직접 고쳐주세요.";
      })
      .catch(function () {
        ocrStatus.textContent = "❌ 인식 엔진을 불러오지 못했어요. 본문을 직접 입력해주세요.";
      })
      .then(function () {
        updateOcrBtnState();
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
      saveStatus.textContent = "✅ 저장했어요!";
      // 수정한 경우엔 목록으로, 새로 만든 경우엔 방금 만든 유닛을 바로 미리보기.
      window.location.href = editUnit ? listHref : "reader.html?id=" + encodeURIComponent(unit.id);
    } catch (e) {
      saveStatus.style.color = "#b3261e";
      saveStatus.textContent = "❌ 저장 실패 (용량 초과 가능성): " + e.message;
    }
  });
})();
