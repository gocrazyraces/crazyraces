// ----- CANVAS -----
const canvas = new fabric.Canvas('canvas', {
  backgroundColor: '#ffffff'
});

// IMPORTANT: do not touch this unless needed
canvas.renderAll();

// ----- DRAWING -----
const drawTool = document.getElementById('drawTool');
const selectTool = document.getElementById('selectTool');
const brushSize = document.getElementById('brushSize');
const color = document.getElementById('color');

drawTool.onclick = () => {
  canvas.isDrawingMode = true;
};

selectTool.onclick = () => {
  canvas.isDrawingMode = false;
};

brushSize.oninput = () => {
  canvas.freeDrawingBrush.width = brushSize.value;
};

color.oninput = () => {
  canvas.freeDrawingBrush.color = color.value;
};

// Initialize brush defaults
canvas.freeDrawingBrush.width = brushSize.value;
canvas.freeDrawingBrush.color = color.value;

// ----- UPLOADS (WORKING) -----
function setupUpload(inputId) {
  const input = document.getElementById(inputId);

  input.addEventListener('change', () => {
    if (!input.files.length) return;

    const reader = new FileReader();
    reader.onload = () => {
      fabric.Image.fromURL(reader.result, img => {
        img.left = 200;
        img.top = 200;
        img.scaleToWidth(300);
        canvas.add(img);
        canvas.setActiveObject(img);
        canvas.renderAll();
      });
    };
    reader.readAsDataURL(input.files[0]);
  });
}

setupUpload('uploadBody');
setupUpload('uploadWheel');

// ----- SUBMIT (placeholder test) -----
document.getElementById('submit').onclick = () => {
  alert('Editor baseline works. Submission can be reconnected next.');
};
