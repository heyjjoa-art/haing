// 업로드된 사진(dataURL) 안에서 QR코드를 찾아 그 안에 담긴 값(보통 음원 재생 링크)을 읽어온다.
// 사진 전체를 훑어도 못 찾으면, QR은 보통 사진의 한쪽 구석에 작게 찍혀 있으므로
// 네 귀퉁이를 확대해서 한 번 더 시도한다.
function decodeFromCanvas(canvas) {
  var ctx = canvas.getContext("2d");
  var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  var result = jsQR(imageData.data, imageData.width, imageData.height, {
    inversionAttempts: "attemptBoth"
  });
  return result ? result.data : null;
}

function tryFullImage(img, maxSize) {
  var canvas = document.createElement("canvas");
  var scale = Math.min(1, maxSize / Math.max(img.width, img.height));
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
  return decodeFromCanvas(canvas);
}

function tryCorners(img) {
  var cropFractions = [0.5, 0.35];
  var corners = ["tl", "tr", "bl", "br"];

  for (var f = 0; f < cropFractions.length; f++) {
    var cropW = img.width * cropFractions[f];
    var cropH = img.height * cropFractions[f];

    for (var c = 0; c < corners.length; c++) {
      var sx = corners[c].indexOf("l") !== -1 ? 0 : img.width - cropW;
      var sy = corners[c].indexOf("t") !== -1 ? 0 : img.height - cropH;

      var canvas = document.createElement("canvas");
      var upscale = 2;
      canvas.width = Math.round(cropW * upscale);
      canvas.height = Math.round(cropH * upscale);
      canvas
        .getContext("2d")
        .drawImage(img, sx, sy, cropW, cropH, 0, 0, canvas.width, canvas.height);
      var found = decodeFromCanvas(canvas);
      if (found) return found;
    }
  }
  return null;
}

function decodeQrFromDataUrl(dataUrl) {
  return new Promise(function (resolve) {
    var img = new Image();
    img.onload = function () {
      try {
        var found = tryFullImage(img, 1600);
        if (!found) found = tryFullImage(img, Math.max(img.width, img.height));
        if (!found) found = tryCorners(img);
        resolve(found);
      } catch (e) {
        console.warn("QR 인식 실패:", e);
        resolve(null);
      }
    };
    img.onerror = function () {
      resolve(null);
    };
    img.src = dataUrl;
  });
}
