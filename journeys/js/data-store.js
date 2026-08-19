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
    return merged;
  }

  function getUnit(id) {
    return loadAll()[id] || null;
  }

  function deleteUnit(id) {
    var units = loadAll();
    delete units[id];
    saveAll(units);
  }

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
