// 여러 휴대폰 사이에 콘텐츠·진행 상황을 맞추기 위한 클라우드 연결 창구.
// 이 파일은 오직 "연결하고 공통 함수 몇 개 제공하기"만 한다 - 어떤 데이터를 언제
// 올리고 받을지는 각 스토어(data-store.js, progress-store.js 등)가 알아서 정한다.
// Firebase 연결이 실패해도(오프라인 등) enabled가 false가 될 뿐, 이 기기 로컬 저장은
// 그대로 동작한다 - 클라우드는 어디까지나 "여러 기기 맞추기"를 위한 보조 장치다.
var HaingCloud = (function () {
  var firebaseConfig = {
    apiKey: "AIzaSyDRrVZXdyPwre7WFmVrfhZmblzoX-OELeo",
    authDomain: "haing-d51c8.firebaseapp.com",
    projectId: "haing-d51c8",
    storageBucket: "haing-d51c8.firebasestorage.app",
    messagingSenderId: "591278824981",
    appId: "1:591278824981:web:575e55428d0223bd98781c"
  };

  var db = null;
  var enabled = false;

  try {
    if (typeof firebase !== "undefined") {
      firebase.initializeApp(firebaseConfig);
      db = firebase.firestore();
      enabled = true;
    }
  } catch (e) {
    console.warn("[HaingCloud] 초기화 실패, 이 기기에는 로컬 저장만 사용합니다.", e);
  }

  // 문서 하나를 실시간 구독한다. 이 기기에서 방금 쓴 변경의 echo(hasPendingWrites)는
  // 건너뛰고, 다른 기기에서 온 변경일 때만 콜백을 부른다.
  function watchDoc(path, onRemoteChange) {
    if (!enabled) return function () {};
    return db.doc(path).onSnapshot(
      function (snap) {
        if (snap.metadata.hasPendingWrites) return;
        onRemoteChange(snap.exists ? snap.data() : null);
      },
      function (err) {
        console.warn("[HaingCloud] watchDoc 실패", path, err);
      }
    );
  }

  // 컬렉션 전체를 실시간 구독한다. 콜백에는 { 문서id: 데이터 } 형태로 넘어온다.
  function watchCollection(path, onRemoteChange) {
    if (!enabled) return function () {};
    return db.collection(path).onSnapshot(
      function (snap) {
        if (snap.metadata.hasPendingWrites) return;
        var docs = {};
        snap.forEach(function (doc) {
          docs[doc.id] = doc.data();
        });
        onRemoteChange(docs);
      },
      function (err) {
        console.warn("[HaingCloud] watchCollection 실패", path, err);
      }
    );
  }

  // 문서 하나를 딱 한 번만 읽는다(기기 최초 연결 시, 로컬과 클라우드 중 뭘 시작점으로 삼을지 정할 때 씀).
  function getDocOnce(path) {
    if (!enabled) return Promise.resolve(null);
    return db
      .doc(path)
      .get()
      .then(function (snap) {
        return snap.exists ? snap.data() : null;
      })
      .catch(function (err) {
        console.warn("[HaingCloud] getDocOnce 실패", path, err);
        return null;
      });
  }

  // 딱 한 번만 읽는다(기기 최초 연결 시, 로컬과 클라우드 중 뭘 시작점으로 삼을지 정할 때 씀).
  function getCollectionOnce(path) {
    if (!enabled) return Promise.resolve(null);
    return db
      .collection(path)
      .get()
      .then(function (snap) {
        var docs = {};
        snap.forEach(function (doc) {
          docs[doc.id] = doc.data();
        });
        return docs;
      })
      .catch(function (err) {
        console.warn("[HaingCloud] getCollectionOnce 실패", path, err);
        return null;
      });
  }

  // Firestore는 undefined 값이 있는 필드를 그냥 거부한다(에러 발생). 없는 사진 필드처럼
  // 값이 없는 경우가 흔해서, JSON 왕복으로 undefined 필드를 통째로 지우고 나서 쓴다.
  function stripUndefined(data) {
    return JSON.parse(JSON.stringify(data));
  }

  // 실패해도 이 기기의 로컬 저장은 이미 끝난 뒤라 조용히 무시한다(다음 변경 때 다시 시도됨).
  function writeDoc(path, data) {
    if (!enabled) return Promise.resolve();
    return db
      .doc(path)
      .set(stripUndefined(data))
      .catch(function (err) {
        console.warn("[HaingCloud] writeDoc 실패", path, err);
      });
  }

  // JSON 왕복(stripUndefined) 대신 쓰는 안전한 버전. arrayUnion()처럼 Firestore가 주는
  // 특수 값(센티넬)은 JSON 왕복을 거치면 그냥 빈 객체가 돼버려서, 평범한 객체/배열만
  // 복사하고 그 밖의 값은 그대로 넘긴다.
  function stripUndefinedKeepSentinels(value) {
    if (Array.isArray(value)) return value.map(stripUndefinedKeepSentinels);
    var isPlain =
      value !== null &&
      typeof value === "object" &&
      Object.prototype.toString.call(value) === "[object Object]" &&
      (value.constructor === Object || typeof value.constructor === "undefined");
    if (!isPlain) return value;
    var out = {};
    Object.keys(value).forEach(function (k) {
      if (value[k] === undefined) return;
      out[k] = stripUndefinedKeepSentinels(value[k]);
    });
    return out;
  }

  // 여러 기기가 같은 문서(아이별 도장 등)를 쓸 때 writeDoc(set)은 문서를 통째로
  // 덮어써서, 다른 기기가 먼저 올려둔 기록을 지워버린다. 이 함수는 넘긴 필드만
  // 병합(merge)해서 쓰므로 안 넘긴 필드(다른 날짜 기록 등)는 서버에 그대로 남는다.
  // 단, 배열 필드는 병합해도 통째로 교체되므로 쌓아야 하는 배열은 arrayUnion()으로 넘긴다.
  function writeDocMerge(path, data) {
    if (!enabled) return Promise.resolve();
    return db
      .doc(path)
      .set(stripUndefinedKeepSentinels(data), { merge: true })
      .catch(function (err) {
        console.warn("[HaingCloud] writeDocMerge 실패", path, err);
      });
  }

  // 배열에 "이 값들을 더해라"를 서버에서 처리하게 하는 값. 이미 있는 값은 그대로 두고
  // 없는 값만 붙어서, 두 기기가 각각 더한 값이 둘 다 남는다. 클라우드가 꺼져 있거나
  // 값이 없으면 평범한 배열을 그대로 돌려준다(로컬 저장만 쓰는 경우).
  function arrayUnion(values) {
    var list = values || [];
    if (!enabled || typeof firebase === "undefined" || !list.length) return list;
    var FieldValue = firebase.firestore.FieldValue;
    return FieldValue.arrayUnion.apply(FieldValue, list);
  }

  function deleteDoc(path) {
    if (!enabled) return Promise.resolve();
    return db
      .doc(path)
      .delete()
      .catch(function (err) {
        console.warn("[HaingCloud] deleteDoc 실패", path, err);
      });
  }

  return {
    enabled: enabled,
    watchDoc: watchDoc,
    watchCollection: watchCollection,
    getDocOnce: getDocOnce,
    getCollectionOnce: getCollectionOnce,
    writeDoc: writeDoc,
    writeDocMerge: writeDocMerge,
    arrayUnion: arrayUnion,
    deleteDoc: deleteDoc
  };
})();
