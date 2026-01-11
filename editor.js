/**
 * =========================================================
 * CRAZY RACES (temporary name) — Car Designer
 * =========================================================
 *
 * Goals (this iteration):
 * - Professional, simple workflow:
 *     1) Draw/upload body
 *     2) Draw/upload wheel
 *     3) Place wheels (multiple copies, scale/rotate)
 *     4) Allocate 100 credits (acc + speed)
 *     5) Submit to API
 *
 * Key implementation decision:
 * - We keep TWO “art” layers on OFFSCREEN canvases:
 *     - bodyArtCanvas: holds ONLY the body drawing/upload (no wheels)
 *     - wheelArtCanvas: holds ONLY the wheel drawing/upload
 *
 * The visible bodyCanvas shows:
 *     bodyArt + placed wheels (composite)
 *
 * Why?
 * - Undo/redo for body and wheel are much simpler and robust (ImageData snapshots).
 * - Wheel placement can be edited without destroying the body artwork.
 * - Submission can send: body image + wheel image + wheel transforms (positions).
 */

// ============================
// DOM REFERENCES
// ============================
const ui = {
  statusPill: document.getElementById("uiStatusPill"),

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

// Canvas sizes (single source of truth)
const BODY_W = window.CRAZY_RACES_BODY_W ?? 1024;
const BODY_H = window.CRAZY_RACES_BODY_H ?? 512;
const WHEEL_W = window.CRAZY_RACES_WHEEL_W ?? 256;
const WHEEL_H = window.CRAZY_RACES_WHEEL_H ?? 256;

// Visual tuning
const BODY_PEN_WIDTH = 4;
const WHEEL_PEN_WIDTH = 4;

// How “clickable” a wheel is (hit radius multiplier)
const WHEEL_HIT_PAD = 1.05;

// ============================
// CANVAS SETUP
// ============================

// Visible canvases
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
// - bodyArt: only body artwork
// - wheelArt: only wheel artwork
const bodyArtCanvas = document.createElement("canvas");
bodyArtCanvas.width = BODY_W;
bodyArtCanvas.height = BODY_H;
const bodyArtCtx = bodyArtCanvas.getContext("2d");

const wheelArtCanvas = document.createElement("canvas");
wheelArtCanvas.width = WHEEL_W;
wheelArtCanvas.height = WHEEL_H;
const wheelArtCtx = wheelArtCanvas.getContext("2d");

// ============================
// EDITOR STATE
// ============================

/**
 * Tabs: 'body' | 'wheel' | 'placement' | 'properties' | 'submit'
 */
let currentTab = "body";

/**
 * Tools:
 * - pen: draw strokes
 * - move: currently "inspect only" (we keep it for future transforms)
 */
let currentTool = "pen"; // 'pen' | 'move'

// Current pen colour (body & wheel have separate pickers, but we store it here)
let currentPenColor = "#2C2B3A";

// Pointer drawing state
let isDrawing = false;
let strokePoints = []; // [{x,y}, ...] captured during a stroke

// Body / wheel undo stacks store ImageData snapshots for robustness
const bodyUndo = [];
const bodyRedo = [];
const wheelUndo = [];
const wheelRedo = [];

/**
 * Wheel “master” availability:
 * - We consider a wheel “ready” if wheelArt has any non-empty pixels.
 *   (We approximate this by tracking a boolean set when drawing/uploading/clearing.)
 */
let hasWheelArt = false;

// Wheel placements on the car.
// Each wheel is a “copy” of wheelArt, drawn with transform.
const placedWheels = [];
let selectedWheelIndex = -1; // -1 means none selected

// ============================
// UTILS
// ============================

function setStatus(text) {
  ui.statusPill.textContent = text;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

/**
 * Convert pointer event -> canvas coordinates, accounting for CSS scaling.
 */
function getCanvasPos(canvas, evt) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (evt.clientX - rect.left) * (canvas.width / rect.width),
    y: (evt.clientY - rect.top) * (canvas.height / rect.height),
  };
}

/**
 * Basic wheel hit test:
 * We treat each wheel as a circle with radius proportional to its scaled size.
 */
function hitTestWheel(pos, wheel) {
  const dx = pos.x - wheel.x;
  const dy = pos.y - wheel.y;
  const r = (Math.max(WHEEL_W, WHEEL_H) * wheel.scale * 0.5) * WHEEL_HIT_PAD;
  return (dx * dx + dy * dy) <= r * r;
}

function getSelectedWheel() {
  if (selectedWheelIndex < 0 || selectedWheelIndex >= placedWheels.length) return null;
  return placedWheels[selectedWheelIndex];
}

