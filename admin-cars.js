(() => {
  const container = document.getElementById('adminCars');
  if (!container) return;

  async function fetchCars() {
    try {
      const response = await fetch('/api/admin-cars');
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text);
      }
      const data = await response.json();
      renderCars(data.cars || []);
    } catch (error) {
      container.innerHTML = `<div class="no-entries">Failed to load cars: ${error.message}</div>`;
    }
  }

  function renderCars(cars) {
    if (!cars.length) {
      container.innerHTML = '<div class="no-entries">No cars found.</div>';
      return;
    }

    const rows = cars.map(car => {
      const status = car.carstatus || 'submitted';
      return `
        <div class="admin-card">
          <div>
            <strong>${car.carname || 'Unnamed car'}</strong> (Season ${car.season}, #${car.carnumber})
            <div>Status: <span class="pill">${status}</span></div>
          </div>
          <div class="admin-actions">
            <button class="btn small" data-action="approved" data-row="${car.rowIndex}">Approve</button>
            <button class="btn small danger" data-action="rejected" data-row="${car.rowIndex}">Reject</button>
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = rows;
  }

  container.addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;

    const rowIndex = button.dataset.row;
    const status = button.dataset.action;

    try {
      const response = await fetch('/api/admin-car-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rowIndex, status })
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text);
      }
      await fetchCars();
    } catch (error) {
      alert(`Failed to update status: ${error.message}`);
    }
  });

  fetchCars();
})();