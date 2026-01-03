// ====================
// CANVAS SETUP
// ====================
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

// tabs
let currentTab = 'body';

// Body & wheel data
let bodyElements = []; // {type:'path'|'image', path?, image?, x?, y?, width?, height?}
let wheelElements = []; // {id, type:'path'|'image', image?, width?, height?}
let wheelPlacements = []; // {wheelId, x, y, scale}

// Drawing states
let drawing=false, erasing=false;
let brushSize=4, brushColor='#000000';
let currentPath=[];
let selectedElement=null;

// ====================
// TAB SWITCH
// ====================
const tabs=['body','wheel','placement','properties','submit'];
tabs.forEach(tab=>{
  document.getElementById(tab+'Tab').onclick = ()=>{
    currentTab=tab;
    tabs.forEach(t=>{
      document.getElementById(t+'Tab').classList.toggle('active', t===tab);
      document.getElementById(t+'Controls').classList.toggle('active', t===tab);
    });
    redrawCanvas();
  };
});

// ====================
// BODY CONTROLS
// ====================
document.getElementById('drawBodyBtn').onclick=()=>{drawing=true; erasing=false;};
document.getElementById('eraseBodyBtn').onclick=()=>{drawing=true; erasing=true;};
document.getElementById('clearBodyBtn').onclick=()=>{
  bodyElements=[];
  redrawCanvas();
};
document.getElementById('bodyBrushSize').oninput=function(){ brushSize=parseInt(this.value,10); };
document.getElementById('bodyColor').oninput=function(){ brushColor=this.value; };

// ====================
// WHEEL CONTROLS
// ====================
document.getElementById('drawWheelBtn').onclick=()=>{drawing=true; erasing=false;};
document.getElementById('eraseWheelBtn').onclick=()=>{drawing=true; erasing=true;};
document.getElementById('clearWheelBtn').onclick=()=>{
  wheelElements=[];
  redrawCanvas();
};
document.getElementById('wheelBrushSize').oninput=function(){ brushSize=parseInt(this.value,10); };
document.getElementById('wheelColor').oninput=function(){ brushColor=this.value; };

// ====================
// DRAWING HANDLERS
// ====================
canvas.addEventListener('pointerdown', e=>{
  if(currentTab==='body' || currentTab==='wheel'){
    drawing=true;
    currentPath=[{x:e.offsetX,y:e.offsetY}];
  }
});
canvas.addEventListener('pointermove', e=>{
  if(!drawing) return;
  const point={x:e.offsetX,y:e.offsetY};
  currentPath.push(point);
  drawTempLine(currentPath[currentPath.length-2], point);
});
canvas.addEventListener('pointerup', e=>{
  if(drawing){
    drawing=false;
    if(currentPath.length>1){
      const el={type:'path', path:currentPath.slice(), color:brushColor, size:brushSize};
      if(currentTab==='body') bodyElements.push(el);
      else if(currentTab==='wheel') wheelElements.push({...el, id:Date.now()});
    }
    currentPath=[];
    redrawCanvas();
  }
});

function drawTempLine(p1,p2){
  ctx.strokeStyle=erasing?'#fff':brushColor;
  ctx.lineWidth=brushSize;
  ctx.lineCap='round';
  ctx.beginPath();
  ctx.moveTo(p1.x,p1.y);
  ctx.lineTo(p2.x,p2.y);
  ctx.stroke();
}

// ====================
// IMAGE UPLOAD
// ====================
document.getElementById('uploadBody').onchange=function(e){
  if(!this.files.length) return;
  const file=this.files[0];
  const reader=new FileReader();
  reader.onload=function(ev){
    const img=new Image();
    img.onload=function(){
      bodyElements.push({type:'image', image:img, x:100, y:100, width:img.width, height:img.height});
      redrawCanvas();
    };
    img.src=ev.target.result;
  };
  reader.readAsDataURL(file);
};

