/**
 * =========================================================
 * DOODLE DERBY 2D — Car Designer
 * =========================================================
 *
 * Changes implemented in this iteration:
 * 5) Body is now moveable:
 *    - In Body tab, choose "Move body"
 *    - Drag body around the canvas
 *    - Wheels are positioned RELATIVE to the body, so they move with it
 *
 * 6) Status pill moved into page (workspace topbar)
 * 7) Tips moved underneath drawing area (dynamic per tab)
 * 8) Button spacing handled in CSS (row gap + stack spacing)
 */

// ============================
// DOM REFERENCES
// ============================
const ui = {
  statusPill: document.getElementById("uiStatusPill"),
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
  previewCanvas: document.getElementById("previewCanvas"),

  // Workspace labels/buttons
  canvasTitle: document.getElementById("canvasTitle"),
  canvasSubtitle: document.getElementById("canvasSubtitle"),
  centerBodyBtn: document.getElementById("centerBodyBtn"),
  exportPreviewBtn: document.getElementById("exportPreviewBtn"),

  // Body controls
  bodyPenBtn: document.getElementById("bodyPenBtn"),
  bodyMoveBtn: document.getElementById("bodyMoveBtn"),
  bodyColor: document.getElementById("bodyColor"),
  uploadBody: document.getElementById("uploadBody"),
  bodyUndoBtn: document.getElementById("bodyUndoBtn"),
  bodyRedoBtn: document.getElementById("bodyRedoBtn"),
  bodyClearBtn: document.getElementById("bodyClearBtn"),

  // Wheel controls
  wheelPenBtn: document.getElementById("wheelPenBtn"),
  wheelMoveBtn: document.getElementById("wheelMoveBtn"),
  wheelColor: document.getElementById("wheelColor"),
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
  presetBalancedBtn: document.getElementById("presetBalancedBtn"),
  presetSpeedBtn: document.getElementById("presetSpeedBtn"),

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

// Visual tuning
const BODY_PEN_WIDTH = 4;
const WHEEL_PEN_WIDTH = 4;
const WHEEL_HIT_PAD = 1.05;

// ============================
// CANVAS SETUP
// ============================
ui.bodyCanvas.width = BODY_W;
ui.bodyCanvas.height = BODY_H;
ui.wheelCanvas.width = WHEEL_W;
ui.wheelCanvas.height = WHEEL_H;
ui.previewCanvas.width = 512;
ui.previewCanvas.height = 256;

const bodyCtx = ui.bodyCanvas.getContext("2d");
const wheelCtx = ui.wheelCanvas.getContext("2d");
const previewCtx = ui.previewCanvas.getContext("2d");

// Offscreen “art” canvases:
// - bodyArtCanvas holds ONLY body pixels (in its own local coordinates)
// - wheelArtCanvas holds ONLY wheel pixels (in its own local coordinates)
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
let currentTool = "pen"; // 'pen' | 'move'
let currentPenColor = "#2C2B3A";

let isDrawing = false;
let strokePoints = [];

// Body layer position (NEW)
// This is the big change enabling body movement.
// - bodyArtCanvas stays unchanged; we draw it into the visible canvas at (bodyOffsetX, bodyOffsetY).
// - Wheels are stored in BODY-LOCAL coordinates; rendering adds the body offset.
let bodyOffsetX = 0;
let bodyOffsetY = 0;
let isBodyDragging = false;
let bodyDragStartX = 0;
let bodyDragStartY = 0;
let bodyDragOffsetStartX = 0;
let bodyDragOffsetStartY = 0;

// Undo stacks for artwork layers
const bodyUndo = [];
const bodyRedo = [];
const wheelUndo = [];
const wheelRedo = [];

let hasWheelArt = false;

// Wheels stored in BODY-LOCAL coordinates
const placedWheels = [];
let selectedWheelIndex = -1;

// ============================
// TIPS (under drawing area)
// ============================
const TAB_TIPS = {
  body:
    "Draw or upload your car body. Use Move body to drag the whole body around. Tip: upload a PNG with transparency for clean edges.",
  wheel:
    "Create a wheel (square works best). Keep it simple—wheels render small. You can upload a PNG too.",
  placement:
    "Click a wheel to select it, drag to move, then scale/rotate with sliders. Wheels are placed relative to the body, so moving the body moves wheels too.",
  properties:
    "Spend exactly 100 credits across Acceleration and Top Speed. Remaining must hit 0 to submit.",
  submit:
    "Enter team name, car name, and email, then submit. The payload includes artwork, wheel layout, body offset, and performance credits."
};

function setTips(tabName) {
  ui.tipsText.textContent = TAB_TIPS[tabName] ?? "";
}

// ============================
// UTILS
// ============================
function setStatus(text) {
  ui.statusPill.textContent = text;
}

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

// Convert global canvas coordinates -> body-local coordinates
function toBodyLocal(pos) {
  return { x: pos.x - bodyOffsetX, y: pos.y - bodyOffsetY };
}

// Convert body-local coordinates -> global canvas coordinates
function toGlobalFromBodyLocal(pos) {
  return { x: pos.x + bodyOffsetX, y: pos.y + bodyOffsetY };
}

// Wheel hit test uses GLOBAL position (body offset included)
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

// Subtle background grid for a “design surface”
function drawSubtleGrid(ctx, w, h) {
  ctx.save();
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);

  ctx.globalAlpha = 0.10;
  ctx.strokeStyle = "#2C2B3A";
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

// Undo snapshots
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

  // Draw body art at current body offset (NEW)
  bodyCtx.drawImage(bodyArtCanvas, bodyOffsetX, bodyOffsetY);

  // Draw wheels at bodyOffset + wheelLocal(x,y)
  for (let i = 0; i < placedWheels.length; i++) {
    const w = placedWheels[i];
    const g = toGlobalFromBodyLocal({ x: w.x, y: w.y });

    bodyCtx.save();
    bodyCtx.translate(g.x, g.y);
    bodyCtx.rotate(w.rotationRad);
    bodyCtx.scale(w.scale, w.scale);

    bodyCtx.drawImage(wheelArtCanvas, -WHEEL_W / 2, -WHEEL_H / 2, WHEEL_W, WHEEL_H);

    // Selection highlight
    if (currentTab === "placement" && i === selectedWheelIndex) {
      bodyCtx.lineWidth = 3;
      bodyCtx.strokeStyle = "#ED4D2E";
      bodyCtx.strokeRect(-WHEEL_W / 2, -WHEEL_H / 2, WHEEL_W, WHEEL_H);
    }

    bodyCtx.restore();
  }

  // Optional: show a gentle outline around the body bounds while moving (helps UX)
  if (currentTab === "body" && currentTool === "move") {
    bodyCtx.save();
    bodyCtx.globalAlpha = 0.55;
    bodyCtx.strokeStyle = "#224C8F";
    bodyCtx.lineWidth = 2;
    bodyCtx.strokeRect(bodyOffsetX + 4, bodyOffsetY + 4, BODY_W - 8, BODY_H - 8);
    bodyCtx.restore();
  }
}

