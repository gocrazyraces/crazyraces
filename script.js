// --- Konva Stage ---
const stage = new Konva.Stage({
  container: "drawing-pane",
  width: 1024,
  height: 512
});

const carLayer = new Konva.Layer();
const wheelLayer = new Konva.Layer();
const crosshairLayer = new Konva.Layer();

stage.add(carLayer, wheelLayer, crosshairLayer);

// --- Drawing State ---
let mode = null; // 'car', 'wheel', 'crosshair'
let isDrawing = false;
let currentLine = null;
let carHistory = [];
let wheelHistory = [];
let wheels = [];
let crosshairs = [];

// --- Brush Settings ---
const brushColorInput = document.getElementById("brush-color");
const brushSizeInput = document.getElementById("brush-size");

function setMode(newMode) {
  mode = newMode;
  isDrawing = false;
  currentLine = null;
}

// --- Freehand Drawing ---
stage.on("mousedown touchstart", (e) => {
  if (mode === "car" || mode === "wheel") {
    isDrawing = true;
    currentLine = new Konva.Line({
      stroke: mode === "car" ? brushColorInput.value : "blue",
      strokeWidth: mode === "car" ? parseInt(brushSizeInput.value) : 2,
      lineJoin: "round",
      lineCap: "round",
      points: [],
      draggable: false
    });
    if (mode === "car") carLayer.add(currentLine);
    else wheelLayer.add(currentLine);
  } else if (mode === "crosshair") {
    const pos = stage.getPointerPosition();
    const cross = new Konva.Group({ x: pos.x, y: pos.y });
    cross.add(new Konva.Line({ points: [-10,0,10,0], stroke:'red', strokeWidth:2 }));
    cross.add(new Konva.Line({ points: [0,-10,0,10], stroke:'red', strokeWidth:2 }));
    crosshairs.push(cross);
    crosshairLayer.add(cross);
    crosshairLayer.draw();
  }
});

stage.on("mousemove touchmove", (e) => {
  if (!isDrawing || !currentLine) return;
  const pos = stage.getPointerPosition();
  const newPoints = currentLine.points().concat([pos.x, pos.y]);
  currentLine.points(newPoints);
  if (mode === "car") carLayer.batchDraw();
  else wheelLayer.batchDraw();
});

stage.on("mouseup touchend", () => {
  if (isDrawing && currentLine) {
    if (mode === "car") carHistory.push(currentLine);
    else if (mode === "wheel") wheelHistory.push(currentLine);
  }
  isDrawing = false;
  currentLine = null;
});

// --- Buttons ---
document.getElementById("start-car-draw").addEventListener("click", () => setMode("car"));
document.getElementById("start-wheel-draw").addEventListener("click", () => setMode("wheel"));
document.getElementById("place-wheel-crosshair").addEventListener("click", () => setMode("crosshair"));

// --- Undo ---
document.getElementById("undo-car").addEventListener("click", () => {
  if (carHistory.length === 0) return;
  const last = carHistory.pop();
  last.destroy();
  carLayer.draw();
});
document.getElementById("undo-wheel").addEventListener("click", () => {
  if (wheelHistory.length === 0) return;
  const last = wheelHistory.pop();
  last.destroy();
  wheelLayer.draw();
});

// --- Upload Car Image ---
document.getElementById("upload-car").addEventListener("click", () => {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.onchange = (e) => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = function(evt) {
      const img = new Image();
      img.src = evt.target.result;
      img.onload = () => {
        const kImg = new Konva.Image({
          image: img,
          x: stage.width()/2 - img.width/2,
          y: stage.height()/2 - img.height/2,
          draggable: true
        });
        carLayer.add(kImg);
        carLayer.draw();
        carHistory.push(kImg);
      };
    };
    reader.readAsDataURL(file);
  };
  input.click();
});

// --- Upload Wheel Image ---
document.getElementById("upload-wheel").addEventListener("click", () => {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.onchange = (e) => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = function(evt) {
      const img = new Image();
      img.src = evt.target.result;
      img.onload = () => {
        const kImg = new Konva.Image({
          image: img,
          x: stage.width()/2 - img.width/2,
          y: stage.height()/2 - img.height/2,
          draggable: true
        });
        wheelLayer.add(kImg);
        wheels.push(kImg);
        wheelLayer.draw();
      };
    };
    reader.readAsDataURL(file);
  };
  input.click();
});

// --- Slider max 100 ---
const accelSlider = document.getElementById("acceleration");
const speedSlider = document.getElementById("topSpeed");
function updateSliders() {
  const total = parseInt(accelSlider.value) + parseInt(speedSlider.value);
  if (total > 100) speedSlider.value = 100 - parseInt(accelSlider.value);
}
accelSlider.addEventListener("input", updateSliders);
speedSlider.addEventListener("input", updateSliders);

// --- Email Validation ---
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// --- Preview ---
document.getElementById("preview-car").addEventListener("click", () => {
  wheels.forEach(wheel => new Konva.Tween({ node: wheel, rotation: 360, duration: 2, repeat: Infinity }).play());
});

// --- Submit Car ---
document.getElementById("submit-car").addEventListener("click", async () => {
  const email = document.getElementById("email").value;
  if (!isValidEmail(email)) return alert("Enter a valid email.");

  const carData = {
    carName: document.getElementById("carName").value,
    teamName: document.getElementById("teamName").value,
    acceleration: accelSlider.value,
    topSpeed: speedSlider.value,
    email,
    carImageData: carLayer.toDataURL({ pixelRatio: 2 }),
    wheelImageData: wheelLayer.toDataURL({ pixelRatio: 2 }),
    wheelPositions: crosshairs.map(c => ({ x: c.x(), y: c.y() }))
  };

  try {
    const res = await fetch("/api/submit-car", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ carData }),
    });
    const result = await res.json();
    alert(result.message);
  } catch (err) {
    console.error(err);
    alert("Submission failed");
  }
});