document.getElementById('uploadWheel').onchange=function(e){
  if(!this.files.length) return;
  const file=this.files[0];
  const reader=new FileReader();
  reader.onload=function(ev){
    const img=new Image();
    img.onload=function(){
      wheelElements.push({id:Date.now(), type:'image', image:img, width:100, height:100});
      redrawCanvas();
    };
    img.src=ev.target.result;
  };
  reader.readAsDataURL(file);
};

// ====================
// PLACEMENT LOGIC
// ====================
canvas.addEventListener('pointerdown', e=>{
  if(currentTab==='placement'){
    const mx=e.offsetX, my=e.offsetY;
    // place first available wheel at click
    for(let w of wheelElements){
      if(!wheelPlacements.find(p=>p.wheelId===w.id)){
        wheelPlacements.push({wheelId:w.id, x:mx, y:my, scale:1});
        redrawCanvas();
        break;
      }
    }
  }
});

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
  if(!carName || !teamName || !email){ alert('Fill Car Name, Team Name, Email'); return; }

  // Export body canvas
  let bodyCanvas=document.createElement('canvas');
  bodyCanvas.width=canvas.width; bodyCanvas.height=canvas.height;
  let bodyCtx=bodyCanvas.getContext('2d');
  bodyElements.forEach(el=>{
    if(el.type==='path'){
      bodyCtx.strokeStyle=el.color; bodyCtx.lineWidth=el.size; bodyCtx.lineCap='round';
      bodyCtx.beginPath();
      bodyCtx.moveTo(el.path[0].x,el.path[0].y);
      for(let i=1;i<el.path.length;i++) bodyCtx.lineTo(el.path[i].x,el.path[i].y);
      bodyCtx.stroke();
    } else if(el.type==='image'){
      bodyCtx.drawImage(el.image,el.x,el.y,el.width,el.height);
    }
  });

  // Export wheels separately
  let wheelCanvas=document.createElement('canvas');
  wheelCanvas.width=canvas.width; wheelCanvas.height=canvas.height;
  let wheelCtx=wheelCanvas.getContext('2d');
  wheelPlacements.forEach(p=>{
    const w=wheelElements.find(w=>w.id===p.wheelId);
    if(w) wheelCtx.drawImage(w.image,p.x-w.width*p.scale/2,p.y-w.height*p.scale/2,w.width*p.scale,w.height*p.scale);
  });

  const payload={carData:{
    carName, teamName, email,
    acceleration:parseInt(accSlider.value),
    topSpeed:parseInt(speedSlider.value),
    carImageData:bodyCanvas.toDataURL('image/png'),
    wheelImageData:wheelCanvas.toDataURL('image/png'),
    wheelPositions:wheelPlacements.map(p=>({wheelId:p.wheelId,x:p.x,y:p.y,scale:p.scale}))
  }};

  try{
    const resp=await fetch('/api/submit-car',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify(payload)
    });
    if(resp.ok) document.getElementById('submitStatus').textContent='Submission successful!';
    else document.getElementById('submitStatus').textContent='Submission failed!';
  } catch(e){
    document.getElementById('submitStatus').textContent='Submission failed!';
  }
};

// ====================
// REDRAW CANVAS
// ====================
function redrawCanvas(){
  ctx.clearRect(0,0,canvas.width,canvas.height);

  // Body
  bodyElements.forEach(el=>{
    if(el.type==='path'){
      ctx.strokeStyle=el.color; ctx.lineWidth=el.size; ctx.lineCap='round';
      ctx.beginPath();
      ctx.moveTo(el.path[0].x,el.path[0].y);
      for(let i=1;i<el.path.length;i++) ctx.lineTo(el.path[i].x,el.path[i].y);
      ctx.stroke();
    } else if(el.type==='image'){
      ctx.drawImage(el.image,el.x,el.y,el.width,el.height);
    }
  });

  // Wheels (placement)
  wheelPlacements.forEach(p=>{
    const w=wheelElements.find(w=>w.id===p.wheelId);
    if(w) ctx.drawImage(w.image,p.x-w.width*p.scale/2,p.y-w.height*p.scale/2,w.width*p.scale,w.height*p.scale);
  });
}
