/**
 * =========================================================
 * RAPID RACERS 2D — Car Designer logic
 * =========================================================
 * Changes in this iteration:
 * - Added pen thickness controls (body + wheel)
 * - Removed preset buttons (Balanced / Speedster) and related handlers
 * - Button labels simplified in HTML (Draw/Move/Upload/Clear)
 * - Export button label updated (handled in HTML)
 */

// ============================
// DOM REFERENCES
// ============================
const ui = {
  tipsText: document.getElementById("tipsText"),

  // Tabs
  tabs: {
    name: document.getElementById("nameTab"),
    body: document.getElementById("bodyTab"),
    wheel: document.getElementById("wheelTab"),
    placement: document.getElementById("placementTab"),
    properties: document.getElementById("propertiesTab"),
    submit: document.getElementById("submitTab"),
  },
  panels: {
    name: document.getElementById("nameControls"),
    body: document.getElementById("bodyControls"),
    wheel: document.getElementById("wheelControls"),
    placement: document.getElementById("placementControls"),
    properties: document.getElementById("propertiesControls"),
    submit: document.getElementById("submitControls"),
  },

  // Canvases
  bodyCanvas: document.getElementById("bodyCanvas"),
  wheelCanvas: document.getElementById("wheelCanvas"),

  // Workspace labels/buttons
  canvasTitle: document.getElementById("canvasTitle"),
  canvasSubtitle: document.getElementById("canvasSubtitle"),
  exportPreviewBtn: document.getElementById("exportPreviewBtn"),
  canvasWrap: document.querySelector(".canvas-wrap"),

  // Body controls
  bodyPenBtn: document.getElementById("bodyPenBtn"),
  bodyFillBtn: document.getElementById("bodyFillBtn"),
  bodyMoveBtn: document.getElementById("bodyMoveBtn"),
  bodyColor: document.getElementById("bodyColor"),
  bodyThickness: document.getElementById("bodyThickness"),
  uploadBody: document.getElementById("uploadBody"),
  generateBodyBtn: document.getElementById("generateBodyBtn"),
  bodyUndoBtn: document.getElementById("bodyUndoBtn"),
  bodyRedoBtn: document.getElementById("bodyRedoBtn"),
  bodyClearBtn: document.getElementById("bodyClearBtn"),

  // Wheel controls
  wheelPenBtn: document.getElementById("wheelPenBtn"),
  wheelMoveBtn: document.getElementById("wheelMoveBtn"),
  wheelColor: document.getElementById("wheelColor"),
  wheelThickness: document.getElementById("wheelThickness"),
  uploadWheel: document.getElementById("uploadWheel"),
  generateWheelBtn: document.getElementById("generateWheelBtn"),
  wheelUndoBtn: document.getElementById("wheelUndoBtn"),
  wheelRedoBtn: document.getElementById("wheelRedoBtn"),
  wheelClearBtn: document.getElementById("wheelClearBtn"),

  // Placement controls
  addWheelBtn: document.getElementById("addWheelBtn"),
  duplicateWheelBtn: document.getElementById("duplicateWheelBtn"),
  deleteWheelBtn: document.getElementById("deleteWheelBtn"),
  wheelScale: document.getElementById("wheelScale"),
  wheelRotation: document.getElementById("wheelRotation"),
  selectedWheelLabel: document.getElementById("selectedWheelLabel"),
  wheelCountLabel: document.getElementById("wheelCountLabel"),

  // Properties controls
  accSlider: document.getElementById("acceleration"),
  speedSlider: document.getElementById("topSpeed"),
  accVal: document.getElementById("accVal"),
  speedVal: document.getElementById("speedVal"),
  pointsRemaining: document.getElementById("pointsRemaining"),
  creditsHelp: document.getElementById("creditsHelp"),

  // Submit controls
  submitCarName: document.getElementById("submitCarName"),
  carName: document.getElementById("carName"),
  raceSelect: document.getElementById("raceSelect"),
  submitBtn: document.getElementById("submitBtn"),
  submitStatus: document.getElementById("submitStatus"),
  carKeyDisplay: document.getElementById("carKeyDisplay"),
  carKeyHint: document.getElementById("carKeyHint"),
  carNameStatus: document.getElementById("carNameStatus"),
  carKeyBtn: document.getElementById("carKeyBtn"),
  carNameTick: document.getElementById("carNameTick"),
};

// ============================
// CONSTANTS / CONFIG
// ============================
const TOTAL_CREDITS = window.CRAZY_RACES_TOTAL_CREDITS ?? 100;
const SUBMIT_ENDPOINT = window.CRAZY_RACES_SUBMIT_ENDPOINT ?? "/api/submit-car";
const GARAGE_ENDPOINT = window.CRAZY_RACES_GARAGE_ENDPOINT ?? "/api/garage-enter";

const BODY_W = window.CRAZY_RACES_BODY_W ?? 1024;
const BODY_H = window.CRAZY_RACES_BODY_H ?? 512;
const WHEEL_W = window.CRAZY_RACES_WHEEL_W ?? 256;
const WHEEL_H = window.CRAZY_RACES_WHEEL_H ?? 256;

const WHEEL_HIT_PAD = 1.05;

// Pen widths are now dynamic via sliders
let bodyPenWidth = 4;
let wheelPenWidth = 4;

// ============================
// CANVAS SETUP
// ============================
ui.bodyCanvas.width = BODY_W;
ui.bodyCanvas.height = BODY_H;
ui.wheelCanvas.width = WHEEL_W;
ui.wheelCanvas.height = WHEEL_H;

const bodyCtx = ui.bodyCanvas.getContext("2d");
const wheelCtx = ui.wheelCanvas.getContext("2d");

