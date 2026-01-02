const canvas = new fabric.Canvas('canvas', {
  backgroundColor: '#fff'
});
canvas.renderAll();

// ===== Tools =====
document.getElementById('draw').onclick = () => {
  canvas.isDrawingMode = true;
  canvas.freeDrawingBrush.width = 4;
  canvas.freeDrawingBrush.color = '#000';
};

document.getElementById('select').onclick = () => {
  canvas.isDrawingMode = false;
};

// ===== Crosshairs =====
let placing = false;
const wheels = [];

document.getElementById('crosshair').onclick = () => {
  placing = true;
};

canvas.on('mouse:down', e => {
  if (!placing) return;

  const p = canvas.getPointer(e.e);
  const size = 12;

  const h = new fabric.Line(
    [p.x - size, p.y, p.x + size, p.y],
    { stroke: 'red', selectable: false }
  );
  const v = new fabric.Line(
    [p.x, p.y - size, p.x, p.y + size],
    { stroke: 'red', selectable: false }
  );

  canvas.add(h, v);
  wheels.push({ x: p.x, y: p.y });
  placing = false;
});

// ===== Uploads =====
function upload(input) {
  input.onchange = e => {
    const r = new FileReader();
    r.onload = ev => {
      fabric.Image.fromURL(ev.target.result, img => {
        img.left = 100;
        img.top = 100;
        canvas.add(img);
      });
    };
    r.readAsDataURL(e.target.files[0]);
  };
}

upload(document.getElementById('uploadCar'));
upload(document.getElementById('uploadWheel'));

// ===== Export =====
document.getElementById('export').onclick = () => {
  const png = canvas.toDataURL({ format: 'png' });
  const a = document.createElement('a');
  a.href = png;
  a.download = 'car.png';
  a.click();
};