/**
 * Draw a “paper-ish” background grid (very subtle).
 * This makes it feel more like a design surface.
 */
function drawSubtleGrid(ctx, w, h) {
  ctx.save();
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);

  // faint grid
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

/**
 * Snapshot helpers (undo/redo):
 * We store ImageData because it faithfully captures the canvas
 * including alpha, and doesn’t lose references like JSON would.
 */
function pushBodyUndoSnapshot() {
  bodyUndo.push(bodyArtCtx.getImageData(0, 0, BODY_W, BODY_H));
  // Any new action clears redo history
  bodyRedo.length = 0;
}

function pushWheelUndoSnapshot() {
  wheelUndo.push(wheelArtCtx.getImageData(0, 0, WHEEL_W, WHEEL_H));
  wheelRedo.length = 0;
}

/**
 * Safe undo: requires at least 2 snapshots to “go back”.
 */
function undoCanvas(undoStack, redoStack, targetCtx, w, h) {
  if (undoStack.length < 2) return; // nothing to undo to
  const current = undoStack.pop();
  redoStack.push(current);

  const prev = undoStack[undoStack.length - 1];
  targetCtx.putImageData(prev, 0, 0);
}

/**
 * Safe redo.
 */
function redoCanvas(undoStack, redoStack, targetCtx) {
  if (redoStack.length === 0) return;
  const next = redoStack.pop();
  undoStack.push(next);
  targetCtx.putImageData(next, 0, 0);
}

/**
 * Clear an art canvas and push an undo snapshot.
 */
function clearArtCanvas(ctx, w, h, pushSnapshotFn) {
  ctx.clearRect(0, 0, w, h);
  pushSnapshotFn();
}

/**
 * Draw a stroke preview on top of the *visible* canvas (not committed).
 */
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

/**
 * Commit a stroke onto a target art layer (bodyArt or wheelArt).
 */
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

/**
 * Upload helpers:
 * - Body upload: draws image centered and scaled to fit nicely.
 * - Wheel upload: draws image centered and scaled to fit the square.
 */
function drawUploadedImageToArt(img, targetCtx, w, h) {
  targetCtx.save();
  targetCtx.clearRect(0, 0, w, h);

  // Scale to fit inside target canvas while preserving aspect ratio
  const scale = Math.min(w / img.width, h / img.height);
  const drawW = img.width * scale;
  const drawH = img.height * scale;
  const x = (w - drawW) / 2;
  const y = (h - drawH) / 2;

  targetCtx.drawImage(img, x, y, drawW, drawH);
  targetCtx.restore();
}

/**
 * Export a PNG of the composite preview (body + wheels).
 */
function exportCompositePNG() {
  const png = getCompositeDataURL();
  const a = document.createElement("a");
  a.href = png;
  a.download = "crazyraces_car_preview.png";
  a.click();
}

/**
 * Composite renderer:
 * - always renders:
 *    1) grid background
 *    2) bodyArt
 *    3) placed wheels
 *    4) selection highlight (placement tab only)
 */
function renderBodyComposite() {
  // Background/grid
  drawSubtleGrid(bodyCtx, BODY_W, BODY_H);

  // Body art layer
  bodyCtx.drawImage(bodyArtCanvas, 0, 0);

  // Wheels
  for (let i = 0; i < placedWheels.length; i++) {
    const w = placedWheels[i];

    bodyCtx.save();
    bodyCtx.translate(w.x, w.y);
    bodyCtx.rotate(w.rotationRad);
    bodyCtx.scale(w.scale, w.scale);

    // Draw wheel art centered
    bodyCtx.drawImage(wheelArtCanvas, -WHEEL_W / 2, -WHEEL_H / 2, WHEEL_W, WHEEL_H);

    // Selection highlight
    if (currentTab === "placement" && i === selectedWheelIndex) {
      bodyCtx.lineWidth = 3;
      bodyCtx.strokeStyle = "#ED4D2E"; // orange highlight
      bodyCtx.strokeRect(-WHEEL_W / 2, -WHEEL_H / 2, WHEEL_W, WHEEL_H);
    }

    bodyCtx.restore();
  }
}

/**
 * Wheel editor renderer:
 * - subtle background
 * - wheelArt
 */
function renderWheelEditor() {
  // light background
  wheelCtx.save();
  wheelCtx.clearRect(0, 0, WHEEL_W, WHEEL_H);

  // faint “target” to suggest centering
  wheelCtx.globalAlpha = 0.08;
  wheelCtx.fillStyle = "#224C8F";
  wheelCtx.beginPath();
  wheelCtx.arc(WHEEL_W / 2, WHEEL_H / 2, 90, 0, 2 * Math.PI);
  wheelCtx.fill();
  wheelCtx.restore();

  // wheel art on top
  wheelCtx.drawImage(wheelArtCanvas, 0, 0);
}

