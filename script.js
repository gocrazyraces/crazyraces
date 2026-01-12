/**
 * =========================================================
 * RAPID RACERS 2D — shared config + race timing UI
 * =========================================================
 */

window.CRAZY_RACES_SUBMIT_ENDPOINT = "/api/submit-car";
window.CRAZY_RACES_TOTAL_CREDITS = 100;

window.CRAZY_RACES_BODY_W = 1024;
window.CRAZY_RACES_BODY_H = 512;
window.CRAZY_RACES_WHEEL_W = 256;
window.CRAZY_RACES_WHEEL_H = 256;

/**
 * Race time:
 * - "1 week from now" at 20:00 GMT (treated as 20:00 UTC)
 * - Header shows date + "20:00 GMT"
 * - Page bar shows countdown: (Xd Ym Zs to go)
 */
(function raceTimingUI() {
  const nextRaceEl = document.getElementById("nextRaceDate");
  const countdownEl = document.getElementById("nextRaceCountdown");

  // Build next race datetime: 7 days from today, 20:00 UTC
  const now = new Date();
  const race = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  race.setUTCHours(20, 0, 0, 0);

  // Header date format in UTC so "GMT" makes sense
  const fmtDate = new Intl.DateTimeFormat(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

  function updateHeader() {
    if (!nextRaceEl) return;
    const datePart = fmtDate.format(race);
    nextRaceEl.textContent = `${datePart} 20:00 GMT`;
  }

  function updateCountdown() {
    if (!countdownEl) return;

    const diff = race.getTime() - Date.now();

    if (diff <= 0) {
      countdownEl.textContent = "(Race time!)";
      return;
    }

    // Requested explicitly: days, minutes, seconds
    // minutes are the remaining minutes after removing whole days (0..1439)
    const days = Math.floor(diff / 86400000);
    const minutes = Math.floor((diff % 86400000) / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);

    countdownEl.textContent = `(${days}d ${minutes}m ${seconds}s to go)`;
  }

  updateHeader();
  updateCountdown();
  setInterval(updateCountdown, 1000);

  // Footer year
  const yearEl = document.getElementById("footerYear");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());
})();
