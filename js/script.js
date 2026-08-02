(function () {
  "use strict";

  var STORAGE_KEY = "haingData";

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

  function dataURLToBlob(dataUrl) {
    var parts = dataUrl.split(",");
    var mimeMatch = parts[0].match(/:(.*?);/);
    var mime = mimeMatch ? mimeMatch[1] : "";
    var binary = atob(parts[1]);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new Blob([bytes], { type: mime });
  }

  // ---- 책 사진 업로드 ----
  var bookPhotoInput = $("#bookPhotoInput");
  var bookPhotoPreviewBox = $("#bookPhotoPreviewBox");
  var bookPhotoData = null; // { name, dataUrl }

  function renderBookPhoto() {
    if (bookPhotoData) {
      bookPhotoPreviewBox.innerHTML =
        '<img src="' + bookPhotoData.dataUrl + '" alt="영어책 사진">';
    } else {
      bookPhotoPreviewBox.innerHTML =
        '<span class="placeholder">사진 미리보기</span>';
    }
  }

  bookPhotoInput.addEventListener("change", function () {
    var file = bookPhotoInput.files[0];
    if (!file) return;
    fileToDataURL(file).then(function (dataUrl) {
      bookPhotoData = { name: file.name, dataUrl: dataUrl };
      renderBookPhoto();
      persist();
    });
  });

  // ---- 음원 업로드 + QR 생성 컨트롤러 (본문/단어 공통) ----
  function createAudioController(opts) {
    var inputEl = $(opts.input);
    var nameEl = $(opts.name);
    var playerEl = $(opts.player);
    var qrBoxEl = $(opts.qrBox);

    var data = null; // { name, dataUrl }
    var objectUrl = null;
    var qrInstance = null;

    function renderQr(url) {
      qrBoxEl.innerHTML = "";
      qrInstance = new QRCode(qrBoxEl, {
        text: url,
        width: 140,
        height: 140,
        correctLevel: QRCode.CorrectLevel.M
      });
      var note = document.createElement("div");
      note.className = "qr-note";
      note.textContent =
        "※ 이 브라우저에서만 재생되는 임시 QR입니다. 다른 기기에서 스캔하려면 음원을 인터넷에 올린 후 그 주소로 QR을 다시 만들어야 합니다.";
      qrBoxEl.appendChild(note);
    }

    function apply(file, dataUrl) {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      objectUrl = URL.createObjectURL(file);
      nameEl.textContent = file.name;
      playerEl.src = objectUrl;
      playerEl.style.display = "block";
      renderQr(objectUrl);
      data = { name: file.name, dataUrl: dataUrl };
    }

    inputEl.addEventListener("change", function () {
      var file = inputEl.files[0];
      if (!file) return;
      fileToDataURL(file).then(function (dataUrl) {
        apply(file, dataUrl);
        persist();
      });
    });

    return {
      loadSaved: function (saved) {
        if (!saved) return;
        var blob = dataURLToBlob(saved.dataUrl);
        var file = new File([blob], saved.name, { type: blob.type });
        apply(file, saved.dataUrl);
      },
      getData: function () {
        return data;
      }
    };
  }

  var storyAudio = createAudioController({
    input: "#storyAudioInput",
    name: "#storyAudioName",
    player: "#storyAudioPlayer",
    qrBox: "#storyQrBox"
  });

  var wordAudio = createAudioController({
    input: "#wordAudioInput",
    name: "#wordAudioName",
    player: "#wordAudioPlayer",
    qrBox: "#wordQrBox"
  });

  // ---- 본문 텍스트 ----
  var storyTextEl = $("#storyText");
  storyTextEl.addEventListener("input", debounce(persist, 300));

  // ---- 단어 리스트 ----
  var wordListEl = $("#wordList");
  var wordTemplate = $("#wordItemTemplate");

  function addWordItem(spelling, meaning) {
    var frag = wordTemplate.content.cloneNode(true);
    var item = frag.querySelector(".word-item");
    var spellingEl = item.querySelector(".word-spelling");
    var meaningEl = item.querySelector(".word-meaning");
    var removeBtn = item.querySelector(".remove-word-btn");

    spellingEl.value = spelling || "";
    meaningEl.value = meaning || "";

    spellingEl.addEventListener("input", debounce(persist, 300));
    meaningEl.addEventListener("input", debounce(persist, 300));
    removeBtn.addEventListener("click", function () {
      item.remove();
      persist();
    });

    wordListEl.appendChild(item);
  }

  $("#addWordBtn").addEventListener("click", function () {
    addWordItem("", "");
    persist();
  });

  function collectWords() {
    var items = wordListEl.querySelectorAll(".word-item");
    var words = [];
    items.forEach(function (item) {
      var spelling = item.querySelector(".word-spelling").value.trim();
      var meaning = item.querySelector(".word-meaning").value.trim();
      if (spelling || meaning) {
        words.push({ spelling: spelling, meaning: meaning });
      }
    });
    return words;
  }

  // ---- 저장 / 불러오기 ----
  function buildState() {
    return {
      bookPhoto: bookPhotoData,
      story: {
        text: storyTextEl.value,
        audio: storyAudio.getData()
      },
      words: collectWords(),
      wordAudio: wordAudio.getData()
    };
  }

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(buildState()));
    } catch (e) {
      console.warn("저장 실패 (용량 초과 가능성):", e);
    }
  }

  function debounce(fn, delay) {
    var timer = null;
    return function () {
      clearTimeout(timer);
      timer = setTimeout(fn, delay);
    };
  }

  function loadState() {
    var raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      addWordItem("", "");
      return;
    }
    var state;
    try {
      state = JSON.parse(raw);
    } catch (e) {
      addWordItem("", "");
      return;
    }

    if (state.bookPhoto) {
      bookPhotoData = state.bookPhoto;
      renderBookPhoto();
    }

    if (state.story) {
      storyTextEl.value = state.story.text || "";
      storyAudio.loadSaved(state.story.audio);
    }

    if (state.words && state.words.length) {
      state.words.forEach(function (w) {
        addWordItem(w.spelling, w.meaning);
      });
    } else {
      addWordItem("", "");
    }

    wordAudio.loadSaved(state.wordAudio);
  }

  // ---- 내보내기 / 초기화 ----
  $("#exportBtn").addEventListener("click", function () {
    var blob = new Blob([JSON.stringify(buildState(), null, 2)], {
      type: "application/json"
    });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "haing-data.json";
    a.click();
    URL.revokeObjectURL(url);
  });

  $("#resetBtn").addEventListener("click", function () {
    if (confirm("입력한 내용을 모두 지울까요?")) {
      localStorage.removeItem(STORAGE_KEY);
      location.reload();
    }
  });

  loadState();
})();
