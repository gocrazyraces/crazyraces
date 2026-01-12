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
  return (d
