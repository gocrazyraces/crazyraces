// --- Konva Stage Setup ---
const stage = new Konva.Stage({
  container: "drawing-pane",
  width: 1024,
  height: 512,
});

const layer = new Konva.Layer();
stage.add(layer);

// --- Freehand car body drawing ---
let isDrawing = false;
let currentLine;

stage.on("mousedown touchstart", function () {
  isDrawing = true;
  currentLine = new Konva.Line({
    stroke: "black",
    strokeWidth: 3,
    points: [],
    lineJoin: "round",
    lineCap: "round",
    draggable: false,
  });
  layer.add(currentLine);
});

stage.on("mousemove touchmove", function (e) {
  if (!isDrawing) return;
  const pos = stage.getPointerPosition();
  const newPoints = currentLine.points().concat([pos.x, pos.y]);
  currentLine.points(newPoints);
  layer.batchDraw();
});

stage.on("mouseup touchend", function () {
  isDrawing = false;
});

// --- Wheels ---
let wheels = [];

// Add wheel button
document.getElementById("add-wheel").addEventListener("click", () => {
  const wheel = new Konva.Circle({
    x: stage.width() / 2,
    y: stage.height() / 2,
    radius: 50,
    stroke: "red",
    strokeWidth: 2,
    draggable: true,
  });
  wheels.push(wheel);
  layer.add(wheel);
  layer.draw();
});

// --- Car preview animation ---
document.getElementById("preview-car").addEventListener("click", () => {
  wheels.forEach((wheel) => {
    new Konva.Tween({
      node: wheel,
      rotation: 360,
      duration: 2,
      repeat: Infinity,
    }).play();
  });

  layer.find("Line").forEach((line) => {
    new Konva.Tween({
      node: line,
      x: stage.width() - 200,
      duration: 3,
      easing: Konva.Easings.Linear,
    }).play();
  });
});

// --- Email Validation ---
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// --- Sliders max 100 ---
const accelSlider = document.getElementById("acceleration");
const speedSlider = document.getElementById("topSpeed");

function updateSliders() {
  const total = parseInt(accelSlider.value) + parseInt(speedSlider.value);
  if (total > 100) speedSlider.value = 100 - parseInt(accelSlider.value);
}

accelSlider.addEventListener("input", updateSliders);
speedSlider.addEventListener("input", updateSliders);

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
    // Capture car body as image
    carImageData: stage.toDataURL({ pixelRatio: 2 }),
    wheelImageData: stage.toDataURL({ pixelRatio: 2 }),
    wheelPositions: wheels.map((w) => ({
      x: w.x(),
      y: w.y(),
      radius: w.radius(),
    })),
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