function renderWheelEditor() {
  wheelCtx.save();
  wheelCtx.clearRect(0, 0, WHEEL_W, WHEEL_H);

  wheelCtx.globalAlpha = 0.08;
  wheelCtx.fillStyle = "#224C8F";
  wheelCtx.beginPath();
  wheelCtx.arc(WHEEL_W / 2, WHEEL_H / 2, 90, 0, 2 * Math.PI);
  wheelCtx.fill();

  wheelCtx.restore();
  wheelCtx.drawImage(wheelArtCanvas, 0, 0);
}

function renderPreview() {
  previewCtx.clearRect(0, 0, ui.previewCanvas.width, ui.previewCanvas.height);

  const composite = document.createElement("canvas");
  composite.width = BODY_W;
  composite.height = BODY_H;
  const cctx = composite.getContext("2d");

  cctx.fillStyle = "#ffffff";
  cctx.fillRect(0, 0, BODY_W, BODY_H);

  // Body with offset
  cctx.drawImage(bodyArtCanvas, bodyOffsetX, bodyOffsetY);

  // Wheels with offset
  for (const w of placedWheels) {
    const g = toGlobalFromBodyLocal({ x: w.x, y: w.y });
    cctx.save();
    cctx.translate(g.x, g.y);
    cctx.rotate(w.rotationRad);
    cctx.scale(w.scale, w.scale);
    cctx.drawImage(wheelArtCanvas, -WHEEL_W / 2, -WHEEL_H / 2);
    cctx.restore();
  }

  const pw = ui.previewCanvas.width;
  const ph = ui.previewCanvas.height;
  const scale = Math.min(pw / BODY_W, ph / BODY_H);

  const dw = BODY_W * scale;
  const dh = BODY_H * scale;
  const dx = (pw - dw) / 2;
  const dy = (ph - dh) / 2;

  previewCtx.drawImage(composite, dx, dy, dw, dh);
}

