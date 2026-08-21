(function () {
  "use strict";

  var storyTitleEl = document.getElementById("storyTitle");
  var bookPageImg = document.getElementById("bookPageImg");
  var storyTextArea = document.getElementById("storyTextArea");
  var listenActionsEl = document.getElementById("listenActions");

  var wordSpans = []; // { start, end, el } - joinedText 안에서 각 단어의 위치
  var joinedText = "";
  var currentReadingEl = null;
  var manuallyStopped = false;
  var boundaryFired = false;
  var fallbackTimer = null;
  var fallbackIndex = 0;

  function render() {
    storyTitleEl.textContent = DataStore.getStoryTitle();

    bookPageImg.src = DataStore.getStoryImage();

    buildStoryText(DataStore.getStoryParagraphs());
    renderListenActions();
  }

  function completeStorybook() {
    var firstTime = ProgressStore.markDone("storybook");
    ProgressStore.markReviewStep("storybook");
    if (firstTime) {
      PraisePopup.show("flashcards.html", "다음 단계로 ▶");
    }
  }

  function buildStoryText(paragraphs) {
    storyTextArea.innerHTML = "";
    wordSpans = [];

    var vocabSet = {};
    DataStore.getWords().forEach(function (w) {
      vocabSet[w.word.toLowerCase()] = true;
    });

    var offset = 0;
    paragraphs.forEach(function (paragraph, pIdx) {
      var p = document.createElement("p");
      var tokens = paragraph.split(/(\s+)/);

      tokens.forEach(function (token) {
        if (token === "") return;
        if (/^\s+$/.test(token)) {
          p.appendChild(document.createTextNode(token));
          offset += token.length;
          return;
        }
        var span = document.createElement("span");
        span.className = "story-word";
        var bare = token.replace(/[^a-zA-Z']/g, "").toLowerCase();
        if (vocabSet[bare]) span.classList.add("vocab-word");
        span.textContent = token;
        p.appendChild(span);
        wordSpans.push({ start: offset, end: offset + token.length, el: span });
        offset += token.length;
      });

      storyTextArea.appendChild(p);
      if (pIdx < paragraphs.length - 1) {
        offset += 1; // paragraphs.join(" ")에서 문단 사이에 들어가는 공백 한 칸
      }
    });

    joinedText = paragraphs.join(" ");
  }

  function clearReadingHighlight() {
    if (currentReadingEl) {
      currentReadingEl.classList.remove("reading");
      currentReadingEl = null;
    }
  }

  function highlightAt(charIndex) {
    clearReadingHighlight();
    var match = wordSpans.find(function (w) {
      return charIndex >= w.start && charIndex < w.end;
    });
    if (match) {
      match.el.classList.add("reading");
      currentReadingEl = match.el;
      match.el.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }

  function stopFallbackHighlighter() {
    if (fallbackTimer) {
      clearTimeout(fallbackTimer);
      fallbackTimer = null;
    }
  }

  // 태블릿/모바일 브라우저는 "지금 읽는 단어" 이벤트(onboundary)를 안 보내주는 경우가
  // 많다. 그럴 때는 단어 글자 수로 읽는 시간을 어림잡아 순서대로 하이라이트를 넘긴다.
  function startFallbackHighlighter(rate) {
    var charsPerSecond = 13 * rate;
    fallbackIndex = 0;

    function step() {
      if (boundaryFired || manuallyStopped) return; // 진짜 이벤트가 살아있으면 이건 멈춘다
      if (fallbackIndex >= wordSpans.length) return;

      var w = wordSpans[fallbackIndex];
      clearReadingHighlight();
      w.el.classList.add("reading");
      currentReadingEl = w.el;
      w.el.scrollIntoView({ block: "center", behavior: "smooth" });

      var text = w.el.textContent;
      var durationMs = Math.max(120, (text.length / charsPerSecond) * 1000);
      fallbackIndex++;
      fallbackTimer = setTimeout(step, durationMs);
    }

    step();
  }

  function makeTtsButton() {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "listen-btn tts";
    btn.textContent = "🔊 영어 음성으로 읽어주기";

    btn.addEventListener("click", function () {
      if (!Tts.isSupported()) {
        btn.textContent = "이 브라우저는 음성 읽기를 지원하지 않아요";
        return;
      }
      if (window.speechSynthesis.speaking) {
        manuallyStopped = true;
        stopFallbackHighlighter();
        Tts.stop();
        clearReadingHighlight();
        btn.classList.remove("playing");
        btn.textContent = "🔊 영어 음성으로 읽어주기";
        return;
      }

      btn.classList.add("playing");
      btn.textContent = "⏸ 읽는 중 (다시 누르면 멈춤)";

      manuallyStopped = false;
      boundaryFired = false;
      stopFallbackHighlighter();
      Tts.stop();

      var speakRate = 0.9;
      Tts.speak(joinedText, {
        rate: speakRate,
        onboundary: function (event) {
          if (event.name === "word" || event.name === undefined) {
            boundaryFired = true;
            stopFallbackHighlighter();
            highlightAt(event.charIndex);
          }
        },
        onend: function () {
          stopFallbackHighlighter();
          clearReadingHighlight();
          btn.classList.remove("playing");
          btn.textContent = "🔊 영어 음성으로 읽어주기";
          if (!manuallyStopped) {
            completeStorybook();
          }
        }
      });

      // 진짜 단어 이벤트가 잠깐(0.6초) 안 오면, 어림잡은 시간으로 대신 넘긴다.
      fallbackTimer = setTimeout(function () {
        if (!boundaryFired && !manuallyStopped) {
          startFallbackHighlighter(speakRate);
        }
      }, 600);

      // 음성 재생이 중간에 끊기거나 onend가 안 오는 경우를 대비해서,
      // 예상 재생 시간이 다 지나면 그래도 완료 처리해준다.
      var estimatedMs = Math.max(3000, (joinedText.length / (13 * speakRate)) * 1000) + 2000;
      setTimeout(function () {
        if (!manuallyStopped) {
          completeStorybook();
        }
      }, estimatedMs);
    });

    return btn;
  }

  function renderListenActions() {
    listenActionsEl.innerHTML = "";
    var ttsBtn = makeTtsButton();
    listenActionsEl.appendChild(ttsBtn);

    var note = document.createElement("p");
    note.className = "listen-note";
    note.textContent = "굵게 표시된 단어는 이번 주 배우는 단어예요. 읽는 부분은 노란색으로 표시돼요.";
    listenActionsEl.appendChild(note);

    // 페이지에 들어오면 바로 읽어준다.
    if (Tts.isSupported()) {
      ttsBtn.click();
    }
  }

  render();
})();