/**
 * Preview canvas: shows a scaled composite (like a thumbnail).
 */
function renderPreview() {
  previewCtx.clearRect(0, 0, ui.previewCanvas.width, ui.previewCanvas.height);

  // Build a temporary offscreen composite for export/preview
  const composite = document.createElement("canvas");
  composite.width = BODY_W;
  composite.height = BODY_H;
  const cctx = composite.getContext("2d");

  drawSubtleGrid(cctx, BODY_W, BODY_H);
  cctx.drawImage(bodyArtCanvas, 0, 0);

  for (const w of placedWheels) {
    cctx.save();
    cctx.translate(w.x, w.y);
    cctx.rotate(w.rotationRad);
    cctx.scale(w.scale, w.scale);
    cctx.drawImage(wheelArtCanvas, -WHEEL_W / 2, -WHEEL_H / 2);
    cctx.restore();
  }

  // Fit composite into preview canvas (preserve aspect)
  const pw = ui.previewCanvas.width;
  const ph = ui.previewCanvas.height;
  const scale = Math.min(pw / BODY_W, ph / BODY_H);

  const dw = BODY_W * scale;
  const dh = BODY_H * scale;
  const dx = (pw - dw) / 2;
  const dy = (ph - dh) / 2;

  previewCtx.drawImage(composite, dx, dy, dw, dh);
}

/**
 * Convenience: composite DataURL (for export OR submission preview)
 */
function getCompositeDataURL() {
  const composite = document.createElement("canvas");
  composite.width = BODY_W;
  composite.height = BODY_H;
  const cctx = composite.getContext("2d");

  // White bg (race engine-friendly)
  cctx.fillStyle = "#ffffff";
  cctx.fillRect(0, 0, BODY_W, BODY_H);

  cctx.drawImage(bodyArtCanvas, 0, 0);
  for (const w of placedWheels) {
    cctx.save();
    cctx.translate(w.x, w.y);
    cctx.rotate(w.rotationRad);
    cctx.scale(w.scale, w.scale);
    cctx.drawImage(wheelArtCanvas, -WHEEL_W / 2, -WHEEL_H / 2);
    cctx.restore();
  }

  return composite.toDataURL("image/png");
}

/**
 * Update wheel UI text and controls based on selection.
 */
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

/**
 * Switch tab UI + canvas visibility + titles.
 */
function setTab(tabName) {
  currentTab = tabName;

  // Buttons + panels
  for (const t of Object.keys(ui.tabs)) {
    const active = t === tabName;
    ui.tabs[t].classList.toggle("active", active);
    ui.tabs[t].setAttribute("aria-selected", String(active));
    ui.panels[t].classList.toggle("active", active);
  }

  // Canvas visibility:
  // - body canvas shown in body + placement (and also in other tabs as context)
  // - wheel canvas shown ONLY in wheel tab
  ui.wheelCanvas.style.display = (tabName === "wheel") ? "block" : "none";

  // Update workspace labels for clarity
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
    ui.canvasSubtitle.textContent = "Draw or upload the car body";
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

  // Render the correct canvases
  renderAll();
}

/**
 * Render everything.
 */
function renderAll() {
  renderBodyComposite();
  renderWheelEditor();
  renderPreview();
  refreshWheelUI();
}

/**
 * Ensure we start with at least one undo snapshot (so undo works).
 */
function initUndoStacks() {
  // Start clean + snapshot
  bodyArtCtx.clearRect(0, 0, BODY_W, BODY_H);
  wheelArtCtx.clearRect(0, 0, WHEEL_W, WHEEL_H);
  pushBodyUndoSnapshot();
  pushWheelUndoSnapshot();
}

/**
 * Center body art:
 * For now, “center body” means: put the body art bitmap centered by moving pixels.
 * This is a very lightweight approach.
 *
 * (Later we can support “select/move body layer” properly; this is good enough for v1.)
 */