function getCompositeDataURL() {
  const composite = document.createElement("canvas");
  composite.width = BODY_W;
  composite.height = BODY_H;
  const cctx = composite.getContext("2d");

  cctx.fillStyle = "#ffffff";
  cctx.fillRect(0, 0, BODY_W, BODY_H);

  cctx.drawImage(bodyArtCanvas, bodyOffsetX, bodyOffsetY);

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
  a.download = "doodlederby_car_preview.png";
  a.click();
}

// Wheel UI refresh
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
  renderPreview();
  refreshWheelUI();
}

// ============================
// BODY CENTERING (updated)
// ============================

/**
 * Center body by adjusting bodyOffset (not by shifting pixels).
 * This is far safer now that the body layer can move.
 */
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

  if (!found) {
    setStatus("Nothing to center (body is empty)");
    return;
  }

  const boxW = maxX - minX + 1;
  const boxH = maxY - minY + 1;

  // Choose offsets so that the bounding box is centered in the visible canvas
  bodyOffsetX = Math.round((BODY_W - boxW) / 2 - minX);
  bodyOffsetY = Math.round((BODY_H - boxH) / 2 - minY);

  setStatus("Body centered");
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

  // Wheel canvas is only visible in wheel tab
  ui.wheelCanvas.style.display = (tabName === "wheel") ? "block" : "none";

  if (tabName === "wheel") {
    ui.canvasTitle.textContent = "Wheel canvas";
    ui.canvasSubtitle.textContent = "Draw or upload a wheel (square)";
    setStatus("Editing wheel");
  } else if (tabName === "placement") {
    ui.canvasTitle.textContent = "Body canvas";
    ui.canvasSubtitle.textContent = "Drag wheels to position them";
    setStatus("Placing wheels");
  } else if (tabName === "body") {
    ui.canvasTitle.textContent = "Body canvas";
    ui.canvasSubtitle.textContent = "Draw or upload the car body (Move tool drags body)";
    setStatus("Editing body");
  } else if (tabName === "properties") {
    ui.canvasTitle.textContent = "Body canvas";
    ui.canvasSubtitle.textContent = "Adjust performance credits";
    setStatus("Adjusting performance");
  } else {
    ui.canvasTitle.textContent = "Body canvas";
    ui.canvasSubtitle.textContent = "Final checks before submission";
    setStatus("Ready to submit");
  }

  setTips(tabName);
  renderAll();
}

// Tab wiring
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
  setStatus("Body pen tool");
};

ui.bodyMoveBtn.onclick = () => {
  currentTool = "move";
  setStatus("Body move tool (drag the body)");
};

ui.wheelPenBtn.onclick = () => {
  currentTool = "pen";
  currentPenColor = ui.wheelColor.value;
  setStatus("Wheel pen tool");
};

