/**
 * Garage page JavaScript
 * Loads car info and renders cards
 */
(function initializeGaragePage() {
  const grid = document.getElementById('garageGrid');

  async function loadGarageData() {
    if (!grid) return;

    try {
      const response = await fetch('/api/car-info');
      const data = await response.json();

      if (data.cars && data.cars.length > 0) {
        renderCars(data.cars);
      } else {
        grid.innerHTML = '<div class="no-entries">No cars found yet.</div>';
      }
    } catch (error) {
      console.error('Failed to load car info:', error);
      grid.innerHTML = '<div class="no-entries">Unable to load garage data.</div>';
    }
  }

  function renderCars(cars) {
    const cards = cars.map(car => {
      const carName = car.carname || 'Unknown Car';
      const carVersion = car.carversion || '—';
      const thumb = car.carthumbnailpath || '';

      return `
        <article class="garage-card">
          <div class="garage-thumb">
            ${thumb ? `<img src="${thumb}" alt="${carName} thumbnail" loading="lazy" />` : '<div class="garage-thumb-placeholder">No image</div>'}
          </div>
          <div class="garage-card-body">
            <h3 class="garage-card-title">${carName}</h3>
            <p class="garage-card-subtitle">Mark: ${carVersion}</p>
          </div>
        </article>
      `;
    }).join('');

    grid.innerHTML = cards;
  }

  // Load data on page load
  loadGarageData();
})();