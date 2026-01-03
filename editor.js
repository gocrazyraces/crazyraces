// ---------- CANVAS ----------
const canvas = new fabric.Canvas('canvas', {
  backgroundColor: '#ffffff'
});
canvas.renderAll();

// ---------- STATE ----------
let currentTab = 'body';

// ---------- TABS ----------
document.querySelectorAll('.tab').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    currentTab = btn.dataset.tab;

    editorTools.classList.toggle('hidden', currentTab === 'props');
    properties.classList.toggle('hidden', currentTab !== 'props');
  };
});

// ---------- DRAWING ----------
drawBtn.onclick = () => {
  canvas.isDrawingMode = true;
};

selectBtn.onclick = () => {
  canvas.isDrawingMode = false;
};

brushSize.oninput = () => {
  canvas.freeDrawingBrush.width = +brushSize.value;
};

color.oninput = () => {
  canvas.freeDrawingBrush.color = color.value;
};

canvas.freeDrawingBrush.width = brushSize.value;
canvas.freeDrawingBrush.color = color.value;

// ---------- UPLOAD ----------
uploadImage.addEventListener('change', () => {
  if (!uploadImage.files.length) return;

  const reader = new FileReader();
  reader.onload = () => {
    fabric.Image.fromURL(reader.result, img => {
      img.left = 200;
      img.top = 200;
      img.scaleToWidth(300);
      img.customType = currentTab; // body or wheel
      canvas.add(img);
      canvas.setActiveObject(img);
      canvas.renderAll();
    });
  };
  reader.readAsDataURL(uploadImage.files[0]);
});

// ---------- PROPERTIES ----------
function updateStats() {
  const a = +accel.value;
  const s = +speed.value;
  const total = a + s;

  if (total > 100) {
    speed.value = 100 - a;
  }

  accelVal.textContent = accel.value;
  speedVal.textContent = speed.value;
  remaining.textContent = 100 - (+accel.value + +speed.value);
}

accel.oninput = speed.oninput = updateStats;
updateStats();

// ---------- SUBMIT (SAME API CONTRACT) ----------
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
    wheelPositions: [],
    carImageData: canvas.toDataURL({ format: 'png' }),
    wheelImageData: canvas.toDataURL({ format: 'png' })
  };

  const res = await fetch('/api/submit-car', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ carData })
  });

  alert(res.ok ? 'Submitted successfully!' : 'Submission failed');
};
