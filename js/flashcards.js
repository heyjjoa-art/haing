(function () {
  "use strict";

  var ACTIVE_WORDS = DataStore.getWords();
  var TOTAL_WORDS = ACTIVE_WORDS.length;

  var progressCountEl = document.getElementById("progressCount");
  var progressTotalEl = document.getElementById("progressTotal");
  var speedModeToggle = document.getElementById("speedModeToggle");

  var dot1 = document.getElementById("dot1");
  var dot2 = document.getElementById("dot2");
  var dot3 = document.getElementById("dot3");

  var flashEmojiEl = document.getElementById("flashEmoji");
  var flashQuestionEl = document.getElementById("flashQuestion");
  var flashDefinitionEl = document.getElementById("flashDefinition");
  var flashWordEl = document.getElementById("flashWord");
  var flashMeaningEl = document.getElementById("flashMeaning");
  var nextStageBtn = document.getElementById("nextStageBtn");
  var replayBtn = document.getElementById("replayBtn");

  var queue = [];
  var completedWords = 0;
  var currentWord = null;
  var currentStage = 1;
  var autoTimer = null;
  var currentSpeechText = null;

  progressTotalEl.textContent = String(TOTAL_WORDS);

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i];
      a[i] = a[j];
      a[j] = tmp;
    }
    return a;
  }

  function updateProgress() {
    progressCountEl.textContent = String(completedWords);
    ProgressStore.setStepProgress("flashcards", completedWords, TOTAL_WORDS);
  }

  function nextWord() {
    if (queue.length === 0) {
      queue = shuffle(ACTIVE_WORDS.slice());
      completedWords = 0;
      updateProgress();
    }
    currentWord = queue.shift();
    currentStage = 1;
    renderStage();
  }

  function renderStage() {
    if (autoTimer) {
      clearTimeout(autoTimer);
      autoTimer = null;
    }

    dot1.classList.toggle("active", currentStage >= 1);
    dot2.classList.toggle("active", currentStage >= 2);
    dot3.classList.toggle("active", currentStage >= 3);

    flashEmojiEl.textContent = currentWord.emoji || "❓";
    flashDefinitionEl.hidden = true;
    flashWordEl.hidden = true;
    flashMeaningEl.hidden = true;

    Tts.stop();
    currentSpeechText = null;
    replayBtn.hidden = true;

    if (currentStage === 1) {
      flashQuestionEl.textContent = "이 그림은 무슨 단어일까요? 생각해보세요!";
      nextStageBtn.textContent = "영어 설명 보기 ▶";
    } else if (currentStage === 2) {
      flashQuestionEl.textContent = "영어로 뜻을 설명하면...";
      flashDefinitionEl.textContent = currentWord.definition;
      flashDefinitionEl.hidden = false;
      nextStageBtn.textContent = "한글 뜻 보기 ▶";
      currentSpeechText = currentWord.definition;
      replayBtn.hidden = false;
      Tts.speak(currentSpeechText);
    } else {
      flashQuestionEl.textContent = "정답은 바로 이 단어예요!";
      flashDefinitionEl.textContent = currentWord.definition;
      flashDefinitionEl.hidden = false;
      flashWordEl.textContent = currentWord.word.toUpperCase();
      flashWordEl.hidden = false;
      flashMeaningEl.textContent = currentWord.meaningKo;
      flashMeaningEl.hidden = false;
      nextStageBtn.textContent = "다음 단어 ▶";
      currentSpeechText = currentWord.word;
      replayBtn.hidden = false;
      Tts.speak(currentSpeechText);
    }

    if (speedModeToggle.checked) {
      var delay = currentStage === 2 ? 3600 : currentStage === 3 ? 2200 : 1800;
      autoTimer = setTimeout(advance, delay);
    }
  }

  function advance() {
    if (currentStage < 3) {
      currentStage++;
      renderStage();
    } else {
      completedWords++;
      updateProgress();
      if (completedWords >= TOTAL_WORDS) {
        if (ProgressStore.markDone("flashcards")) {
          var card = WordCardStore.awardRandomWordCard();
          if (card) {
            WordCardPopup.show(card, "memory.html", "다음 단계로 ▶");
            return;
          }
        }
        location.href = WordCardPopup.withUnitParam("memory.html");
        return;
      }
      nextWord();
    }
  }

  nextStageBtn.addEventListener("click", advance);

  replayBtn.addEventListener("click", function () {
    if (currentSpeechText) {
      Tts.stop();
      Tts.speak(currentSpeechText);
    }
  });

  speedModeToggle.addEventListener("change", function () {
    if (speedModeToggle.checked) {
      renderStage();
    } else if (autoTimer) {
      clearTimeout(autoTimer);
      autoTimer = null;
    }
  });

  if (TOTAL_WORDS === 0) {
    flashQuestionEl.textContent = "학습할 단어가 없어요. 홈에서 단어를 추가해 주세요.";
    nextStageBtn.hidden = true;
  } else {
    queue = shuffle(ACTIVE_WORDS.slice());
    nextWord();
  }
})();
