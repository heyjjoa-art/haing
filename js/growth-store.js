// 게임을 얼마나 많이 플레이했는지로 매기는 계정 전체 성장 레벨(아이언~챌린저, 12단계).
// 단어 카드/트로피/저니스 도장 같은 공부 활동은 이미 게임 기회(크레딧)로 보상되므로
// 여기서 다시 세지 않는다 - 그 크레딧을 실제로 "써서 게임을 한 판 시작한 횟수"만
// XP로 잡는다(1회 = 20XP). 크레딧 게임(테트리스/스도쿠/가로세로)은 크레딧 자체가
// 하루 플레이 횟수를 자연히 제한하니 추가 제한이 없고, 크레딧 없이 무제한 반복
// 가능한 게임(있다면)은 dailyCap을 넘겨서 하루 인정 횟수를 막을 수 있다.
var GrowthStore = (function () {
  var XP_PER_PLAY = 20;

  var TIERS = [
    { key: "iron", label: "아이언", emoji: "🔩", min: 0 },
    { key: "bronze", label: "브론즈", emoji: "🥉", min: 300 },
    { key: "silver", label: "실버", emoji: "🥈", min: 800 },
    { key: "gold", label: "골드", emoji: "🥇", min: 1600 },
    { key: "platinum", label: "플래티넘", emoji: "💠", min: 2800 },
    { key: "sapphire", label: "사파이어", emoji: "🔷", min: 4400 },
    { key: "emerald", label: "에메랄드", emoji: "💚", min: 6400 },
    { key: "ruby", label: "루비", emoji: "❤️", min: 8800 },
    { key: "diamond", label: "다이아몬드", emoji: "💎", min: 11800 },
    { key: "master", label: "마스터", emoji: "⭐", min: 15400 },
    { key: "grandmaster", label: "그랜드마스터", emoji: "🌟", min: 19600 },
    { key: "challenger", label: "챌린저", emoji: "👑", min: 24400 }
  ];

  function playsKey(childId) {
    return "haingGamePlays_" + childId;
  }

  function todayStr() {
    var d = new Date();
    return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
  }

  function dailyCapKey(childId, game) {
    return "haingGamePlaysToday_" + childId + "_" + game;
  }

  function getTotalPlays(childId) {
    if (!childId) return 0;
    return parseInt(localStorage.getItem(playsKey(childId)), 10) || 0;
  }

  // 플레이 1회를 기록한다. dailyCap을 주면 오늘 이 게임에서 이미 그만큼 인정했을
  // 때 조용히 무시한다(게임 자체는 계속할 수 있고 XP만 더 안 붙는다).
  function recordPlay(childId, game, dailyCap) {
    if (!childId) return;
    if (dailyCap) {
      var key = dailyCapKey(childId, game);
      var raw = null;
      try {
        raw = JSON.parse(localStorage.getItem(key));
      } catch (e) {
        raw = null;
      }
      var today = todayStr();
      var count = raw && raw.date === today ? raw.count : 0;
      if (count >= dailyCap) return;
      localStorage.setItem(key, JSON.stringify({ date: today, count: count + 1 }));
    }
    localStorage.setItem(playsKey(childId), String(getTotalPlays(childId) + 1));
  }

  function getXP(childId) {
    return getTotalPlays(childId) * XP_PER_PLAY;
  }

  // xp가 속한 티어와, 다음 티어까지 얼마나 남았는지를 돌려준다. 이미 최고
  // 티어(챌린저)면 next는 null, xpToNext는 0, progressPct는 100.
  function getTier(xp) {
    var current = TIERS[0];
    var next = null;
    for (var i = 0; i < TIERS.length; i++) {
      if (xp >= TIERS[i].min) current = TIERS[i];
      else {
        next = TIERS[i];
        break;
      }
    }
    var xpToNext = 0;
    var progressPct = 100;
    if (next) {
      xpToNext = next.min - xp;
      progressPct = Math.round(((xp - current.min) / (next.min - current.min)) * 100);
    }
    return {
      tier: current.key,
      label: current.label,
      emoji: current.emoji,
      min: current.min,
      xp: xp,
      next: next,
      xpToNext: xpToNext,
      progressPct: progressPct
    };
  }

  function getTierForChild(childId) {
    return getTier(getXP(childId));
  }

  return {
    TIERS: TIERS,
    XP_PER_PLAY: XP_PER_PLAY,
    recordPlay: recordPlay,
    getTotalPlays: getTotalPlays,
    getXP: getXP,
    getTier: getTier,
    getTierForChild: getTierForChild
  };
})();
