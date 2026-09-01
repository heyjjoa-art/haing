// 단어 시험(TEST) 페이지 - 이미 공부한 유닛을 골라 1~4단계를 순서대로 통과하는 복습 시험.
// 1) 영어 보고 한글 뜻 쓰기 → 2) 한글 뜻 보고 영어 쓰기 → 3) 설명 문장 보고 단어 쓰기 →
// 4) 스토리를 들려준 뒤 빈칸 채우기. 각 단계는 그 유닛 단어를 전부(20개) 맞힐 때까지
// 틀린 문제가 다시 나오고, 4단계를 모두 통과하면 트로피 카드와 완전히 같은 기능의
// 무지개 카드를 준다(WordCardStore.awardRainbowCard).
(function () {
  "use strict";

  var unitPickEl = document.getElementById("testUnitPick");
  var unitSelectEl = document.getElementById("testUnitSelect");
  var unitEmptyHintEl = document.getElementById("testUnitEmptyHint");
  var startBtn = document.getElementById("testStartBtn");

  var quizPanelEl = document.getElementById("testQuizPanel");
  var stepEls = Array.prototype.slice.call(document.querySelectorAll(".test-step"));

  var answerCardEl = document.getElementById("testAnswerCard");
  var progressEl = document.getElementById("testProgress");
  var questionEl = document.getElementById("testQuestion");
  var replayBtn = document.getElementById("testReplayBtn");
  var answerInput = document.getElementById("testAnswerInput");
  var feedbackEl = document.getElementById("testFeedback");
  var submitBtn = document.getElementById("testSubmitBtn");
  var nextBtn = document.getElementById("testNextBtn");

  var stageCompleteCardEl = document.getElementById("testStageCompleteCard");
  var stageCompleteTextEl = document.getElementById("testStageCompleteText");
  var stageNextBtn = document.getElementById("testStageNextBtn");

  var storyReadCardEl = document.getElementById("testStoryReadCard");
  var storyReadTextEl = document.getElementById("testStoryReadText");
  var storyReplayBtn = document.getElementById("testStoryReplayBtn");
  var storyReadyBtn = document.getElementById("testStoryReadyBtn");

  var storyFillCardEl = document.getElementById("testStoryFillCard");
  var storyProgressEl = document.getElementById("testStoryProgress");
  var storyFillTextEl = document.getElementById("testStoryFillText");
  var storyFeedbackEl = document.getElementById("testStoryFeedback");
  var storyGradeBtn = document.getElementById("testStoryGradeBtn");

  var switchUnitBtn = document.getElementById("testSwitchUnitBtn");

  function escapeHtml(s) {
    var div = document.createElement("div");
    div.textContent = s == null ? "" : String(s);
    return div.innerHTML;
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

  function normalizeEn(s) {
    return String(s || "").trim().toLowerCase();
  }

  function normalizeKo(s) {
    return String(s || "").trim().replace(/\s+/g, "");
  }

  // ── 유닛 목록: 단어 + 본문이 둘 다 등록된(=스토리 빈칸까지 낼 수 있는) 유닛만. ──
  function buildUnitCandidates() {
    var all = DataStore.getAllUnits();
    var withStory = all.filter(function (entry) {
      return entry.data && entry.data.words && entry.data.words.length && entry.data.storyText && entry.data.storyText.trim();
    });
    if (all.length === 0) {
      // 등록된 유닛이 하나도 없으면 다른 페이지들과 마찬가지로 기본 샘플(Unit 15)로 시험을 볼 수 있게 한다.
      withStory = [{ unit: "unspecified", data: null }];
    }
    return withStory;
  }

  function unitLabel(entry) {
    if (entry.unit === "unspecified") return "기본 단어 (Unit 15)";
    return "Unit " + entry.unit;
  }

  function populateUnitSelect() {
    var candidates = buildUnitCandidates();
    unitSelectEl.innerHTML = "";
    if (candidates.length === 0) {
      unitEmptyHintEl.hidden = false;
      unitSelectEl.hidden = true;
      startBtn.disabled = true;
      return;
    }
    unitEmptyHintEl.hidden = true;
    unitSelectEl.hidden = false;
    startBtn.disabled = false;
    candidates.forEach(function (entry) {
      var opt = document.createElement("option");
      opt.value = entry.unit;
      opt.textContent = unitLabel(entry);
      unitSelectEl.appendChild(opt);
    });
  }

  // ── 시험 상태 ──
  var currentUnit = null;
  var WORDS = [];
  var TOTAL = 0;
  var stageIndex = 0;
  var queue = [];
  var currentItem = null;
  var correctSoFar = 0;

  var STAGE_DEFS = [
    {
      label: "1단계 (영어 → 한글 뜻)",
      prompt: function (w) {
        return (w.emoji ? w.emoji + "  " : "") + w.word.toUpperCase();
      },
      speak: null,
      check: function (input, w) {
        return normalizeKo(input) === normalizeKo(w.meaningKo);
      },
      correctDisplay: function (w) {
        return w.meaningKo;
      },
      placeholder: "한글 뜻을 입력하세요"
    },
    {
      label: "2단계 (한글 뜻 → 영어)",
      prompt: function (w) {
        return w.meaningKo;
      },
      speak: null,
      check: function (input, w) {
        return normalizeEn(input) === normalizeEn(w.word);
      },
      correctDisplay: function (w) {
        return w.word.toUpperCase();
      },
      placeholder: "영어 단어를 입력하세요"
    },
    {
      label: "3단계 (설명 문장 → 단어)",
      prompt: function (w) {
        return w.definition || w.word;
      },
      speak: function (w) {
        return w.definition || w.word;
      },
      check: function (input, w) {
        return normalizeEn(input) === normalizeEn(w.word);
      },
      correctDisplay: function (w) {
        return w.word.toUpperCase();
      },
      placeholder: "영어 단어를 입력하세요"
    }
  ];

  function updateStepDots() {
    stepEls.forEach(function (el, i) {
      el.classList.toggle("active", i === stageIndex);
      el.classList.toggle("done", i < stageIndex);
    });
  }

  function showOnly(el) {
    [answerCardEl, stageCompleteCardEl, storyReadCardEl, storyFillCardEl].forEach(function (panel) {
      panel.hidden = panel !== el;
    });
  }

  function resetToUnitPicker() {
    Tts.stop();
    quizPanelEl.hidden = true;
    unitPickEl.hidden = false;
    populateUnitSelect();
  }

  function startStage(idx) {
    stageIndex = idx;
    updateStepDots();
    if (idx < STAGE_DEFS.length) {
      correctSoFar = 0;
      queue = shuffle(WORDS.slice());
      showOnly(answerCardEl);
      nextItem();
    } else {
      startStoryStage();
    }
  }

  function nextItem() {
    if (queue.length === 0) {
      stageComplete();
      return;
    }
    currentItem = queue.shift();
    renderItem();
  }

  function renderItem() {
    var stage = STAGE_DEFS[stageIndex];
    progressEl.textContent = "정답 " + correctSoFar + " / " + TOTAL;
    questionEl.textContent = stage.prompt(currentItem);
    answerInput.placeholder = stage.placeholder;
    answerInput.value = "";
    answerInput.disabled = false;
    feedbackEl.textContent = "";
    feedbackEl.className = "test-feedback";
    submitBtn.hidden = false;
    nextBtn.hidden = true;
    Tts.stop();
    if (stage.speak) {
      replayBtn.hidden = false;
      Tts.speak(stage.speak(currentItem));
    } else {
      replayBtn.hidden = true;
    }
    answerInput.focus();
  }

  function submitAnswer() {
    if (answerInput.disabled) return;
    var stage = STAGE_DEFS[stageIndex];
    var ok = stage.check(answerInput.value, currentItem);
    answerInput.disabled = true;
    submitBtn.hidden = true;
    nextBtn.hidden = false;
    nextBtn.focus();

    if (ok) {
      correctSoFar++;
      progressEl.textContent = "정답 " + correctSoFar + " / " + TOTAL;
      feedbackEl.textContent = "✅ 정답이에요!";
      feedbackEl.className = "test-feedback test-feedback-correct";
    } else {
      feedbackEl.textContent = "❌ 아쉬워요! 정답은 " + stage.correctDisplay(currentItem) + " 였어요. 이 단어는 조금 뒤에 다시 나와요.";
      feedbackEl.className = "test-feedback test-feedback-wrong";
      queue.push(currentItem);
    }
  }

  function stageComplete() {
    showOnly(stageCompleteCardEl);
    if (stageIndex < STAGE_DEFS.length) {
      stageCompleteTextEl.textContent =
        "🎉 " + STAGE_DEFS[stageIndex].label + " 완료! " + TOTAL + "개 단어를 모두 맞혔어요!";
    }
    stageNextBtn.onclick = function () {
      startStage(stageIndex + 1);
    };
  }

  // ── 4단계: 스토리 읽어주기 + 빈칸 채우기 ──
  var storyFullText = "";
  var storyBlanks = []; // [{ word, start, end, surface }]

  function buildStoryBlanks(fullText, words) {
    var used = [];
    var blanks = [];
    words.forEach(function (w) {
      var word = w.word;
      if (!word) return;
      var escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      // 단어의 활용형(-s, -ed, -ing 등)까지 잡아내도록 뒤에 소문자 0~4글자를 더 허용한다.
      var re = new RegExp("\\b" + escaped + "[a-z]{0,4}\\b", "gi");
      var m;
      while ((m = re.exec(fullText)) !== null) {
        var start = m.index;
        var end = start + m[0].length;
        var overlaps = used.some(function (r) {
          return start < r[1] && end > r[0];
        });
        if (!overlaps) {
          used.push([start, end]);
          blanks.push({ word: word, start: start, end: end, surface: m[0] });
          break;
        }
      }
    });
    blanks.sort(function (a, b) {
      return a.start - b.start;
    });
    return blanks;
  }

  function paragraphsToHtml(text) {
    return text
      .split(/\n\s*\n/)
      .map(function (p) {
        return "<p>" + p + "</p>";
      })
      .join("");
  }

  function renderStoryFillHtml() {
    var html = "";
    var cursor = 0;
    storyBlanks.forEach(function (b, i) {
      html += escapeHtml(storyFullText.slice(cursor, b.start));
      html +=
        '<input type="text" class="test-story-blank" data-idx="' +
        i +
        '" autocomplete="off" autocapitalize="off" spellcheck="false">';
      cursor = b.end;
    });
    html += escapeHtml(storyFullText.slice(cursor));
    return paragraphsToHtml(html);
  }

  function startStoryStage() {
    var paragraphs = DataStore.getStoryParagraphs(currentUnit);
    storyFullText = paragraphs.join("\n\n");
    storyBlanks = buildStoryBlanks(storyFullText, WORDS);

    showOnly(storyReadCardEl);
    storyReadTextEl.innerHTML = paragraphsToHtml(escapeHtml(storyFullText));

    Tts.stop();
    Tts.speak(storyFullText);
  }

  storyReplayBtn.addEventListener("click", function () {
    Tts.stop();
    Tts.speak(storyFullText);
  });

  storyReadyBtn.addEventListener("click", function () {
    Tts.stop();
    showOnly(storyFillCardEl);
    storyFillTextEl.innerHTML = renderStoryFillHtml();
    storyFeedbackEl.textContent = "";
    storyFeedbackEl.className = "test-feedback";
    updateStoryProgress();
    var firstInput = storyFillTextEl.querySelector(".test-story-blank");
    if (firstInput) firstInput.focus();
  });

  function updateStoryProgress() {
    var inputs = storyFillTextEl.querySelectorAll(".test-story-blank");
    var done = storyFillTextEl.querySelectorAll(".test-story-blank:disabled").length;
    storyProgressEl.textContent = "정답 " + done + " / " + inputs.length;
  }

  storyGradeBtn.addEventListener("click", function () {
    var inputs = storyFillTextEl.querySelectorAll(".test-story-blank");
    inputs.forEach(function (inp) {
      if (inp.disabled) return;
      var idx = parseInt(inp.dataset.idx, 10);
      var answer = normalizeEn(storyBlanks[idx].surface);
      if (normalizeEn(inp.value) === answer) {
        inp.disabled = true;
        inp.classList.remove("test-blank-wrong");
        inp.classList.add("test-blank-correct");
      } else {
        inp.classList.add("test-blank-wrong");
        inp.value = "";
      }
    });
    updateStoryProgress();

    var remaining = storyFillTextEl.querySelectorAll(".test-story-blank:not(:disabled)").length;
    if (remaining === 0) {
      storyFeedbackEl.textContent = "🎉 20개 빈칸을 모두 맞혔어요!";
      storyFeedbackEl.className = "test-feedback test-feedback-correct";
      finishAllStages();
    } else {
      storyFeedbackEl.textContent = "❌ 아직 " + remaining + "개 남았어요. 틀린 칸은 지워졌으니 다시 써보세요!";
      storyFeedbackEl.className = "test-feedback test-feedback-wrong";
    }
  });

  // ── 4단계까지 전부 통과: 무지개 카드 지급 ──
  function finishAllStages() {
    var reward = WordCardStore.awardRainbowCard(currentUnit);
    if (reward) {
      WordCardPopup.show(reward, "index.html", "홈으로 🎉", {
        title: "🌈 축하합니다!",
        subtitle: "1~4단계를 모두 통과했어요! 무지개 카드를 받았어요."
      });
    } else {
      window.setTimeout(function () {
        alert("🎉 정말 잘했어요! 이 유닛은 이미 무지개 카드를 받았어요.\n복습 삼아 다시 풀어본 거예요!");
        resetToUnitPicker();
      }, 300);
    }
  }

  // ── 이벤트 연결 ──
  submitBtn.addEventListener("click", submitAnswer);
  answerInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      if (!answerInput.disabled) {
        submitAnswer();
      } else if (!nextBtn.hidden) {
        nextBtn.click();
      }
    }
  });
  nextBtn.addEventListener("click", nextItem);
  replayBtn.addEventListener("click", function () {
    var stage = STAGE_DEFS[stageIndex];
    if (stage && stage.speak) {
      Tts.stop();
      Tts.speak(stage.speak(currentItem));
    }
  });

  switchUnitBtn.addEventListener("click", resetToUnitPicker);

  startBtn.addEventListener("click", function () {
    var candidates = buildUnitCandidates();
    if (candidates.length === 0) return;
    currentUnit = unitSelectEl.value;
    WORDS = DataStore.getWords(currentUnit) || [];
    TOTAL = WORDS.length;
    if (TOTAL === 0) {
      alert("이 유닛에는 아직 단어가 없어요.");
      return;
    }
    unitPickEl.hidden = true;
    quizPanelEl.hidden = false;
    startStage(0);
  });

  populateUnitSelect();
})();
