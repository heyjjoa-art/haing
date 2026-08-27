// 모든 페이지 헤더 부제목에 "영어를 좋아하는 [아이콘+이름 버튼]"을 보여준다.
// 관리자로 로그인했을 때는 "관리자 모드 [🛠️ 관리자]"로 바뀐다.
// 예전엔 계정 전환이 헤더 우측의 별도 버튼이었는데, 이제 그 버튼 자리는 단어도감
// 아이콘이 차지하고, 계정 전환은 부제목 안 이름 버튼을 누르면 되도록 옮겨왔다.
// 실제 "누구로 바꿀지 고르는" 화면은 index.html에만 있어서, 여기서 누르면 지금
// 로그인을 풀고 index.html로 보내 거기서 새로 고르게 한다.
//
// 아이로 로그인 중이면 헤더 우측(단어도감 아이콘 왼쪽)에 성장 레벨 배지도 함께
// 띄운다. GrowthStore가 아직 없는 페이지(옛 캐시 등)에서는 조용히 건너뛴다.
(function () {
  "use strict";

  var subtitleEl = document.getElementById("appSubtitle");
  var headerEl = document.querySelector(".app-header");
  if (!subtitleEl || typeof ChildStore === "undefined") return;

  function logout() {
    if (confirm("다른 친구로 바꿀까요?")) {
      ChildStore.setActive(null);
      if (typeof AdminAuthStore !== "undefined") AdminAuthStore.setActive(false);
      window.location.href = "index.html";
    }
  }

  function render() {
    var info = ChildStore.getActiveInfo();
    var isAdmin = typeof AdminAuthStore !== "undefined" && AdminAuthStore.isActive();
    subtitleEl.textContent = "";
    subtitleEl.appendChild(document.createTextNode(isAdmin ? "관리자 모드 " : "영어를 좋아하는 "));
    if (info || isAdmin) {
      var nameBtn = document.createElement("button");
      nameBtn.type = "button";
      nameBtn.className = "subtitle-child-btn";
      nameBtn.textContent = isAdmin ? "🛠️ 관리자" : info.zodiacEmoji + " " + info.name;
      nameBtn.addEventListener("click", logout);
      subtitleEl.appendChild(nameBtn);
    }
    renderGrowthBadge(info && !isAdmin ? ChildStore.getActive() : null);
  }

  // ── 성장 레벨 배지 ────────────────────────────────────────────────
  var TIER_PALETTE = {
    bronze: { light: "#f0c49a", mid: "#d78f52", dark: "#8a4c22", ring: "#6e3a19" },
    silver: { light: "#fbfcfd", mid: "#cfd6dc", dark: "#8f99a3", ring: "#6b747d" },
    gold: { light: "#fff1b8", mid: "#f0bd3e", dark: "#c2860f", ring: "#8f6208" },
    platinum: { light: "#e3f6fb", mid: "#8fc7dd", dark: "#3f7591", ring: "#2c5468" },
    diamond: { light: "#d9fbff", mid: "#5fd6e6", dark: "#1490a3", ring: "#0d6c7a" }
  };

  var badgeIdSeq = 0;

  // 은은한 금속/보석 배지 하나를 그린다 - 메달류(브론즈~골드)는 별, 보석류
  // (플래티넘·다이아몬드)는 컷팅된 보석 모양을 가운데 얹어서 재질감을 구분한다.
  function badgeSvg(tierKey, size) {
    var c = TIER_PALETTE[tierKey] || TIER_PALETTE.bronze;
    badgeIdSeq++;
    var gradId = "gbGrad" + badgeIdSeq;
    var shineId = "gbShine" + badgeIdSeq;
    var isGem = tierKey === "platinum" || tierKey === "diamond";
    var emblem = isGem
      ? '<path d="M32 15 L46 25 L32 51 L18 25 Z" fill="rgba(255,255,255,0.28)"/>' +
        '<path d="M32 15 L46 25 L32 33 L18 25 Z" fill="rgba(255,255,255,0.85)"/>' +
        '<path d="M18 25 L32 33 L32 51 Z" fill="rgba(255,255,255,0.5)"/>' +
        '<path d="M46 25 L32 33 L32 51 Z" fill="rgba(255,255,255,0.32)"/>'
      : '<path d="M32 16 L36.3 27 L48 27.4 L38.6 34.6 L42 46 L32 39 L22 46 L25.4 34.6 L16 27.4 L27.7 27 Z" fill="rgba(255,255,255,0.92)"/>';
    return (
      '<svg viewBox="0 0 64 64" width="' + size + '" height="' + size + '" aria-hidden="true">' +
      "<defs>" +
      '<radialGradient id="' + gradId + '" cx="35%" cy="28%" r="80%">' +
      '<stop offset="0%" stop-color="' + c.light + '"/>' +
      '<stop offset="55%" stop-color="' + c.mid + '"/>' +
      '<stop offset="100%" stop-color="' + c.dark + '"/>' +
      "</radialGradient>" +
      '<radialGradient id="' + shineId + '" cx="50%" cy="50%" r="50%">' +
      '<stop offset="0%" stop-color="rgba(255,255,255,0.75)"/>' +
      '<stop offset="100%" stop-color="rgba(255,255,255,0)"/>' +
      "</radialGradient>" +
      "</defs>" +
      '<circle cx="32" cy="32" r="29" fill="' + c.ring + '"/>' +
      '<circle cx="32" cy="32" r="26" fill="url(#' + gradId + ')"/>' +
      '<circle cx="32" cy="32" r="26" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="1.5" stroke-dasharray="2.5 4"/>' +
      emblem +
      '<ellipse cx="23" cy="21" rx="10" ry="6" fill="url(#' + shineId + ')" transform="rotate(-28 23 21)"/>' +
      "</svg>"
    );
  }

  var TIER_DESC = {
    bronze: "게임을 처음 시작한 단계예요.",
    silver: "꾸준히 게임을 즐기고 있어요!",
    gold: "많이 놀아본 실력자예요!",
    platinum: "정말 열심히 했어요, 대단해요!",
    diamond: "최고 등급이에요! 진짜 노력파예요 💎"
  };

  function injectStylesOnce() {
    if (document.getElementById("growthBadgeStyles")) return;
    var style = document.createElement("style");
    style.id = "growthBadgeStyles";
    style.textContent =
      ".growth-badge-btn{position:absolute;top:50%;right:92px;transform:translateY(-50%);" +
      "width:44px;height:44px;padding:0;border:none;background:transparent;cursor:pointer;" +
      "filter:drop-shadow(0 2px 4px rgba(35,32,42,0.28));}" +
      ".growth-badge-btn svg{display:block;width:100%;height:100%;}" +
      ".growth-badge-btn:active{transform:translateY(-50%) scale(0.93);}" +
      ".growth-popup-backdrop{position:fixed;inset:0;background:rgba(20,16,10,0.55);" +
      "display:flex;align-items:flex-end;justify-content:center;z-index:9999;padding:0;}" +
      "@media (min-width:560px){.growth-popup-backdrop{align-items:center;padding:20px;}}" +
      ".growth-popup{background:#fffdf8;width:100%;max-width:420px;max-height:88vh;overflow-y:auto;" +
      "border-radius:20px 20px 0 0;padding:22px 20px 28px;position:relative;" +
      "box-shadow:0 -8px 32px rgba(0,0,0,0.25);}" +
      "@media (min-width:560px){.growth-popup{border-radius:20px;}}" +
      ".growth-popup-close{position:absolute;top:12px;right:14px;border:none;background:rgba(0,0,0,0.06);" +
      "width:30px;height:30px;border-radius:50%;font-size:1rem;cursor:pointer;color:#635d6b;}" +
      ".growth-popup-eyebrow{margin:0 0 14px;font-size:0.78rem;font-weight:bold;letter-spacing:0.04em;" +
      "color:#a8632f;text-align:center;}" +
      ".growth-popup-current{display:flex;flex-direction:column;align-items:center;gap:6px;margin-bottom:20px;}" +
      ".growth-popup-current svg{width:88px;height:88px;filter:drop-shadow(0 4px 10px rgba(0,0,0,0.25));}" +
      ".growth-popup-tier-name{margin:4px 0 0;font-size:1.25rem;font-weight:bold;}" +
      ".growth-popup-tier-desc{margin:0;font-size:0.85rem;color:#635d6b;text-align:center;}" +
      ".growth-popup-xp{margin:6px 0 0;font-size:0.78rem;color:#8a7969;font-variant-numeric:tabular-nums;}" +
      ".growth-popup-bar{width:100%;max-width:260px;height:8px;border-radius:999px;background:#eee6d6;" +
      "overflow:hidden;margin-top:8px;}" +
      ".growth-popup-bar-fill{height:100%;background:linear-gradient(90deg,#ffb454,#e0453a);border-radius:999px;}" +
      ".growth-popup-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:2px;}" +
      ".growth-tier-row{display:flex;align-items:center;gap:12px;padding:10px 8px;border-radius:12px;}" +
      ".growth-tier-row.is-current{background:#fff1d6;}" +
      ".growth-tier-row.is-locked{opacity:0.45;}" +
      ".growth-tier-row svg{width:34px;height:34px;flex-shrink:0;}" +
      ".growth-tier-row-body{min-width:0;}" +
      ".growth-tier-row-name{margin:0;font-weight:bold;font-size:0.92rem;}" +
      ".growth-tier-row-desc{margin:1px 0 0;font-size:0.76rem;color:#8a7969;}" +
      ".growth-tier-row-req{margin:1px 0 0;font-size:0.7rem;color:#b7a893;font-variant-numeric:tabular-nums;}";
    document.head.appendChild(style);
  }

  function closeGrowthPopup() {
    var el = document.getElementById("growthPopupBackdrop");
    if (el) el.remove();
  }

  function openGrowthPopup(childId) {
    closeGrowthPopup();
    var xp = GrowthStore.getXP(childId);
    var current = GrowthStore.getTier(xp);

    var backdrop = document.createElement("div");
    backdrop.className = "growth-popup-backdrop";
    backdrop.id = "growthPopupBackdrop";
    backdrop.addEventListener("click", function (e) {
      if (e.target === backdrop) closeGrowthPopup();
    });

    var popup = document.createElement("div");
    popup.className = "growth-popup";

    var closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "growth-popup-close";
    closeBtn.textContent = "✕";
    closeBtn.addEventListener("click", closeGrowthPopup);
    popup.appendChild(closeBtn);

    var eyebrow = document.createElement("p");
    eyebrow.className = "growth-popup-eyebrow";
    eyebrow.textContent = "나의 성장 레벨";
    popup.appendChild(eyebrow);

    var currentWrap = document.createElement("div");
    currentWrap.className = "growth-popup-current";
    currentWrap.innerHTML =
      badgeSvg(current.tier, 88) +
      '<p class="growth-popup-tier-name">' + current.label + "</p>" +
      '<p class="growth-popup-tier-desc">' + TIER_DESC[current.tier] + "</p>" +
      '<p class="growth-popup-xp">' +
      (current.next
        ? xp.toLocaleString() + "XP · 다음 등급까지 " + current.xpToNext.toLocaleString() + "XP"
        : xp.toLocaleString() + "XP · 가장 높은 등급이에요!") +
      "</p>" +
      '<div class="growth-popup-bar"><div class="growth-popup-bar-fill" style="width:' + current.progressPct + '%"></div></div>';
    popup.appendChild(currentWrap);

    var list = document.createElement("ul");
    list.className = "growth-popup-list";
    GrowthStore.TIERS.forEach(function (t) {
      var li = document.createElement("li");
      var isCurrent = t.key === current.tier;
      var isLocked = xp < t.min;
      li.className = "growth-tier-row" + (isCurrent ? " is-current" : "") + (isLocked ? " is-locked" : "");
      li.innerHTML =
        badgeSvg(t.key, 34) +
        '<div class="growth-tier-row-body">' +
        '<p class="growth-tier-row-name">' + t.emoji + " " + t.label + "</p>" +
        '<p class="growth-tier-row-desc">' + TIER_DESC[t.key] + "</p>" +
        '<p class="growth-tier-row-req">' + t.min.toLocaleString() + "XP 이상</p>" +
        "</div>";
      list.appendChild(li);
    });
    popup.appendChild(list);

    backdrop.appendChild(popup);
    document.body.appendChild(backdrop);
  }

  // childId가 없으면(관리자 모드/로그아웃 상태) 배지를 아예 안 보여준다 - 이건
  // 아이 개인 화면이지 관리자가 볼 자리가 아니고, 로그인 전에도 의미가 없다.
  function renderGrowthBadge(childId) {
    var existing = document.getElementById("growthBadgeBtn");
    if (existing) existing.remove();
    if (!childId || typeof GrowthStore === "undefined" || !headerEl) return;

    injectStylesOnce();
    var tier = GrowthStore.getTierForChild(childId);

    var btn = document.createElement("button");
    btn.type = "button";
    btn.id = "growthBadgeBtn";
    btn.className = "growth-badge-btn";
    btn.setAttribute("aria-label", tier.label + " 등급 배지 - 눌러서 자세히 보기");
    btn.innerHTML = badgeSvg(tier.tier, 44);
    btn.addEventListener("click", function () {
      openGrowthPopup(childId);
    });
    headerEl.appendChild(btn);
  }

  render();
  // index.html에서는 로그인 화면(그리드)에서 아이를 고르면 새로고침 없이 바로
  // 전환되니, 부제목도 같이 실시간으로 다시 그려야 한다.
  if (ChildStore.onChange) ChildStore.onChange(render);
})();
