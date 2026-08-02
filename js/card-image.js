// 아직 못 모은 카드 자리에 쓸 "?" 이미지를 SVG로 그려서 data URL로 돌려준다.
function buildLockedCardImageUrl() {
  var svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="220" height="300" viewBox="0 0 220 300">' +
    '<rect x="4" y="4" width="212" height="292" rx="18" fill="#ece2d2" stroke="#d8c9ae" stroke-width="4"/>' +
    '<circle cx="110" cy="120" r="62" fill="#e2d4bd"/>' +
    '<text x="110" y="145" font-size="60" text-anchor="middle" font-family="sans-serif" font-weight="bold" fill="#b7a893">?</text>' +
    '<text x="110" y="250" font-size="16" text-anchor="middle" font-family="sans-serif" fill="#b7a893">아직 못 모았어요</text>' +
    "</svg>";
  return "data:image/svg+xml," + encodeURIComponent(svg);
}
