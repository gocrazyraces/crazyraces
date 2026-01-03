// ===============================
// SINGLETON FABRIC CANVAS (FIX)
// ===============================

let canvas;

if (!window.__CRAZYRACES_CANVAS__) {
  canvas = new fabric.Canvas('canvas', {
    backgroundColor: '#ffffff'
  });

  window.__CRAZYRACES_CANVAS__ = canvas;
} else {
  canvas = window.__CRAZYRACES_CANVAS__;
}

canvas.renderAll();

// ===============================
// TOOLS
// ===============================

const drawBtn = document.getElementById('drawBtn');
const selectBtn = document.getElementById('selectBtn');
const brushSize = document.getElementById('brushSize');
const color = document.getElementById('color');
const upload = document.getElementById('upload');

drawBtn.onclick = () => {
  canvas.isDrawingMode = true;
};

selectBtn.onclick = () => {
  canvas.isDrawingMode = false;
};

canvas.freeDrawingBrush.width = brushSize.value;
canvas.freeDrawingBrush.color = color.value;

brushSize.oninput = () => {
  canvas.freeDrawingBrush.width = brushSize.value;
};

color.oninput = () => {
  canvas.freeDrawingBrush.color = color.value;
};

// ===============================
// UPLOAD (NOW WORKS)
// ===============================

upload.onchange = () => {
  if (!upload.files.length) return;

  const reader = new FileReader();
  reader.onload = () => {
    fabric.Image.fromURL(reader.result, img => {
      img.left = 100;
      img.top = 100;
      img.scaleToWidth(300);
      canvas.add(img);
      canvas.setActiveObject(img);
      canvas.renderAll();
    });
  };
  reader.readAsDataURL(upload.files[0]);
};
