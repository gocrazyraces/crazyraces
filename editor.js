// ====================
// FABRIC CANVAS SETUP
// ====================
const canvas = new fabric.Canvas('canvas', { backgroundColor: '#fff' });
canvas.isDrawingMode = true;
canvas.freeDrawingBrush.width = 4;
canvas.freeDrawingBrush.color = '#000000';

// Tabs
let currentTab = 'body';
document.getElementById('bodyTab').onclick = () => switchTab('body');
document.getElementById('wheelTab').onclick = () => switchTab('wheel');

function switchTab(tab) {
  currentTab = tab;
  document.getElementById('bodyTab').classList.toggle('active', tab==='body');
  document.getElementById('wheelTab').classList.toggle('active', tab==='wheel');
}

// ====================
// TOOL CONTROLS
// ====================
document.getElementById('drawBtn').onclick = () => canvas.isDrawingMode = true;
document.getElementById('selectBtn').onclick = () => canvas.isDrawingMode = false;

document.getElementById('brushSize').oninput = function() {
  canvas.freeDrawingBrush.width = parseInt(this.value,10);
};
document.getElementById('color').oninput = function() {
  canvas.freeDrawingBrush.color = this.value;
};

// ====================
// UPLOAD
// ====================
document.getElementById('upload').onchange = function(e) {
  if (!this.files.length) return;
  const reader = new FileReader();
  reader.onload = function(ev) {
    fabric.Image.fromURL(ev.target.result, function(img) {
      img.left = 100;
      img.top = 100;
      img.scaleToWidth(300);
      img.set('selectable', true);
      img.set('tab', currentTab); // mark which tab it belongs to
      canvas.add(img);
      canvas.setActiveObject(img);
      canvas.renderAll();
    });
  };
  reader.readAsDataURL(this.files[0]);
};

// ====================
// PROPERTIES
// ====================
const accSlider = document.getElementById('acceleration');
const speedSlider = document.getElementById('topSpeed');
const accVal = document.getElementById('accVal');
const speedVal = document.getElementById('speedVal');
const pointsRemaining = document.getElementById('pointsRemaining');

function updatePoints() {
  const total = parseInt(accSlider.value)+parseInt(speedSlider.value);
  pointsRemaining.textContent = 100 - total;
}
accSlider.oninput = () => { accVal.textContent = accSlider.value; updatePoints(); };
speedSlider.oninput = () => { speedVal.textContent = speedSlider.value; updatePoints(); };
updatePoints();

// ====================
// SUBMIT
// ====================
document.getElementById('submitBtn').onclick = async () => {
  const carName = document.getElementById('carName').value.trim();
  const teamName = document.getElementById('teamName').value.trim();
  const email = document.getElementById('email').value.trim();

  if(!carName || !teamName || !email) {
    alert('Please fill Car Name, Team Name, and Email.');
    return;
  }

  // Export images for each tab
  let bodyImage = '';
  let wheelImage = '';

  canvas.getObjects().forEach(obj=>{
    if(obj.tab==='body') bodyImage = obj.toDataURL({format:'png'});
    if(obj.tab==='wheel') wheelImage = obj.toDataURL({format:'png'});
  });

  const payload = {
    carData: {
      carName, teamName, email,
      acceleration: parseInt(accSlider.value),
      topSpeed: parseInt(speedSlider.value),
      carImageData: bodyImage,
      wheelImageData: wheelImage
    }
  };

  try {
    const resp = await fetch('/api/submit-car', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify(payload)
    });
    if(resp.ok) {
      document.getElementById('submitStatus').textContent = 'Submission successful!';
    } else {
      document.getElementById('submitStatus').textContent = 'Submission failed!';
    }
  } catch(e) {
    document.getElementById('submitStatus').textContent = 'Submission failed!';
  }
};
