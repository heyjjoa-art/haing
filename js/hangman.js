(function () {
  "use strict";

  var MAX_WRONG = 6;
  var ACTIVE_WORDS = DataStore.getWords();

  // 세 단계 모두 20개 단어 전부를 다루되, 직접 맞혀야 하는 글자 비율만 다르게 한다.
  // 쉬운 단계: 30%만 맞히면 됨(70% 미리 보여줌) / 중간: 70% / 어려운: 100%(전부 직접 맞혀야 함)
  var STAGES = {
    easy: {
      label: "쉬운 단계",
      guessFraction: 0.3,
      words: ACTIVE_WORDS
    },
    medium: {
      label: "중간 단계",
      guessFraction: 0.7,
      words: ACTIVE_WORDS
    },
    hard: {
      label: "어려운 단계",
      guessFraction: 1.0,
      words: ACTIVE_WORDS
    }
  };

  var KEYBOARD_ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];

  var easyTab = document.getElementById("easyTab");
  var mediumTab = document.getElementById("mediumTab");
  var hardTab = document.getElementById("hardTab");
  var stageProgressEl = document.getElementById("stageProgress");
  var stageTotalEl = document.getElementById("stageTotal");
  var livesLeftEl = document.getElementById("livesLeft");
  var hintTextEl = document.getElementById("hintText");
  var wordBlanksEl = document.getElementById("wordBlanks");
  var keyboardEl = document.getElementById("keyboard");
  var resultBannerEl = document.getElementById("resultBanner");
  var resultTextEl = document.getElementById("resultText");
  var nextWordBtn = document.getElementById("nextWordBtn");
  var svgEl = document.getElementById("hangmanSvg");
  var hintReplayBtn = document.getElementById("hintReplayBtn");

  var tabs = { easy: easyTab, medium: mediumTab, hard: hardTab };

  var STAGE_ORDER = ["easy", "medium", "hard"];
  var TOTAL_ALL_WORDS = ACTIVE_WORDS.length;

  var currentStageKey = "easy";
  var stageCyclesDone = {};
  var queue = [];
  var completedCount = 0;
  var overallCompleted = 0;
  var hardStageWins = 0;
  var hardStageTotal = 0;
  var currentWord = null;
  var guessedLetters = [];
  var revealedPositions = [];
  var wrongCount = 0;
  var gameOver = false;

  function speakHint() {
    // 화면 힌트 글자는 정답을 가리지만, 음성은 원래 문장(정답 발음 포함)을 그대로 읽어준다.
    Tts.stop();
    Tts.speak(currentWord.definition);
  }

  function maskAnswerInText(text, word) {
    var escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    var re = new RegExp("\\b" + escaped + "\\b", "gi");
    var blank = new Array(word.length + 1).join("_");
    return text.replace(re, blank);
  }

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

  function switchStage(stageKey) {
    currentStageKey = stageKey;
    ProgressStore.setCustomState("hangmanStage", stageKey);
    Object.keys(tabs).forEach(function (key) {
      tabs[key].classList.toggle("active", key === stageKey);
    });
    queue = shuffle(STAGES[stageKey].words);
    completedCount = 0;
    if (stageKey === "hard") {
      hardStageWins = 0;
      hardStageTotal = 0;
    }
    stageTotalEl.textContent = String(STAGES[stageKey].words.length);
    updateProgress();

    if (STAGES[stageKey].words.length === 0) {
      hintTextEl.textContent = "이 단계에 해당하는 단어가 없어요. 단어를 더 추가해 주세요.";
      wordBlanksEl.textContent = "";
      keyboardEl.innerHTML = "";
      resultBannerEl.hidden = true;
      return;
    }

    startNextWord();
  }

  function updateProgress() {
    stageProgressEl.textContent = String(completedCount);
  }

  function startNextWord() {
    if (queue.length === 0) {
      // 이 단계를 한 바퀴 다 돌았으면 다음(더 어려운) 단계로 자동으로 이어간다.
      var idx = STAGE_ORDER.indexOf(currentStageKey);
      var nextStage = null;
      for (var i = idx + 1; i < STAGE_ORDER.length; i++) {
        if (STAGES[STAGE_ORDER[i]].words.length > 0) {
          nextStage = STAGE_ORDER[i];
          break;
        }
      }
      // 어려운 단계까지 다 마쳤으면 처음(쉬운 단계)부터 다시 연습한다.
      switchStage(nextStage || "easy");
      return;
    }
    currentWord = queue.shift();
    guessedLetters = [];
    wrongCount = 0;
    gameOver = false;

    resultBannerEl.hidden = true;
    livesLeftEl.textContent = String(MAX_WRONG - wrongCount);
    hintTextEl.textContent = "💡 " + maskAnswerInText(currentWord.definition, currentWord.word);
    speakHint();

    var wordLower = currentWord.word.toLowerCase();
    var guessFraction = STAGES[currentStageKey].guessFraction;
    var revealCount = Math.round(wordLower.length * (1 - guessFraction));
    // 아무리 쉬운 단계라도 최소 한 글자는 직접 맞혀야 한다.
    revealCount = Math.min(revealCount, wordLower.length - 1);
    revealedPositions = wordLower.split("").map(function (ch, i) {
      return i < revealCount;
    });

    resetHangmanParts();
    renderBlanks();
    renderKeyboard();
  }

  function resetHangmanParts() {
    for (var i = 1; i <= MAX_WRONG; i++) {
      var el = svgEl.querySelector(".p" + i);
      if (el) el.classList.remove("show");
    }
  }

  function renderBlanks() {
    var letters = currentWord.word.toLowerCase().split("");
    var display = letters
      .map(function (ch, i) {
        var revealed = revealedPositions[i] || guessedLetters.indexOf(ch) !== -1;
        return revealed ? ch.toUpperCase() : "_";
      })
      .join(" ");
    wordBlanksEl.textContent = display;
  }

  function renderKeyboard() {
    keyboardEl.innerHTML = "";
    KEYBOARD_ROWS.forEach(function (row, rowIdx) {
      var rowEl = document.createElement("div");
      rowEl.className = "keyboard-row keyboard-row-" + (rowIdx + 1);

      row.split("").forEach(function (letter) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "key-btn";
        btn.textContent = letter.toUpperCase();

        if (guessedLetters.indexOf(letter) !== -1) {
          btn.disabled = true;
          if (currentWord.word.toLowerCase().indexOf(letter) !== -1) {
            btn.classList.add("correct");
          }
        }

        btn.addEventListener("click", function () {
          onGuess(letter, btn);
        });

        rowEl.appendChild(btn);
      });

      keyboardEl.appendChild(rowEl);
    });
  }

  function onGuess(letter, btnEl) {
    if (gameOver) return;
    if (guessedLetters.indexOf(letter) !== -1) return;

    guessedLetters.push(letter);
    var wordLower = currentWord.word.toLowerCase();

    if (wordLower.indexOf(letter) !== -1) {
      btnEl.classList.add("correct");
      btnEl.disabled = true;
      renderBlanks();
      checkWin();
    } else {
      btnEl.classList.add("wrong");
      btnEl.disabled = true;
      wrongCount++;
      livesLeftEl.textContent = String(Math.max(0, MAX_WRONG - wrongCount));
      var partEl = svgEl.querySelector(".p" + wrongCount);
      if (partEl) partEl.classList.add("show");
      if (wrongCount >= MAX_WRONG) {
        endRound(false);
      }
    }
  }

  function checkWin() {
    var wordLower = currentWord.word.toLowerCase();
    var allRevealed = wordLower.split("").every(function (ch, i) {
      return revealedPositions[i] || guessedLetters.indexOf(ch) !== -1;
    });
    if (allRevealed) {
      endRound(true);
    }
  }

  function endRound(didWin) {
    gameOver = true;
    completedCount++;
    overallCompleted++;
    updateProgress();
    ProgressStore.setStepProgress("hangman", Math.min(overallCompleted, TOTAL_ALL_WORDS), TOTAL_ALL_WORDS);

    if (currentStageKey === "hard") {
      hardStageTotal++;
      if (didWin) hardStageWins++;
    }

    if (completedCount === STAGES[currentStageKey].words.length) {
      stageCyclesDone[currentStageKey] = true;
      // 4번 게임은 어려운 단계까지 한 바퀴 마치면 완료로 친다.
      if (currentStageKey === "hard") {
        ProgressStore.markDone("hangman");

        var score = hardStageTotal > 0 ? Math.round((hardStageWins / hardStageTotal) * 100) : 0;
        var isBonus = score >= 90;
        var cards = [];
        var firstCard = CardStore.awardRandomCard();
        if (firstCard) cards.push(firstCard);
        if (isBonus) {
          var bonusCard = CardStore.awardRandomCard();
          if (bonusCard) cards.push(bonusCard);
        }

        if (cards.length > 0) {
          CardPopup.show(cards, "index.html", "홈으로 🎉", {
            subtitle:
              "점수 " +
              score +
              "점" +
              (isBonus ? " · 90점 이상이라 보너스 카드 한 장 더!" : "")
          });
        }
      }
    }

    disableAllKeys();

    if (didWin) {
      resultTextEl.textContent = "🎉 정답이에요! " + currentWord.word.toUpperCase();
    } else {
      resultTextEl.textContent =
        "😢 아쉬워요! 정답은 " + currentWord.word.toUpperCase() + " 였어요.";
      wordBlanksEl.textContent = currentWord.word.toUpperCase().split("").join(" ");
    }
    resultBannerEl.hidden = false;
  }

  function disableAllKeys() {
    var btns = keyboardEl.querySelectorAll(".key-btn");
    btns.forEach(function (b) {
      b.disabled = true;
    });
  }

  Object.keys(tabs).forEach(function (key) {
    tabs[key].addEventListener("click", function () {
      if (currentStageKey !== key) switchStage(key);
    });
  });

  nextWordBtn.addEventListener("click", startNextWord);
  hintReplayBtn.addEventListener("click", speakHint);

  // 전에 하던 단계가 있으면 거기부터 이어서 시작한다.
  var savedStage = ProgressStore.getCustomState("hangmanStage");
  switchStage(savedStage && STAGES[savedStage] ? savedStage : "easy");
})();
