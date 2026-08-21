// 관리자 탭 하나를 잠그는 공용 비밀번호(아이별 비밀번호와 별개). 이것도 진짜
// 보안이 필요한 값은 아니라서 평문으로 저장하고, 로그인처럼 이 기기에만 적용된다.
var AdminAuthStore = (function () {
  var KEY = "haingAdminPin";
  var ACTIVE_KEY = "haingAdminActive";

  function getPin() {
    return localStorage.getItem(KEY) || "";
  }

  function hasPin() {
    return !!getPin();
  }

  function setPin(pin) {
    var trimmed = String(pin || "").trim();
    if (trimmed) {
      localStorage.setItem(KEY, trimmed);
    } else {
      localStorage.removeItem(KEY);
    }
  }

  function verifyPin(input) {
    var saved = getPin();
    if (!saved) return true;
    return String(input || "") === saved;
  }

  // "지금 이 기기에서 관리자로 로그인돼 있는지" - 아이 로그인(ChildStore)과는
  // 별개의 상태다. 관리자로 로그인하면 관리자 탭이 보이고, 아이로 로그인하면
  // (또는 로그아웃하면) 숨겨진다.
  function isActive() {
    return localStorage.getItem(ACTIVE_KEY) === "1";
  }

  function setActive(active) {
    if (active) {
      localStorage.setItem(ACTIVE_KEY, "1");
    } else {
      localStorage.removeItem(ACTIVE_KEY);
    }
  }

  return {
    hasPin: hasPin,
    setPin: setPin,
    verifyPin: verifyPin,
    isActive: isActive,
    setActive: setActive
  };
})();
