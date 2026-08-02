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
  // QR 인식/Unit 번호 인식은 원본 화질 그대로 시도해서 인식률을 유지한다.
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

  // 사진을 흑백으로 바꾸고 대비를 확 높여서(이진화) 배경 잡음을 줄인다.
  // 책 사진은 배경(책상, 소품)이 같이 찍혀서 그냥 OCR을 돌리면 글자를 잘 못 읽는다.
  function binarize(canvas) {
    var ctx = canvas.getContext("2d");
    var imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    var d = imgData.data;
    for (var i = 0; i < d.length; i += 4) {
      var gray = d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11;
      var v = gray > 150 ? 255 : 0;
      d[i] = d[i + 1] = d[i + 2] = v;
    }
    ctx.putImageData(imgData, 0, 0);
    return canvas;
  }

  function cropUpscaled(img, sx, sy, sw, sh, upscale) {
    var canvas = document.createElement("canvas");
    canvas.width = Math.round(sw * upscale);
    canvas.height = Math.round(sh * upscale);
    canvas.getContext("2d").drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    return binarize(canvas);
  }

  function subCrop(canvas, xFrac, wFrac) {
    var sx = Math.round(canvas.width * xFrac);
    var sw = Math.round(canvas.width * wFrac);
    var out = document.createElement("canvas");
    out.width = sw;
    out.height = canvas.height;
    out.getContext("2d").drawImage(canvas, sx, 0, sw, canvas.height, 0, 0, sw, canvas.height);
    return out;
  }

  // "UNIT 15" 배지는 세로로 쓴 "UNIT" 글자와 숫자가 붙어있어서 한 번에 읽으면
  // 서로 겹쳐 보여 실패하기 쉽다. 숫자만 있는 좁은 구간을 여러 번 슬라이딩하며 찾는다.
  // 해상도에 따라 잘리는 위치가 조금씩 달라지므로, 첫 결과가 아니라 가장 자릿수가
  // 많이(=온전하게) 읽힌 결과를 우선한다.
  function scanForDigits(worker, cornerCanvas) {
    var xOffsets = [0.02, 0.1, 0.18, 0.26, 0.34, 0.42, 0.5, 0.58, 0.66];
    var widthFrac = 0.28;
    var chain = Promise.resolve();
    var candidates = [];

    xOffsets.forEach(function (xFrac) {
      chain = chain.then(function () {
        var slice = subCrop(cornerCanvas, xFrac, widthFrac);
        return worker.recognize(slice.toDataURL("image/png")).then(function (result) {
          var text = ((result && result.data && result.data.text) || "").replace(/\D/g, "");
          if (text && text.length >= 1 && text.length <= 3) {
            candidates.push(text);
          }
        });
      });
    });

    return chain.then(function () {
      // 애매한 한 자리 숫자 조각은 신뢰하지 않는다. 온전한 2~3자리 숫자만 인정한다.
      var reliable = candidates.filter(function (c) {
        return c.length >= 2;
      });
      if (reliable.length === 0) return null;

      var maxLen = Math.max.apply(
        null,
        reliable.map(function (c) {
          return c.length;
        })
      );
      var longest = reliable.filter(function (c) {
        return c.length === maxLen;
      });
      var counts = {};
      longest.forEach(function (c) {
        counts[c] = (counts[c] || 0) + 1;
      });
      var best = longest[0];
      Object.keys(counts).forEach(function (c) {
        if (counts[c] > counts[best]) best = c;
      });
      return best;
    });
  }

  // "UNIT 15" 같은 표시는 사진마다 왼쪽 위/오른쪽 위 등 위치가 달라서,
  // 양쪽 위 모서리를 각각 확대해서 읽어보고 숫자를 찾는다.
  function detectUnitNumber(dataUrl) {
    return new Promise(function (resolve) {
      if (typeof Tesseract === "undefined") {
        resolve(null);
        return;
      }
      var img = new Image();
      img.onload = function () {
        var cw = Math.round(img.width * 0.28);
        var ch = Math.round(img.height * 0.16);
        var topLeft = cropUpscaled(img, 0, 0, cw, ch, 3);
        var topRight = cropUpscaled(img, img.width - cw, 0, cw, ch, 3);

        Tesseract.createWorker("eng")
          .then(function (worker) {
            return worker
              .setParameters({
                tessedit_char_whitelist: "0123456789",
                tessedit_pageseg_mode: "7"
              })
              .then(function () {
                return scanForDigits(worker, topRight);
              })
              .then(function (num) {
                if (num) {
                  worker.terminate();
                  resolve(num);
                  return;
                }
                return scanForDigits(worker, topLeft).then(function (num2) {
                  worker.terminate();
                  resolve(num2);
                });
              })
              .catch(function () {
                worker.terminate();
                resolve(null);
              });
          })
          .catch(function () {
            resolve(null);
          });
      };
      img.onerror = function () {
        resolve(null);
      };
      img.src = dataUrl;
    });
  }

  var weekPhotosInput = $("#weekPhotosInput");
  var storyPhotoPreview = $("#storyPhotoPreview");
  var wordsPhotoPreview = $("#wordsPhotoPreview");
  var saveWeekBtn = $("#saveWeekBtn");
  var saveStatus = $("#saveStatus");
  var manualUnitEntry = $("#manualUnitEntry");
  var manualUnitInput = $("#manualUnitInput");
  var manualUnitApplyBtn = $("#manualUnitApplyBtn");

  var pendingStoryPhotoDataUrl = null;
  var pendingWordsPhotoDataUrl = null;
  var pendingStoryAudioLink = null;
  var pendingWordsAudioLink = null;
  var pendingUnitNumber = null;

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

  function updateReadyStatus() {
    saveStatus.style.color = "";
    if (pendingUnitNumber) {
      saveStatus.textContent =
        "✅ Unit " + pendingUnitNumber + "번 사진이 준비되었습니다. 저장버튼을 눌러주세요.";
      manualUnitEntry.hidden = true;
    } else {
      saveStatus.textContent =
        "⚠️ Unit 번호를 사진에서 자동으로 찾지 못했어요. 아래에 직접 입력해 주세요.";
      manualUnitEntry.hidden = false;
    }
  }

  manualUnitApplyBtn.addEventListener("click", function () {
    var value = manualUnitInput.value.trim();
    if (!value) return;
    pendingUnitNumber = value;
    updateReadyStatus();
  });

  weekPhotosInput.addEventListener("change", function () {
    var files = Array.from(weekPhotosInput.files).slice(0, 2);
    if (files.length === 0) return;

    saveStatus.textContent = "사진 불러오는 중...";
    saveStatus.style.color = "";
    pendingUnitNumber = null;
    manualUnitEntry.hidden = true;
    manualUnitInput.value = "";

    var storyOriginalDataUrl = null;
    var tasks = [];

    if (files[0]) {
      tasks.push(
        processPhoto(files[0], storyPhotoPreview).then(function (result) {
          pendingStoryPhotoDataUrl = result.dataUrl;
          pendingStoryAudioLink = result.link;
          storyOriginalDataUrl = result.originalDataUrl;
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
      if (!storyOriginalDataUrl) {
        updateReadyStatus();
        return;
      }
      saveStatus.textContent = "Unit 번호 인식 중...";
      detectUnitNumber(storyOriginalDataUrl).then(function (num) {
        pendingUnitNumber = num;
        updateReadyStatus();
      });
    });
  });

  saveWeekBtn.addEventListener("click", function () {
    var unit = pendingUnitNumber;
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
    } catch (e) {
      saveStatus.textContent = "❌ 저장 실패 (용량 초과 가능성): " + e.message;
      saveStatus.style.color = "#b3261e";
    }
  });

  function loadExisting() {
    var data = DataStore.load();
    var currentUnit = DataStore.getCurrentUnit();

    if (currentUnit) pendingUnitNumber = currentUnit;

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
