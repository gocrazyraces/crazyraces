const canvas = new fabric.Canvas('canvas', {
  backgroundColor: '#fff',
  preserveObjectStacking: true
});
canvas.renderAll();

/* ========= UNDO / REDO ========= */
const history = [];
let historyIndex = -1;

function saveState() {
  history.splice(historyIndex + 1);
  history.push(JSON.stringify(canvas));
  historyIndex++;
}

canvas.on('object:added', saveState);
canvas.on('object:modified', saveState);
canvas.on('object:removed', saveState);

document.getElementById('undo').onclick = () => {
  if (historyIndex <= 0) return;
  historyIndex--;
  canvas.loadFromJSON(history[historyIndex], canvas.renderAll.bind(canvas));
};

document.getElementById('redo').onclick = () => {
  if (historyIndex >= history.length - 1) return;
  historyIndex++;
  canvas.loadFromJSON(history[historyIndex], canvas.renderAll.bind(canvas));
};

/* ========= TOOLING ========= */
let tool = 'select';
let placingWheel = false;
const wheelMarkers = [];
const wheelImages = [];

document.querySelectorAll('[data-tool]').forEach(b =>
  b.onclick = () => setTool(b.dataset.tool)
);

function setTool(t) {
  tool = t;
  placingWheel = t === 'crosshair';
  canvas.isDrawingMode = t === 'draw' || t === 'erase';

  if (t === 'erase') {
    canvas.freeDrawingBrush.color = '#fff';
  } else {
    canvas.freeDrawingBrush.color = document.getElementById('color').value;
  }
}

document.getElementById('brushSize').oninput =
  e => canvas.freeDrawingBrush.width = +e.target.value;

document.getElementById('color').oninput =
  e => canvas.freeDrawingBrush.color = e.target.value;

/* ========= WHEELS ========= */
canvas.on('mouse:down', e => {
  if (!placingWheel) return;
  const p = canvas.getPointer(e.e);
  const s = 12;

  const h = new fabric.Line([p.x - s, p.y, p.x + s, p.y], { stroke: 'red', selectable: false });
  const v = new fabric.Line([p.x, p.y - s, p.x, p.y + s], { stroke: 'red', selectable: false });

  canvas.add(h, v);
  wheelMarkers.push({ x: p.x, y: p.y });
  placingWheel = false;
});

/* ========= UPLOAD ========= */
function upload(input, targetArray) {
  input.onchange = e => {
    const r = new FileReader();
    r.onload = ev => {
      fabric.Image.fromURL(ev.target.result, img => {
        img.left = 200;
        img.top = 200;
        img.lockRotation = true;
        canvas.add(img);
        targetArray.push(img);
      });
    };
    r.readAsDataURL(e.target.files[0]);
  };
}

upload(uploadBody, []);
upload(uploadWheel, wheelImages);

/* ========= SLIDERS ========= */
function cap() {
  if (+accel.value + +speed.value > 100)
    speed.value = 100 - accel.value;
}
accel.oninput = speed.oninput = cap;

/* ========= PREVIEW ========= */
preview.onclick = () => {
  wheelImages.forEach((w, i) => {
    const m = wheelMarkers[i];
    if (!m) return;
    w.set({ left: m.x - w.width / 2, top: m.y - w.height / 2 });
    w.animate('angle', '+=360', {
      duration: 800,
      onChange: canvas.renderAll.bind(canvas)
    });
  });
};

/* ========= SUBMIT (BACKEND COMPATIBLE) ========= */
submit.onclick = async () => {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value))
    return alert('Invalid email');

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