// Offscreen artwork layers
const bodyArtCanvas = document.createElement("canvas");
bodyArtCanvas.width = BODY_W;
bodyArtCanvas.height = BODY_H;
const bodyArtCtx = bodyArtCanvas.getContext("2d");

const wheelArtCanvas = document.createElement("canvas");
wheelArtCanvas.width = WHEEL_W;
wheelArtCanvas.height = WHEEL_H;
const wheelArtCtx = wheelArtCanvas.getContext("2d");

// ============================
// STATE
// ============================
let currentTab = "body";
let currentTool = "pen";
let currentPenColor = ui.bodyColor.value || "#3B0273";
let carNameList = [];
let activeRaces = [];
let currentCar = null;

let isDrawing = false;
let strokePoints = [];

// Body movement
let bodyOffsetX = 0;
let bodyOffsetY = 0;
let isBodyDragging = false;
let bodyDragStartX = 0;
let bodyDragStartY = 0;
let bodyDragOffsetStartX = 0;
let bodyDragOffsetStartY = 0;

// Undo stacks
const bodyUndo = [];
const bodyRedo = [];
const wheelUndo = [];
const wheelRedo = [];

// Wheel master availability
let hasWheelArt = false;

// Wheels stored in BODY-LOCAL coords
const placedWheels = [];
let selectedWheelIndex = -1;

// ============================
// TIPS
// ============================
const TAB_TIPS = {
  name:
    "Enter a name for your new car or search for it in the garage.",
  body:
    "Draw or upload your car body. Use Move to drag the whole body around. PNG transparency works best.",
  wheel:
    "Create a wheel (square works best). You can draw it or upload a PNG.",
  placement:
    "Click a wheel to select it, drag to move, then scale/rotate using sliders.",
  properties:
    "Spend exactly 100 credits across Acceleration and Top Speed. Remaining must be 0.",
  submit:
    "Save your car to the garage to receive a key, then optionally enter a race.",
};

function setTips(tabName) {
  if (ui.tipsText) ui.tipsText.textContent = TAB_TIPS[tabName] ?? "";
}

function formatRaceLabel(race) {
  const raceDate = new Date(race.racedeadline);
  const datePart = isNaN(raceDate.getTime())
    ? race.racedeadline
    : raceDate.toLocaleDateString(undefined, {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });

  return `${race.racename} (Race ${race.racenumber}) - ${datePart}`;
}

function renderActiveRaceOptions() {
  if (!ui.raceSelect) return;

  ui.raceSelect.innerHTML = "";

  if (!activeRaces.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "No active races available";
    ui.raceSelect.appendChild(option);
    ui.raceSelect.disabled = true;
    if (ui.submitBtn) {
      ui.submitBtn.textContent = "Send car to Garage only";
      ui.submitBtn.disabled = false;
    }
    return;
  }

  ui.raceSelect.disabled = false;
  if (ui.submitBtn) {
    ui.submitBtn.textContent = "Enter car";
    ui.submitBtn.disabled = false;
  }

  activeRaces.forEach((race) => {
    const option = document.createElement("option");
    option.value = `${race.season}:${race.racenumber}`;
    option.textContent = formatRaceLabel(race);
    ui.raceSelect.appendChild(option);
  });

  ui.raceSelect.value = `${activeRaces[0].season}:${activeRaces[0].racenumber}`;
}

async function loadActiveRaces() {
  if (!ui.raceSelect) return;

  try {
    const response = await fetch('/api/races?resource=active');
    const data = await response.json();
    activeRaces = Array.isArray(data.races) ? data.races : [];
  } catch (error) {
    console.error('Failed to load active races:', error);
    activeRaces = [];
  }

  renderActiveRaceOptions();
}

// ============================
// UTILS
// ============================
function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function getCanvasPos(canvas, evt) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (evt.clientX - rect.left) * (canvas.width / rect.width),
    y: (evt.clientY - rect.top) * (canvas.height / rect.height),
  };
}

function toBodyLocal(pos) {
  return { x: pos.x - bodyOffsetX, y: pos.y - bodyOffsetY };
}

function toGlobalFromBodyLocal(pos) {
  return { x: pos.x + bodyOffsetX, y: pos.y + bodyOffsetY };
}

function hitTestWheelGlobal(globalPos, wheelLocal) {
  const wheelGlobal = toGlobalFromBodyLocal({ x: wheelLocal.x, y: wheelLocal.y });
  const dx = globalPos.x - wheelGlobal.x;
  const dy = globalPos.y - wheelGlobal.y;
  const r = (Math.max(WHEEL_W, WHEEL_H) * wheelLocal.scale * 0.5) * WHEEL_HIT_PAD;
  return (dx * dx + dy * dy) <= r * r;
}

function getSelectedWheel() {
  if (selectedWheelIndex < 0 || selectedWheelIndex >= placedWheels.length) return null;
  return placedWheels[selectedWheelIndex];
}

function drawSubtleGrid(ctx, w, h) {
  ctx.save();
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);

  ctx.globalAlpha = 0.08;
  ctx.strokeStyle = "#3C36D9";
  ctx.lineWidth = 1;

  const step = 32;
  for (let x = 0; x <= w; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = 0; y <= h; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  ctx.restore();
}

function pushBodyUndoSnapshot() {
  bodyUndo.push(bodyArtCtx.getImageData(0, 0, BODY_W, BODY_H));
  bodyRedo.length = 0;
}

function pushWheelUndoSnapshot() {
  wheelUndo.push(wheelArtCtx.getImageData(0, 0, WHEEL_W, WHEEL_H));
  wheelRedo.length = 0;
}

