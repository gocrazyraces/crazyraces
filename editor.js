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

let bodyElements = []; // paths/images on body
let wheelElements = []; // wheel images
let wheelPlaceholders = []; // {x, y, radius, id}

let currentPath = [];
let selectedElement = null; // for moving images or paths

// ====================
// TAB SWITCH
// ====================
const tabs = ['body','wheel','properties','submit'];
tabs.forEach(tab=>{
  document.getElementById(tab+'Tab').onclick = ()=>{
    currentTab = tab;
    tabs.forEach(t=>{
      document.getElementById(t+'Tab').classList.toggle('active', t===tab);
      document.getElementById(t+'Controls').classList.toggle('active', t===tab);
    });
    redrawCanvas();
  };
});

// ====================
// TOOL CONTROLS
// ====================
document.getElementById('drawBtn').onclick = () => erasing=false;
document.getElementById('eraseBtn').onclick = () => erasing=true;
document.getElementById('brushSize').oninput = function(){ brushSize = parseInt(this.value,10); };
document.getElementById('color').oninput = function(){ brushColor = this.value; };
document.getElementById('clearBtn').onclick = function() {
  if(currentTab==='body') bodyElements=[]; 
  else if(currentTab==='wheel') wheelElements=[]; 
  redrawCanvas();
};

// ====================
// ADD WHEEL PLACEHOLDER
// ====================
document.getElementById('addWheelPlaceholder').onclick = function(){
  canvas.addEventListener('click', addWheelPlaceholderOnce, {once:true});
  alert('Click on canvas to add a wheel placeholder');
};
function addWheelPlaceholderOnce(e){
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  wheelPlaceholders.push({x,y,radius:20,id:Date.now()});
  redrawCanvas();
}

// ====================
// DRAWING LOGIC
// ====================
canvas.addEventListener('pointerdown', e=>{
  if(currentTab==='body'){
    drawing=true;
    currentPath = [{x:e.offsetX, y:e.offsetY}];
  }
});
canvas.addEventListener('pointermove', e=>{
  if(!drawing) return;
  if(currentTab!=='body') return;
  const point = {x:e.offsetX, y:e.offsetY};
  currentPath.push(point);
  drawLineSegment(currentPath[currentPath.length-2], point, brushColor, brushSize);
});
canvas.addEventListener('pointerup', e=>{
  if(drawing && currentTab==='body'){
    drawing=false;
    if(currentPath.length>1){
      bodyElements.push({type:'path', color:brushColor, size:brushSize, path:currentPath});
    }
    currentPath=[];
    redrawCanvas();
  }
});

function drawLineSegment(p1, p2, color, size){
  ctx.strokeStyle = erasing ? '#fff' : color;
  ctx.lineWidth = size;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(p1.x,p1.y);
  ctx.lineTo(p2.x,p2.y);
  ctx.stroke();
}

// ====================
// IMAGE UPLOAD
// ====================
document.getElementById('uploadBody').onchange = function(e){
  if(!this.files.length) return;
  const file = this.files[0];
  const reader = new FileReader();
  reader.onload = function(ev){
    const img = new Image();
    img.onload = function(){
      bodyElements.push({type:'image', image:img, x:100, y:100, width:img.width, height:img.height});
      redrawCanvas();
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
};

document.getElementById('uploadWheel').onchange = function(e){
  if(!this.files.length) return;
  const file = this.files[0];
  const reader = new FileReader();
  reader.onload = function(ev){
    const img = new Image();
    img.onload = function(){
      wheelElements.push({type:'image', image:img, width:100, height:100}); // square wheel
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

  // Body elements
  bodyElements.forEach(el=>{
    if(el.type==='path'){
      ctx.strokeStyle=el.color;
      ctx.lineWidth=el.size;
      ctx.lineCap='round';
      ctx.beginPath();
      ctx.moveTo(el.path[0].x, el.path[0].y);
      for(let i=1;i<el.path.length;i++) ctx.lineTo(el.path[i].x, el.path[i].y);
      ctx.stroke();
    } else if(el.type==='image'){
      ctx.drawImage(el.image, el.x, el.y, el.width, el.height);
    }
  });

  // Wheel placeholders
  wheelPlaceholders.forEach(ph=>{
    ctx.strokeStyle='red';
    ctx.lineWidth=2;
    ctx.beginPath();
    ctx.arc(ph.x, ph.y, ph.radius, 0, Math.PI*2);
    ctx.stroke();
  });

  // Wheel images snapped to placeholders
  for(let i=0; i<wheelPlaceholders.length && i<wheelElements.length; i++){
    const ph = wheelPlaceholders[i];
    const wheel = wheelElements[i];
    ctx.drawImage(wheel.image, ph.x - wheel.width/2, ph.y - wheel.height/2, wheel.width, wheel.height);
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

  // Export body canvas
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

  // Export wheels separately
  let wheelCanvas = document.createElement('canvas');
  wheelCanvas.width = canvas.width; wheelCanvas.height = canvas.height;
  let wheelCtx = wheelCanvas.getContext('2d');
  for(let i=0;i<wheelPlaceholders.length && i<wheelElements.length;i++){
    const ph = wheelPlaceholders[i];
    const wheel = wheelElements[i];
    wheelCtx.drawImage(wheel.image, ph.x - wheel.width/2, ph.y - wheel.height/2, wheel.width, wheel.height);
  }

  const payload = {
    carData:{
      carName, teamName, email,
      acceleration: parseInt(accSlider.value),
      topSpeed: parseInt(speedSlider.value),
      carImageData: bodyCanvas.toDataURL('image/png'),
      wheelImageData: wheelCanvas.toDataURL('image/png'),
      wheelPositions: wheelPlaceholders.map(ph=>({x:ph.x,y:ph.y}))
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
