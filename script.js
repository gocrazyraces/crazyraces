// Initialize Fabric.js canvas
const canvas = new fabric.Canvas('fabric-canvas', {
  backgroundColor: '#fff',
  preserveObjectStacking: true
});

// Store crosshairs and images
let crosshairs = [];
let placingCrosshair = false;
let carImageObj = null;
let wheelImageObj = null;

// Add crosshair button
document.getElementById('add-crosshair').onclick = () => {
  alert('Click on canvas to place a crosshair');
  placingCrosshair = true;
};

// Handle canvas clicks for crosshairs
canvas.on('mouse:down', function(options) {
  if(!placingCrosshair) return;
  const pointer = canvas.getPointer(options.e);
  const size = 10;

  // Red crosshair (two lines)
  const line1 = new fabric.Line([pointer.x-size, pointer.y, pointer.x+size, pointer.y], { stroke: 'red', strokeWidth: 2 });
  const line2 = new fabric.Line([pointer.x, pointer.y-size, pointer.x, pointer.y+size], { stroke: 'red', strokeWidth: 2 });

  canvas.add(line1);
  canvas.add(line2);
  crosshairs.push({x:pointer.x, y:pointer.y});

  placingCrosshair = false;
});

// Upload image helper
function uploadImage(isCar) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = e => {
    const reader = new FileReader();
    reader.onload = evt => {
      fabric.Image.fromURL(evt.target.result, function(img) {
        img.set({ left: 0, top: 0, selectable: true });
        canvas.add(img);
        if(isCar) carImageObj = img;
        else wheelImageObj = img;
        canvas.renderAll();
      });
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

// Export Car PNG
document.getElementById('export-car').onclick = () => {
  const dataURL = canvas.toDataURL({ format:'png' });
  downloadURL(dataURL, 'car.png');
};

// Export Wheel PNG (just the wheel image if uploaded)
document.getElementById('export-wheel').onclick = () => {
  if(!wheelImageObj) {
    alert('No wheel image uploaded');
    return;
  }
  const tempCanvas = new fabric.StaticCanvas(null, { width: wheelImageObj.width, height: wheelImageObj.height });
  tempCanvas.add(fabric.util.object.clone(wheelImageObj));
  const dataURL = tempCanvas.toDataURL({ format:'png' });
  downloadURL(dataURL, 'wheel.png');
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

  const carDataURL = canvas.toDataURL({ format:'png' });
  const wheelDataURL = wheelImageObj ? (new fabric.StaticCanvas(null, {width:wheelImageObj.width, height:wheelImageObj.height})).toDataURL({format:'png'}) : carDataURL;

  const data = {
    carName,
    teamName,
    email,
    acceleration: accelSlider.value,
    topSpeed: speedSlider.value,
    crosshairs,
    carImage: carDataURL,
    wheelImage: wheelDataURL
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
