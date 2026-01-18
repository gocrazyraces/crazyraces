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
      countdownEl.textContent = "Race time!";
      return;
    }

    const totalSeconds = Math.floor(diff / 1000);
    const days = Math.floor(totalSeconds / (24 * 3600));
    const hours = Math.floor((totalSeconds % (24 * 3600)) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    countdownEl.textContent = `${days} days, ${hours} hours, ${minutes} minutes, ${seconds} seconds!`;
  }

  updateHeader();
  updateCountdown();
  setInterval(updateCountdown, 1000);

  // Footer year
  const yearEl = document.getElementById("footerYear");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  // Version info
  const versionEl = document.getElementById("versionInfo");
  if (versionEl) {
    const now = new Date();
    const day = now.getDate();
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const month = monthNames[now.getMonth()];
    const year = now.getFullYear();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const suffix = day === 1 || day === 21 || day === 31 ? 'st' : day === 2 || day === 22 ? 'nd' : day === 3 || day === 23 ? 'rd' : 'th';
    versionEl.textContent = `Version 0.1 (${day}${suffix} ${month} ${year} ${hours}:${minutes})`;
  }
})();
