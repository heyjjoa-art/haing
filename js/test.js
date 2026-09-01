// 단어 시험(TEST) 페이지 - 이미 공부한 유닛을 골라 1~4단계를 순서대로 통과하는 복습 시험.
// 1) 영어 보고 한글 뜻 쓰기 → 2) 한글 뜻 보고 영어 쓰기 → 3) 설명 문장 보고 단어 쓰기 →
// 4) 스토리를 문장 단위로 들려주다 빈칸 앞에서 멈추고, 다 채울 때까지 반복해 들으며 쓰기.
// 각 단계는 그 유닛 단어를 전부 맞힐 때까지 틀린 문제가 다시 나오고, 4단계를 모두
// 통과하면 트로피 카드와 완전히 같은 기능의 무지개 카드를 준다
// (WordCardStore.awardRainbowCard - 기존 1~4번 공부 완주로 받는 골드 트로피와는
// 저장은 같은 배열을 쓰되 완전히 별개의 카드로 구분된다).
(function () {
  "use strict";

  var unitPickEl = document.getElementById("testUnitPick");
  var unitSelectEl = document.getElementById("testUnitSelect");
  var unitEmptyHintEl = document.getElementById("testUnitEmptyHint");
  var restartCheckbox = document.getElementById("testRestartCheckbox");
  var resumeHintEl = document.getElementById("testResumeHint");
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
  var storyReadyBtn = document.getElementById("testStoryReadyBtn");

  var storyFillCardEl = document.getElementById("testStoryFillCard");
  var storyProgressEl = document.getElementById("testStoryProgress");
  var storyFillTextEl = document.getElementById("testStoryFillText");
  var storyReplayBtn = document.getElementById("testStoryReplayBtn");
  var storyFeedbackEl = document.getElementById("testStoryFeedback");
  var storySubmitBtn = document.getElementById("testStoryGradeBtn");

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

  // 3단계 설명 문장 중에는 "A boss is a person in charge..."처럼 정답 단어 자체가
  // 문장 안에 그대로 들어있는 경우가 많다 - 화면 글자뿐 아니라 TTS 음성도 정답을
  // 그대로 읽어버리면 문제가 성립하지 않으므로 둘 다 가려서 보여준다/들려준다.
  function maskWordRegex(word) {
    var escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp("\\b" + escaped + "[a-z]{0,5}\\b", "gi");
  }

  function maskWordForDisplay(text, word) {
    return String(text || "").replace(maskWordRegex(word), function (match) {
      return new Array(match.length + 1).join("_");
    });
  }

  function maskWordForSpeech(text, word) {
    return String(text || "").replace(maskWordRegex(word), "blank");
  }

  // ── 유닛 목록: "4. 스펠링 게임"까지 1~4단계(초등은 2~4단계)를 이미 다 끝낸
  // 유닛만 시험을 볼 수 있다 - 아직 안 배운 단어로 시험을 보는 건 앞뒤가 안 맞기
  // 때문이다. 주간 유닛(본문 있음)은 1~4단계를 다 보고, 초등 단어장은 본문이
  // 없어서 스토리 빈칸(4단계)을 낼 수 없으니 1~3단계만으로 시험을 구성한다.
  function doneHangmanFor(unitKey) {
    return typeof ProgressStore !== "undefined" && ProgressStore.isDoneForUnit && ProgressStore.isDoneForUnit("hangman", unitKey);
  }

  function buildUnitCandidates() {
    var candidates = [];
    var all = DataStore.getAllUnits();
    var pool = all.length > 0 ? all : [{ unit: "unspecified", data: null }];
    pool.forEach(function (entry) {
      var words = DataStore.getWords(entry.unit) || [];
      var hasStory = DataStore.getStoryParagraphs(entry.unit).length > 0;
      if (words.length > 0 && hasStory && doneHangmanFor(entry.unit)) {
        candidates.push({
          unit: entry.unit,
          label: entry.unit === "unspecified" ? "기본 단어 (Unit 15)" : "Unit " + entry.unit,
          isElementary: false
        });
      }
    });
    (DataStore.getElementaryLevels() || []).forEach(function (entry) {
      if (doneHangmanFor(entry.level)) {
        candidates.push({ unit: entry.level, label: entry.level, isElementary: true });
      }
    });
    return candidates;
  }

  // ── 단계 진행 저장 - 1~3단계를 하나 끝낼 때마다 그 유닛의 "여기까지 통과함"을
  // 저장해서, 나중에 같은 유닛을 다시 고르면 이어서 다음 단계부터 시작할 수 있다.
  // 4단계까지 전부 통과하면(무지개 카드 지급 시점) 기록을 지워서 다음 도전은
  // 다시 1단계부터 새로 풀게 한다.
  function testProgressKey(unit) {
    var childId = typeof ChildStore !== "undefined" && ChildStore.getActive();
    var prefix = childId ? childId + "_" : "guest_";
    return "haingTestProgress_" + prefix + String(unit);
  }

  function getSavedStageCount(unit) {
    var n = parseInt(localStorage.getItem(testProgressKey(unit)), 10);
    return isNaN(n) ? 0 : Math.min(n, STAGE_COUNT - 1);
  }

  function saveStageCount(unit, n) {
    localStorage.setItem(testProgressKey(unit), String(n));
  }

  function clearStageCount(unit) {
    localStorage.removeItem(testProgressKey(unit));
  }

  function updateResumeHint() {
    var unit = unitSelectEl.value;
    var saved = unit ? getSavedStageCount(unit) : 0;
    if (saved > 0) {
      resumeHintEl.hidden = false;
      resumeHintEl.textContent = "📌 이 유닛은 " + saved + "단계까지 통과했어요. 이어서 " + (saved + 1) + "단계부터 시작해요.";
    } else {
      resumeHintEl.hidden = true;
      resumeHintEl.textContent = "";
    }
  }

  var candidatesByUnit = {};

  function populateUnitSelect() {
    var candidates = buildUnitCandidates();
    candidatesByUnit = {};
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
      candidatesByUnit[entry.unit] = entry;
      var opt = document.createElement("option");
      opt.value = entry.unit;
      opt.textContent = entry.label + (entry.isElementary ? " (1~3단계)" : "");
      unitSelectEl.appendChild(opt);
    });
    restartCheckbox.checked = false;
    updateResumeHint();
  }

  unitSelectEl.addEventListener("change", updateResumeHint);

  // ── 시험 상태 ──
  var STAGE_COUNT = 4; // 0~2: 단어 퀴즈, 3: 스토리 빈칸(초등 단어장은 이 단계 없이 3단계까지만)
  var currentUnit = null;
  var currentUnitIsElementary = false;
  var WORDS = [];
  var TOTAL = 0;
  var stageIndex = 0;
  var queue = [];
  var currentItem = null;
  var correctSoFar = 0;
  var correctWordKeys = null; // Set-비슷한 객체 - 이번 단계에서 이미 맞힌 단어(중복 집계 방지)
  var awaitingNext = false; // 채점 직후 "다음"을 누르기 전까지는 새 문제로 못 넘어가게 막는 잠금

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
        return maskWordForDisplay(w.definition || w.word, w.word);
      },
      speak: function (w) {
        return maskWordForSpeech(w.definition || w.word, w.word);
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
    awaitingNext = false;
    updateStepDots();
    if (idx < STAGE_DEFS.length) {
      correctSoFar = 0;
      correctWordKeys = {};
      queue = shuffle(WORDS.slice());
      showOnly(answerCardEl);
      nextItem();
    } else if (currentUnitIsElementary) {
      // 초등 단어장은 본문이 없어서 4단계(스토리 빈칸)를 낼 수 없다 - 1~3단계만
      // 다 맞히면 바로 통과로 치고 무지개 카드를 준다.
      finishAllStages();
    } else {
      startStoryStage();
    }
  }

  // 큐가 비어도, 실제로 맞힌 고유 단어 수가 전체 단어 수와 정확히 같을 때만 그
  // 단계를 완료로 친다 - 어떤 이유로든(연타 등) 큐가 먼저 비어버려도 이 확인을
  // 통과하지 못하면 그 단어를 다시 큐에 넣어 계속 재도전하게 한다.
  function nextItem() {
    if (queue.length === 0) {
      if (Object.keys(correctWordKeys).length >= TOTAL) {
        stageComplete();
      } else {
        queue = shuffle(WORDS.filter(function (w) {
          return !correctWordKeys[normalizeEn(w.word)];
        }));
      }
      if (queue.length === 0) {
        stageComplete();
        return;
      }
    }
    currentItem = queue.shift();
    renderItem();
  }

  function renderItem() {
    var stage = STAGE_DEFS[stageIndex];
    awaitingNext = false;
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
    awaitingNext = true;
    nextBtn.focus();

    var key = normalizeEn(currentItem.word);
    if (ok && !correctWordKeys[key]) {
      correctWordKeys[key] = true;
      correctSoFar = Object.keys(correctWordKeys).length;
      progressEl.textContent = "정답 " + correctSoFar + " / " + TOTAL;
      feedbackEl.textContent = "✅ 정답이에요!";
      feedbackEl.className = "test-feedback test-feedback-correct";
    } else if (ok) {
      // 이미 한 번 맞힌 단어(재도전 큐 정리 과정의 우연한 중복)라도 다시 맞혔다는
      // 사실은 그대로 알려준다.
      feedbackEl.textContent = "✅ 정답이에요!";
      feedbackEl.className = "test-feedback test-feedback-correct";
    } else {
      feedbackEl.textContent = "❌ 아쉬워요! 정답은 " + stage.correctDisplay(currentItem) + " 였어요. 이 단어는 조금 뒤에 다시 나와요.";
      feedbackEl.className = "test-feedback test-feedback-wrong";
      queue.push(currentItem);
    }
  }

  function goNext() {
    if (!awaitingNext) return;
    awaitingNext = false;
    nextItem();
  }

  function stageComplete() {
    showOnly(stageCompleteCardEl);
    if (stageIndex < STAGE_DEFS.length) {
      stageCompleteTextEl.textContent =
        "🎉 " + STAGE_DEFS[stageIndex].label + " 완료! " + TOTAL + "개 단어를 모두 맞혔어요!";
      saveStageCount(currentUnit, stageIndex + 1);
    }
    stageNextBtn.onclick = function () {
      startStage(stageIndex + 1);
    };
  }

  // ── 4단계: 문장을 들려주다 빈칸 앞에서 멈추고, 맞히면 이어서 다음 문장을 들려준다 ──
  var storyFullText = "";
  var storySegments = []; // segments[i] = blanks[i] 앞의 본문, segments[blanks.length] = 마지막 빈칸 뒤 나머지
  var storyBlanks = []; // [{ word, start, end, surface }]
  var currentBlankIdx = 0;

  function buildStoryBlanks(fullText, words) {
    var used = [];
    var blanks = [];
    words.forEach(function (w) {
      var word = w.word;
      if (!word) return;
      var escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      // 단어의 활용형(-s, -ed, -ing 등, 시제 변화 포함)까지 잡아내도록 뒤에 소문자
      // 0~5글자를 더 허용한다 - 스토리 안에서는 사전형이 아니라 실제로 쓰인
      // 시제/활용형 그대로가 빈칸의 정답이 된다.
      var re = new RegExp("\\b" + escaped + "[a-z]{0,5}\\b", "gi");
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

  function buildStorySegments(fullText, blanks) {
    var segments = [];
    var cursor = 0;
    blanks.forEach(function (b) {
      segments.push(fullText.slice(cursor, b.start));
      cursor = b.end;
    });
    segments.push(fullText.slice(cursor));
    return segments;
  }

  function paragraphSafeHtml(html) {
    return html
      .split(/\n\s*\n/)
      .map(function (p) {
        return "<p>" + p + "</p>";
      })
      .join("");
  }

  function startStoryStage() {
    var paragraphs = DataStore.getStoryParagraphs(currentUnit);
    storyFullText = paragraphs.join("\n\n");
    storyBlanks = buildStoryBlanks(storyFullText, WORDS);
    storySegments = buildStorySegments(storyFullText, storyBlanks);
    currentBlankIdx = 0;
    if (storyBlanks.length === 0) {
      // 본문에서 단어를 하나도 못 찾은 예외적인 경우 - 빈칸을 낼 수 없으니 그냥 통과로 친다.
      finishAllStages();
      return;
    }
    showOnly(storyReadCardEl);
  }

  storyReadyBtn.addEventListener("click", function () {
    showOnly(storyFillCardEl);
    storyFeedbackEl.textContent = "";
    storyFeedbackEl.className = "test-feedback";
    renderStoryProgressive();
    speakCurrentSegment();
  });

  function updateStoryProgress() {
    storyProgressEl.textContent = "정답 " + currentBlankIdx + " / " + storyBlanks.length;
  }

  function renderStoryProgressive() {
    var html = "";
    for (var i = 0; i < currentBlankIdx; i++) {
      html += escapeHtml(storySegments[i]);
      html += '<span class="test-story-answered">' + escapeHtml(storyBlanks[i].surface) + "</span>";
    }
    if (currentBlankIdx < storyBlanks.length) {
      html += escapeHtml(storySegments[currentBlankIdx]);
      var w = storyBlanks[currentBlankIdx].surface;
      var blankSize = Math.max(3, w.length);
      html +=
        '<input type="text" id="testStoryLiveBlank" class="test-story-blank" size="' +
        blankSize +
        '" style="width:' +
        (blankSize + 1) +
        'ch" placeholder="' +
        new Array(w.length + 1).join("_") +
        '" autocomplete="off" autocapitalize="off" spellcheck="false">';
    } else {
      html += escapeHtml(storySegments[storyBlanks.length]);
    }
    storyFillTextEl.innerHTML = paragraphSafeHtml(html);
    updateStoryProgress();
    var liveInput = document.getElementById("testStoryLiveBlank");
    if (liveInput) liveInput.focus();
  }

  function speakCurrentSegment() {
    Tts.stop();
    var text = storySegments[currentBlankIdx];
    if (text && text.trim()) Tts.speak(text);
  }

  storyReplayBtn.addEventListener("click", speakCurrentSegment);

  function submitStoryBlank() {
    var input = document.getElementById("testStoryLiveBlank");
    if (!input) return;
    var answer = normalizeEn(storyBlanks[currentBlankIdx].surface);
    if (normalizeEn(input.value) === answer) {
      storyFeedbackEl.textContent = "✅ 정답이에요!";
      storyFeedbackEl.className = "test-feedback test-feedback-correct";
      currentBlankIdx++;
      if (currentBlankIdx >= storyBlanks.length) {
        renderStoryProgressive();
        Tts.stop();
        storyFeedbackEl.textContent = "🎉 스토리 빈칸을 모두 맞혔어요!";
        finishAllStages();
      } else {
        renderStoryProgressive();
        speakCurrentSegment();
      }
    } else {
      storyFeedbackEl.textContent = "❌ 다시 써보세요! (다시 듣기를 눌러 들어보세요)";
      storyFeedbackEl.className = "test-feedback test-feedback-wrong";
      input.value = "";
      input.focus();
    }
  }

  storySubmitBtn.addEventListener("click", submitStoryBlank);
  storyFillTextEl.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && e.target && e.target.id === "testStoryLiveBlank") {
      submitStoryBlank();
    }
  });

  // ── 4단계까지 전부 통과: 무지개 카드 지급 ──
  function finishAllStages() {
    clearStageCount(currentUnit);
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
      } else {
        goNext();
      }
    }
  });
  nextBtn.addEventListener("click", goNext);
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
    currentUnitIsElementary = !!(candidatesByUnit[currentUnit] && candidatesByUnit[currentUnit].isElementary);
    WORDS = DataStore.getWords(currentUnit) || [];
    TOTAL = WORDS.length;
    if (TOTAL === 0) {
      alert("이 유닛에는 아직 단어가 없어요.");
      return;
    }
    if (stepEls.length > 3) stepEls[3].hidden = currentUnitIsElementary;
    unitPickEl.hidden = true;
    quizPanelEl.hidden = false;
    var resumeIdx = restartCheckbox.checked ? 0 : getSavedStageCount(currentUnit);
    if (resumeIdx > 0 && resumeIdx < STAGE_DEFS.length) {
      alert("📌 이 유닛은 " + resumeIdx + "단계까지 통과했어요! " + (resumeIdx + 1) + "단계부터 이어서 시작할게요.");
    } else if (restartCheckbox.checked) {
      clearStageCount(currentUnit);
    }
    startStage(resumeIdx);
  });

  populateUnitSelect();
})();