function undoCanvas(undoStack, redoStack, targetCtx) {
  if (undoStack.length < 2) return;
  const current = undoStack.pop();
  redoStack.push(current);
  const prev = undoStack[undoStack.length - 1];
  targetCtx.putImageData(prev, 0, 0);
}

function redoCanvas(undoStack, redoStack, targetCtx) {
  if (redoStack.length === 0) return;
  const next = redoStack.pop();
  undoStack.push(next);
  targetCtx.putImageData(next, 0, 0);
}

function clearArtCanvas(ctx, w, h, pushSnapshotFn) {
  ctx.clearRect(0, 0, w, h);
  pushSnapshotFn();
}

function strokePreview(ctx, points, color, width) {
  if (points.length < 2) return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  ctx.stroke();
  ctx.restore();
}

function commitStroke(targetCtx, points, color, width) {
  if (points.length < 2) return;
  targetCtx.save();
  targetCtx.strokeStyle = color;
  targetCtx.lineWidth = width;
  targetCtx.lineCap = "round";
  targetCtx.lineJoin = "round";
  targetCtx.beginPath();
  targetCtx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) targetCtx.lineTo(points[i].x, points[i].y);
  targetCtx.stroke();
  targetCtx.restore();
}

function drawUploadedImageToArt(img, targetCtx, w, h) {
  targetCtx.save();
  targetCtx.clearRect(0, 0, w, h);

  const scale = Math.min(w / img.width, h / img.height);
  const drawW = img.width * scale;
  const drawH = img.height * scale;
  const x = (w - drawW) / 2;
  const y = (h - drawH) / 2;

  targetCtx.drawImage(img, x, y, drawW, drawH);
  targetCtx.restore();
}

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

function floodFill(ctx, startX, startY, fillColor, w, h) {
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;

  const startIdx = (startY * w + startX) * 4;
  const startR = data[startIdx];
  const startG = data[startIdx + 1];
  const startB = data[startIdx + 2];
  const startA = data[startIdx + 3];

  const fillR = fillColor.r;
  const fillG = fillColor.g;
  const fillB = fillColor.b;
  const fillA = 255; // Assume opaque fill

  // If already the same color, no need to fill
  if (startR === fillR && startG === fillG && startB === fillB && startA === fillA) return;

  const stack = [[startX, startY]];
  const visited = new Set();

  while (stack.length > 0) {
    const [x, y] = stack.pop();
    const key = `${x},${y}`;
    if (visited.has(key)) continue;
    visited.add(key);

    const idx = (y * w + x) * 4;
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    const a = data[idx + 3];

    if (r === startR && g === startG && b === startB && a === startA) {
      data[idx] = fillR;
      data[idx + 1] = fillG;
      data[idx + 2] = fillB;
      data[idx + 3] = fillA;

      // Add neighbors
      if (x > 0) stack.push([x - 1, y]);
      if (x < w - 1) stack.push([x + 1, y]);
      if (y > 0) stack.push([x, y - 1]);
      if (y < h - 1) stack.push([x, y + 1]);
    }
  }

  ctx.putImageData(imageData, 0, 0);
}

// ============================
// RENDERING
// ============================
function renderBodyComposite() {
  const disableGridTabs = ["name", "properties", "submit"];
  const showGrid = !disableGridTabs.includes(currentTab);
  if (showGrid) {
    drawSubtleGrid(bodyCtx, BODY_W, BODY_H);
  } else {
    bodyCtx.clearRect(0, 0, BODY_W, BODY_H);
    bodyCtx.fillStyle = "#ffffff";
    bodyCtx.fillRect(0, 0, BODY_W, BODY_H);
  }

  bodyCtx.drawImage(bodyArtCanvas, bodyOffsetX, bodyOffsetY);

  if (currentTab !== "placement" && currentTab !== "name" && currentTab !== "properties" && currentTab !== "submit") {
    return;
  }

  for (let i = 0; i < placedWheels.length; i++) {
    const w = placedWheels[i];
    const g = toGlobalFromBodyLocal({ x: w.x, y: w.y });

    bodyCtx.save();
    bodyCtx.translate(g.x, g.y);
    bodyCtx.rotate(w.rotationRad);
    bodyCtx.scale(w.scale, w.scale);

    bodyCtx.drawImage(wheelArtCanvas, -WHEEL_W / 2, -WHEEL_H / 2, WHEEL_W, WHEEL_H);

    if (currentTab === "placement" && i === selectedWheelIndex) {
      bodyCtx.lineWidth = 3;
      bodyCtx.strokeStyle = "#F2CB05";
      bodyCtx.strokeRect(-WHEEL_W / 2, -WHEEL_H / 2, WHEEL_W, WHEEL_H);
    }

    bodyCtx.restore();
  }
}

function renderWheelEditor() {
  if (currentTab !== "wheel") {
    wheelCtx.clearRect(0, 0, WHEEL_W, WHEEL_H);
    wheelCtx.fillStyle = "#ffffff";
    wheelCtx.fillRect(0, 0, WHEEL_W, WHEEL_H);
    return;
  }

  // Draw the grid pattern background
  drawSubtleGrid(wheelCtx, WHEEL_W, WHEEL_H);

  wheelCtx.save();
  wheelCtx.globalAlpha = 0.12;
  wheelCtx.fillStyle = "#8bdcff";
  wheelCtx.beginPath();
  wheelCtx.arc(WHEEL_W / 2, WHEEL_H / 2, 90, 0, 2 * Math.PI);
  wheelCtx.fill();

  wheelCtx.restore();
  wheelCtx.drawImage(wheelArtCanvas, 0, 0);
}

