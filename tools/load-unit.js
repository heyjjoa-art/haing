// Firestore에 유닛 내용(단어/본문)을 채워 넣는 도구.
// 매주: 사진 올리기 -> Claude에게 전사 요청 -> 이 스크립트로 적재, 순서로 쓴다.
// updateMask로 넘긴 필드만 덮어써서, 이미 저장된 사진(base64) 필드는 절대 건드리지 않는다.
//
// 사용법: node tools/load-unit.js <collection> <docId> <fields.json>
//   collection: wordUnits | journeysUnits
//   docId: 예) 18, 1-3__at-home-in-the-ocean
//   fields.json: 덮어쓸 필드만 담은 평평한(flat) 객체. updatedAt은 안 넣으면 자동으로 채워진다.

const fs = require("fs");
const https = require("https");

const PROJECT_ID = "haing-d51c8";

function toFirestoreValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === "string") return { stringValue: v };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number") {
    return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  }
  if (Array.isArray(v)) {
    return { arrayValue: { values: v.map(toFirestoreValue) } };
  }
  if (typeof v === "object") {
    var fields = {};
    Object.keys(v).forEach(function (k) {
      fields[k] = toFirestoreValue(v[k]);
    });
    return { mapValue: { fields: fields } };
  }
  throw new Error("지원하지 않는 값 타입: " + typeof v);
}

function main() {
  var args = process.argv.slice(2);
  if (args.length !== 3) {
    console.error("사용법: node tools/load-unit.js <collection> <docId> <fields.json>");
    process.exit(1);
  }
  var collection = args[0];
  var docId = args[1];
  var jsonPath = args[2];

  if (collection !== "wordUnits" && collection !== "journeysUnits") {
    console.error('collection은 "wordUnits" 또는 "journeysUnits"여야 합니다: ' + collection);
    process.exit(1);
  }

  var data = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  if (data.updatedAt === undefined) data.updatedAt = Date.now();

  var fields = {};
  Object.keys(data).forEach(function (k) {
    fields[k] = toFirestoreValue(data[k]);
  });

  var fieldNames = Object.keys(data);
  var maskQuery = fieldNames
    .map(function (k) {
      return "updateMask.fieldPaths=" + encodeURIComponent(k);
    })
    .join("&");

  var path =
    "/v1/projects/" +
    PROJECT_ID +
    "/databases/(default)/documents/" +
    collection +
    "/" +
    encodeURIComponent(docId) +
    "?" +
    maskQuery;

  var body = JSON.stringify({ fields: fields });

  var req = https.request(
    {
      hostname: "firestore.googleapis.com",
      path: path,
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body)
      }
    },
    function (res) {
      var chunks = [];
      res.on("data", function (c) {
        chunks.push(c);
      });
      res.on("end", function () {
        var text = Buffer.concat(chunks).toString("utf8");
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log("✅ " + collection + "/" + docId + " 에 " + fieldNames.join(", ") + " 저장 완료");
        } else {
          console.error("❌ 실패 (" + res.statusCode + "): " + text);
          process.exit(1);
        }
      });
    }
  );
  req.on("error", function (e) {
    console.error("❌ 요청 실패:", e.message);
    process.exit(1);
  });
  req.write(body);
  req.end();
}

main();