function centerBodyArt() {
  // Extract current pixels
  const img = bodyArtCtx.getImageData(0, 0, BODY_W, BODY_H);

  // Find bounding box of non-transparent pixels
  let minX = BODY_W, minY = BODY_H, maxX = 0, maxY = 0;
  let found = false;

  const data = img.data;
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

  // Create temp canvas containing just the box
  const temp = document.createElement("canvas");
  temp.width = boxW;
  temp.height = boxH;
  const tctx = temp.getContext("2d");

  // Copy pixels
  const box = bodyArtCtx.getImageData(minX, minY, boxW, boxH);
  tctx.putImageData(box, 0, 0);

  // Clear and paste centered
  bodyArtCtx.clearRect(0, 0, BODY_W, BODY_H);
  const dx = Math.round((BODY_W - boxW) / 2);
  const dy = Math.round((BODY_H - boxH) / 2);
  bodyArtCtx.drawImage(temp, dx, dy);

  pushBodyUndoSnapshot();
  renderAll();
  setStatus("Body centered");
}

// ============================
// TAB WIRING
// ============================
ui.tabs.body.onclick = () => setTab("body");
ui.tabs.wheel.onclick = () => setTab("wheel");
ui.tabs.placement.onclick = () => setTab("placement");
ui.tabs.properties.onclick = () => setTab("properties");
ui.tabs.submit.onclick = () => setTab("submit");

// ============================
// TOOL BUTTONS
// ============================

// Body tool buttons
ui.bodyPenBtn.onclick = () => {
  currentTool = "pen";
  currentPenColor = ui.bodyColor.value;
  setStatus("Body pen tool");
};
ui.bodyMoveBtn.onclick = () => {
  currentTool = "move";
  setStatus("Body move/inspect (v1)");
};

// Wheel tool buttons
ui.wheelPenBtn.onclick = () => {
  currentTool = "pen";
  currentPenColor = ui.wheelColor.value;
  setStatus("Wheel pen tool");
};
ui.wheelMoveBtn.onclick = () => {
  currentTool = "move";
  setStatus("Wheel move/inspect (v1)");
};

// Pen colour changes
ui.bodyColor.oninput = () => { if (currentTab === "body") currentPenColor = ui.bodyColor.value; };
ui.wheelColor.oninput = () => { if (currentTab === "wheel") currentPenColor = ui.wheelColor.value; };

// Workspace buttons
ui.centerBodyBtn.onclick = centerBodyArt;
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
      renderAll();
      setStatus("Body image uploaded");
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);

  // allow re-uploading same file without needing to change name
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

// Body
ui.bodyUndoBtn.onclick = () => { undoCanvas(bodyUndo, bodyRedo, bodyArtCtx, BODY_W, BODY_H); renderAll(); };
ui.bodyRedoBtn.onclick = () => { redoCanvas(bodyUndo, bodyRedo, bodyArtCtx); renderAll(); };
ui.bodyClearBtn.onclick = () => {
  clearArtCanvas(bodyArtCtx, BODY_W, BODY_H, pushBodyUndoSnapshot);
  renderAll();
  setStatus("Body cleared");
};

// Wheel
ui.wheelUndoBtn.onclick = () => {
  undoCanvas(wheelUndo, wheelRedo, wheelArtCtx, WHEEL_W, WHEEL_H);
  // Recompute hasWheelArt very roughly:
  // If we undo back to first snapshot (empty), this becomes false.
  // We’ll just set true if there is at least 2 snapshots (likely drawn/uploaded).
  hasWheelArt = wheelUndo.length > 1;
  renderAll();
};
ui.wheelRedoBtn.onclick = () => { redoCanvas(wheelUndo, wheelRedo, wheelArtCtx); hasWheelArt = true; renderAll(); };
ui.wheelClearBtn.onclick = () => {
  clearArtCanvas(wheelArtCtx, WHEEL_W, WHEEL_H, pushWheelUndoSnapshot);
  hasWheelArt = false;
  renderAll();
  setStatus("Wheel cleared");
};

// ============================
// BODY CANVAS POINTER EVENTS
// ============================

/**
 * bodyCanvas serves two roles:
 * - Body tab: draw strokes onto bodyArt (commit on pointerup)
 * - Placement tab: select/drag wheels
 */
ui.bodyCanvas.onpointerdown = (e) => {
  const pos = getCanvasPos(ui.bodyCanvas, e);

  // Placement tab: selection/drag
  if (currentTab === "placement") {
    selectedWheelIndex = -1;

    // Find top-most wheel under pointer (iterate backwards)
    for (let i = placedWheels.length - 1; i >= 0; i--) {
      if (hitTestWheel(pos, placedWheels[i])) {
        selectedWheelIndex = i;
        break;
      }
    }

    // If selected, store drag offset
    const w = getSelectedWheel();
    if (w) {
      w.dragOffsetX = pos.x - w.x;
      w.dragOffsetY = pos.y - w.y;
      w.isDragging = true;
      setStatus(`Selected wheel #${selectedWheelIndex + 1}`);
    } else {
      setStatus("No wheel selected");
    }

    renderAll();
    return;
  }

  // Body tab drawing
  if (currentTab === "body" && currentTool === "pen") {
    isDrawing = true;
    currentPenColor = ui.bodyColor.value;
    strokePoints = [pos];
    ui.bodyCanvas.setPointerCapture(e.pointerId);
    return;
  }

  // In other tabs, we ignore pointerdown
};

