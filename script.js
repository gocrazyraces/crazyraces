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
 * Race information from Google Sheets:
 * - Dynamically loads race details from Sheet2
 * - Shows next active race information
 * - Header shows race name and deadline
 * - Page bar shows countdown to race deadline
 */
(function raceTimingUI() {
  const nextRaceEl = document.getElementById("nextRaceDate");
  const countdownEl = document.getElementById("nextRaceCountdown");

  // Header date format in UTC so "GMT" makes sense
  const fmtDate = new Intl.DateTimeFormat(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

  let raceDeadline = null;

  // Fetch race information from Google Sheets
  async function loadRaceInfo() {
    try {
      const response = await fetch('/api/race-info');
      const data = await response.json();

      if (data.raceInfo) {
        const race = data.raceInfo;
        raceDeadline = new Date(race.racedeadline);

        // Update header with race name and deadline
        if (nextRaceEl) {
          const datePart = fmtDate.format(raceDeadline);
          const timePart = raceDeadline.toLocaleTimeString('en-GB', {
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'UTC'
          });
          nextRaceEl.textContent = `${race.racename} - ${datePart} ${timePart} GMT`;
        }

        // Update page title with race info
        document.title = `${race.racename} - Rapid Racers 2D`;

        updateCountdown();
      } else {
        // Fallback to default if no race info
        setDefaultRace();
      }
    } catch (error) {
      console.error('Failed to load race info:', error);
      setDefaultRace();
    }
  }

  function setDefaultRace() {
    // Build next race datetime: 7 days from today, 20:00 UTC
    const now = new Date();
    raceDeadline = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    raceDeadline.setUTCHours(20, 0, 0, 0);

    if (nextRaceEl) {
      const datePart = fmtDate.format(raceDeadline);
      nextRaceEl.textContent = `Next Race - ${datePart} 20:00 GMT`;
    }
    updateCountdown();
  }

  function updateCountdown() {
    if (!countdownEl || !raceDeadline) return;

    const diff = raceDeadline.getTime() - Date.now();

    if (diff <= 0) {
      countdownEl.textContent = "Race time!";
      return;
    }

    const totalSeconds = Math.floor(diff / 1000);
    const days = Math.floor(totalSeconds / (24 * 3600));
    const hours = Math.floor((totalSeconds % (24 * 3600)) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    countdownEl.textContent = `${days}d ${hours}h ${minutes}m ${seconds}s to go!`;
  }

  // Load race info on page load
  loadRaceInfo();
  // Update countdown every second
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
    versionEl.textContent = `Version 0.57 (${day}${suffix} ${month} ${year} ${hours}:${minutes})`;
  }
})();
