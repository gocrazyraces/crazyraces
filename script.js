// Konva setup
const stage = new Konva.Stage({
  container: "drawing-pane",
  width: 1024,
  height: 512
});
const layer = new Konva.Layer();
stage.add(layer);

// Car body (freehand)
const carBody = new Konva.Line({
  points: [],
  stroke: "black",
  strokeWidth: 3,
  lineJoin: "round",
  draggable: true
});
layer.add(carBody);

// Wheel array
let wheels = [];

// Add wheel
document.getElementById("add-wheel").addEventListener("click", () => {
  const wheel = new Konva.Circle({
    x: stage.width() / 2,
    y: stage.height() / 2,
    radius: 50,
    stroke: "red",
    strokeWidth: 2,
    draggable: true
  });
  wheels.push(wheel);
  layer.add(wheel);
  layer.draw();
});

// Preview car animation
document.getElementById("preview-car").addEventListener("click", () => {
  wheels.forEach(wheel => {
    new Konva.Tween({
      node: wheel,
      rotation: 360,
      duration: 2,
      repeat: Infinity
    }).play();
  });
});

// Email validation
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Slider zero-sum
const accelSlider = document.getElementById("acceleration");
const speedSlider = document.getElementById("topSpeed");

function updateSliders() {
  const total = parseInt(accelSlider.value) + parseInt(speedSlider.value);
  if (total > 100) speedSlider.value = 100 - parseInt(accelSlider.value);
}

accelSlider.addEventListener("input", updateSliders);
speedSlider.addEventListener("input", updateSliders);

// Submit car
document.getElementById("submit-car").addEventListener("click", async () => {
  const email = document.getElementById("email").value;
  if (!isValidEmail(email)) return alert("Enter a valid email.");

  const carData = {
    carName: document.getElementById("carName").value,
    teamName: document.getElementById("teamName").value,
    acceleration: accelSlider.value,
    topSpeed: speedSlider.value,
    email,
    carImageData: stage.toDataURL({ pixelRatio: 2 }),
    wheelImageData: stage.toDataURL({ pixelRatio: 2 }),
    wheelPositions: wheels.map(w => ({ x: w.x(), y: w.y(), radius: w.radius() }))
  };

  try {
    const res = await fetch("/api/submit-car", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ carData })
    });
    const result = await res.json();
    alert(result.message);
  } catch (err) {
    console.error(err);
    alert("Submission failed");
  }
});
