// ====================
// CANVASES
// ====================
const bodyCanvas = document.getElementById('bodyCanvas');
const bodyCtx = bodyCanvas.getContext('2d');

const wheelCanvas = document.getElementById('wheelCanvas');
const wheelCtx = wheelCanvas.getContext('2d');

// ====================
// TABS
// ====================
let currentTab = 'body';
const tabs = ['body','wheel','placement','properties','submit'];
tabs.forEach(tab=>{
  document.getElementById(tab+'Tab').onclick = ()=>{
    currentTab=tab;
    tabs.forEach(t=>{
      document.getElementById(t+'Tab').classList.toggle('active', t===tab);
      document.getElementById(t+'Controls').classList.toggle('active', t===tab);
    });
    bodyCanvas.style.display=(currentTab==='body' || currentTab==='placement')?'block':'none';
    wheelCanvas.style.display=(currentTab==='wheel')?'block':'none';
    drawBodyCanvas();
    drawWheelCanvas();
  };
});

// ====================
// DATA
// ====================
let bodyElements = [];
let wheelElement = null;
let placedWheels = [];
let drawing = false;
let currentColor = '#000000';
let currentTool = null;
let penPoints = [];

let undoStackBody=[], redoStackBody=[];
let undoStackWheel=[], redoStackWheel=[];

let selectedWheel = null;
let offsetX=0, offsetY=0, isDragging=false;
let isScaling=false, isRotating=false;
const handleSize = 10;

// ====================
// BODY DRAW / UPLOAD
// ====================
document.getElementById('bodyColor').onchange = e=>{currentColor=e.target.value;};
document.getElementById('drawBodyBtn').onclick = ()=>{currentTool='bodyPen';};

