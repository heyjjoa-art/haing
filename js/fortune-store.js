// 1,2,3단계를 모두 완료했을 때 주는 보상 - "띠별 오늘의 운세".
// 포털사이트 오늘의 운세 코너의 형식(상황 묘사 → 조언 → 긍정적 결론 3문장 + 행운의 색·숫자)을
// 참고했지만, 문구 자체는 저작권 문제가 없도록 새로 지은 것이다(진짜 사주풀이 아님).
// 공부 얘기가 아니라 아이들이 읽으면 그냥 기분 좋아지는 일반적인 문장들로 구성했다.
//
// 문구는 "오프닝(오늘 분위기) + 조언 + 결과" 3조각을 조합해서 만든다.
// 오프닝/조언/결과/색 인덱스를 모두 comboIndex % 각 배열 길이로 독립 계산하기
// 때문에 매일 세 문장과 색이 다 같이 바뀌고(어제와 이어서 비슷해 보이지 않음),
// 전체 조합은 최소 120일(8, 6, 5의 최소공배수)이 지나야 반복된다. 게다가 띠마다
// 시작 지점을 다르게 잡아서, 같은 날 하정이(말띠)와 하진이(닭띠)가 보는 문구도
// 서로 달라진다.
var FortuneStore = (function () {
  var OPENERS = [
    "괜히 기분 좋은 일이 자꾸 생기는 하루예요.",
    "마음이 유난히 편안하고 여유로운 하루예요.",
    "새로운 것에 마음이 끌리는 하루예요.",
    "몸도 마음도 가뿐한 컨디션 좋은 하루예요.",
    "가까운 사람과 마음이 잘 통하는 하루예요.",
    "작은 것에도 고마운 마음이 샘솟는 하루예요.",
    "평소보다 자신감이 넘치는 하루예요.",
    "차분하게 여유가 느껴지는 하루예요."
  ];

  var ADVICES = [
    "하고 싶은 말이 있다면 오늘 용기 내어 표현해보세요.",
    "가까운 사람에게 먼저 따뜻한 말 한마디를 건네보세요.",
    "서두르지 않고 하나씩 차근차근 해보세요.",
    "평소 미뤄뒀던 작은 일을 오늘 한번 해보세요.",
    "주변을 천천히 둘러보며 작은 것들을 살펴보세요.",
    "오늘 하루 감사한 일을 마음속으로 세 가지 떠올려보세요."
  ];

  var OUTCOMES = [
    "그 마음이 하루를 훨씬 더 즐겁게 만들어줄 거예요.",
    "작은 용기가 스스로를 한 뼘 더 자라게 해줄 거예요.",
    "따뜻한 마음이 돌고 돌아 좋은 일로 돌아올 거예요.",
    "그 안에서 뜻밖의 즐거움을 발견하게 될 거예요.",
    "편안한 마음이 오히려 더 좋은 결과를 가져다줄 거예요."
  ];

  var COLORS = [
    "에메랄드 그린", "라벤더 퍼플", "코랄 핑크", "레몬 옐로우", "스카이 블루",
    "피치 오렌지", "민트 그린", "체리 레드", "라일락", "터콰이즈",
    "머스터드 옐로우", "베이비 핑크", "인디고 블루", "탠저린 오렌지"
  ];

  var CYCLE_LENGTH = OPENERS.length * ADVICES.length * OUTCOMES.length; // 8*6*5 = 240

  // 12띠를 고르게 240칸 위에 흩어 놓는다(20칸씩 간격) - 같은 날이어도 띠마다
  // 다른 조합을 보게 하기 위함이다.
  var ZODIAC_ORDER = ["쥐띠", "소띠", "호랑이띠", "토끼띠", "용띠", "뱀띠", "말띠", "양띠", "원숭이띠", "닭띠", "개띠", "돼지띠"];

  function zodiacOffset(zodiacName) {
    var idx = ZODIAC_ORDER.indexOf(zodiacName);
    if (idx === -1) idx = 0;
    return idx * 20;
  }

  var EPOCH = new Date(2026, 0, 1); // 고정 기준일 - 값 자체는 의미 없고, 매일 1씩 늘어나기만 하면 된다.

  function daysSinceEpoch() {
    var today = new Date();
    var todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return Math.round((todayMidnight - EPOCH) / 86400000);
  }

  // { main, color, number } 형태로 돌려준다.
  function getTodayFortune(zodiacName) {
    var comboIndex = (((daysSinceEpoch() + zodiacOffset(zodiacName)) % CYCLE_LENGTH) + CYCLE_LENGTH) % CYCLE_LENGTH;

    // 자릿수(진법) 방식 대신 각 배열마다 독립적으로 comboIndex % 길이를 써서
    // 오프닝/조언/결과/색이 "매일" 다 같이 바뀌도록 한다. 예전 방식은
    // outcomeIdx만 매일 바뀌고 adviceIdx는 5일에 한 번, openerIdx는
    // 30일에 한 번만 바뀌어서 색이 30일씩 똑같이 나오는 문제가 있었다.
    // 색 인덱스도 openerIdx에 얹어 쓰지 않고 COLORS 자체 길이로 독립 계산해서,
    // 문장과 색이 서로 다른 주기로 바뀌며 더 다양하게 섞이도록 한다.
    var outcomeIdx = comboIndex % OUTCOMES.length;
    var adviceIdx = comboIndex % ADVICES.length;
    var openerIdx = comboIndex % OPENERS.length;
    var colorIdx = comboIndex % COLORS.length;

    return {
      main: OPENERS[openerIdx] + " " + ADVICES[adviceIdx] + " " + OUTCOMES[outcomeIdx],
      color: COLORS[colorIdx],
      number: (comboIndex % 9) + 1
    };
  }

  return {
    getTodayFortune: getTodayFortune
  };
})();