function getCompositeDataURL() {
  const composite = document.createElement("canvas");
  composite.width = BODY_W;
  composite.height = BODY_H;
  const cctx = composite.getContext("2d");

  // Draw body image (preserves transparency)
  cctx.drawImage(bodyArtCanvas, bodyOffsetX, bodyOffsetY);

  // Draw wheels on top
  for (const w of placedWheels) {
    const g = toGlobalFromBodyLocal({ x: w.x, y: w.y });
    cctx.save();
    cctx.translate(g.x, g.y);
    cctx.rotate(w.rotationRad);
    cctx.scale(w.scale, w.scale);
    cctx.drawImage(wheelArtCanvas, -WHEEL_W / 2, -WHEEL_H / 2);
    cctx.restore();
  }

  return composite.toDataURL("image/png");
}

function exportCompositePNG() {
  const png = getCompositeDataURL();
  const a = document.createElement("a");
  a.href = png;
  a.download = "rapidracers_car.png";
  a.click();
}

function refreshWheelUI() {
  ui.wheelCountLabel.textContent = `Wheels: ${placedWheels.length}`;

  const w = getSelectedWheel();
  if (!w) {
    ui.selectedWheelLabel.textContent = "No wheel selected";
    ui.wheelScale.value = "1";
    ui.wheelRotation.value = "0";
    return;
  }

  ui.selectedWheelLabel.textContent = `Selected wheel #${selectedWheelIndex + 1}`;
  ui.wheelScale.value = String(w.scale);
  ui.wheelRotation.value = String(Math.round(w.rotationDeg));
}

function renderAll() {
  renderBodyComposite();
  renderWheelEditor();
  refreshWheelUI();
}

