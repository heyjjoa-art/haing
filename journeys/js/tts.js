// 브라우저 내장 음성합성(Web Speech API) 공용 헬퍼.
// 실제 "아이 목소리"가 있는 기기는 드물어서, 있는 목소리 중 가장 귀엽게 들릴 만한
// 여성/하이톤 목소리를 고르고 피치(음높이)를 높여서 최대한 비슷하게 흉내낸다.
var Tts = (function () {
  var CUTE_NAME_HINTS = [
    "child",
    "kid",
    "junior",
    "girl",
    "female",
    "woman",
    "samantha",
    "zira",
    "susan",
    "karen",
    "moira",
    "tessa",
    "victoria",
    "google us english",
    "google uk english female"
  ];

  var cachedVoices = [];

  function refreshVoices() {
    if ("speechSynthesis" in window) {
      cachedVoices = window.speechSynthesis.getVoices() || [];
    }
  }

  if ("speechSynthesis" in window) {
    refreshVoices();
    window.speechSynthesis.onvoiceschanged = refreshVoices;
  }

  function findByHint(list) {
    for (var i = 0; i < CUTE_NAME_HINTS.length; i++) {
      var hint = CUTE_NAME_HINTS[i];
      var found = list.find(function (v) {
        return v.name.toLowerCase().indexOf(hint) !== -1;
      });
      if (found) return found;
    }
    return null;
  }

  function pickCuteVoice() {
    var enVoices = cachedVoices.filter(function (v) {
      return v.lang && v.lang.toLowerCase().indexOf("en") === 0;
    });
    if (enVoices.length === 0) return null;

    // 기기에 내장된(local) 목소리를 먼저 쓴다. 크롬의 네트워크 음성(Google ...)은
    // 대부분 "지금 읽는 단어" 이벤트를 보내주지 않아서, 형광펜이 못 따라간다.
    var localVoices = enVoices.filter(function (v) {
      return v.localService;
    });

    return (
      findByHint(localVoices) ||
      localVoices[0] ||
      findByHint(enVoices) ||
      enVoices[0]
    );
  }

  function isSupported() {
    return "speechSynthesis" in window;
  }

  // 긴 글(예: 논픽션 지문)을 utterance 하나로 통째로 읽히면, 크롬 등 일부 브라우저가
  // 몇 초~몇십 초 뒤 소리 없이 멈춰버리는 버그가 있다(엔진이 끊겼는데도 onend/onerror가
  // 안 와서 앱은 계속 읽는 중인 줄 안다). 문장 단위로 잘라 여러 utterance를 순서대로
  // 이어 말하면 이 문제를 피할 수 있고, 매 문장마다 실제로 소리가 나는지도 확인된다.
  var activeSeq = 0;
  var MAX_CHUNK_LEN = 200;

  function splitForSpeech(text, maxLen) {
    var chunks = [];
    var start = 0;
    var n = text.length;
    while (start < n) {
      var remaining = n - start;
      if (remaining <= maxLen) {
        chunks.push(text.slice(start));
        break;
      }
      var slice = text.slice(start, start + maxLen);
      // 창(window) 안에서 마지막 문장부호(. ! ?) 뒤 공백을 찾아 그 자리에서 끊는다.
      var re = /[.!?]\s/g;
      var m;
      var lastEnd = -1;
      while ((m = re.exec(slice))) {
        lastEnd = m.index + m[0].length;
      }
      var breakIdx;
      if (lastEnd !== -1) {
        breakIdx = lastEnd;
      } else {
        var lastSpace = slice.lastIndexOf(" ");
        breakIdx = lastSpace > 0 ? lastSpace + 1 : maxLen;
      }
      chunks.push(text.slice(start, start + breakIdx));
      start += breakIdx;
    }
    return chunks;
  }

  function stop() {
    if (isSupported()) window.speechSynthesis.cancel();
    activeSeq++; // 아직 진행 중이던 speak()의 다음 조각 예약을 무효화한다.
  }

  // text 전체를 문장 단위로 잘라 순서대로 이어 말한다. 호출부(reader.js)에는 예전과
  // 똑같이 text 전체를 기준으로 한 하나의 onboundary/onend만 보이도록, charIndex에
  // 지금까지 읽은 조각들의 길이를 더해서 넘겨준다.
  function speak(text, opts) {
    if (!isSupported()) return null;
    opts = opts || {};
    var chunks = splitForSpeech(text, MAX_CHUNK_LEN);
    var myToken = ++activeSeq;

    function startSpeaking() {
      speakChunk(0, 0);
    }

    function speakChunk(idx, offset) {
      if (myToken !== activeSeq) return;
      if (idx >= chunks.length) {
        if (opts.onend) opts.onend();
        return;
      }
      var chunkText = chunks[idx];
      var utterance = new SpeechSynthesisUtterance(chunkText);
      utterance.lang = "en-US";
      utterance.pitch = opts.pitch != null ? opts.pitch : 1.5;
      utterance.rate = opts.rate != null ? opts.rate : 0.9;
      var voice = pickCuteVoice();
      if (voice) utterance.voice = voice;
      // 청크(대략 문장 단위)가 실제로 소리 나기 시작하는 순간을 호출부에 알려준다.
      // onboundary(단어 단위 실시간 위치)를 안 보내주는 음성이 많아서, 이 이벤트를
      // 형광펜을 다시 맞추는 재동기화 지점으로 쓴다 - 오차가 나더라도 청크 하나(짧은
      // 문장 하나) 분량을 못 벗어난다.
      utterance.onstart = function () {
        if (myToken !== activeSeq || !opts.onchunkstart) return;
        opts.onchunkstart(offset, chunkText);
      };
      utterance.onboundary = function (event) {
        if (myToken !== activeSeq || !opts.onboundary) return;
        opts.onboundary({
          name: event.name,
          charIndex: offset + (event.charIndex || 0)
        });
      };

      // 이 조각(청크) 하나를 "끝냈다"고 보고 다음 조각으로 넘어간다. onend/onerror
      // 둘 중 먼저 온 쪽을 따르고, 워치독 타이머가 먼저 울렸으면 그것도 같은 취급을
      // 한다 - 셋 중 뭐가 됐든 한 번만 넘어가도록 advanced 플래그로 막는다.
      var advanced = false;
      function advanceToNextChunk() {
        if (advanced) return;
        advanced = true;
        clearTimeout(watchdogTimer);
        speakChunk(idx + 1, offset + chunkText.length);
      }
      utterance.onend = advanceToNextChunk;
      // 크롬 일부 버전은 정상 종료 대신 error 이벤트(주로 "interrupted"/"canceled" 외의
      // 원인 불명 오류)를 주기도 한다 - 이걸 무시하면 그 자리에서 영영 멈춘다.
      utterance.onerror = function (event) {
        // "canceled"/"interrupted"는 stop()이 정상적으로 cancel()을 부른 경우에도
        // 흔히 같이 오는 값이라 경고를 찍지 않는다 - 진짜 예상 밖 오류만 남긴다.
        var reason = event && event.error;
        if (reason !== "canceled" && reason !== "interrupted") {
          console.warn("[Tts] 발화 오류, 다음 조각으로 건너뜀", reason);
        }
        advanceToNextChunk();
      };

      // 크롬은 가끔 onend도 onerror도 안 보내고 그냥 소리 없이 멈춰버리는 버그가 있다
      // (실제로 관찰됨 - 특정 조각 경계에서 재생이 완전히 끊김). 글자 수로 어림잡은
      // 예상 재생 시간보다 한참 지나도 끝났다는 신호가 안 오면 강제로 다음 조각으로
      // 넘어가서, 앱이 "재생 중" 상태로 영원히 멈춰있지 않게 한다.
      var estimatedMs = (chunkText.length / (10 * (utterance.rate || 1))) * 1000;
      var watchdogTimer = setTimeout(function () {
        // onend/onerror가 둘 다 안 온 채로 여기까지 왔다는 뜻 - 실제로 크롬이 조용히
        // 멈춘 경우. 어느 문장(조각)에서 이 버그가 실제로 발생하는지 나중에 확인할 수
        // 있게 남겨둔다.
        console.warn("[Tts] 응답 없음(워치독), 다음 조각으로 강제 진행:", chunkText.slice(0, 50));
        advanceToNextChunk();
      }, Math.max(2500, estimatedMs) + 5000);

      window.speechSynthesis.speak(utterance);
    }

    // 직전에 stop()으로 cancel()을 부른 직후(예: 페이지 넘기며 자동 재개)라면, 크롬은
    // cancel()과 speak()가 같은 틱에 연달아 들어오면 새 발화를 그냥 씹어버리고 소리
    // 없이 아무 일도 안 일어나는 버그가 있다. 한 틱 쉬었다 시작하면 이 문제를 피한다.
    setTimeout(function () {
      if (myToken !== activeSeq) return;
      startSpeaking();
    }, 80);
    return null;
  }

  return {
    isSupported: isSupported,
    speak: speak,
    stop: stop,
    pickCuteVoice: pickCuteVoice
  };
})();
