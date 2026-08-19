// 하정/하진 두 아이를 구분하기 위한 아주 단순한 "로그인"(비밀번호 없이 이름만 선택).
// 진행 상황(ProgressStore)이나 단어 카드 도감(WordCardStore), 저니스 스탬프는 이 값으로
// 아이별로 나뉘어 저장되고, 단어/저니스 등록 콘텐츠 자체는 두 아이가 공유한다.
var ChildStore = (function () {
  var ACTIVE_KEY = "haingActiveChild";

  var CHILDREN = [
    { id: "hajung", name: "하정", zodiac: "말띠", zodiacEmoji: "🐴" },
    { id: "hajin", name: "하진", zodiac: "닭띠", zodiacEmoji: "🐔" }
  ];

  function getInfo(id) {
    return (
      CHILDREN.find(function (c) {
        return c.id === id;
      }) || null
    );
  }

  function getActive() {
    return localStorage.getItem(ACTIVE_KEY) || null;
  }

  function getActiveInfo() {
    return getInfo(getActive());
  }

  var changeListeners = [];

  function setActive(id) {
    if (id) {
      localStorage.setItem(ACTIVE_KEY, id);
    } else {
      localStorage.removeItem(ACTIVE_KEY);
    }
    changeListeners.forEach(function (fn) {
      fn(id);
    });
  }

  // 로그인한 아이가 바뀔 때(로그인/전환) 클라우드 동기화를 다시 걸어야 하는 스토어들이
  // 여기에 등록해둔다 - 페이지가 새로고침되지 않고 같은 화면에서 바로 전환되기 때문.
  function onChange(fn) {
    changeListeners.push(fn);
  }

  return {
    CHILDREN: CHILDREN,
    getInfo: getInfo,
    getActive: getActive,
    getActiveInfo: getActiveInfo,
    setActive: setActive,
    onChange: onChange
  };
})();
