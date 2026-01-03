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
let penPoints = [];

// ====================
// BODY DRAW / UPLOAD
// ====================
document.getElementById('bodyColor').onchange = (e)=>{currentColor=e.target.value;};
document.getElementById('drawBodyBtn').onclick = ()=>{currentTab='body'; currentTool='bodyPen';};
let currentTool = null;

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
      wheelElement = {img, x:128, y:128, width:img.width, height:img.height, scale:1};
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
// BODY CANVAS DRAW
// ====================
function drawBodyCanvas(){
  bodyCtx.clearRect(0,0,1024,768);
  bodyElements.forEach(el=>{
    if(el.type==='image') bodyCtx.drawImage(el.img, el.x, el.y, el.width, el.height);
    if(el.type==='path'){
      bodyCtx.strokeStyle=el.color;
      bodyCtx.lineWidth=2;
      bodyCtx.beginPath();
      el.points.forEach((p,i)=>{
        if(i===0) bodyCtx.moveTo(p.x,p.y);
        else bodyCtx.lineTo(p.x,p.y);
      });
      bodyCtx.stroke();
    }
  });
  // Draw wheels on placement tab
  if(currentTab==='placement'){
    placedWheels.forEach(w=>{
      bodyCtx.drawImage(w.img,w.x-w.width/2,w.y-w.height/2,w.width*w.scale,w.height*w.scale);
    });
  }
}

// ====================
// WHEEL CANVAS DRAW
// ====================
function drawWheelCanvas(){
  wheelCtx.clearRect(0,0,256,256);
  wheelCtx.fillStyle='rgba(200,200,200,0.5)';
  wheelCtx.beginPath();
  wheelCtx.arc(128,128,64,0,2*Math.PI);
  wheelCtx.fill();
  if(wheelElement){
    wheelCtx.drawImage(wheelElement.img,wheelElement.x-wheelElement.width/2,wheelElement.y-wheelElement.height/2,
      wheelElement.width*wheelElement.scale,wheelElement.height*wheelElement.scale);
  }
}

// ====================
// CANVAS INTERACTION
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
    const pos = getMousePos(bodyCanvas,e);
    penPoints=[pos];
  }
};
bodyCanvas.onpointermove = function(e){
  if(drawing && currentTool==='bodyPen'){
    const pos = getMousePos(bodyCanvas,e);
    penPoints.push(pos);
    drawBodyCanvas();
    // draw current line
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

// TODO: Add drag/scale for images and wheels (next step)

// ====================
// PLACEMENT TAB
// ====================
document.getElementById('addWheelBtn').onclick = ()=>{
  if(!wheelElement) return alert("Upload wheel first!");
  placedWheels.push({img:wheelElement.img,x:200,y:400,width:wheelElement.width,height:wheelElement.height,scale:wheelElement.scale});
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
    scale:w.scale
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
