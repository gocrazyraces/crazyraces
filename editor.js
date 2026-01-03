const canvas = new fabric.Canvas('canvas', {
  backgroundColor: '#fff',
  preserveObjectStacking: true
});
canvas.renderAll();

/* ===== LAYERS ===== */
const layers = {
  body: [],
  wheels: [],
  markers: []
};

/* ===== MODE / TOOLS ===== */
let mode = 'body';
let tool = 'select';
let placingMarker = false;

document.getElementById('mode-body').onclick = () => setMode('body');
document.getElementById('mode-wheel').onclick = () => setMode('wheel');

function setMode(m) {
  mode = m;
  document.getElementById('mode-body').classList.toggle('active', m === 'body');
  document.getElementById('mode-wheel').classList.toggle('active', m === 'wheel');
  canvas.isDrawingMode = false;
}

document.querySelectorAll('.tool').forEach(b => {
  b.onclick = () => setTool(b.dataset.tool);
});

function setTool(t) {
  tool = t;
  placingMarker = (t === 'crosshair' && mode === 'wheel');

  document.querySelectorAll('.tool').forEach(b =>
    b.classList.toggle('active', b.dataset.tool === t)
  );

  canvas.isDrawingMode = (t === 'draw' || t === 'erase');
  canvas.freeDrawingBrush.width = +brushSize.value;
  canvas.freeDrawingBrush.color = t === 'erase' ? '#fff' : color.value;
}

/* ===== BRUSH ===== */
brushSize.oninput = e =>
  canvas.freeDrawingBrush.width = +e.target.value;

color.oninput = e =>
  canvas.freeDrawingBrush.color = e.target.value;

/* ===== MARKERS ===== */
canvas.on('mouse:down', e => {
  if (!placingMarker) return;

  const p = canvas.getPointer(e.e);
  const s = 12;

  const h = new fabric.Line([p.x - s, p.y, p.x + s, p.y], {
    stroke: 'red', selectable: false, evented: false
  });
  const v = new fabric.Line([p.x, p.y - s, p.x, p.y + s], {
    stroke: 'red', selectable: false, evented: false
  });

  canvas.add(h, v);
  layers.markers.push(h, v);
  placingMarker = false;
});

/* ===== UPLOADS (FIXED) ===== */
function handleUpload(input, layerName, lock) {
  input.addEventListener('change', e => {
    if (!e.target.files.length) return;

    const reader = new FileReader();
    reader.onload = ev => {
      fabric.Image.fromURL(ev.target.result, img => {
        img.left = 300;
        img.top = 250;
        img.lockRotation = true;
        img.selectable = !lock;

        if (lock) {
          img.lockMovementX = true;
          img.lockMovementY = true;
        }

        canvas.add(img);
        layers[layerName].push(img);
      });
    };
    reader.readAsDataURL(e.target.files[0]);
  });
}

handleUpload(uploadBody, 'body', false);
handleUpload(uploadWheel, 'wheels', true);

/* ===== LAYER VISIBILITY / LOCK ===== */
function toggleLayer(layer, visible) {
  layers[layer].forEach(o => o.visible = visible);
  canvas.renderAll();
}

document.getElementById('layer-body').onchange =
  e => toggleLayer('body', e.target.checked);

document.getElementById('layer-wheels').onchange =
  e => toggleLayer('wheels', e.target.checked);

document.getElementById('layer-markers').onchange =
  e => toggleLayer('markers', e.target.checked);

/* ===== STATS ===== */
const accel = document.getElementById('accel');
const speed = document.getElementById('speed');
const accelVal = document.getElementById('accelVal');
const speedVal = document.getElementById('speedVal');

function updateStats() {
  if (+accel.value + +speed.value > 100) {
    speed.value = 100 - accel.value;
  }
  accelVal.textContent = accel.value;
  speedVal.textContent = speed.value;
}

accel.oninput = speed.oninput = updateStats;
updateStats();

/* ===== PREVIEW ===== */
preview.onclick = () => {
  layers.wheels.forEach((w, i) => {
    const m = layers.markers[i * 2];
    if (!m) return;

    w.set({
      left: m.x1 - w.width / 2,
      top: m.y1 - w.height / 2
    });

    w.animate('angle', '+=360', {
      duration: 800,
      onChange: canvas.renderAll.bind(canvas)
    });
  });
};

/* ===== SUBMIT (UNCHANGED CONTRACT) ===== */
submit.onclick = async () => {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)) {
    alert('Invalid email');
    return;
  }

  const wheelPositions = [];
  for (let i = 0; i < layers.markers.length; i += 2) {
    wheelPositions.push({
      x: layers.markers[i].x1,
      y: layers.markers[i].y1
    });
  }

  const carData = {
    carName: carName.value,
    teamName: teamName.value,
    email: email.value,
    acceleration: +accel.value,
    topSpeed: +speed.value,
    wheelPositions,
    carImageData: canvas.toDataURL({ format: 'png' }),
    wheelImageData: layers.wheels[0]
      ? layers.wheels[0].toDataURL({ format: 'png' })
      : canvas.toDataURL({ format: 'png' })
  };

  const res = await fetch('/api/submit-car', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ carData })
  });

  alert(res.ok ? 'Submitted successfully!' : 'Submission failed');
};