ui.bodyCanvas.onpointermove = (e) => {
  const pos = getCanvasPos(ui.bodyCanvas, e);

  // Placement: drag selected wheel
  if (currentTab === "placement") {
    const w = getSelectedWheel();
    if (w && w.isDragging) {
      w.x = clamp(pos.x - w.dragOffsetX, 0, BODY_W);
      w.y = clamp(pos.y - w.dragOffsetY, 0, BODY_H);
      renderAll();
    }
    return;
  }

  // Body drawing preview
  if (currentTab === "body" && isDrawing && currentTool === "pen") {
    strokePoints.push(pos);

    // Render composite then overlay stroke preview
    renderBodyComposite();
    strokePreview(bodyCtx, strokePoints, currentPenColor, BODY_PEN_WIDTH);

    // Preview still updates thumbnail
    renderPreview();
  }
};

ui.bodyCanvas.onpointerup = (e) => {
  // Placement: stop dragging
  if (currentTab === "placement") {
    const w = getSelectedWheel();
    if (w) w.isDragging = false;
    return;
  }

  // Body drawing commit
  if (currentTab === "body" && isDrawing && currentTool === "pen") {
    isDrawing = false;
    // Commit stroke to body art
    commitStroke(bodyArtCtx, strokePoints, currentPenColor, BODY_PEN_WIDTH);
    pushBodyUndoSnapshot();
    strokePoints = [];
    renderAll();
    setStatus("Body stroke added");
  }
};

// ============================
// WHEEL CANVAS POINTER EVENTS
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

  // Commit to wheel art
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
    // Offset the duplicate slightly so you can see it
    x: clamp(w.x + 30, 0, BODY_W),
    y: clamp(w.y + 20, 0, BODY_H),
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

// Scale/rotation sliders operate on the *selected* wheel
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

let lastChanged = "acc"; // track which slider was touched last for nicer constraint handling

function updateCreditsUI() {
  const acc = parseInt(ui.accSlider.value, 10);
  const spd = parseInt(ui.speedSlider.value, 10);
  const remaining = TOTAL_CREDITS - (acc + spd);

  ui.accVal.textContent = String(acc);
  ui.speedVal.textContent = String(spd);
  ui.pointsRemaining.textContent = String(remaining);

  // Friendly hint text
  if (remaining === 0) {
    ui.creditsHelp.textContent = "Perfect — you can submit";
  } else if (remaining > 0) {
    ui.creditsHelp.textContent = "Allocate all credits to submit";
  } else {
    ui.creditsHelp.textContent = "Over budget — adjust sliders";
  }
}

/**
 * Enforce acc + speed <= 100.
 * If the user pushes one slider too high, we automatically reduce the other.
 */
function enforceCreditConstraint(changed) {
  lastChanged = changed;

  let acc = parseInt(ui.accSlider.value, 10);
  let spd = parseInt(ui.speedSlider.value, 10);

  const total = acc + spd;
  if (total <= TOTAL_CREDITS) {
    updateCreditsUI();
    return;
  }

  // Need to reduce the other slider
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

/**
 * Gather payload for API.
 * We send:
 * - teamName, carName, email
 * - acceleration, topSpeed (credits)
 * - bodyImageData: PNG of body ONLY (no wheels)
 * - wheelImageData: PNG of wheel ONLY
 * - wheelPositions: array of transforms for each placed wheel
 * - previewComposite: PNG of body+wheels (optional convenience)
 */
async function submitCar() {
  // Basic validation
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

  // Ensure user has created something
  if (!hasWheelArt) {
    alert("Please create a wheel (Step 2) before submitting.");
    return;
  }

  // Export images from OFFSCREEN art canvases (not the UI canvas)
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
      teamName,
      carName,
      email,
      acceleration: acc,
      topSpeed: spd,

      // artwork
      bodyImageData,
      wheelImageData,

      // transforms
      wheelPositions,

      // optional (handy for debugging or a gallery view)
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
// INITIALISATION
// ============================
function init() {
  initUndoStacks();

  // Start with balanced credits
  updateCreditsUI();

  // Start on body tab, pen tool
  currentPenColor = ui.bodyColor.value;
  currentTool = "pen";
  setTab("body");
  renderAll();
}

init();
