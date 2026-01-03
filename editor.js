const canvas = new fabric.Canvas('canvas', {
  backgroundColor: '#fff',
  preserveObjectStacking: true
});
canvas.renderAll();

/* ===== STATE ===== */
let mode = 'body';           // body | wheel
let tool = 'select';
let placingWheel = false;

const wheelMarkers = [];
const wheelImages = [];

/* ===== MODE BUTTONS ===== */
const bodyBtn = document.getElementById('mode-body');
const wheelBtn = document.getElementById('mode-wheel');

bodyBtn.onclick = () => setMode('body');
wheelBtn.onclick = () => setMode('wheel');

function setMode(m) {
  mode = m;
  bodyBtn.classList.toggle('active', m === 'body');
  wheelBtn.classList.toggle('active', m === 'wheel');
  canvas.isDrawingMode = false;
}

/* ===== TOOLS ===== */
document.querySelectorAll('.tool').forEach(btn => {
  btn.onclick = () => setTool(btn.dataset.tool);
});

function setTool(t) {
  tool = t;
  placingWheel = (t === 'crosshair' && mode === 'wheel');

  document.querySelectorAll('.tool').forEach(b =>
    b.classList.toggle('active', b.dataset.tool === t)
  );

  canvas.isDrawingMode = (t === 'draw' || t === 'erase');
  canvas.freeDrawingBrush.width = +brushSize.value;
  canvas.freeDrawingBrush.color =
    t === 'erase' ? '#fff' : color.value;
}

/* ===== BRUSH ===== */
brushSize.oninput = e =>
  canvas.freeDrawingBrush.width = +e.target.value;

color.oninput = e =>
  canvas.freeDrawingBrush.color = e.target.value;

/* ===== WHEEL MARKERS (LOCKED) ===== */
canvas.on('mouse:down', e => {
  if (!placingWheel) return;

  const p = canvas.getPointer(e.e);
  const s = 12;

  const h = new fabric.Line([p.x - s, p.y, p.x + s, p.y], {
    stroke: 'red',
    selectable: false,
    evented: false
  });
  const v = new fabric.Line([p.x, p.y - s, p.x, p.y + s], {
    stroke: 'red',
    selectable: false,
    evented: false
  });

  canvas.add(h, v);
  wheelMarkers.push({ x: p.x, y: p.y });
  placingWheel = false;
});

/* ===== UPLOADS ===== */
function upload(input, isWheel) {
  input.onchange = e => {
    const r = new FileReader();
    r.onload = ev => {
      fabric.Image.fromURL(ev.target.result, img => {
        img.left = 300;
        img.top = 250;
        img.lockRotation = true;

        if (isWheel) {
          img.lockMovementX = true;
          img.lockMovementY = true;
          wheelImages.push(img);
        }

        canvas.add(img);
      });
    };
    r.readAsDataURL(e.target.files[0]);
  };
}

upload(uploadBody, false);
upload(uploadWheel, true);

/* ===== SLIDER CAP ===== */
function capStats() {
  if (+accel.value + +speed.value > 100) {
    speed.value = 100 - accel.value;
  }
}
accel.oninput = speed.oninput = capStats;

/* ===== PREVIEW ===== */
preview.onclick = () => {
  wheelImages.forEach((w, i) => {
    const m = wheelMarkers[i];
    if (!m) return;

    w.set({
      left: m.x - w.width / 2,
      top: m.y - w.height / 2
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

  const carData = {
    carName: carName.value,
    teamName: teamName.value,
    email: email.value,
    acceleration: +accel.value,
    topSpeed: +speed.value,
    wheelPositions: wheelMarkers,
    carImageData: canvas.toDataURL({ format: 'png' }),
    wheelImageData: wheelImages[0]
      ? wheelImages[0].toDataURL({ format: 'png' })
      : canvas.toDataURL({ format: 'png' })
  };

  const res = await fetch('/api/submit-car', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ carData })
  });

  alert(res.ok ? 'Submitted successfully!' : 'Submission failed');
};