ui.wheelMoveBtn.onclick = () => {
  currentTool = "move";
  setStatus("Wheel inspect (drawing disabled)");
};

// Pen colour updates
ui.bodyColor.oninput = () => { if (currentTab === "body") currentPenColor = ui.bodyColor.value; };
ui.wheelColor.oninput = () => { if (currentTab === "wheel") currentPenColor = ui.wheelColor.value; };

// Workspace buttons
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

      // Reset offsets so the newly uploaded body starts “naturally”
      bodyOffsetX = 0;
      bodyOffsetY = 0;

      renderAll();
      setStatus("Body image uploaded");
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
      setStatus("Wheel image uploaded");
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
  setStatus("Body cleared");
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
  setStatus("Wheel cleared");
};

// ============================
// POINTER EVENTS — BODY CANVAS
// ============================

ui.bodyCanvas.onpointerdown = (e) => {
  const globalPos = getCanvasPos(ui.bodyCanvas, e);

  // PLACEMENT TAB: click/select/drag wheels (stored body-local)
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
      setStatus(`Selected wheel #${selectedWheelIndex + 1}`);
    } else {
      setStatus("No wheel selected");
    }

    renderAll();
    return;
  }

  // BODY TAB:
  if (currentTab === "body") {
    // 5) MOVE TOOL: drag the body offset
    if (currentTool === "move") {
      isBodyDragging = true;
      bodyDragStartX = globalPos.x;
      bodyDragStartY = globalPos.y;
      bodyDragOffsetStartX = bodyOffsetX;
      bodyDragOffsetStartY = bodyOffsetY;
      ui.bodyCanvas.setPointerCapture(e.pointerId);
      setStatus("Dragging body...");
      return;
    }

    // PEN TOOL: draw onto bodyArtCanvas in BODY-LOCAL coordinates
    if (currentTool === "pen") {
      isDrawing = true;
      currentPenColor = ui.bodyColor.value;

      // Convert pointer into body-local coordinates before drawing
      const localPos = toBodyLocal(globalPos);
      strokePoints = [localPos];

      ui.bodyCanvas.setPointerCapture(e.pointerId);
      return;
    }
  }
};

ui.bodyCanvas.onpointermove = (e) => {
  const globalPos = getCanvasPos(ui.bodyCanvas, e);

  // Placement: drag wheel (wheel coords are body-local)
  if (currentTab === "placement") {
    const w = getSelectedWheel();
    if (w && w.isDragging) {
      // convert global into body-local, accounting for drag offset
      const desiredGlobalX = globalPos.x - w.dragOffsetX;
      const desiredGlobalY = globalPos.y - w.dragOffsetY;

      const local = toBodyLocal({ x: desiredGlobalX, y: desiredGlobalY });

      w.x = clamp(local.x, -BODY_W, BODY_W * 2);
      w.y = clamp(local.y, -BODY_H, BODY_H * 2);

      renderAll();
    }
    return;
  }

  // Body move
  if (currentTab === "body" && currentTool === "move" && isBodyDragging) {
    const dx = globalPos.x - bodyDragStartX;
    const dy = globalPos.y - bodyDragStartY;

    bodyOffsetX = Math.round(bodyDragOffsetStartX + dx);
    bodyOffsetY = Math.round(bodyDragOffsetStartY + dy);

    renderAll();
    return;
  }

  // Body draw preview (draw preview onto visible composite, not onto art yet)
  if (currentTab === "body" && currentTool === "pen" && isDrawing) {
    const localPos = toBodyLocal(globalPos);
    strokePoints.push(localPos);

    // Render composite first
    renderBodyComposite();

    // Overlay stroke preview at GLOBAL coords by translating local->global
    // We can preview by temporarily shifting points by bodyOffset.
    const previewPoints = strokePoints.map(p => ({
      x: p.x + bodyOffsetX,
      y: p.y + bodyOffsetY
    }));

    strokePreview(bodyCtx, previewPoints, currentPenColor, BODY_PEN_WIDTH);
    renderPreview();
  }
};

