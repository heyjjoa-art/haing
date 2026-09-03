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
    merged.cloudSyncPromise = syncUnitToCloud(id, merged);
    return merged;
  }

  function getUnit(id) {
    return loadAll()[id] || null;
  }

  // 관리자가 이 유닛을 "종료"하면 그 뒤로는 복습(다시 읽기)만 가능하고, 오늘의
  // 미션(도장)에는 반영되지 않는다 - reader.js의 onStageCompleted가 unit.ended를
  // 보고 막아준다. 다른 필드는 그대로 두고 ended만 바꿔서 saveUnit으로 저장한다.
  function setEnded(id, ended) {
    var unit = getUnit(id);
    if (!unit) return null;
    return saveUnit(Object.assign({}, unit, { ended: !!ended }));
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

  // 쓰기가 실제로 클라우드에 도착할 때까지 기다릴 수 있도록 Promise를 그대로 돌려준다 -
  // 호출부(add.js)가 이 Promise를 기다린 뒤에 페이지를 이동해야, 저장 직후 다음 페이지의
  // bootstrapCloudSync가 아직 도착하지 않은 이 쓰기를 예전 스냅샷으로 덮어써버리는 경쟁을 막을 수 있다.
  function syncUnitToCloud(id, unit) {
    if (typeof HaingCloud === "undefined" || !HaingCloud.enabled) return Promise.resolve();
    var cloudData = Object.assign({}, unit, { photos: (unit.photos || []).slice() });
    return fitUnitForCloud(cloudData).then(function (fitted) {
      return HaingCloud.writeDoc(CLOUD_COLLECTION + "/" + id, fitted);
    });
  }

  // 클라우드 컬렉션 전체를 그대로 로컬 맵으로 바꿔 반영하고, 열려있는 목록 화면을 다시 그린다.
  // watchCollection의 실시간 콜백에서만 쓴다 - 그쪽은 이 기기가 방금 쓴 내용의 echo는
  // 건너뛰므로(hasPendingWrites) 여기 오는 스냅샷은 항상 서버가 확인해준 최신 상태다.
  function applyCloudUnits(remoteDocs) {
    saveAll(remoteDocs || {});
    if (window.__journeysRenderHome) window.__journeysRenderHome();
  }

  // 로컬에만 있고 클라우드엔 없는 유닛을 "방금 만들어서 아직 못 올라간 것"으로 봐줄
  // 최대 시간. 이보다 오래된 로컬 전용 유닛은 다른 기기에서 삭제된 것으로 보고
  // 로컬에서도 지운다 - 안 그러면 삭제해도 예전 기기/탭이 다시 열릴 때마다
  // 그 기기에 남아있던 stale 사본이 클라우드로 되살아나 계속 재등장한다.
  var RECENT_LOCAL_ONLY_MS = 5 * 60 * 1000;

  // bootstrap 시점의 1회성 스냅샷은 위와 다르게 "덮어쓰기"가 아니라 "병합"해야 한다 -
  // 방금 다른 페이지에서 저장한 유닛의 클라우드 쓰기가 아직 도착하기 전일 수 있어서,
  // 그대로 덮어쓰면 막 저장한 내용이 사라진다. 로컬이 더 최신인 유닛은 살려두고,
  // 로컬에만 있는 유닛은 방금 생긴 것일 때만 살려서 다시 밀어올린다(오래된 것은
  // 다른 기기에서 지워진 걸로 보고 같이 지운다).
  function mergeCloudSnapshotIntoLocal(remoteDocs) {
    var local = loadAll();
    var merged = Object.assign({}, remoteDocs);
    Object.keys(local).forEach(function (id) {
      var remote = remoteDocs[id];
      var localUnit = local[id];
      if (remote && (localUnit.updatedAt || 0) > (remote.updatedAt || 0)) {
        merged[id] = localUnit;
      } else if (!remote && Date.now() - (localUnit.updatedAt || 0) < RECENT_LOCAL_ONLY_MS) {
        merged[id] = localUnit;
        syncUnitToCloud(id, localUnit);
      }
    });
    saveAll(merged);
    if (window.__journeysRenderHome) window.__journeysRenderHome();
  }

  // 이 기기가 클라우드에 처음 연결될 때: 클라우드가 비어있으면 이 기기의 기존 로컬
  // 데이터를 그대로 올려서 시작점으로 삼고, 이미 있으면 그걸 반영한다. 이후는 실시간 동기화.
  function bootstrapCloudSync() {
    if (typeof HaingCloud === "undefined" || !HaingCloud.enabled) return;
    HaingCloud.getCollectionOnce(CLOUD_COLLECTION).then(function (remoteDocs) {
      if (remoteDocs && Object.keys(remoteDocs).length > 0) {
        mergeCloudSnapshotIntoLocal(remoteDocs);
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
      // 유닛 문서 안에 id 필드가 안 들어있으면(예: Claude가 도구로 Firestore에 직접
      // 넣으면서 깜빡한 경우) 홈 화면 카드가 "reader.html?id=undefined"로 링크되어
      // "유닛을 찾을 수 없어요"가 뜬다 - 맵의 키(=진짜 문서 id)로 보정해준다.
      if (!u.id) u = Object.assign({}, u, { id: id });
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
    setEnded: setEnded,
    getGroupedByLevel: getGroupedByLevel,
    hasAny: hasAny
  };
})();