document.getElementById('uploadBody').onchange = function(e){
  if(!this.files.length) return;
  const reader = new FileReader();
  reader.onload=function(ev){
    const img = new Image();
    img.onload = ()=>{
      bodyElements.push({type:'image', img, x:bodyCanvas.width/2, y:bodyCanvas.height/2, width:img.width, height:img.height, scale:1, rotation:0});
      undoStackBody.push(JSON.stringify(bodyElements));
      drawBodyCanvas();
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(this.files[0]);
};
document.getElementById('clearBodyBtn').onclick = ()=>{
  bodyElements=[]; undoStackBody.push(JSON.stringify(bodyElements)); drawBodyCanvas();
};
document.getElementById('undoBodyBtn').onclick = ()=>{
  if(!undoStackBody.length) return;
  redoStackBody.push(JSON.stringify(bodyElements));
  bodyElements = JSON.parse(undoStackBody.pop());
  drawBodyCanvas();
};

// ====================
// WHEEL DRAW / UPLOAD
// ====================
document.getElementById('wheelColor').onchange = e=>{currentColor=e.target.value;};
document.getElementById('drawWheelBtn').onclick = ()=>{currentTool='wheelPen';};

document.getElementById('uploadWheel').onchange = function(e){
  if(!this.files.length) return;
  const reader = new FileReader();
  reader.onload=function(ev){
    const img = new Image();
    img.onload = ()=>{
      wheelElement = {type:'image', img, x:wheelCanvas.width/2, y:wheelCanvas.height/2, width:img.width, height:img.height, scale:1, rotation:0};
      undoStackWheel.push(JSON.stringify(wheelElement));
      drawWheelCanvas();
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(this.files[0]);
};
document.getElementById('clearWheelBtn').onclick = ()=>{
  wheelElement=null; undoStackWheel.push(JSON.stringify(wheelElement)); drawWheelCanvas();
};
document.getElementById('undoWheelBtn').onclick = ()=>{
  if(!undoStackWheel.length) return;
  redoStackWheel.push(JSON.stringify(wheelElement));
  wheelElement = JSON.parse(undoStackWheel.pop());
  drawWheelCanvas();
};

// ====================
// DRAWING FUNCTIONS
// ====================
function drawBodyCanvas(){
  bodyCtx.clearRect(0,0,bodyCanvas.width,bodyCanvas.height);
  bodyElements.forEach(el=>{
    bodyCtx.save();
    bodyCtx.translate(el.x,el.y);
    bodyCtx.rotate(el.rotation||0);
    if(el.type==='image') bodyCtx.drawImage(el.img,-el.width/2,-el.height/2,el.width*el.scale,el.height*el.scale);
    if(el.type==='path'){
      bodyCtx.strokeStyle=el.color;
      bodyCtx.lineWidth=2;
      bodyCtx.beginPath();
      el.points.forEach((p,i)=> i===0 ? bodyCtx.moveTo(p.x,p.y) : bodyCtx.lineTo(p.x,p.y));
      bodyCtx.stroke();
    }
    bodyCtx.restore();
  });
  // Draw wheels
  placedWheels.forEach(w=>{
    bodyCtx.save();
    bodyCtx.translate(w.x,w.y);
    bodyCtx.rotate(w.rotation);
    bodyCtx.drawImage(w.img,-w.width/2,-w.height/2,w.width*w.scale,w.height*w.scale);
    if(w===selectedWheel){
      bodyCtx.strokeStyle='red';
      bodyCtx.lineWidth=2;
      bodyCtx.strokeRect(-w.width*w.scale/2,-w.height*w.scale/2,w.width*w.scale,w.height*w.scale);
      drawHandles(w);
    }
    bodyCtx.restore();
  });
}

function drawWheelCanvas(){
  wheelCtx.clearRect(0,0,wheelCanvas.width,wheelCanvas.height);
  wheelCtx.fillStyle='rgba(200,200,200,0.5)';
  wheelCtx.beginPath();
  wheelCtx.arc(wheelCanvas.width/2,wheelCanvas.height/2,64,0,2*Math.PI);
  wheelCtx.fill();
  if(wheelElement){
    wheelCtx.save();
    wheelCtx.translate(wheelElement.x,wheelElement.y);
    wheelCtx.rotate(wheelElement.rotation||0);
    wheelCtx.drawImage(wheelElement.img,-wheelElement.width/2,-wheelElement.height/2,wheelElement.width*wheelElement.scale,wheelElement.height*wheelElement.scale);
    wheelCtx.restore();
  }
}

function drawHandles(wheel){
  const s = handleSize;
  const halfW = wheel.width*wheel.scale/2;
  const halfH = wheel.height*wheel.scale/2;
  // Draw 4 corner handles
  bodyCtx.fillStyle='blue';
  bodyCtx.fillRect(-halfW-s/2,-halfH-s/2,s,s);
  bodyCtx.fillRect(halfW-s/2,-halfH-s/2,s,s);
  bodyCtx.fillRect(-halfW-s/2,halfH-s/2,s,s);
  bodyCtx.fillRect(halfW-s/2,halfH-s/2,s,s);
}

// ====================
// POINTER HELPERS
// ====================
function getMousePos(canvas, evt){
  const rect = canvas.getBoundingClientRect();
  return { x:(evt.clientX-rect.left)*(canvas.width/rect.width), y:(evt.clientY-rect.top)*(canvas.height/rect.height) };
}

// ====================
// BODY CANVAS EVENTS (DRAW + PLACEMENT)
// ====================
bodyCanvas.onpointerdown = function(e){
  const pos = getMousePos(bodyCanvas,e);
  if(currentTool==='bodyPen'){
    drawing=true; penPoints=[pos];
  } else if(currentTab==='placement'){
    selectedWheel=null;
    for(let i=placedWheels.length-1;i>=0;i--){
      const w=placedWheels[i];
      const dx=pos.x-w.x, dy=pos.y-w.y;
      if(Math.hypot(dx,dy)<Math.max(w.width*w.scale,w.height*w.scale)/2){
        selectedWheel=w; offsetX=dx; offsetY=dy; isDragging=true; break;
      }
    }
    drawBodyCanvas();
  }
};
bodyCanvas.onpointermove = function(e){
  const pos = getMousePos(bodyCanvas,e);
  if(drawing && currentTool==='bodyPen'){
    penPoints.push(pos);
    drawBodyCanvas();
    bodyCtx.strokeStyle=currentColor; bodyCtx.lineWidth=2;
    bodyCtx.beginPath();
    penPoints.forEach((p,i)=> i===0 ? bodyCtx.moveTo(p.x,p.y) : bodyCtx.lineTo(p.x,p.y));
    bodyCtx.stroke();
  } else if(isDragging && selectedWheel){
    selectedWheel.x = pos.x-offsetX;
    selectedWheel.y = pos.y-offsetY;
    drawBodyCanvas();
  }
};
bodyCanvas.onpointerup = function(e){
  if(drawing && currentTool==='bodyPen'){
    bodyElements.push({type:'path', points:penPoints, color:currentColor});
    undoStackBody.push(JSON.stringify(bodyElements));
    drawing=false; penPoints=[];
  }
  isDragging=false; selectedWheel=null;
};

// ====================
// WHEEL CANVAS EVENTS
// ====================
wheelCanvas.onpointerdown = function(e){
  const pos = getMousePos(wheelCanvas,e);
  if(currentTool==='wheelPen'){
    drawing=true; penPoints=[pos];
  } else if(wheelElement){
    const dx=pos.x-wheelElement.x, dy=pos.y-wheelElement.y;
    if(Math.hypot(dx,dy)<Math.max(wheelElement.width,wheelElement.height)/2){
      selectedWheel=wheelElement; offsetX=dx; offsetY=dy; isDragging=true;
    }
  }
};
wheelCanvas.onpointermove = function(e){
  const pos = getMousePos(wheelCanvas,e);
  if(drawing && currentTool==='wheelPen'){
    penPoints.push(pos);
    drawWheelCanvas();
    wheelCtx.strokeStyle=currentColor; wheelCtx.lineWidth=2;
    wheelCtx.beginPath();
    penPoints.forEach((p,i)=> i===0 ? wheelCtx.moveTo(p.x,p.y) : wheelCtx.lineTo(p.x,p.y));
    wheelCtx.stroke();
  } else if(isDragging && selectedWheel){
    selectedWheel.x=pos.x-offsetX;
    selectedWheel.y=pos.y-offsetY;
    drawWheelCanvas();
  }
};
wheelCanvas.onpointerup = function(e){
  if(drawing && currentTool==='wheelPen'){
    wheelElement={type:'path', points:penPoints, color:currentColor, ...wheelElement};
    undoStackWheel.push(JSON.stringify(wheelElement));
    drawing=false; penPoints=[];
  }
  isDragging=false; selectedWheel=null;
};

// ====================
// PLACEMENT TAB BUTTONS
// ====================
document.getElementById('addWheelBtn').onclick = ()=>{
  if(!wheelElement) return alert("Upload or draw wheel first!");
  placedWheels.push({...wheelElement,x:bodyCanvas.width/2, y:bodyCanvas.height/2, scale:1, rotation:0});
  drawBodyCanvas();
};
document.getElementById('deleteWheelBtn').onclick = ()=>{
  if(selectedWheel){
    const idx=placedWheels.indexOf(selectedWheel);
    if(idx>=0) placedWheels.splice(idx,1);
    selectedWheel=null;
    drawBodyCanvas();
  }
};

// ====================
// PROPERTIES
// ====================
const accSlider=document.getElementById('acceleration');
const speedSlider=document.getElementById('topSpeed');
const accVal=document.getElementById('accVal');
const speedVal=document.getElementById('speedVal');
const pointsRemaining=document.getElementById('pointsRemaining');
function updatePoints(){
  const total=parseInt(accSlider.value)+parseInt(speedSlider.value);
  pointsRemaining.textContent=100-total;
}
accSlider.oninput=()=>{accVal.textContent=accSlider.value; updatePoints();}
speedSlider.oninput=()=>{speedVal.textContent=speedSlider.value; updatePoints();}
updatePoints();

// ====================
// SUBMIT
// ====================
document.getElementById('submitBtn').onclick=async function(){
  const carName=document.getElementById('carName').value.trim();
  const teamName=document.getElementById('teamName').value.trim();
  const email=document.getElementById('email').value.trim();
  if(!carName||!teamName||!email){ alert("Fill all fields"); return; }

  const bodyDataURL = bodyCanvas.toDataURL('image/png');
  const wheelDataURL = wheelCanvas.toDataURL('image/png');

  const wheelPositions = placedWheels.map((w,i)=>({
    wheelId:i, x:w.x, y:w.y, scale:w.scale, rotation:w.rotation
  }));

  const payload = {
    carData:{
      carName, teamName, email,
      acceleration: parseInt(accSlider.value),
      topSpeed: parseInt(speedSlider.value),
      carImageData: bodyDataURL,
      wheelImageData:wheelDataURL,
      wheelPositions
    }
  };

  try{
    const resp = await fetch('/api/submit-car',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify(payload)
    });
    document.getElementById('submitStatus').textContent = resp.ok ? "Submission successful!" : "Submission failed!";
  } catch(e){
    document.getElementById('submitStatus').textContent = "Submission failed!";
  }
};
