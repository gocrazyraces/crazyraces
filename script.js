const canvas = new fabric.Canvas('fabric-canvas', { backgroundColor: '#eee' });

// --- History ---
let history = [];
let redoStack = [];
function saveState() { history.push(JSON.stringify(canvas)); redoStack=[]; }
canvas.on('object:added', saveState);
canvas.on('object:modified', saveState);
canvas.on('object:removed', saveState);

// --- Tools ---
let currentTool = null;

// Select
document.getElementById('select-tool').onclick = () => { canvas.isDrawingMode=false; currentTool='select'; };

// Brush
document.getElementById('brush-tool').onclick = () => {
  canvas.isDrawingMode = true; currentTool='brush';
  const brush = new fabric.PencilBrush(canvas);
  brush.width = parseInt(document.getElementById('brush-size').value);
  brush.color = document.getElementById('brush-color').value;
  canvas.freeDrawingBrush = brush;
};

// Eraser
document.getElementById('eraser-tool').onclick = () => {
  canvas.isDrawingMode=true; currentTool='eraser';
  const eraser = new fabric.EraserBrush(canvas);
  eraser.width = parseInt(document.getElementById('brush-size').value);
  canvas.freeDrawingBrush = eraser;
};

// Shapes
document.getElementById('rect-tool').onclick = ()=>{ currentTool='rect'; canvas.isDrawingMode=false; };
document.getElementById('circle-tool').onclick = ()=>{ currentTool='circle'; canvas.isDrawingMode=false; };
document.getElementById('line-tool').onclick = ()=>{ currentTool='line'; canvas.isDrawingMode=false; };

// Draw shapes on click
canvas.on('mouse:down', function(o){
  if(!['rect','circle','line'].includes(currentTool)) return;
  const pointer = canvas.getPointer(o.e);
  if(currentTool==='rect'){
    const rect = new fabric.Rect({ left:pointer.x, top:pointer.y, width:50, height:30, fill:'#00f', selectable:true });
    canvas.add(rect); saveState();
  }
  if(currentTool==='circle'){
    const circ = new fabric.Circle({ left:pointer.x, top:pointer.y, radius:25, fill:'#0f0', selectable:true });
    canvas.add(circ); saveState();
  }
  if(currentTool==='line'){
    const line = new fabric.Line([pointer.x,pointer.y,pointer.x+50,pointer.y], { stroke:'black', strokeWidth:3, selectable:true });
    canvas.add(line); saveState();
  }
});

// Brush controls
document.getElementById('brush-color').onchange = () => { if(canvas.isDrawingMode) canvas.freeDrawingBrush.color=document.getElementById('brush-color').value; };
document.getElementById('brush-size').onchange = () => { if(canvas.isDrawingMode) canvas.freeDrawingBrush.width=parseInt(document.getElementById('brush-size').value); };

// Undo / Redo
document.getElementById('undo').onclick = () => { if(history.length>0){ redoStack.push(JSON.stringify(canvas)); canvas.loadFromJSON(history.pop(),()=>canvas.renderAll()); } };
document.getElementById('redo').onclick = () => { if(redoStack.length>0){ history.push(JSON.stringify(canvas)); canvas.loadFromJSON(redoStack.pop(),()=>canvas.renderAll()); } };

// Upload car
document.getElementById('upload-car').onclick = ()=>{ uploadImage('car'); };
// Upload wheel
document.getElementById('upload-wheel').onclick = ()=>{ uploadImage('wheel'); };
function uploadImage(type){
  const input = document.createElement('input'); input.type='file'; input.accept='image/*';
  input.onchange = e=>{
    const reader = new FileReader();
    reader.onload = evt => { fabric.Image.fromURL(evt.target.result, img => {
      img.left=512-img.width/2; img.top=256-img.height/2; img.set({name:type, selectable:true});
      if(type==='wheel') img.crosshairSnapped=false;
      canvas.add(img); saveState();
    }); };
    reader.readAsDataURL(e.target.files[0]);
  }; input.click();
}

// Crosshairs
const crosshairs=[];
document.getElementById('add-crosshair').onclick=(e)=>{
  const pointer = canvas.getPointer(e.e);
  const ch = new fabric.Circle({ left:pointer.x, top:pointer.y, radius:5, fill:'red', selectable:false });
  crosshairs.push(ch); canvas.add(ch);
};

// Wheel snapping
canvas.on('object:moving', e=>{
  const obj=e.target;
  if(obj.name!=='wheel') return;
  crosshairs.forEach(ch=>{
    const dist=Math.hypot(obj.left-ch.left,obj.top-ch.top);
    if(dist<20){ obj.left=ch.left; obj.top=ch.top; obj.crosshairSnapped=true; }
  });
});

// Sliders capped at 100
const accelSlider=document.getElementById("acceleration");
const speedSlider=document.getElementById("topSpeed");
function updateSliders(){
  const total=parseInt(accelSlider.value)+parseInt(speedSlider.value);
  if(total>100) speedSlider.value=100-parseInt(accelSlider.value);
}
accelSlider.addEventListener("input", updateSliders);
speedSlider.addEventListener("input", updateSliders);

// Email validation
function isValidEmail(email){ return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }

// Preview
document.getElementById('preview-car').onclick=()=>{
  const car=canvas.getObjects().find(o=>o.name==='car'); if(!car) return alert('Add a car');
  const wheels=canvas.getObjects().filter(o=>o.name==='wheel');
  let startX=car.left; const endX=900;
  function animate(){
    if(car.left>=endX){ car.left=startX; wheels.forEach(w=>w.left=w.left); }
    car.left+=5; wheels.forEach(w=>{ w.left+=5; w.rotate(15); });
    canvas.renderAll(); requestAnimationFrame(animate);
  }
  animate();
};

// Submit
document.getElementById('submit-car').onclick=async()=>{
  const email=document.getElementById('email').value; if(!isValidEmail(email)) return alert('Enter valid email.');
  const carName=document.getElementById('carName').value;
  const teamName=document.getElementById('teamName').value;

  // Export car
  const carObj=canvas.getObjects().find(o=>o.name==='car');
  let carDataURL='';
  if(carObj){ const carCanvas=new fabric.StaticCanvas(null,{width:carObj.width*2,height:carObj.height*2});
    carCanvas.add(carObj.clone()); carDataURL=carCanvas.toDataURL({format:'png'}); }

  // Export wheels
  const wheelObjs=canvas.getObjects().filter(o=>o.name==='wheel');
  const wheelCanvas=new fabric.StaticCanvas(null,{width:1024,height:512});
  wheelObjs.forEach(w=>wheelCanvas.add(w.clone()));
  const wheelDataURL=wheelCanvas.toDataURL({format:'png'});

  const carData={
    carName, teamName, acceleration: accelSlider.value, topSpeed: speedSlider.value,
    email, carImageData: carDataURL, wheelImageData: wheelDataURL,
    wheelPositions: wheelObjs.map(w=>({x:w.left,y:w.top}))
  };

  try{
    const res = await fetch('/api/submit-car',{method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({carData})});
    const result=await res.json(); alert(result.message);
  } catch(err){ console.error(err); alert('Submission failed'); }
};
