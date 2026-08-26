// 따라읽기·혼자읽기 중 아이 목소리를 마이크로 녹음해서 이 기기에만(IndexedDB) 저장한다.
// 클라우드로는 안 올라간다 - 다른 기기에서 볼 필요가 없고(부모가 같은 기기로 옆에서
// 듣는 걸 전제로 함), localStorage는 사진 데이터로 이미 꽉 차 있어서(5MB 한도) 못 쓴다.
// 페이지당 최신 한 번만 남기고(같은 자리에 덮어쓰기) 이전 녹음은 버린다.
var RecordingStore = (function () {
  var DB_NAME = "journeysRecordings";
  var DB_VERSION = 1;
  var STORE_NAME = "takes";
  // 아이폰 사파리는 audio/webm을 못 만든다(audio/mp4로 만듦) - 지원하는 것 중 첫 번째로
  // 녹음하고, 실제로 쓰인 mimeType을 같이 저장해뒀다가 재생할 때 그대로 쓴다.
  var MIME_CANDIDATES = ["audio/webm", "audio/mp4", "audio/ogg"];

  var dbPromise = null;
  var activeSession = null; // { recorder, chunks, stream, mimeType, mode, pageIndex }

  function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      if (!("indexedDB" in window)) {
        reject(new Error("indexedDB not supported"));
        return;
      }
      var req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      req.onsuccess = function () {
        resolve(req.result);
      };
      req.onerror = function () {
        reject(req.error);
      };
    });
    return dbPromise;
  }

  function recordKey(childId, unitId, mode, pageIndex) {
    return (childId || "guest") + "|" + unitId + "|" + mode + "|" + pageIndex;
  }

  function stopTracks(stream) {
    stream.getTracks().forEach(function (t) {
      t.stop();
    });
  }

  function pickSupportedMimeType() {
    for (var i = 0; i < MIME_CANDIDATES.length; i++) {
      if (window.MediaRecorder && MediaRecorder.isTypeSupported(MIME_CANDIDATES[i])) {
        return MIME_CANDIDATES[i];
      }
    }
    return "";
  }

  function isSupported() {
    return !!(
      navigator.mediaDevices &&
      navigator.mediaDevices.getUserMedia &&
      window.MediaRecorder
    );
  }

  // 이 mode의 녹음을 시작한다(마이크 권한 요청 포함). 이미 다른 캡처가 진행 중이면
  // 그건 그냥 버리고(취소) 새로 시작한다 - 한 번에 하나만 녹음할 수 있으므로.
  function startCapture(mode, pageIndex) {
    if (!isSupported()) {
      return Promise.reject({ reason: "unsupported" });
    }
    if (activeSession) cancelCapture(activeSession.mode);

    return navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then(function (stream) {
        var mimeType = pickSupportedMimeType();
        var options = mimeType ? { mimeType: mimeType } : undefined;
        var recorder;
        try {
          recorder = options ? new MediaRecorder(stream, options) : new MediaRecorder(stream);
        } catch (e) {
          stopTracks(stream);
          throw { reason: "denied", error: e };
        }
        var chunks = [];
        recorder.addEventListener("dataavailable", function (e) {
          if (e.data && e.data.size > 0) chunks.push(e.data);
        });
        activeSession = {
          recorder: recorder,
          chunks: chunks,
          stream: stream,
          mimeType: recorder.mimeType || mimeType || "audio/webm",
          mode: mode,
          pageIndex: pageIndex
        };
        recorder.start();
      })
      .catch(function (err) {
        if (err && err.reason) throw err;
        throw { reason: "denied", error: err };
      });
  }

  // 녹음을 멈추고 Blob으로 돌려준다. mode가 지금 진행 중인 캡처와 안 맞거나(다른 모드로
  // 넘어갔거나) 애초에 캡처가 시작 안 됐으면(마이크 권한 거부 등) null을 돌려준다 -
  // 호출부(reader.js)는 이 null을 "녹음 없음"으로 보고 완료 처리를 막는다.
  function stopCapture(mode, pageIndex) {
    if (!activeSession || activeSession.mode !== mode) {
      return Promise.resolve(null);
    }
    var session = activeSession;
    activeSession = null;

    if (session.recorder.state === "inactive") {
      stopTracks(session.stream);
      return Promise.resolve(session.chunks.length ? new Blob(session.chunks, { type: session.mimeType }) : null);
    }

    return new Promise(function (resolve) {
      session.recorder.addEventListener("stop", function () {
        stopTracks(session.stream);
        var blob = session.chunks.length ? new Blob(session.chunks, { type: session.mimeType }) : null;
        resolve(blob);
      });
      try {
        session.recorder.stop();
      } catch (e) {
        stopTracks(session.stream);
        resolve(null);
      }
    });
  }

  // 녹음을 저장하지 않고 그냥 버린다 - 재생 중에 멈춤을 누르거나 다른 모드로 갈아탈 때.
  function cancelCapture(mode) {
    if (!activeSession || (mode && activeSession.mode !== mode)) return;
    var session = activeSession;
    activeSession = null;
    if (session.recorder.state !== "inactive") {
      try {
        session.recorder.stop();
      } catch (e) {
        // 이미 멈춘 상태 등 - 무시
      }
    }
    stopTracks(session.stream);
  }

  function withStore(mode, fn) {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE_NAME, mode);
        var store = tx.objectStore(STORE_NAME);
        var req = fn(store);
        req.onsuccess = function () {
          resolve(req.result);
        };
        req.onerror = function () {
          reject(req.error);
        };
      });
    });
  }

  function saveTake(childId, unitId, mode, pageIndex, blob, mimeType) {
    var key = recordKey(childId, unitId, mode, pageIndex);
    return withStore("readwrite", function (store) {
      return store.put({ blob: blob, mimeType: mimeType, savedAt: Date.now() }, key);
    });
  }

  function getTake(childId, unitId, mode, pageIndex) {
    var key = recordKey(childId, unitId, mode, pageIndex);
    return withStore("readonly", function (store) {
      return store.get(key);
    }).then(function (result) {
      return result || null;
    });
  }

  function hasTake(childId, unitId, mode, pageIndex) {
    return getTake(childId, unitId, mode, pageIndex).then(function (t) {
      return !!t;
    });
  }

  function deleteTake(childId, unitId, mode, pageIndex) {
    var key = recordKey(childId, unitId, mode, pageIndex);
    return withStore("readwrite", function (store) {
      return store.delete(key);
    });
  }

  return {
    isSupported: isSupported,
    startCapture: startCapture,
    stopCapture: stopCapture,
    cancelCapture: cancelCapture,
    saveTake: saveTake,
    getTake: getTake,
    hasTake: hasTake,
    deleteTake: deleteTake
  };
})();
