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
      const raceResponse = await fetch('/api/races?resource=info');
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
      const response = await fetch(`/api/races?resource=entries&season=${season}&racenumber=${racenumber}`);
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
    const carHeader = document.createElement('th');
    carHeader.textContent = 'Car Name';
    const imageHeader = document.createElement('th');
    imageHeader.textContent = 'Car';

    headerRow.appendChild(carHeader);
    headerRow.appendChild(imageHeader);
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Table body
    const tbody = document.createElement('tbody');

    entries.forEach(entry => {
      const row = document.createElement('tr');

      const carCell = document.createElement('td');
      carCell.textContent = entry.carName || 'Unknown Car';

      const imageCell = document.createElement('td');
      const thumbSrc = entry.thumb64ImageData
        || entry.carThumb64Path
        || entry.thumb256ImageData
        || entry.carThumb256Path
        || entry.previewImageData
        || entry.carImagePath
        || '';
      const fullImageSrc = entry.previewImageData || entry.carImagePath || '';
      if (thumbSrc) {
        const img = document.createElement('img');
        img.src = thumbSrc;
        img.alt = entry.carName || 'Car preview';
        img.loading = 'lazy';
        img.className = 'entries-thumb';

        if (fullImageSrc) {
          const link = document.createElement('a');
          link.href = fullImageSrc;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          link.appendChild(img);
          imageCell.appendChild(link);
        } else {
          imageCell.appendChild(img);
        }
      } else {
        imageCell.textContent = '—';
      }

      row.appendChild(carCell);
      row.appendChild(imageCell);
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

  // Load historical race results
  async function loadHistoricalResults() {
    try {
      // Get current season from race info, fallback to season 1
      let currentSeason = 1;
      try {
        const raceResponse = await fetch('/api/races?resource=info');
        const raceData = await raceResponse.json();
        if (raceData.raceInfo && raceData.raceInfo.season) {
          currentSeason = raceData.raceInfo.season;
        }
      } catch (error) {
        console.log('Could not get current season, using default');
      }

      const response = await fetch(`/api/races?resource=results&season=${currentSeason}`);
      const data = await response.json();

      if (data.results && data.results.length > 0) {
        displayHistoricalResults(data.results);
      } else {
        showNoHistoricalResults();
      }
    } catch (error) {
      console.error('Failed to load historical results:', error);
      showNoHistoricalResults();
    }
  }

  function displayHistoricalResults(results) {
    const container = document.getElementById('historicalResultsContainer');

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
      .map(([raceName, raceResults]) => createHistoricalRaceSection(raceName, raceResults))
      .join('');

    container.innerHTML = racesHtml;
  }

  function createHistoricalRaceSection(raceName, results) {
    const tableRows = results.map(result => `
      <tr>
        <td>${result.position}</td>
        <td>${formatTime(result.time)}</td>
        <td>${result.status}</td>
        <td>${result.carnumber || '—'}</td>
        <td>${result.carname || ''}</td>
        <td>${result.notes || ''}</td>
      </tr>
    `).join('');

    return `
      <section class="historical-race-section">
        <h3>${raceName} Results</h3>
        <div class="results-table-container">
          <table class="results-table">
            <thead>
              <tr>
                <th>Position</th>
                <th>Time</th>
                <th>Status</th>
                <th>Car #</th>
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

  function showNoHistoricalResults() {
    const container = document.getElementById('historicalResultsContainer');
    if (container) {
      container.innerHTML = '<div class="no-results">No historical race results available yet.</div>';
    }
  }

  // Load data on page load
  loadRaceData();
  loadHistoricalResults();

  // Update countdown every second
  setInterval(updateCountdown, 1000);
})();
