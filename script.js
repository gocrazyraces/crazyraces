// Initialize LiterallyCanvas
const lc = LC.init(document.getElementById('lc'), {
  imageURLPrefix: 'https://cdn.jsdelivr.net/npm/literallycanvas/lib/img',
  tools: [LC.tools.Pencil, LC.tools.Eraser, LC.tools.Rectangle, LC.tools.Ellipse, LC.tools.Text]
});

// Wheel crosshairs
let crosshairs = [];
let placingCrosshair = false;

// Add crosshair
document.getElementById('add-crosshair').onclick = () => {
  alert('Click on the canvas to place a crosshair');
  placingCrosshair = true;
};

// Handle crosshair placement
lc.canvas.addEventListener('click', e => {
  if (!placingCrosshair) return;
  const rect = lc.canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  crosshairs.push({x, y});

  // Draw a small red cross
  const size = 10;
  lc.addShape(new LC.Shape.Rectangle({
    x: x-size, y: y-size, width: size*2, height: size*2,
    strokeColor: 'red', fillColor: 'red', strokeWidth:1
  }));
  placingCrosshair = false;
});

// Image uploads
function uploadImage(isCar) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = e => {
    const reader = new FileReader();
    reader.onload = evt => {
      const img = new Image();
      img.onload = () => {
        lc.saveShape(new LC.Shape.Image({x:0, y:0, image:img, width:img.width, height:img.height}));
      };
      img.src = evt.target.result;
      if (isCar) window.carImageData = evt.target.result;
      else window.wheelImageData = evt.target.result;
    };
    reader.readAsDataURL(e.target.files[0]);
  };
  input.click();
}
document.getElementById('upload-car').onclick = () => uploadImage(true);
document.getElementById('upload-wheel').onclick = () => uploadImage(false);

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

// Export helpers
function downloadURL(url, filename) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
}

document.getElementById('export-car').onclick = () => {
  const dataURL = lc.getImage().toDataURL();
  downloadURL(dataURL, 'car.png');
};

document.getElementById('export-wheel').onclick = () => {
  const dataURL = window.wheelImageData || lc.getImage().toDataURL();
  downloadURL(dataURL, 'wheel.png');
};

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
  const blob = new Blob([JSON.stringify(data,null,2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  downloadURL(url,'car.json');
};

// Submit to backend
document.getElementById('submit-design').onclick = async () => {
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
    crosshairs,
    carImage: window.carImageData || lc.getImage().toDataURL(),
    wheelImage: window.wheelImageData || lc.getImage().toDataURL()
  };

  try {
    const res = await fetch('/api/submit-car', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify(data)
    });
    if(res.ok) alert('Submitted successfully!');
    else alert('Submission failed.');
  } catch(err) {
    console.error(err);
    alert('Submission failed.');
  }
};
