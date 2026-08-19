// 유닛별로 업로드한 사진/QR 결과를 localStorage에 저장한다.
// 새 유닛을 올려도 예전 유닛 데이터는 지워지지 않고 남아서 나중에 다시 볼 수 있다.
// 저장된 게 하나도 없으면 기본(Unit 15) 데이터를 대신 돌려준다.
var DataStore = (function () {
  var UNITS_KEY = "haingUnits";
  var CURRENT_KEY = "haingCurrentUnit";
  var DEFAULT_UNIT_KEY = "unspecified";

  function loadAllUnits() {
    var raw = localStorage.getItem(UNITS_KEY);
    if (!raw) return {};
    try {
      return JSON.parse(raw) || {};
    } catch (e) {
      return {};
    }
  }

  function saveAllUnits(units) {
    localStorage.setItem(UNITS_KEY, JSON.stringify(units));
  }

  function getCurrentUnit() {
    return localStorage.getItem(CURRENT_KEY) || null;
  }

  function setCurrentUnit(unitKey) {
    localStorage.setItem(CURRENT_KEY, unitKey);
  }

  // 명시적으로 unitKey를 안 주면: 주소창의 ?unit=15 값을 먼저 보고, 없으면 현재(최신) 유닛을 쓴다.
  function resolveUnitKey(explicitUnit) {
    if (explicitUnit) return explicitUnit;
    try {
      var params = new URLSearchParams(window.location.search);
      var fromUrl = params.get("unit");
      if (fromUrl) return fromUrl;
    } catch (e) {
      // no-op
    }
    return getCurrentUnit();
  }

  function load(unitKey) {
    var key = resolveUnitKey(unitKey);
    if (!key) return {};
    var units = loadAllUnits();
    return units[key] || {};
  }

  function saveUnitData(unitKey, partial) {
    var key = unitKey || DEFAULT_UNIT_KEY;
    var units = loadAllUnits();
    var merged = Object.assign({}, units[key], partial);
    units[key] = merged;
    saveAllUnits(units);
    setCurrentUnit(key);
    syncUnitToCloud(key, merged);
    return merged;
  }

  var CLOUD_COLLECTION = "wordUnits";

  // 사진(data: URL)은 Storage에 올려 짧은 다운로드 URL로 바꾼 뒤에 Firestore에 쓴다.
  // localStorage에도 그 URL로 갱신해서, 매번 큰 base64 문자열을 들고 있지 않게 한다.
  function syncUnitToCloud(unitKey, data) {
    if (typeof HaingCloud === "undefined" || !HaingCloud.enabled) return;

    var storyUrl = data.storyPhotoDataUrl;
    var wordsUrl = data.wordsPhotoDataUrl;
    var uploads = [];

    if (storyUrl && storyUrl.indexOf("data:") === 0) {
      uploads.push(
        HaingCloud.uploadDataUrl("word-photos/" + unitKey + "/story.jpg", storyUrl).then(function (url) {
          if (url) storyUrl = url;
        })
      );
    }
    if (wordsUrl && wordsUrl.indexOf("data:") === 0) {
      uploads.push(
        HaingCloud.uploadDataUrl("word-photos/" + unitKey + "/words.jpg", wordsUrl).then(function (url) {
          if (url) wordsUrl = url;
        })
      );
    }

    Promise.all(uploads).then(function () {
      var cloudData = Object.assign({}, data, {
        storyPhotoDataUrl: storyUrl,
        wordsPhotoDataUrl: wordsUrl
      });
      HaingCloud.writeDoc(CLOUD_COLLECTION + "/" + unitKey, cloudData);

      if (storyUrl !== data.storyPhotoDataUrl || wordsUrl !== data.wordsPhotoDataUrl) {
        var units = loadAllUnits();
        if (units[unitKey]) {
          units[unitKey].storyPhotoDataUrl = storyUrl;
          units[unitKey].wordsPhotoDataUrl = wordsUrl;
          saveAllUnits(units);
        }
      }
    });
  }

  // 클라우드 컬렉션 전체를 그대로 로컬 맵으로 바꿔 반영하고, 열려있는 화면을 다시 그린다.
  function applyCloudUnits(remoteDocs) {
    saveAllUnits(remoteDocs || {});
    if (window.__haingRenderHome) window.__haingRenderHome();
    if (window.__haingRenderAdminWordUnits) window.__haingRenderAdminWordUnits();
  }

  // 이 기기가 클라우드에 처음 연결될 때: 클라우드가 비어있으면(가장 먼저 연결한 기기)
  // 이 기기의 기존 로컬 데이터를 그대로 클라우드에 올려서 시작점으로 삼는다.
  // 클라우드에 이미 데이터가 있으면 그걸 이 기기에 반영한다. 이후는 실시간으로 맞춘다.
  function bootstrapCloudSync() {
    if (typeof HaingCloud === "undefined" || !HaingCloud.enabled) return;
    HaingCloud.getCollectionOnce(CLOUD_COLLECTION).then(function (remoteDocs) {
      if (remoteDocs && Object.keys(remoteDocs).length > 0) {
        applyCloudUnits(remoteDocs);
      } else {
        var localUnits = loadAllUnits();
        Object.keys(localUnits).forEach(function (key) {
          syncUnitToCloud(key, localUnits[key]);
        });
      }
      HaingCloud.watchCollection(CLOUD_COLLECTION, applyCloudUnits);
    });
  }

  bootstrapCloudSync();

  // 이미 등록된 유닛의 번호를 바꾼다. 새 번호가 이미 쓰이고 있으면 실패(false)를
  // 돌려주니 호출하는 쪽에서 안내하고, 성공하면 진행 상황/단어 카드도 같이 옮겨준다.
  function renameUnit(oldKey, newKey) {
    if (!oldKey || !newKey || oldKey === newKey) return false;
    var units = loadAllUnits();
    if (!(oldKey in units)) return false;
    if (newKey in units) return false;

    units[newKey] = units[oldKey];
    delete units[oldKey];
    saveAllUnits(units);

    if (getCurrentUnit() === oldKey) setCurrentUnit(newKey);

    var oldSuffix = "_" + oldKey;
    var newSuffix = "_" + newKey;
    Object.keys(localStorage).forEach(function (key) {
      var isUnitScoped =
        key.indexOf("haingProgress_") === 0 ||
        key.indexOf("haingStepProgress_") === 0 ||
        key.indexOf("haingCustom_") === 0;
      if (!isUnitScoped) return;
      if (key.slice(key.length - oldSuffix.length) !== oldSuffix) return;
      var renamedKey = key.slice(0, key.length - oldSuffix.length) + newSuffix;
      var value = localStorage.getItem(key);
      localStorage.removeItem(key);
      localStorage.setItem(renamedKey, value);
    });

    if (typeof WordCardStore !== "undefined" && WordCardStore.renameUnitInCards) {
      WordCardStore.renameUnitInCards(oldKey, newKey);
    }

    syncUnitToCloud(newKey, units[newKey]);
    if (typeof HaingCloud !== "undefined") HaingCloud.deleteDoc(CLOUD_COLLECTION + "/" + oldKey);

    return true;
  }

  function getAllUnits() {
    var units = loadAllUnits();
    return Object.keys(units)
      .map(function (key) {
        return { unit: key, data: units[key] };
      })
      .sort(function (a, b) {
        var na = parseFloat(a.unit);
        var nb = parseFloat(b.unit);
        if (!isNaN(na) && !isNaN(nb)) return nb - na;
        return a.unit < b.unit ? 1 : -1;
      });
  }

  function resetToDefault() {
    localStorage.removeItem(UNITS_KEY);
    localStorage.removeItem(CURRENT_KEY);
  }

  // 유닛 사진/자료만 지운다. 스텔라이브 카드 컬렉션은 별도로 저장되어 있어 영향받지 않는다.
  function deleteUnit(unitKey) {
    var units = loadAllUnits();
    delete units[unitKey];
    saveAllUnits(units);

    // 이 유닛의 진행 상황 기록도 같이 지운다.
    var suffix = "_" + unitKey;
    Object.keys(localStorage).forEach(function (key) {
      if (
        key.indexOf("haingProgress_") === 0 ||
        key.indexOf("haingStepProgress_") === 0 ||
        key.indexOf("haingCustom_") === 0
      ) {
        if (key.slice(key.length - suffix.length) === suffix) {
          localStorage.removeItem(key);
        }
      }
    });

    if (getCurrentUnit() === unitKey) {
      var remaining = Object.keys(units);
      setCurrentUnit(remaining.length > 0 ? remaining[0] : "");
      if (remaining.length === 0) localStorage.removeItem(CURRENT_KEY);
    }

    if (typeof HaingCloud !== "undefined") HaingCloud.deleteDoc(CLOUD_COLLECTION + "/" + unitKey);
  }

  function hasCustomData(unitKey) {
    var data = load(unitKey);
    return !!(data.storyPhotoDataUrl || data.wordsPhotoDataUrl);
  }

  function getStoryPhotoUrl(unitKey) {
    var data = load(unitKey);
    return data.storyPhotoDataUrl || DEFAULT_STORY_PHOTO;
  }

  // 스토리 내용과 어울리는 삽화(대표 이미지). 지금은 유닛마다 따로 없어서 기본 삽화를 쓴다.
  function getStoryImage(unitKey) {
    var data = load(unitKey);
    return data.storyImage || DEFAULT_STORY_IMAGE;
  }

  function getWordsPhotoUrl(unitKey) {
    var data = load(unitKey);
    return data.wordsPhotoDataUrl || null;
  }

  function getStoryTitle(unitKey) {
    var data = load(unitKey);
    return data.storyTitle || DEFAULT_STORY_TITLE;
  }

  function getStoryParagraphs(unitKey) {
    var data = load(unitKey);
    if (data.storyText && data.storyText.trim()) {
      return data.storyText
        .split(/\n\s*\n/)
        .map(function (p) { return p.trim(); })
        .filter(Boolean);
    }
    return DEFAULT_STORY_PARAGRAPHS;
  }

  function getStoryAudioLink(unitKey) {
    var data = load(unitKey);
    return data.storyAudioLink || null;
  }

  function getWordsAudioLink(unitKey) {
    var data = load(unitKey);
    return data.wordsAudioLink || null;
  }

  function getWords(unitKey) {
    var data = load(unitKey);
    if (data.words && data.words.length) return data.words;
    return DEFAULT_WORDS_DATA;
  }

  return {
    load: load,
    saveUnitData: saveUnitData,
    renameUnit: renameUnit,
    getAllUnits: getAllUnits,
    getCurrentUnit: getCurrentUnit,
    setCurrentUnit: setCurrentUnit,
    resolveUnitKey: resolveUnitKey,
    resetToDefault: resetToDefault,
    deleteUnit: deleteUnit,
    hasCustomData: hasCustomData,
    getStoryPhotoUrl: getStoryPhotoUrl,
    getStoryImage: getStoryImage,
    getWordsPhotoUrl: getWordsPhotoUrl,
    getStoryTitle: getStoryTitle,
    getStoryParagraphs: getStoryParagraphs,
    getStoryAudioLink: getStoryAudioLink,
    getWordsAudioLink: getWordsAudioLink,
    getWords: getWords
  };
})();
