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

// ====================
// BODY DRAW / UPLOAD
// ====================
document.getElementById('bodyColor').onchange = (e)=>{currentColor=e.target.value;};
document.getElementById('drawBodyBtn').onclick = ()=>{currentTab='body'; currentTool='bodyPen';};

document.getElementById('uploadBody').onchange = function(e){
  if(!this.files.length) return;
  const reader = new FileReader();
  reader.onload=function(ev){
    const img = new Image();
    img.onload = ()=>{
      bodyElements.push({type:'image', img, x:100, y:100, width:img.width, height:img.height});
      drawBodyCanvas();
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(this.files[0]);
};
document.getElementById('clearBodyBtn').onclick = ()=>{
  bodyElements = [];
  drawBodyCanvas();
};

// ====================
// WHEEL DRAW / UPLOAD
// ====================
document.getElementById('wheelColor').onchange = (e)=>{currentColor=e.target.value;};
document.getElementById('drawWheelBtn').onclick = ()=>{currentTab='wheel'; currentTool='wheelPen';};

document.getElementById('uploadWheel').onchange = function(e){
  if(!this.files.length) return;
  const reader = new FileReader();
  reader.onload=function(ev){
    const img = new Image();
    img.onload = ()=>{
      wheelElement = {type:'image', img, x:128, y:128, width:img.width, height:img.height, scale:1, rotation:0};
      drawWheelCanvas();
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(this.files[0]);
};
document.getElementById('clearWheelBtn').onclick = ()=>{
  wheelElement=null;
  drawWheelCanvas();
};

// ====================
// DRAWING FUNCTIONS
// ====================
function drawBodyCanvas(){
  bodyCtx.clearRect(0,0,1024,768);
  bodyElements.forEach(el=>{
    if(el.type==='image'){
      bodyCtx.save();
      bodyCtx.translate(el.x,el.y);
      bodyCtx.drawImage(el.img,-el.width/2,-el.height/2,el.width,el.height);
      bodyCtx.restore();
    }
    if(el.type==='path'){
      bodyCtx.strokeStyle=el.color;
      bodyCtx.lineWidth=2;
      bodyCtx.beginPath();
      el.points.forEach((p,i)=> i===0 ? bodyCtx.moveTo(p.x,p.y) : bodyCtx.lineTo(p.x,p.y));
      bodyCtx.stroke();
    }
  });
  // Draw wheels on placement tab
  if(currentTab==='placement'){
    placedWheels.forEach(w=>{
      bodyCtx.save();
      bodyCtx.translate(w.x,w.y);
      bodyCtx.rotate(w.rotation);
      bodyCtx.drawImage(w.img,-w.width/2,-w.height/2,w.width*w.scale,w.height*w.scale);
      bodyCtx.restore();
    });
  }
}

function drawWheelCanvas(){
  wheelCtx.clearRect(0,0,256,256);
  // placeholder circle
  wheelCtx.fillStyle='rgba(200,200,200,0.5)';
  wheelCtx.beginPath();
  wheelCtx.arc(128,128,64,0,2*Math.PI);
  wheelCtx.fill();
  // wheel image
  if(wheelElement){
    wheelCtx.save();
    wheelCtx.translate(wheelElement.x,wheelElement.y);
    wheelCtx.rotate(wheelElement.rotation||0);
    wheelCtx.drawImage(wheelElement.img,-wheelElement.width/2,-wheelElement.height/2,wheelElement.width*wheelElement.scale,wheelElement.height*wheelElement.scale);
    wheelCtx.restore();
  }
}

// ====================
// POINTER INTERACTIONS
// ====================
function getMousePos(canvas, evt){
  const rect = canvas.getBoundingClientRect();
  return {
    x:(evt.clientX-rect.left)*(canvas.width/rect.width),
    y:(evt.clientY-rect.top)*(canvas.height/rect.height)
  };
}

// BODY DRAWING
bodyCanvas.onpointerdown = function(e){
  if(currentTool==='bodyPen'){
    drawing=true;
    penPoints=[getMousePos(bodyCanvas,e)];
  } else if(currentTab==='placement'){
    // TODO: implement wheel selection/dragging
  }
};
bodyCanvas.onpointermove = function(e){
  if(drawing && currentTool==='bodyPen'){
    penPoints.push(getMousePos(bodyCanvas,e));
    drawBodyCanvas();
    bodyCtx.strokeStyle=currentColor;
    bodyCtx.lineWidth=2;
    bodyCtx.beginPath();
    penPoints.forEach((p,i)=> i===0 ? bodyCtx.moveTo(p.x,p.y) : bodyCtx.lineTo(p.x,p.y));
    bodyCtx.stroke();
  }
};
bodyCanvas.onpointerup = function(e){
  if(drawing && currentTool==='bodyPen'){
    bodyElements.push({type:'path', points:penPoints, color:currentColor});
    drawing=false;
    penPoints=[];
  }
};

// WHEEL DRAWING
wheelCanvas.onpointerdown = function(e){
  if(currentTool==='wheelPen'){
    drawing=true;
    penPoints=[getMousePos(wheelCanvas,e)];
  }
};
wheelCanvas.onpointermove = function(e){
  if(drawing && currentTool==='wheelPen'){
    penPoints.push(getMousePos(wheelCanvas,e));
    drawWheelCanvas();
    wheelCtx.strokeStyle=currentColor;
    wheelCtx.lineWidth=2;
    wheelCtx.beginPath();
    penPoints.forEach((p,i)=> i===0 ? wheelCtx.moveTo(p.x,p.y) : wheelCtx.lineTo(p.x,p.y));
    wheelCtx.stroke();
  }
};
wheelCanvas.onpointerup = function(e){
  if(drawing && currentTool==='wheelPen'){
    wheelElement={type:'path', points:penPoints, color:currentColor, ...wheelElement};
    drawing=false;
    penPoints=[];
  }
};

// ====================
// PLACEMENT TAB
// ====================
document.getElementById('addWheelBtn').onclick = ()=>{
  if(!wheelElement) return alert("Upload or draw wheel first!");
  placedWheels.push({...wheelElement,x:200,y:400,scale:1,rotation:0});
  drawBodyCanvas();
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
    wheelId:i,
    x:w.x,
    y:w.y,
    scale:w.scale,
    rotation:w.rotation
  }));

  const payload = {
    carData:{
      carName, teamName, email,
      acceleration: parseInt(accSlider.value),
      topSpeed: parseInt(speedSlider.value),
      carImageData: bodyDataURL,
      wheelImageData: wheelDataURL,
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