ui.bodyCanvas.onpointerup = (e) => {
  // Placement: stop dragging wheel
  if (currentTab === "placement") {
    const w = getSelectedWheel();
    if (w) w.isDragging = false;
    return;
  }

  // Stop dragging body
  if (currentTab === "body" && currentTool === "move" && isBodyDragging) {
    isBodyDragging = false;
    setStatus("Body moved");
    return;
  }

  // Commit body stroke onto art (in body-local coords)
  if (currentTab === "body" && currentTool === "pen" && isDrawing) {
    isDrawing = false;
    commitStroke(bodyArtCtx, strokePoints, currentPenColor, BODY_PEN_WIDTH);
    pushBodyUndoSnapshot();
    strokePoints = [];
    renderAll();
    setStatus("Body stroke added");
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
  strokePreview(wheelCtx, strokePoints, currentPenColor, WHEEL_PEN_WIDTH);
};

ui.wheelCanvas.onpointerup = (e) => {
  if (currentTab !== "wheel") return;
  if (!isDrawing || currentTool !== "pen") return;

  isDrawing = false;
  commitStroke(wheelArtCtx, strokePoints, currentPenColor, WHEEL_PEN_WIDTH);
  hasWheelArt = true;
  pushWheelUndoSnapshot();

  strokePoints = [];
  renderAll();
  setStatus("Wheel stroke added");
};

// ============================
// WHEEL PLACEMENT CONTROLS
// ============================

ui.addWheelBtn.onclick = () => {
  if (!hasWheelArt) {
    alert("Please draw or upload a wheel first (Step 2).");
    return;
  }

  // Add wheel at center of body-local space (i.e., visually centered once body offset applied)
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
  setStatus(`Wheel added (#${selectedWheelIndex + 1})`);
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
  setStatus(`Wheel duplicated (#${selectedWheelIndex + 1})`);
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
  setStatus("Wheel deleted");
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
// PERFORMANCE CREDITS (100 TOTAL)
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

ui.presetBalancedBtn.onclick = () => {
  ui.accSlider.value = "50";
  ui.speedSlider.value = "50";
  updateCreditsUI();
};

ui.presetSpeedBtn.onclick = () => {
  ui.accSlider.value = "30";
  ui.speedSlider.value = "70";
  updateCreditsUI();
};

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

  // Body art is still exported as its raw layer.
  // NEW: we also include bodyOffsetX/Y so the server/race engine can place it.
  const bodyImageData = bodyArtCanvas.toDataURL("image/png");
  const wheelImageData = wheelArtCanvas.toDataURL("image/png");
  const previewComposite = getCompositeDataURL();

  // Wheels are stored in body-local coords (NEW)
  const wheelPositions = placedWheels.map((w, i) => ({
    wheelId: i,
    x: w.x,
    y: w.y,
    scale: w.scale,
    rotationDegrees: w.rotationDeg,
  }));

  const payload = {
    carData: {
      teamName,
      carName,
      email,
      acceleration: acc,
      topSpeed: spd,

      bodyImageData,
      wheelImageData,

      // NEW: body offset + local wheel transforms
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
      ui.submitStatus.textContent = "Submission failed (server returned an error).";
      setStatus("Submission failed");
      return;
    }

    ui.submitStatus.textContent = "✅ Submission successful!";
    setStatus("Submitted successfully");
  } catch (err) {
    ui.submitStatus.textContent = "Submission failed (network error).";
    setStatus("Submission failed");
  }
}

ui.submitBtn.onclick = submitCar;

// ============================
// INIT
// ============================
function init() {
  initUndoStacks();
  updateCreditsUI();

  currentPenColor = ui.bodyColor.value;
  currentTool = "pen";

  setTab("body");
  renderAll();
}

init();
