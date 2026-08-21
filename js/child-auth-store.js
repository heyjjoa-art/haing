// 아이별 비밀번호(선택 사항). 형제가 실수로/장난으로 서로 계정을 바꾸는 걸 막는
// 용도의 가벼운 잠금이라 평문으로 저장한다 - 진짜 보안이 필요한 값이 아니다.
// ChildStore의 "지금 로그인한 아이" 자체가 기기별 상태(클라우드 동기화 없음)라서,
// 이 비밀번호도 똑같이 이 기기에만 적용된다 - 다른 기기에서 쓰려면 그 기기에서
// 따로 설정해야 한다.
var ChildAuthStore = (function () {
  function key(childId) {
    return "haingChildPin_" + childId;
  }

  function getPin(childId) {
    return localStorage.getItem(key(childId)) || "";
  }

  function hasPin(childId) {
    return !!getPin(childId);
  }

  function setPin(childId, pin) {
    var trimmed = String(pin || "").trim();
    if (trimmed) {
      localStorage.setItem(key(childId), trimmed);
    } else {
      localStorage.removeItem(key(childId));
    }
  }

  function verifyPin(childId, input) {
    var saved = getPin(childId);
    if (!saved) return true;
    return String(input || "") === saved;
  }

  return {
    hasPin: hasPin,
    setPin: setPin,
    verifyPin: verifyPin
  };
})();
