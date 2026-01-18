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
    body: document.getElementById("bodyTab"),
    wheel: document.getElementById("wheelTab"),
    placement: document.getElementById("placementTab"),
    properties: document.getElementById("propertiesTab"),
    submit: document.getElementById("submitTab"),
  },
  panels: {
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
  centerBodyBtn: document.getElementById("centerBodyBtn"),
  exportPreviewBtn: document.getElementById("exportPreviewBtn"),

  // Body controls
  bodyPenBtn: document.getElementById("bodyPenBtn"),
  bodyMoveBtn: document.getElementById("bodyMoveBtn"),
  bodyColor: document.getElementById("bodyColor"),
  bodyThickness: document.getElementById("bodyThickness"),
  uploadBody: document.getElementById("uploadBody"),
  bodyUndoBtn: document.getElementById("bodyUndoBtn"),
  bodyRedoBtn: document.getElementById("bodyRedoBtn"),
  bodyClearBtn: document.getElementById("bodyClearBtn"),

  // Wheel controls
  wheelPenBtn: document.getElementById("wheelPenBtn"),
  wheelMoveBtn: document.getElementById("wheelMoveBtn"),
  wheelColor: document.getElementById("wheelColor"),
  wheelThickness: document.getElementById("wheelThickness"),
  uploadWheel: document.getElementById("uploadWheel"),
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
  teamName: document.getElementById("teamName"),
  carName: document.getElementById("carName"),
  email: document.getElementById("email"),
  submitBtn: document.getElementById("submitBtn"),
  submitStatus: document.getElementById("submitStatus"),
};

// ============================
// CONSTANTS / CONFIG
// ============================
const TOTAL_CREDITS = window.CRAZY_RACES_TOTAL_CREDITS ?? 100;
const SUBMIT_ENDPOINT = window.CRAZY_RACES_SUBMIT_ENDPOINT ?? "/api/submit-car";

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
  body:
    "Draw or upload your car body. Use Move to drag the whole body around. PNG transparency works best.",
  wheel:
    "Create a wheel (square works best). You can draw it or upload a PNG.",
  placement:
    "Click a wheel to select it, drag to move, then scale/rotate using sliders.",
  properties:
    "Spend exactly 100 credits across Acceleration and Top Speed. Remaining must be 0.",
  submit:
    "Enter team name, car name, and email, then submit.",
};

function setTips(tabName) {
  if (ui.tipsText) ui.tipsText.textContent = TAB_TIPS[tabName] ?? "";
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

// ============================
// RENDERING
// ============================
function renderBodyComposite() {
  drawSubtleGrid(bodyCtx, BODY_W, BODY_H);

  bodyCtx.drawImage(bodyArtCanvas, bodyOffsetX, bodyOffsetY);

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
  wheelCtx.save();
  wheelCtx.clearRect(0, 0, WHEEL_W, WHEEL_H);

  wheelCtx.globalAlpha = 0.06;
  wheelCtx.fillStyle = "#3B0273";
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
function initUndoStacks() {
  bodyArtCtx.clearRect(0, 0, BODY_W, BODY_H);
  wheelArtCtx.clearRect(0, 0, WHEEL_W, WHEEL_H);
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

  ui.wheelCanvas.style.display = (tabName === "wheel") ? "block" : "none";

  if (tabName === "wheel") {
    ui.canvasTitle.textContent = "Wheel canvas";
    ui.canvasSubtitle.textContent = "Draw or upload a wheel (square)";
  } else if (tabName === "placement") {
    ui.canvasTitle.textContent = "Body canvas";
    ui.canvasSubtitle.textContent = "Click a wheel to select it; drag to move";
  } else if (tabName === "body") {
    ui.canvasTitle.textContent = "Body canvas";
    ui.canvasSubtitle.textContent = "Draw the body or drag it with Move";
  } else if (tabName === "properties") {
    ui.canvasTitle.textContent = "Body canvas";
    ui.canvasSubtitle.textContent = "Adjust performance credits";
  } else {
    ui.canvasTitle.textContent = "Body canvas";
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

// ============================
// TOOL BUTTONS
// ============================
ui.bodyPenBtn.onclick = () => {
  currentTool = "pen";
  currentPenColor = ui.bodyColor.value;
};
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

ui.centerBodyBtn.onclick = centerBodyArtByOffset;
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
};

ui.bodyCanvas.onpointermove = (e) => {
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
  const teamName = ui.teamName.value.trim();
  const carName = ui.carName.value.trim();
  const email = ui.email.value.trim();

  if (!teamName || !carName || !email) {
    alert("Please fill Team name, Car name, and Email.");
    return;
  }

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

  // Get active race information for validation
  let activeRace = null;
  try {
    const raceResponse = await fetch('/api/race-info');
    const raceData = await raceResponse.json();
    if (raceData.raceInfo) {
      activeRace = raceData.raceInfo;
    }
  } catch (error) {
    console.error('Failed to get race info:', error);
    alert('Unable to verify active race. Please try again.');
    return;
  }

  if (!activeRace) {
    alert('No active race available for entry at this time.');
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

  const payload = {
    carData: {
      season: activeRace.season,
      race: activeRace.racenumber,
      teamName,
      carName,
      email,
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

  ui.submitStatus.textContent = "Submitting…";

  try {
    const resp = await fetch(SUBMIT_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      const errorText = await resp.text();
      ui.submitStatus.textContent = `Submission failed: ${errorText}`;
      return;
    }

    ui.submitStatus.textContent = "✅ Submission successful!";
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

  setTab("body");
  renderAll();
}
init();
