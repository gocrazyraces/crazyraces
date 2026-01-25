/**
 * Garage page JavaScript
 * Loads car info and renders cards
 */
(function initializeGaragePage() {
  const grid = document.getElementById('garageGrid');

  async function loadGarageData() {
    if (!grid) return;

    try {
      const response = await fetch('/api/cars?resource=info');
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
      const thumb = car.thumb256ImageData
        || car.carthumb256path
        || car.previewImageData
        || car.carimagepath
        || '';
      const previewLink = car.carimagepath || '';

      return `
        <article class="garage-card">
          <div class="garage-thumb">
            ${thumb ? `
              <a href="${previewLink}" target="_blank" rel="noopener noreferrer">
                <img src="${thumb}" alt="${carName} thumbnail" loading="lazy" />
              </a>
            ` : '<div class="garage-thumb-placeholder">No image</div>'}
          </div>
          <div class="garage-card-body">
            <h3 class="garage-card-title">${carName}</h3>
          </div>
        </article>
      `;
    }).join('');

    grid.innerHTML = cards;
  }

  // Load data on page load
  loadGarageData();
})();