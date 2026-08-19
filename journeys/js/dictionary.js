// 본문에서 모르는 단어를 눌렀을 때 한글 뜻을 찾아준다.
// 1) 한 번 찾아본 단어는 캐시에 저장해두고 계속 재사용(오프라인에서도 동작)
// 2) Word 학습에 등록된 기본 단어는 그 뜻을 그대로 사용
// 3) 그 외 단어는 무료 번역 API(MyMemory)로 즉석 번역해서 캐시에 추가
var Dictionary = (function () {
  var CACHE_KEY = "journeysWordCache";

  function loadCache() {
    var raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return {};
    try {
      return JSON.parse(raw) || {};
    } catch (e) {
      return {};
    }
  }

  function saveCache(cache) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    } catch (e) {
      // 캐시 저장 공간이 꽉 차도 번역 자체는 계속 동작해야 하므로 조용히 무시한다.
    }
  }

  function normalize(word) {
    return String(word || "")
      .toLowerCase()
      .replace(/[^a-z']/g, "");
  }

  function fromBuiltInWords(word) {
    if (typeof DEFAULT_WORDS_DATA === "undefined") return null;
    var found = DEFAULT_WORDS_DATA.find(function (w) {
      return w.word.toLowerCase() === word;
    });
    return found ? found.meaningKo : null;
  }

  // Promise<string|null> - 뜻을 못 찾으면 null
  function lookup(rawWord) {
    var word = normalize(rawWord);
    if (!word) return Promise.resolve(null);

    var cache = loadCache();
    if (cache[word]) return Promise.resolve(cache[word]);

    var builtIn = fromBuiltInWords(word);
    if (builtIn) {
      cache[word] = builtIn;
      saveCache(cache);
      return Promise.resolve(builtIn);
    }

    return fetch("https://api.mymemory.translated.net/get?q=" + encodeURIComponent(word) + "&langpair=en|ko")
      .then(function (res) {
        return res.json();
      })
      .then(function (data) {
        var text = data && data.responseData && data.responseData.translatedText;
        if (!text) return null;
        text = String(text).trim();
        if (!text || text.toLowerCase() === word) return null;
        var freshCache = loadCache();
        freshCache[word] = text;
        saveCache(freshCache);
        return text;
      })
      .catch(function () {
        return null;
      });
  }

  return {
    lookup: lookup
  };
})();
