// ====================
// CANVAS SETUP
// ====================
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

let currentTab = 'body';
let drawing = false;
let erasing = false;
let brushSize = 4;
let brushColor = '#000000';

let bodyElements = [];
let wheelElements = [];

let currentPath = [];

// ====================
// TAB SWITCH
// ====================
document.getElementById('bodyTab').onclick = () => switchTab('body');
document.getElementById('wheelTab').onclick = () => switchTab('wheel');

function switchTab(tab) {
  currentTab = tab;
  document.getElementById('bodyTab').classList.toggle('active', tab==='body');
  document.getElementById('wheelTab').classList.toggle('active', tab==='wheel');
  redrawCanvas();
}

// ====================
// TOOL CONTROLS
// ====================
document.getElementById('drawBtn').onclick = () => erasing=false;
document.getElementById('eraseBtn').onclick = () => erasing=true;
document.getElementById('brushSize').oninput = function(){ brushSize = parseInt(this.value,10); };
document.getElementById('color').oninput = function(){ brushColor = this.value; };
document.getElementById('clearBtn').onclick = function() {
  if(currentTab==='body') bodyElements=[]; else wheelElements=[];
  redrawCanvas();
};

// ====================
// DRAWING LOGIC
// ====================
canvas.addEventListener('pointerdown', e=>{
  drawing=true;
  currentPath = [{x:e.offsetX, y:e.offsetY}];
});
canvas.addEventListener('pointermove', e=>{
  if(!drawing) return;
  const point = {x:e.offsetX, y:e.offsetY};
  currentPath.push(point);
  drawLineSegment(currentPath[currentPath.length-2], point);
});
canvas.addEventListener('pointerup', e=>{
  drawing=false;
  if(currentPath.length>1){
    const element = {type:'path', color:brushColor, size:brushSize, path:currentPath};
    if(currentTab==='body') bodyElements.push(element);
    else wheelElements.push(element);
  }
  currentPath=[];
});

function drawLineSegment(p1, p2){
  ctx.strokeStyle = erasing ? '#fff' : brushColor;
  ctx.lineWidth = brushSize;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(p1.x,p1.y);
  ctx.lineTo(p2.x,p2.y);
  ctx.stroke();
}

// ====================
// IMAGE UPLOAD
// ====================
document.getElementById('upload').onchange = function(e){
  if(!this.files.length) return;
  const file = this.files[0];
  const reader = new FileReader();
  reader.onload = function(ev){
    const img = new Image();
    img.onload = function(){
      const element = {type:'image', image:img, x:100, y:100, width:img.width, height:img.height};
      if(currentTab==='body') bodyElements.push(element);
      else wheelElements.push(element);
      redrawCanvas();
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
};

// ====================
// REDRAW CANVAS
// ====================
function redrawCanvas(){
  ctx.clearRect(0,0,canvas.width,canvas.height);

  bodyElements.forEach(el=>drawElement(el));
  wheelElements.forEach(el=>drawElement(el));
}

function drawElement(el){
  if(el.type==='path'){
    ctx.strokeStyle=el.color;
    ctx.lineWidth=el.size;
    ctx.lineCap='round';
    ctx.beginPath();
    ctx.moveTo(el.path[0].x, el.path[0].y);
    for(let i=1;i<el.path.length;i++){
      ctx.lineTo(el.path[i].x, el.path[i].y);
    }
    ctx.stroke();
  } else if(el.type==='image'){
    ctx.drawImage(el.image, el.x, el.y, el.width, el.height);
  }
}

// ====================
// PROPERTIES
// ====================
const accSlider = document.getElementById('acceleration');
const speedSlider = document.getElementById('topSpeed');
const accVal = document.getElementById('accVal');
const speedVal = document.getElementById('speedVal');
const pointsRemaining = document.getElementById('pointsRemaining');

function updatePoints(){
  const total = parseInt(accSlider.value)+parseInt(speedSlider.value);
  pointsRemaining.textContent = 100-total;
}
accSlider.oninput = ()=>{ accVal.textContent = accSlider.value; updatePoints(); };
speedSlider.oninput = ()=>{ speedVal.textContent = speedSlider.value; updatePoints(); };
updatePoints();

// ====================
// SUBMIT
// ====================
document.getElementById('submitBtn').onclick = async function(){
  const carName = document.getElementById('carName').value.trim();
  const teamName = document.getElementById('teamName').value.trim();
  const email = document.getElementById('email').value.trim();

  if(!carName || !teamName || !email){ alert('Fill Car Name, Team Name, Email'); return; }

  // Export canvas for body and wheel separately
  let bodyCanvas = document.createElement('canvas');
  bodyCanvas.width = canvas.width; bodyCanvas.height = canvas.height;
  let bodyCtx = bodyCanvas.getContext('2d');
  bodyElements.forEach(el=>{
    if(el.type==='path'){
      bodyCtx.strokeStyle = el.color;
      bodyCtx.lineWidth = el.size;
      bodyCtx.lineCap='round';
      bodyCtx.beginPath();
      bodyCtx.moveTo(el.path[0].x,el.path[0].y);
      for(let i=1;i<el.path.length;i++) bodyCtx.lineTo(el.path[i].x,el.path[i].y);
      bodyCtx.stroke();
    } else if(el.type==='image'){
      bodyCtx.drawImage(el.image,el.x,el.y,el.width,el.height);
    }
  });

  let wheelCanvas = document.createElement('canvas');
  wheelCanvas.width = canvas.width; wheelCanvas.height = canvas.height;
  let wheelCtx = wheelCanvas.getContext('2d');
  wheelElements.forEach(el=>{
    if(el.type==='path'){
      wheelCtx.strokeStyle = el.color;
      wheelCtx.lineWidth = el.size;
      wheelCtx.lineCap='round';
      wheelCtx.beginPath();
      wheelCtx.moveTo(el.path[0].x,el.path[0].y);
      for(let i=1;i<el.path.length;i++) wheelCtx.lineTo(el.path[i].x,el.path[i].y);
      wheelCtx.stroke();
    } else if(el.type==='image'){
      wheelCtx.drawImage(el.image,el.x,el.y,el.width,el.height);
    }
  });

  const payload = {
    carData:{
      carName, teamName, email,
      acceleration: parseInt(accSlider.value),
      topSpeed: parseInt(speedSlider.value),
      carImageData: bodyCanvas.toDataURL('image/png'),
      wheelImageData: wheelCanvas.toDataURL('image/png')
    }
  };

  try{
    const resp = await fetch('/api/submit-car',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify(payload)
    });
    if(resp.ok) document.getElementById('submitStatus').textContent='Submission successful!';
    else document.getElementById('submitStatus').textContent='Submission failed!';
  } catch(e){
    document.getElementById('submitStatus').textContent='Submission failed!';
  }
};