// ============================
// CENTER BODY
// ============================
function centerBodyArtByOffset() {
  const img = bodyArtCtx.getImageData(0, 0, BODY_W, BODY_H);
  const data = img.data;

  let minX = BODY_W, minY = BODY_H, maxX = 0, maxY = 0;
  let found = false;

  for (let y = 0; y < BODY_H; y++) {
    for (let x = 0; x < BODY_W; x++) {
      const idx = (y * BODY_W + x) * 4;
      const a = data[idx + 3];
      if (a > 10) {
        found = true;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (!found) return;

  const boxW = maxX - minX + 1;
  const boxH = maxY - minY + 1;

  bodyOffsetX = Math.round((BODY_W - boxW) / 2 - minX);
  bodyOffsetY = Math.round((BODY_H - boxH) / 2 - minY);

  renderAll();
}

// ============================
// INIT UNDO STACKS
// ============================
function initUndoStacks(clearArt = true) {
  bodyUndo.length = 0;
  bodyRedo.length = 0;
  wheelUndo.length = 0;
  wheelRedo.length = 0;

  if (clearArt) {
    bodyArtCtx.clearRect(0, 0, BODY_W, BODY_H);
    wheelArtCtx.clearRect(0, 0, WHEEL_W, WHEEL_H);
  }

  pushBodyUndoSnapshot();
  pushWheelUndoSnapshot();
}

// ============================
// TAB CONTROL
// ============================
function setTab(tabName) {
  currentTab = tabName;

  for (const t of Object.keys(ui.tabs)) {
    const active = t === tabName;
    ui.tabs[t].classList.toggle("active", active);
    ui.tabs[t].setAttribute("aria-selected", String(active));
    ui.panels[t].classList.toggle("active", active);
  }

  // Hide/show canvases based on tab
  ui.bodyCanvas.style.display = (tabName === "wheel") ? "none" : "block";
  ui.wheelCanvas.style.display = (tabName === "wheel") ? "block" : "none";
  if (ui.canvasWrap) {
    ui.canvasWrap.classList.toggle("disabled", ["name", "properties", "submit"].includes(tabName));
  }

  ui.bodyCanvas.classList.toggle("is-disabled", ["name", "properties", "submit"].includes(tabName));

  if (tabName === "wheel") {
    ui.canvasTitle.textContent = "Wheel canvas";
    ui.canvasSubtitle.textContent = "Draw or upload a wheel (square)";
  } else if (tabName === "placement") {
    ui.canvasTitle.textContent = "Car designer";
    ui.canvasSubtitle.textContent = "Click a wheel to select it; drag to move";
  } else if (tabName === "body") {
    ui.canvasTitle.textContent = "Car designer";
    ui.canvasSubtitle.textContent = "Draw the body or drag it with Move";
  } else if (tabName === "properties") {
    ui.canvasTitle.textContent = "Car designer";
    ui.canvasSubtitle.textContent = "Adjust performance credits";
  } else {
    ui.canvasTitle.textContent = "Car designer";
    ui.canvasSubtitle.textContent = "Final checks before submission";
  }

  setTips(tabName);
  renderAll();
}

ui.tabs.body.onclick = () => setTab("body");
ui.tabs.wheel.onclick = () => setTab("wheel");
ui.tabs.placement.onclick = () => setTab("placement");
ui.tabs.properties.onclick = () => setTab("properties");
ui.tabs.submit.onclick = () => setTab("submit");
ui.tabs.name.onclick = () => setTab("name");

// ============================
// TOOL BUTTONS
// ============================
ui.bodyPenBtn.onclick = () => {
  currentTool = "pen";
  currentPenColor = ui.bodyColor.value;
};
ui.bodyFillBtn.onclick = () => { currentTool = "fill"; };
ui.bodyMoveBtn.onclick = () => { currentTool = "move"; };

ui.wheelPenBtn.onclick = () => {
  currentTool = "pen";
  currentPenColor = ui.wheelColor.value;
};
ui.wheelMoveBtn.onclick = () => { currentTool = "move"; };

ui.bodyColor.oninput = () => { if (currentTab === "body") currentPenColor = ui.bodyColor.value; };
ui.wheelColor.oninput = () => { if (currentTab === "wheel") currentPenColor = ui.wheelColor.value; };

ui.bodyThickness.oninput = () => { bodyPenWidth = parseInt(ui.bodyThickness.value, 10); };
ui.wheelThickness.oninput = () => { wheelPenWidth = parseInt(ui.wheelThickness.value, 10); };

ui.exportPreviewBtn.onclick = exportCompositePNG;

// ============================
// UPLOADS
// ============================
ui.uploadBody.onchange = (e) => {
  const file = e.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (ev) => {
    const img = new Image();
    img.onload = () => {
      drawUploadedImageToArt(img, bodyArtCtx, BODY_W, BODY_H);
      pushBodyUndoSnapshot();
      bodyOffsetX = 0;
      bodyOffsetY = 0;
      renderAll();
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
  e.target.value = "";
};

// Generate body button
ui.generateBodyBtn.onclick = async () => {
  try {
    const response = await fetch(`/api/car-gen?type=body&t=${Date.now()}`);
    if (!response.ok) {
      throw new Error('Failed to generate body image');
    }

    const blob = await response.blob();
    const img = new Image();
    img.onload = () => {
      drawUploadedImageToArt(img, bodyArtCtx, BODY_W, BODY_H);
      pushBodyUndoSnapshot();
      bodyOffsetX = 0;
      bodyOffsetY = 0;
      renderAll();
    };
    img.src = URL.createObjectURL(blob);
  } catch (error) {
    console.error('Error generating body:', error);
    alert('Failed to generate body image. Please try again.');
  }
};

ui.uploadWheel.onchange = (e) => {
  const file = e.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (ev) => {
    const img = new Image();
    img.onload = () => {
      drawUploadedImageToArt(img, wheelArtCtx, WHEEL_W, WHEEL_H);
      hasWheelArt = true;
      pushWheelUndoSnapshot();
      renderAll();
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
  e.target.value = "";
};

// Generate wheel button
ui.generateWheelBtn.onclick = async () => {
  try {
    const response = await fetch(`/api/car-gen?type=wheel&t=${Date.now()}`);
    if (!response.ok) {
      throw new Error('Failed to generate wheel image');
    }

    const blob = await response.blob();
    const img = new Image();
    img.onload = () => {
      drawUploadedImageToArt(img, wheelArtCtx, WHEEL_W, WHEEL_H);
      hasWheelArt = true;
      pushWheelUndoSnapshot();
      renderAll();
    };
    img.src = URL.createObjectURL(blob);
  } catch (error) {
    console.error('Error generating wheel:', error);
    alert('Failed to generate wheel image. Please try again.');
  }
};

// ============================
// UNDO / REDO / CLEAR
// ============================
ui.bodyUndoBtn.onclick = () => { undoCanvas(bodyUndo, bodyRedo, bodyArtCtx); renderAll(); };
ui.bodyRedoBtn.onclick = () => { redoCanvas(bodyUndo, bodyRedo, bodyArtCtx); renderAll(); };
ui.bodyClearBtn.onclick = () => {
  clearArtCanvas(bodyArtCtx, BODY_W, BODY_H, pushBodyUndoSnapshot);
  bodyOffsetX = 0;
  bodyOffsetY = 0;
  renderAll();
};

ui.wheelUndoBtn.onclick = () => {
  undoCanvas(wheelUndo, wheelRedo, wheelArtCtx);
  hasWheelArt = wheelUndo.length > 1;
  renderAll();
};
ui.wheelRedoBtn.onclick = () => {
  redoCanvas(wheelUndo, wheelRedo, wheelArtCtx);
  hasWheelArt = true;
  renderAll();
};
ui.wheelClearBtn.onclick = () => {
  clearArtCanvas(wheelArtCtx, WHEEL_W, WHEEL_H, pushWheelUndoSnapshot);
  hasWheelArt = false;
  renderAll();
};

// ============================
// POINTER EVENTS — BODY CANVAS
// ============================
ui.bodyCanvas.onpointerdown = (e) => {
  if (["name", "properties", "submit"].includes(currentTab)) return;
  const globalPos = getCanvasPos(ui.bodyCanvas, e);

  // Placement: select/drag wheels
  if (currentTab === "placement") {
    selectedWheelIndex = -1;

    for (let i = placedWheels.length - 1; i >= 0; i--) {
      if (hitTestWheelGlobal(globalPos, placedWheels[i])) {
        selectedWheelIndex = i;
        break;
      }
    }

    const w = getSelectedWheel();
    if (w) {
      const wheelGlobal = toGlobalFromBodyLocal({ x: w.x, y: w.y });
      w.dragOffsetX = globalPos.x - wheelGlobal.x;
      w.dragOffsetY = globalPos.y - wheelGlobal.y;
      w.isDragging = true;
    }

    renderAll();
    return;
  }

  // Body move tool
  if (currentTab === "body" && currentTool === "move") {
    isBodyDragging = true;
    bodyDragStartX = globalPos.x;
    bodyDragStartY = globalPos.y;
    bodyDragOffsetStartX = bodyOffsetX;
    bodyDragOffsetStartY = bodyOffsetY;
    ui.bodyCanvas.setPointerCapture(e.pointerId);
    return;
  }

  // Body pen tool
  if (currentTab === "body" && currentTool === "pen") {
    isDrawing = true;
    currentPenColor = ui.bodyColor.value;
    strokePoints = [toBodyLocal(globalPos)];
    ui.bodyCanvas.setPointerCapture(e.pointerId);
    return;
  }

  // Body fill tool
  if (currentTab === "body" && currentTool === "fill") {
    const localPos = toBodyLocal(globalPos);
    const x = Math.floor(localPos.x);
    const y = Math.floor(localPos.y);
    if (x >= 0 && x < BODY_W && y >= 0 && y < BODY_H) {
      const fillColor = hexToRgb(ui.bodyColor.value);
      if (fillColor) {
        pushBodyUndoSnapshot();
        floodFill(bodyArtCtx, x, y, fillColor, BODY_W, BODY_H);
        renderAll();
      }
    }
    return;
  }
};

ui.bodyCanvas.onpointermove = (e) => {
  if (["name", "properties", "submit"].includes(currentTab)) return;
  const globalPos = getCanvasPos(ui.bodyCanvas, e);

  // Drag wheel
  if (currentTab === "placement") {
    const w = getSelectedWheel();
    if (w && w.isDragging) {
      const desiredGlobalX = globalPos.x - w.dragOffsetX;
      const desiredGlobalY = globalPos.y - w.dragOffsetY;
      const local = toBodyLocal({ x: desiredGlobalX, y: desiredGlobalY });

      w.x = clamp(local.x, -BODY_W, BODY_W * 2);
      w.y = clamp(local.y, -BODY_H, BODY_H * 2);

      renderAll();
    }
    return;
  }

  // Drag body offset
  if (currentTab === "body" && currentTool === "move" && isBodyDragging) {
    const dx = globalPos.x - bodyDragStartX;
    const dy = globalPos.y - bodyDragStartY;

    bodyOffsetX = Math.round(bodyDragOffsetStartX + dx);
    bodyOffsetY = Math.round(bodyDragOffsetStartY + dy);

    renderAll();
    return;
  }

  // Body pen preview
  if (currentTab === "body" && currentTool === "pen" && isDrawing) {
    strokePoints.push(toBodyLocal(globalPos));

    renderBodyComposite();

    const previewPoints = strokePoints.map(p => ({ x: p.x + bodyOffsetX, y: p.y + bodyOffsetY }));
    strokePreview(bodyCtx, previewPoints, currentPenColor, bodyPenWidth);
  }
};

ui.bodyCanvas.onpointerup = (e) => {
  if (["name", "properties", "submit"].includes(currentTab)) return;
  if (currentTab === "placement") {
    const w = getSelectedWheel();
    if (w) w.isDragging = false;
    return;
  }

  if (currentTab === "body" && currentTool === "move" && isBodyDragging) {
    isBodyDragging = false;
    return;
  }

  if (currentTab === "body" && currentTool === "pen" && isDrawing) {
    isDrawing = false;
    commitStroke(bodyArtCtx, strokePoints, currentPenColor, bodyPenWidth);
    pushBodyUndoSnapshot();
    strokePoints = [];
    renderAll();
  }
};

// ============================
// POINTER EVENTS — WHEEL CANVAS
// ============================
ui.wheelCanvas.onpointerdown = (e) => {
  if (currentTab !== "wheel") return;
  if (currentTool !== "pen") return;

  const pos = getCanvasPos(ui.wheelCanvas, e);
  isDrawing = true;
  currentPenColor = ui.wheelColor.value;
  strokePoints = [pos];
  ui.wheelCanvas.setPointerCapture(e.pointerId);
};

ui.wheelCanvas.onpointermove = (e) => {
  if (currentTab !== "wheel") return;
  if (!isDrawing || currentTool !== "pen") return;

  const pos = getCanvasPos(ui.wheelCanvas, e);
  strokePoints.push(pos);

  renderWheelEditor();
  strokePreview(wheelCtx, strokePoints, currentPenColor, wheelPenWidth);
};

ui.wheelCanvas.onpointerup = (e) => {
  if (currentTab !== "wheel") return;
  if (!isDrawing || currentTool !== "pen") return;

  isDrawing = false;
  commitStroke(wheelArtCtx, strokePoints, currentPenColor, wheelPenWidth);
  hasWheelArt = true;
  pushWheelUndoSnapshot();

  strokePoints = [];
  renderAll();
};

// ============================
// WHEEL PLACEMENT CONTROLS
// ============================
ui.addWheelBtn.onclick = () => {
  if (!hasWheelArt) {
    alert("Please draw or upload a wheel first (Step 2).");
    return;
  }

  placedWheels.push({
    x: BODY_W / 2,
    y: BODY_H / 2,
    scale: 1,
    rotationDeg: 0,
    rotationRad: 0,
    dragOffsetX: 0,
    dragOffsetY: 0,
    isDragging: false,
  });

  selectedWheelIndex = placedWheels.length - 1;
  renderAll();
};

ui.duplicateWheelBtn.onclick = () => {
  const w = getSelectedWheel();
  if (!w) {
    alert("Select a wheel first (click it on the car).");
    return;
  }

  placedWheels.push({
    ...w,
    x: w.x + 30,
    y: w.y + 20,
    isDragging: false,
  });

  selectedWheelIndex = placedWheels.length - 1;
  renderAll();
};

ui.deleteWheelBtn.onclick = () => {
  const w = getSelectedWheel();
  if (!w) {
    alert("Select a wheel first (click it on the car).");
    return;
  }

  placedWheels.splice(selectedWheelIndex, 1);
  selectedWheelIndex = -1;
  renderAll();
};

ui.wheelScale.oninput = () => {
  const w = getSelectedWheel();
  if (!w) return;
  w.scale = parseFloat(ui.wheelScale.value);
  renderAll();
};

ui.wheelRotation.oninput = () => {
  const w = getSelectedWheel();
  if (!w) return;
  w.rotationDeg = parseFloat(ui.wheelRotation.value);
  w.rotationRad = (w.rotationDeg * Math.PI) / 180;
  renderAll();
};

// ============================
// PERFORMANCE CREDITS
// ============================
function updateCreditsUI() {
  const acc = parseInt(ui.accSlider.value, 10);
  const spd = parseInt(ui.speedSlider.value, 10);
  const remaining = TOTAL_CREDITS - (acc + spd);

  ui.accVal.textContent = String(acc);
  ui.speedVal.textContent = String(spd);
  ui.pointsRemaining.textContent = String(remaining);

  if (remaining === 0) ui.creditsHelp.textContent = "Perfect — you can submit";
  else if (remaining > 0) ui.creditsHelp.textContent = "Allocate all credits to submit";
  else ui.creditsHelp.textContent = "Over budget — adjust sliders";
}

function enforceCreditConstraint(changed) {
  let acc = parseInt(ui.accSlider.value, 10);
  let spd = parseInt(ui.speedSlider.value, 10);

  const total = acc + spd;
  if (total <= TOTAL_CREDITS) {
    updateCreditsUI();
    return;
  }

  const overflow = total - TOTAL_CREDITS;

  if (changed === "acc") {
    spd = clamp(spd - overflow, 0, 100);
    ui.speedSlider.value = String(spd);
  } else {
    acc = clamp(acc - overflow, 0, 100);
    ui.accSlider.value = String(acc);
  }

  updateCreditsUI();
}

ui.accSlider.oninput = () => enforceCreditConstraint("acc");
ui.speedSlider.oninput = () => enforceCreditConstraint("speed");

// ============================
// SUBMISSION
// ============================
async function submitCar() {
  const carName = ui.carName.value.trim();
  if (!carName) {
    alert("Please enter a car name first.");
    return;
  }

  const selectedRace = ui.raceSelect?.value || "";
  const [season, race] = selectedRace ? selectedRace.split(":") : [null, null];

  const acc = parseInt(ui.accSlider.value, 10);
  const spd = parseInt(ui.speedSlider.value, 10);

  if (acc + spd !== TOTAL_CREDITS) {
    alert(`Please allocate exactly ${TOTAL_CREDITS} credits (Remaining must be 0).`);
    return;
  }

  if (!hasWheelArt) {
    alert("Please create a wheel (Step 2) before submitting.");
    return;
  }

  const bodyImageData = bodyArtCanvas.toDataURL("image/png");
  const wheelImageData = wheelArtCanvas.toDataURL("image/png");
  const previewComposite = getCompositeDataURL();

  const wheelPositions = placedWheels.map((w, i) => ({
    wheelId: i,
    x: w.x,
    y: w.y,
    scale: w.scale,
    rotationDegrees: w.rotationDeg,
  }));

  const garagePayload = {
    carData: {
      season: season || activeRaces[0]?.season || 1,
      carName,
      carKey: currentCar?.carKey || null,
      carNumber: currentCar?.carNumber || null,
      acceleration: acc,
      topSpeed: spd,
      bodyImageData,
      wheelImageData,
      bodyOffsetX,
      bodyOffsetY,
      wheelPositions,
      previewComposite,
    },
  };

  ui.submitStatus.textContent = "Saving to garage…";

  try {
    const garageResp = await fetch(GARAGE_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(garagePayload),
    });

    if (!garageResp.ok) {
      const errorText = await garageResp.text();
      ui.submitStatus.textContent = `Garage save failed: ${errorText}`;
      return;
    }

    const garageData = await garageResp.json();
    currentCar = {
      carKey: garageData.carKey || currentCar?.carKey || null,
      carNumber: garageData.carNumber || currentCar?.carNumber || null,
    };
    if (ui.carKeyDisplay) ui.carKeyDisplay.textContent = garageData.carKey || '—';
    if (ui.carKeyHint) ui.carKeyHint.textContent = garageData.carKey
      ? "Save this key to retrieve your car from the garage later."
      : "Your key will appear after saving to the garage.";

    if (!season || !race) {
      ui.submitStatus.textContent = "Saved to garage. No active races to enter right now.";
      return;
    }

    ui.submitStatus.textContent = "Entering race…";

    const racePayload = {
      carData: {
        season,
        race,
        carNumber: garageData.carNumber,
        carKey: garageData.carKey,
      }
    };

    const raceResp = await fetch(SUBMIT_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(racePayload),
    });

    if (!raceResp.ok) {
      const errorText = await raceResp.text();
      ui.submitStatus.textContent = `Race entry failed: ${errorText}`;
      return;
    }

    ui.submitStatus.textContent = "✅ Saved to garage and entered the race!";
  } catch (err) {
    ui.submitStatus.textContent = `Submission failed (network error): ${err.message}`;
  }
}
ui.submitBtn.onclick = submitCar;

// ============================
// INIT
// ============================
function init() {
  initUndoStacks();
  updateCreditsUI();

  // Initialise pen widths from sliders
  bodyPenWidth = parseInt(ui.bodyThickness.value, 10) || 4;
  wheelPenWidth = parseInt(ui.wheelThickness.value, 10) || 4;

  currentPenColor = ui.bodyColor.value;
  currentTool = "pen";

  setTab("name");
  loadActiveRaces();
  renderAll();
}
init();

// ============================
// CAR NAME LOOKUP
// ============================
async function loadCarNameList() {
  try {
    const response = await fetch('/api/cars?resource=names');
    const data = await response.json();
    carNameList = (data.names || [])
      .map(name => name.trim().toLowerCase())
      .filter(Boolean);
  } catch (error) {
    console.error('Failed to load car name list:', error);
    carNameList = [];
  }
}

function updateCarNameStatus(value) {
  if (!ui.carNameStatus) return;

  const trimmedValue = value.trim();
  const trimmed = trimmedValue.toLowerCase();
  if (ui.submitCarName) {
    ui.submitCarName.textContent = trimmedValue || '—';
  }
  if (!trimmed) {
    ui.carNameStatus.textContent = '';
    ui.carNameStatus.classList.remove('exists');
    ui.carName?.classList.remove('name-available');
    ui.carNameTick?.classList.remove('visible');
    if (ui.carKeyBtn) {
      ui.carKeyBtn.disabled = true;
      ui.carKeyBtn.textContent = 'Enter car key';
    }
    return;
  }

  const exists = carNameList.includes(trimmed);
  if (exists) {
    ui.carNameStatus.textContent = 'Car name exists.';
    ui.carNameStatus.classList.add('exists');
    ui.carName?.classList.remove('name-available');
    ui.carNameTick?.classList.remove('visible');
    if (ui.carKeyBtn) {
      ui.carKeyBtn.disabled = false;
      ui.carKeyBtn.textContent = 'Enter car key';
    }
  } else {
    ui.carNameStatus.textContent = '';
    ui.carNameStatus.classList.remove('exists');
    ui.carName?.classList.add('name-available');
    ui.carNameTick?.classList.add('visible');
    if (ui.carKeyBtn) {
      ui.carKeyBtn.disabled = true;
      ui.carKeyBtn.textContent = 'Enter car key';
    }
  }
}

if (ui.carName) {
  ui.carName.addEventListener('input', (event) => {
    updateCarNameStatus(event.target.value);
  });
}

if (ui.carKeyBtn) {
  ui.carKeyBtn.addEventListener('click', async () => {
    if (ui.carKeyBtn.disabled) return;

    const key = window.prompt('Enter the 8-digit car key (two groups of four digits, e.g. 1234-5678):');
    if (key === null) return;

    const normalized = key.trim();
    const isValid = /^\d{4}-\d{4}$/.test(normalized) || /^\d{8}$/.test(normalized);

    if (!isValid) {
      alert('Please enter an 8-digit key in the format 1234-5678.');
      return;
    }

    const carName = ui.carName?.value?.trim();
    if (!carName) {
      alert('Please enter the car name first.');
      return;
    }

    ui.carNameStatus.textContent = 'Checking garage…';
    ui.carNameStatus.classList.add('exists');

    try {
      const response = await fetch(`/api/cars?resource=lookup&carname=${encodeURIComponent(carName)}&carkey=${encodeURIComponent(normalized)}`);
      if (!response.ok) {
        const errorText = await response.text();
        ui.carNameStatus.textContent = `Lookup failed: ${errorText}`;
        currentCar = null;
        return;
      }

      const data = await response.json();
      await loadCarIntoDesigner(data.car, data.carData, data.assets);
      ui.carNameStatus.textContent = 'Loaded existing car.';
      ui.carNameStatus.classList.add('exists');
      ui.carName?.classList.remove('name-available');
      ui.carNameTick?.classList.remove('visible');
    } catch (error) {
      console.error('Failed to load car:', error);
      ui.carNameStatus.textContent = 'Failed to load car. Try again.';
      currentCar = null;
    }
  });
}

loadCarNameList();

async function loadCarIntoDesigner(car, carData, assets = {}) {
  if (!carData) return;

  currentCar = {
    carKey: car?.carkey || null,
    carNumber: car?.carnumber || null,
  };

  bodyOffsetX = Number(carData.bodyOffsetX) || 0;
  bodyOffsetY = Number(carData.bodyOffsetY) || 0;

  const bodyUrl = assets.bodyImageData || carData.imagePaths?.body || car?.carimagepath;
  const wheelUrl = assets.wheelImageData || carData.imagePaths?.wheel;

  initUndoStacks(false);

  await Promise.all([
    loadImageIntoCanvas(bodyUrl, bodyArtCtx, BODY_W, BODY_H),
    loadImageIntoCanvas(wheelUrl, wheelArtCtx, WHEEL_W, WHEEL_H)
  ]);

  hasWheelArt = true;
  pushBodyUndoSnapshot();
  pushWheelUndoSnapshot();

  const wheels = Array.isArray(carData.wheels) ? carData.wheels : [];
  placedWheels.length = 0;
  wheels.forEach((wheel) => {
    placedWheels.push({
      x: Number(wheel.x) || 0,
      y: Number(wheel.y) || 0,
      scale: Number(wheel.scale) || 1,
      rotationDeg: Number(wheel.rotationDegrees) || 0,
      rotationRad: ((Number(wheel.rotationDegrees) || 0) * Math.PI) / 180,
      dragOffsetX: 0,
      dragOffsetY: 0,
      isDragging: false,
    });
  });

  selectedWheelIndex = placedWheels.length ? 0 : -1;

  const acc = Number(carData.props?.acceleration ?? ui.accSlider.value ?? 0);
  const spd = Number(carData.props?.topSpeed ?? ui.speedSlider.value ?? 0);
  ui.accSlider.value = String(acc);
  ui.speedSlider.value = String(spd);
  updateCreditsUI();

  if (ui.carKeyDisplay) ui.carKeyDisplay.textContent = currentCar.carKey || '—';
  if (ui.carKeyHint) ui.carKeyHint.textContent = currentCar.carKey
    ? 'Loaded from garage. Save this key to reuse later.'
    : 'Your key will appear after saving to the garage.';

  renderAll();
  setTab(currentTab || 'name');
}

async function loadImageIntoCanvas(url, ctx, w, h) {
  if (!url) return;
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      drawUploadedImageToArt(img, ctx, w, h);
      resolve();
    };
    img.onerror = reject;
    img.src = url;
  });
}
