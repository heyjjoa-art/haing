// 저니스 유닛(레벨 + 제목 + 본문 텍스트 + 사진)을 localStorage에 저장한다.
// 하잉 본 앱과 달리 "레벨.유닛" 여러 개를 동시에 쌓아두고 목록에서 골라 들어가는 구조라
// id를 키로 하는 사전(map) 형태로 관리한다.
var JourneysStore = (function () {
  var UNITS_KEY = "journeysUnits";

  function loadAll() {
    var raw = localStorage.getItem(UNITS_KEY);
    if (!raw) return {};
    try {
      return JSON.parse(raw) || {};
    } catch (e) {
      return {};
    }
  }

  function saveAll(units) {
    localStorage.setItem(UNITS_KEY, JSON.stringify(units));
  }

  function slugify(text) {
    return String(text || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9가-힣]+/g, "-")
      .replace(/(^-+|-+$)/g, "") || "unit";
  }

  function makeId(level, title) {
    var base = slugify(level) + "__" + slugify(title);
    var units = loadAll();
    var id = base;
    var n = 2;
    while (units[id]) {
      id = base + "-" + n;
      n++;
    }
    return id;
  }

  // unit: { id?, level, title, text, photos: [dataUrl, ...] }
  function saveUnit(unit) {
    var units = loadAll();
    var id = unit.id || makeId(unit.level, unit.title);
    var existing = units[id] || {};
    var merged = Object.assign({}, existing, unit, { id: id, updatedAt: Date.now() });
    units[id] = merged;
    saveAll(units);
    syncUnitToCloud(id, merged);
    return merged;
  }

  function getUnit(id) {
    return loadAll()[id] || null;
  }

  function deleteUnit(id) {
    var units = loadAll();
    delete units[id];
    saveAll(units);
    if (typeof HaingCloud !== "undefined") HaingCloud.deleteDoc(CLOUD_COLLECTION + "/" + id);
  }

  var CLOUD_COLLECTION = "journeysUnits";

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

  // Firebase Storage(유료 Blaze 요금제 필요) 없이, 여러 페이지 사진을 Firestore 문서에
  // base64 배열로 그대로 넣는다. 문서 하나는 1MB를 못 넘어서, 넘으면(페이지가 많을 때)
  // 화질을 단계적으로 낮춰가며 다시 압축한다 - 이 기기의 로컬 저장 화질은 그대로 둔다.
  var CLOUD_SIZE_LIMIT = 900000;
  var CLOUD_COMPRESSION_TIERS = [
    { maxDim: 900, quality: 0.55 },
    { maxDim: 600, quality: 0.4 },
    { maxDim: 420, quality: 0.3 }
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
      var photos = cloudData.photos || [];
      return Promise.all(
        photos.map(function (src, idx) {
          if (!src || src.indexOf("data:") !== 0) return Promise.resolve();
          return compressDataUrlForCloud(src, tier.maxDim, tier.quality).then(function (u) {
            photos[idx] = u;
          });
        })
      ).then(function () {
        cloudData.photos = photos;
        return tryFit();
      });
    }
    return tryFit();
  }

  function syncUnitToCloud(id, unit) {
    if (typeof HaingCloud === "undefined" || !HaingCloud.enabled) return;
    var cloudData = Object.assign({}, unit, { photos: (unit.photos || []).slice() });
    fitUnitForCloud(cloudData).then(function (fitted) {
      HaingCloud.writeDoc(CLOUD_COLLECTION + "/" + id, fitted);
    });
  }

  // 클라우드 컬렉션 전체를 그대로 로컬 맵으로 바꿔 반영하고, 열려있는 목록 화면을 다시 그린다.
  function applyCloudUnits(remoteDocs) {
    saveAll(remoteDocs || {});
    if (window.__journeysRenderHome) window.__journeysRenderHome();
  }

  // 이 기기가 클라우드에 처음 연결될 때: 클라우드가 비어있으면 이 기기의 기존 로컬
  // 데이터를 그대로 올려서 시작점으로 삼고, 이미 있으면 그걸 반영한다. 이후는 실시간 동기화.
  function bootstrapCloudSync() {
    if (typeof HaingCloud === "undefined" || !HaingCloud.enabled) return;
    HaingCloud.getCollectionOnce(CLOUD_COLLECTION).then(function (remoteDocs) {
      if (remoteDocs && Object.keys(remoteDocs).length > 0) {
        applyCloudUnits(remoteDocs);
      } else {
        var localUnits = loadAll();
        Object.keys(localUnits).forEach(function (id) {
          syncUnitToCloud(id, localUnits[id]);
        });
      }
      HaingCloud.watchCollection(CLOUD_COLLECTION, applyCloudUnits);
    });
  }

  bootstrapCloudSync();

  // "1.1", "1.10", "2.1" 같은 레벨 문자열을 자릿수가 아니라 숫자값으로 비교한다.
  function levelSortKey(level) {
    return String(level)
      .split(".")
      .map(function (part) {
        var n = parseInt(part, 10);
        return isNaN(n) ? part : n;
      });
  }

  function compareLevelKeys(a, b) {
    var ka = levelSortKey(a);
    var kb = levelSortKey(b);
    var len = Math.max(ka.length, kb.length);
    for (var i = 0; i < len; i++) {
      var av = ka[i];
      var bv = kb[i];
      if (av === undefined) return -1;
      if (bv === undefined) return 1;
      if (av === bv) continue;
      if (typeof av === "number" && typeof bv === "number") return av - bv;
      return String(av) < String(bv) ? -1 : 1;
    }
    return 0;
  }

  function getGroupedByLevel() {
    var units = loadAll();
    var groups = {};
    Object.keys(units).forEach(function (id) {
      var u = units[id];
      var level = u.level || "미분류";
      if (!groups[level]) groups[level] = [];
      groups[level].push(u);
    });
    var levels = Object.keys(groups).sort(compareLevelKeys);
    return levels.map(function (level) {
      groups[level].sort(function (a, b) {
        return (a.title || "").localeCompare(b.title || "");
      });
      return { level: level, units: groups[level] };
    });
  }

  function hasAny() {
    var units = loadAll();
    return Object.keys(units).length > 0;
  }

  return {
    saveUnit: saveUnit,
    getUnit: getUnit,
    deleteUnit: deleteUnit,
    getGroupedByLevel: getGroupedByLevel,
    hasAny: hasAny
  };
})();
