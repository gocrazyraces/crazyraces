/**
 * Results page JavaScript
 * Shows race results for the season
 */

(function initializeResultsPage() {
  // Load race results for the season
  async function loadSeasonResults() {
    try {
      const response = await fetch('/api/race-results?season=1');
      const data = await response.json();

      if (data.results && data.results.length > 0) {
        displaySeasonResults(data.results);
      } else {
        showNoResults();
      }
    } catch (error) {
      console.error('Failed to load race results:', error);
      showNoResults();
    }
  }

  function displaySeasonResults(results) {
    const container = document.getElementById('raceResultsContainer');

    if (!container) return;

    // Group results by race
    const racesMap = new Map();

    results.forEach(result => {
      const raceKey = `Race ${result.racenumber}`;
      if (!racesMap.has(raceKey)) {
        racesMap.set(raceKey, []);
      }
      racesMap.get(raceKey).push(result);
    });

    // Create HTML for each race
    const racesHtml = Array.from(racesMap.entries())
      .sort(([a], [b]) => parseInt(a.split(' ')[1]) - parseInt(b.split(' ')[1]))
      .map(([raceName, raceResults]) => createRaceSection(raceName, raceResults))
      .join('');

    container.innerHTML = racesHtml;
  }

  function createRaceSection(raceName, results) {
    const tableRows = results.map(result => `
      <tr>
        <td>${result.position}</td>
        <td>${formatTime(result.time)}</td>
        <td>${result.status}</td>
        <td>${result.racerteamname}</td>
        <td>${result.racercarname}</td>
        <td>${result.notes || ''}</td>
      </tr>
    `).join('');

    return `
      <section class="race-results-section">
        <h2>${raceName}</h2>
        <div class="results-table-container">
          <table class="results-table">
            <thead>
              <tr>
                <th>Position</th>
                <th>Time</th>
                <th>Status</th>
                <th>Team Name</th>
                <th>Car Name</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
        </div>
      </section>
    `;
  }

  function formatTime(timeStr) {
    // Handle different time formats
    if (!timeStr) return '-';

    // If it's already in MM:SS.mmm format, return as is
    if (timeStr.includes(':')) {
      return timeStr;
    }

    // If it's a number (milliseconds), format it
    const ms = parseInt(timeStr);
    if (!isNaN(ms)) {
      const minutes = Math.floor(ms / 60000);
      const seconds = Math.floor((ms % 60000) / 1000);
      const milliseconds = ms % 1000;
      return `${minutes}:${String(seconds).padStart(2, '0')}.${String(milliseconds).padStart(3, '0')}`;
    }

    return timeStr;
  }

  function showNoResults() {
    const container = document.getElementById('raceResultsContainer');
    if (container) {
      container.innerHTML = '<div class="no-results">No race results available yet.</div>';
    }
  }

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

  // Load results on page load
  loadSeasonResults();
})();
