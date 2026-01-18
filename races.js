/**
 * Races page JavaScript
 * Shows upcoming race details and approved entries
 */

(function initializeRacesPage() {
  let raceDeadline = null;

  // Header date format
  const fmtDate = new Intl.DateTimeFormat(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

  // Load race information and entries
  async function loadRaceData() {
    try {
      // Get race info
      const raceResponse = await fetch('/api/race-info');
      const raceData = await raceResponse.json();

      if (raceData.raceInfo) {
        const race = raceData.raceInfo;
        raceDeadline = new Date(race.racedeadline);

        // Update race details
        updateRaceDetails(race);

        // Load approved entries for this race
        await loadApprovedEntries(race.season, race.racenumber);

        console.log('Loading entries for:', { season: race.season, racenumber: race.racenumber });

        // Start countdown
        updateCountdown();
      } else {
        showNoRaceData();
      }
    } catch (error) {
      console.error('Failed to load race data:', error);
      showNoRaceData();
    }
  }

  function updateRaceDetails(race) {
    const raceNameEl = document.getElementById('raceName');
    const raceDateEl = document.getElementById('raceDate');
    const raceDescriptionEl = document.getElementById('raceDescription');

    if (raceNameEl) raceNameEl.textContent = race.racename || 'Unknown Race';

    if (raceDateEl) {
      const datePart = fmtDate.format(raceDeadline);
      const timePart = raceDeadline.toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'UTC'
      });
      raceDateEl.textContent = `Date: ${datePart} ${timePart} GMT`;
    }

    if (raceDescriptionEl) {
      raceDescriptionEl.textContent = race.racedescription || 'No description available.';
    }
  }

  async function loadApprovedEntries(season, racenumber) {
    try {
      const response = await fetch(`/api/race-entries?season=${season}&racenumber=${racenumber}`);
      const data = await response.json();

      if (data.entries && data.entries.length > 0) {
        displayEntries(data.entries);
        updateEntryCount(data.entryCount);
      } else {
        showNoEntries();
        updateEntryCount(0);
      }
    } catch (error) {
      console.error('Failed to load entries:', error);
      showNoEntries();
      updateEntryCount(0);
    }
  }

  function displayEntries(entries) {
    const container = document.getElementById('entriesContainer');

    if (!container) return;

    // Create table
    const table = document.createElement('table');
    table.className = 'entries-table';

    // Table header
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    const teamHeader = document.createElement('th');
    teamHeader.textContent = 'Team Name';
    const carHeader = document.createElement('th');
    carHeader.textContent = 'Car Name';

    headerRow.appendChild(teamHeader);
    headerRow.appendChild(carHeader);
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Table body
    const tbody = document.createElement('tbody');

    entries.forEach(entry => {
      const row = document.createElement('tr');

      const teamCell = document.createElement('td');
      teamCell.textContent = entry.teamName || 'Unknown Team';

      const carCell = document.createElement('td');
      carCell.textContent = entry.carName || 'Unknown Car';

      row.appendChild(teamCell);
      row.appendChild(carCell);
      tbody.appendChild(row);
    });

    table.appendChild(tbody);
    container.innerHTML = '';
    container.appendChild(table);
  }

  function showNoEntries() {
    const container = document.getElementById('entriesContainer');
    if (container) {
      container.innerHTML = '<div class="no-entries">No approved entries yet.</div>';
    }
  }

  function showNoRaceData() {
    const raceDetails = document.getElementById('raceDetails');
    const entriesContainer = document.getElementById('entriesContainer');

    if (raceDetails) {
      raceDetails.innerHTML = '<div class="no-race">No upcoming race information available.</div>';
    }

    if (entriesContainer) {
      entriesContainer.innerHTML = '<div class="no-entries">No race data to display entries for.</div>';
    }
  }

  function updateEntryCount(count) {
    const entriesEl = document.getElementById('raceEntries');
    if (entriesEl) {
      entriesEl.textContent = `Entries: ${count}`;
    }
  }

  function updateCountdown() {
    const countdownEl = document.getElementById('raceCountdown');

    if (!countdownEl || !raceDeadline) return;

    const diff = raceDeadline.getTime() - Date.now();

    if (diff <= 0) {
      countdownEl.textContent = 'Race time!';
      return;
    }

    const totalSeconds = Math.floor(diff / 1000);
    const days = Math.floor(totalSeconds / (24 * 3600));
    const hours = Math.floor((totalSeconds % (24 * 3600)) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    countdownEl.textContent = `Countdown: ${days}d ${hours}h ${minutes}m ${seconds}s`;
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

  // Load data on page load
  loadRaceData();

  // Update countdown every second
  setInterval(updateCountdown, 1000);
})();
