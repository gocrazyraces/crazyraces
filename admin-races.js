(() => {
  const container = document.getElementById('adminRaces');
  if (!container) return;

  async function fetchRaces() {
    try {
      const response = await fetch('/api/admin?resource=races');
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text);
      }
      const data = await response.json();
      renderRaces(data.races || []);
    } catch (error) {
      container.innerHTML = `<div class="no-entries">Failed to load races: ${error.message}</div>`;
    }
  }

  function renderRaces(races) {
    if (!races.length) {
      container.innerHTML = '<div class="no-entries">No races found.</div>';
      return;
    }

    const rows = races.map(race => {
      return `
        <div class="admin-card">
          <div>
            <strong>${race.racename || 'Unnamed race'}</strong> (Season ${race.season}, Race ${race.racenumber})
            <div>Status: <span class="pill">${race.racestatus || 'unknown'}</span></div>
          </div>
          <div class="admin-actions">
            <input type="file" accept="image/*" data-season="${race.season}" data-race="${race.racenumber}" />
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = rows;
  }

  container.addEventListener('change', async (event) => {
    const input = event.target.closest('input[type="file"]');
    if (!input || !input.files?.length) return;

    const file = input.files[0];
    const season = input.dataset.season;
    const racenumber = input.dataset.race;

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const response = await fetch('/api/admin?resource=race-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            season,
            racenumber,
            imageData: reader.result
          })
        });
        if (!response.ok) {
          const text = await response.text();
          throw new Error(text);
        }
        alert('Race image uploaded.');
      } catch (error) {
        alert(`Failed to upload image: ${error.message}`);
      } finally {
        input.value = '';
      }
    };
    reader.readAsDataURL(file);
  });

  fetchRaces();
})();