// 본문에서 모르는 단어를 눌렀을 때 한글 뜻과 영영 설명을 함께 찾아준다.
// 1) 한 번 찾아본 단어는 캐시에 저장해두고 계속 재사용(오프라인에서도 동작)
// 2) Word 학습에 등록된 기본 단어는 책 Word List 원문의 뜻/영영 설명을 그대로 사용
//    (본문에 나온 바로 그 의미라 가장 정확하다)
// 3) 그 외 단어는 무료 번역 API(MyMemory)로 한글 뜻을, 무료 영영사전 API(dictionaryapi.dev)로
//    영영 설명을 가져온다. 영영사전이 여러 뜻을 주면, 단어가 나온 문단(context)과 겹치는
//    단어가 가장 많은 뜻을 골라서 "본문에 나온 뜻"에 최대한 가깝게 맞춘다.
var Dictionary = (function () {
  var CACHE_KEY = "journeysWordCache2"; // en 필드가 생기며 예전 문자열 캐시와 형식이 달라져 키를 바꿨다

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
    return found ? { ko: found.meaningKo, en: found.definition } : null;
  }

  var STOPWORDS = {
    the: 1, a: 1, an: 1, to: 1, of: 1, in: 1, on: 1, is: 1, are: 1, was: 1, were: 1,
    and: 1, or: 1, that: 1, this: 1, it: 1, for: 1, with: 1, as: 1, by: 1, at: 1,
    be: 1, been: 1, being: 1, you: 1, your: 1, they: 1, them: 1, he: 1, she: 1,
    his: 1, her: 1, has: 1, have: 1, had: 1, will: 1, would: 1, can: 1, could: 1
  };

  function wordsOf(text) {
    return String(text || "")
      .toLowerCase()
      .split(/[^a-z']+/)
      .filter(function (w) {
        return w.length > 2 && !STOPWORDS[w];
      });
  }

  // 영영사전(dictionaryapi.dev) 응답은 뜻(의미)이 여러 개 들어있을 수 있다. 단어가
  // 실제로 나온 문단(context)과 단어가 가장 많이 겹치는 뜻을 골라서 "본문에 나온 뜻"에
  // 최대한 가깝게 맞춘다. context가 없거나 겹치는 게 하나도 없으면 사전이 가장 먼저
  // 주는(=가장 흔히 쓰이는) 뜻을 그대로 쓴다.
  function pickBestDefinition(entries, context) {
    var candidates = [];
    (entries || []).forEach(function (entry) {
      (entry.meanings || []).forEach(function (meaning) {
        (meaning.definitions || []).forEach(function (def) {
          if (def.definition) {
            candidates.push({ pos: meaning.partOfSpeech, text: def.definition, example: def.example || "" });
          }
        });
      });
    });
    if (candidates.length === 0) return null;

    var contextWords = wordsOf(context);
    if (contextWords.length > 0) {
      var best = null;
      var bestScore = 0;
      candidates.forEach(function (c) {
        var candWords = wordsOf(c.text + " " + c.example);
        var score = candWords.filter(function (w) {
          return contextWords.indexOf(w) !== -1;
        }).length;
        if (score > bestScore) {
          bestScore = score;
          best = c;
        }
      });
      if (best) return best;
    }
    return candidates[0];
  }

  function fetchEnglishDefinition(word, context) {
    return fetch("https://api.dictionaryapi.dev/api/v2/entries/en/" + encodeURIComponent(word))
      .then(function (res) {
        return res.ok ? res.json() : null;
      })
      .then(function (entries) {
        var best = entries ? pickBestDefinition(entries, context) : null;
        if (!best) return null;
        return best.pos ? "(" + best.pos + ") " + best.text : best.text;
      })
      .catch(function () {
        return null;
      });
  }

  function fetchKoreanMeaning(word) {
    return fetch("https://api.mymemory.translated.net/get?q=" + encodeURIComponent(word) + "&langpair=en|ko")
      .then(function (res) {
        return res.json();
      })
      .then(function (data) {
        var text = data && data.responseData && data.responseData.translatedText;
        if (!text) return null;
        text = String(text).trim();
        if (!text || text.toLowerCase() === word) return null;
        return text;
      })
      .catch(function () {
        return null;
      });
  }

  // Promise<{ko, en}|null> - 뜻을 아예 못 찾으면 null. en은 영영사전에 없으면 빈 채로 온다.
  function lookup(rawWord, context) {
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

    return Promise.all([fetchKoreanMeaning(word), fetchEnglishDefinition(word, context)]).then(function (results) {
      var ko = results[0];
      var en = results[1];
      if (!ko && !en) return null;
      var result = { ko: ko, en: en };
      var freshCache = loadCache();
      freshCache[word] = result;
      saveCache(freshCache);
      return result;
    });
  }

  return {
    lookup: lookup
  };
})();
