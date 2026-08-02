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

  function stop() {
    if (isSupported()) window.speechSynthesis.cancel();
  }

  function speak(text, opts) {
    if (!isSupported()) return null;
    opts = opts || {};
    var utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.pitch = opts.pitch != null ? opts.pitch : 1.5;
    utterance.rate = opts.rate != null ? opts.rate : 0.9;
    var voice = pickCuteVoice();
    if (voice) utterance.voice = voice;
    if (opts.onboundary) utterance.onboundary = opts.onboundary;
    if (opts.onend) utterance.onend = opts.onend;
    window.speechSynthesis.speak(utterance);
    return utterance;
  }

  return {
    isSupported: isSupported,
    speak: speak,
    stop: stop,
    pickCuteVoice: pickCuteVoice
  };
})();
