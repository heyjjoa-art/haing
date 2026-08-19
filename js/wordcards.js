(function () {
  "use strict";

  var countEl = document.getElementById("wcCount");
  var emptyEl = document.getElementById("wcEmpty");
  var gridEl = document.getElementById("wcGrid");
  var lightboxEl = document.getElementById("wcLightbox");
  var lightboxBodyEl = document.getElementById("wcLightboxBody");
  var lightboxCloseBtn = document.getElementById("wcLightboxClose");

  function openLightbox(record) {
    lightboxBodyEl.innerHTML = WordCardView.cardHtml(record, { large: true });
    lightboxEl.classList.add("open");
  }

  function closeLightbox() {
    lightboxEl.classList.remove("open");
  }

  lightboxCloseBtn.addEventListener("click", closeLightbox);
  lightboxEl.addEventListener("click", function (e) {
    if (e.target === lightboxEl) closeLightbox();
  });

  function render() {
    var pending = WordCardStore.getPendingWords();
    var cards = WordCardStore.getCollected().slice().reverse();

    countEl.textContent = String(cards.length);
    emptyEl.hidden = cards.length > 0;
    gridEl.hidden = cards.length === 0;

    gridEl.innerHTML = "";
    cards.forEach(function (record) {
      var isNew = pending.indexOf(String(record.word || "").toLowerCase()) !== -1;
      var el = WordCardView.cardEl(record, { isNew: isNew });
      el.addEventListener("click", function () {
        openLightbox(record);
      });
      gridEl.appendChild(el);
    });

    WordCardStore.clearPending();
  }

  render();
})();
