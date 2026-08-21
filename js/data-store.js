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
    var merged = Object.assign({}, units[key], partial, { updatedAt: Date.now() });
    units[key] = merged;
    saveAllUnits(units);
    setCurrentUnit(key);
    merged.cloudSyncPromise = syncUnitToCloud(key, merged);
    return merged;
  }

  var CLOUD_COLLECTION = "wordUnits";

  function compressDataUrlForCloud(dataUrl, maxDim, quality) {
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () {
        var scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        var canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = function () {
        resolve(dataUrl);
      };
      img.src = dataUrl;
    });
  }

  // Firebase Storage(유료 Blaze 요금제 필요) 없이, 사진을 Firestore 문서에 base64로
  // 그대로 넣는다. 문서 하나는 1MB를 못 넘어서, 넘으면 화질을 단계적으로 낮춰가며
  // 다시 압축한다 - 이 기기의 로컬 저장 화질(원본 압축본)은 그대로 둔다.
  var CLOUD_SIZE_LIMIT = 900000;
  var CLOUD_COMPRESSION_TIERS = [
    { maxDim: 1000, quality: 0.6 },
    { maxDim: 700, quality: 0.45 },
    { maxDim: 500, quality: 0.35 }
  ];

  function jsonByteSize(obj) {
    return JSON.stringify(obj).length;
  }

  function fitUnitForCloud(cloudData) {
    var tierIdx = 0;
    function tryFit() {
      if (jsonByteSize(cloudData) <= CLOUD_SIZE_LIMIT || tierIdx >= CLOUD_COMPRESSION_TIERS.length) {
        return Promise.resolve(cloudData);
      }
      var tier = CLOUD_COMPRESSION_TIERS[tierIdx++];
      var jobs = [];
      if (cloudData.storyPhotoDataUrl && cloudData.storyPhotoDataUrl.indexOf("data:") === 0) {
        jobs.push(
          compressDataUrlForCloud(cloudData.storyPhotoDataUrl, tier.maxDim, tier.quality).then(function (u) {
            cloudData.storyPhotoDataUrl = u;
          })
        );
      }
      if (cloudData.wordsPhotoDataUrl && cloudData.wordsPhotoDataUrl.indexOf("data:") === 0) {
        jobs.push(
          compressDataUrlForCloud(cloudData.wordsPhotoDataUrl, tier.maxDim, tier.quality).then(function (u) {
            cloudData.wordsPhotoDataUrl = u;
          })
        );
      }
      return Promise.all(jobs).then(tryFit);
    }
    return tryFit();
  }

  // 쓰기가 실제로 클라우드에 도착할 때까지 기다릴 수 있도록 Promise를 그대로 돌려준다 -
  // 방금 저장한 유닛이 다른 페이지의 bootstrapCloudSync가 아직 도착 안 한 이 쓰기를
  // 예전 스냅샷으로 덮어써버리는 경쟁에 휘말리지 않도록, 호출부가 필요하면 기다릴 수 있다.
  function syncUnitToCloud(unitKey, data) {
    if (typeof HaingCloud === "undefined" || !HaingCloud.enabled) return Promise.resolve();
    var cloudData = Object.assign({}, data);
    return fitUnitForCloud(cloudData).then(function (fitted) {
      return HaingCloud.writeDoc(CLOUD_COLLECTION + "/" + unitKey, fitted);
    });
  }

  // 클라우드 컬렉션 전체를 그대로 로컬 맵으로 바꿔 반영하고, 열려있는 화면을 다시 그린다.
  // watchCollection의 실시간 콜백에서만 쓴다 - 그쪽은 이 기기가 방금 쓴 내용의 echo는
  // 건너뛰므로(hasPendingWrites) 여기 오는 스냅샷은 항상 서버가 확인해준 최신 상태다.
  function applyCloudUnits(remoteDocs) {
    saveAllUnits(remoteDocs || {});
    if (window.__haingRenderHome) window.__haingRenderHome();
    if (window.__haingRenderAdminWordUnits) window.__haingRenderAdminWordUnits();
    if (window.__haingRenderWordEdit) window.__haingRenderWordEdit();
  }

  // 로컬에만 있고 클라우드엔 없는 유닛을 "방금 만들어서 아직 못 올라간 것"으로 봐줄
  // 최대 시간. 이보다 오래된 로컬 전용 유닛은 다른 기기에서 삭제된 것으로 보고
  // 로컬에서도 지운다 - 안 그러면 삭제해도 예전 기기/탭이 다시 열릴 때마다
  // 그 기기에 남아있던 stale 사본이 클라우드로 되살아나 계속 재등장한다.
  var RECENT_LOCAL_ONLY_MS = 5 * 60 * 1000;

  // bootstrap 시점의 1회성 스냅샷은 위와 다르게 "덮어쓰기"가 아니라 "병합"해야 한다 -
  // 방금 다른 페이지(예: 홈)에서 저장한 유닛의 클라우드 쓰기가 아직 서버에 도착하기
  // 전일 수 있어서, 그대로 덮어쓰면 막 등록한 유닛이 로컬에서 통째로 사라진다.
  // 로컬이 더 최신인 유닛은 살려두고, 로컬에만 있는 유닛은 방금 생긴 것일 때만
  // 살려서 다시 밀어올린다(오래된 것은 다른 기기에서 지워진 걸로 보고 같이 지운다).
  function mergeCloudSnapshotIntoLocal(remoteDocs) {
    var local = loadAllUnits();
    var merged = Object.assign({}, remoteDocs);
    Object.keys(local).forEach(function (key) {
      var remote = remoteDocs[key];
      var localUnit = local[key];
      if (remote && (localUnit.updatedAt || 0) > (remote.updatedAt || 0)) {
        merged[key] = localUnit;
      } else if (!remote && Date.now() - (localUnit.updatedAt || 0) < RECENT_LOCAL_ONLY_MS) {
        merged[key] = localUnit;
        syncUnitToCloud(key, localUnit);
      }
    });
    saveAllUnits(merged);
    if (window.__haingRenderHome) window.__haingRenderHome();
    if (window.__haingRenderAdminWordUnits) window.__haingRenderAdminWordUnits();
    if (window.__haingRenderWordEdit) window.__haingRenderWordEdit();
  }

  // 이 기기가 클라우드에 처음 연결될 때: 클라우드가 비어있으면(가장 먼저 연결한 기기)
  // 이 기기의 기존 로컬 데이터를 그대로 클라우드에 올려서 시작점으로 삼는다.
  // 클라우드에 이미 데이터가 있으면 로컬과 병합해서 반영한다. 이후는 실시간으로 맞춘다.
  function bootstrapCloudSync() {
    if (typeof HaingCloud === "undefined" || !HaingCloud.enabled) return;
    HaingCloud.getCollectionOnce(CLOUD_COLLECTION).then(function (remoteDocs) {
      if (remoteDocs && Object.keys(remoteDocs).length > 0) {
        mergeCloudSnapshotIntoLocal(remoteDocs);
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

  // 사진만 올라오고 단어/본문이 아직 안 채워진 유닛은 "준비된" 걸로 치지 않는다 -
  // 그래야 홈 화면에서 스토리북 단계가 계속 잠겨서, 빈 유닛이 기본 샘플(Unit 15)로
  // 둔갑해 보이는 대신 정직하게 "준비 중"으로 보인다.
  function hasCustomData(unitKey) {
    var data = load(unitKey);
    return !!(data.words && data.words.length && data.storyText && data.storyText.trim());
  }

  // 기기에 등록된 유닛이 하나도 없을 때만 내장 샘플(Unit 15)을 보여준다 - 유닛은
  // 등록됐는데 아직 단어/본문이 안 채워진 경우까지 샘플로 대신 채우면, 다른 유닛을
  // 등록한 것처럼 보이는 착각을 준다(예: Unit 18을 올렸는데 Unit 15 내용이 나옴).
  function anyUnitsRegistered() {
    return Object.keys(loadAllUnits()).length > 0;
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
    if (data.storyTitle) return data.storyTitle;
    return anyUnitsRegistered() ? "" : DEFAULT_STORY_TITLE;
  }

  function getStoryParagraphs(unitKey) {
    var data = load(unitKey);
    if (data.storyText && data.storyText.trim()) {
      return data.storyText
        .split(/\n\s*\n/)
        .map(function (p) { return p.trim(); })
        .filter(Boolean);
    }
    return anyUnitsRegistered() ? [] : DEFAULT_STORY_PARAGRAPHS;
  }

  function getStoryAudioLink(unitKey) {
    var data = load(unitKey);
    return data.storyAudioLink || null;
  }

  function getWordsAudioLink(unitKey) {
    var data = load(unitKey);
    return data.wordsAudioLink || null;
  }

  // "초등1", "초등2"... 같은 초등 단어장 단계인지 본다. 이 단계는 사진으로 매주
  // 올리는 유닛이 아니라 js/elementary-words-data.js에 고정으로 들어있는 값을 쓴다.
  function isElementaryUnit(unitKey) {
    var key = resolveUnitKey(unitKey);
    return typeof ELEMENTARY_WORD_LEVELS !== "undefined" && !!ELEMENTARY_WORD_LEVELS[key];
  }

  // 홈 화면의 "초등 필수 단어" 선택 목록에 쓴다.
  function getElementaryLevels() {
    if (typeof ELEMENTARY_LEVEL_KEYS === "undefined") return [];
    return ELEMENTARY_LEVEL_KEYS.map(function (key) {
      return { level: key, count: ELEMENTARY_WORD_LEVELS[key].length };
    });
  }

  function getWords(unitKey) {
    if (isElementaryUnit(unitKey)) return ELEMENTARY_WORD_LEVELS[resolveUnitKey(unitKey)];
    var data = load(unitKey);
    if (data.words && data.words.length) return data.words;
    return anyUnitsRegistered() ? [] : DEFAULT_WORDS_DATA;
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
    getWords: getWords,
    isElementaryUnit: isElementaryUnit,
    getElementaryLevels: getElementaryLevels
  };
})();
