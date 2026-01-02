// Initialize Toast UI Image Editor
const imageEditor = new tui.ImageEditor('#toast-image-editor', {
  includeUI: {
    menu: ['draw', 'shape', 'text', 'flip', 'rotate', 'crop'],
    initMenu: 'draw',
    uiSize: { width: '1024px', height: '512px' },
    menuBarPosition: 'bottom'
  },
  cssMaxWidth: 1024,
  cssMaxHeight: 512,
  selectionStyle: { cornerSize: 20, rotatingPointOffset: 70 }
});

// Crosshairs
let crosshairs = [];

// Add wheel crosshair
document.getElementById('add-crosshair').addEventListener('click', () => {
  alert('Click on the image to place a crosshair');
  const onClick = (pos) => {
    const x = pos.offsetX;
    const y = pos.offsetY;
    crosshairs.push({ x, y });
    imageEditor.addText('✚', { x, y, fill: 'red', fontSize: 24 });
    imageEditor.off('mousedown', onClick);
  };
  imageEditor.on('mousedown', onClick);
});

// Upload car/wheel
function uploadImage(type) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = e => {
    const reader = new FileReader();
    reader.onload = evt => {
      imageEditor.loadImageFromURL(evt.target.result, type, {
        crossOrigin: 'anonymous'
      }).then(() => console.log(type + ' loaded'));
    };
    reader.readAsDataURL(e.target.files[0]);
  };
  input.click();
}
document.getElementById('upload-car').onclick = () => uploadImage('car');
document.getElementById('upload-wheel').onclick = () => uploadImage('wheel');

// Sliders capped at 100
const accelSlider = document.getElementById("acceleration");
const speedSlider = document.getElementById("topSpeed");
function updateSliders() {
  const total = parseInt(accelSlider.value) + parseInt(speedSlider.value);
  if(total>100) speedSlider.value = 100 - parseInt(accelSlider.value);
}
accelSlider.addEventListener("input", updateSliders);
speedSlider.addEventListener("input", updateSliders);

// Email validation
function isValidEmail(email) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }

// Download helper
function downloadURL(url, filename) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
}

// Export car PNG
document.getElementById('export-car').onclick = () => {
  const dataURL = imageEditor.toDataURL();
  downloadURL(dataURL, 'car.png');
};

// Export wheels PNG (for demo, we export full image)
document.getElementById('export-wheel').onclick = () => {
  const dataURL = imageEditor.toDataURL();
  downloadURL(dataURL, 'wheels.png');
};

// Export JSON
document.getElementById('export-json').onclick = () => {
  const carName = document.getElementById('carName').value;
  const teamName = document.getElementById('teamName').value;
  const email = document.getElementById('email').value;

  if(!isValidEmail(email)) return alert('Invalid email');

  const data = {
    carName,
    teamName,
    email,
    acceleration: accelSlider.value,
    topSpeed: speedSlider.value,
    crosshairs
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  downloadURL(url, 'car.json');
};

// Submit to serverless backend
document.getElementById('submit-design').onclick = async () => {
  const carName = document.getElementById('carName').value;
  const teamName = document.getElementById('teamName').value;
  const email = document.getElementById('email').value;

  if(!isValidEmail(email)) return alert('Invalid email');

  const carDataURL = imageEditor.toDataURL();
  const data = {
    carName,
    teamName,
    email,
    acceleration: accelSlider.value,
    topSpeed: speedSlider.value,
    crosshairs,
    carImage: carDataURL
  };

  try {
    const res = await fetch('/api/submit-car', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if(res.ok) alert('Submitted successfully!');
    else alert('Error submitting.');
  } catch(err) { console.error(err); alert('Submission failed.'); }
};
