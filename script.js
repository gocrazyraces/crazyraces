/**
 * =========================================================
 * RAPID RACERS 2D — shared config + small UI helpers
 * =========================================================
 */

window.CRAZY_RACES_SUBMIT_ENDPOINT = "/api/submit-car";
window.CRAZY_RACES_TOTAL_CREDITS = 100;

window.CRAZY_RACES_BODY_W = 1024;
window.CRAZY_RACES_BODY_H = 512;
window.CRAZY_RACES_WHEEL_W = 256;
window.CRAZY_RACES_WHEEL_H = 256;

/**
 * Set the “Next race” date to 1 week from now (requested).
 * Also sets footer year.
 */
(function setHeaderAndFooterDates() {
  const nextRaceEl = document.getElementById("nextRaceDate");
  if (nextRaceEl) {
    const d = new Date();
    d.setDate(d.getDate() + 7);

    // Format: e.g. "19 Jan 2026"
    const fmt = new Intl.DateTimeFormat(undefined, {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });

    nextRaceEl.textContent = fmt.format(d);
  }

  const yearEl = document.getElementById("footerYear");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());
})();
