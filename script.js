const canvas = new fabric.Canvas('fabric-canvas', { backgroundColor:'#eee' });

// --- History ---
let history=[], redoStack=[];
function saveState(){ history.push(JSON.stringify(canvas)); redoStack=[]; }
canvas.on('object:added',saveState); canvas.on('object:modified',saveState); canvas.on('object:removed',saveState);

// --- Tools ---
let currentTool='select', tempObj=null, startX=0, startY=0;

// Toolbar buttons
document.getElementById('select-tool').onclick=()=>{ canvas.isDrawingMode=false; currentTool='select'; };
document.getElementById('brush-tool').onclick=()=>{
  canvas.isDrawingMode=true; currentTool='brush';
  const brush=new fabric.PencilBrush(canvas);
  brush.width=parseInt(document.getElementById('brush-size').value);
  brush.color=document.getElementById('brush-color').value;
  canvas.freeDrawingBrush=brush;
};
document.getElementById('eraser-tool').onclick=()=>{ canvas.isDrawingMode=true; currentTool='eraser'; const eraser=new fabric.EraserBrush(canvas); eraser.width=parseInt(document.getElementById('brush-size').value); canvas.freeDrawingBrush=eraser; };
['rect','ellipse','line','polygon'].forEach(t=>{ document.getElementById(`${t}-tool`)?.addEventListener('click',()=>{ canvas.isDrawingMode=false; currentTool=t; }); });

// Mouse for shapes
canvas.on('mouse:down', e=>{
  if(!['rect','ellipse','line','polygon'].includes(currentTool)) return;
  const pointer=canvas.getPointer(e.e); startX=pointer.x; startY=pointer.y;
  if(currentTool==='rect') tempObj=new fabric.Rect({ left:startX, top:startY, width:0, height:0, fill:'#00f' });
  if(currentTool==='ellipse') tempObj=new fabric.Ellipse({ left:startX, top:startY, rx:0, ry:0, fill:'#0f0' });
  if(currentTool==='line') tempObj=new fabric.Line([startX,startY,startX,startY], { stroke:'black', strokeWidth:3 });
  canvas.add(tempObj);
});
canvas.on('mouse:move', e=>{ if(!tempObj) return; const p=canvas.getPointer(e.e); if(tempObj.type==='rect'){ tempObj.set({ width:Math.abs(p.x-startX), height:Math.abs(p.y-startY) }); } if(tempObj.type==='ellipse'){ tempObj.set({ rx:Math.abs(p.x-startX)/2, ry:Math.abs(p.y-startY)/2 }); } if(tempObj.type==='line'){ tempObj.set({ x2:p.x, y2:p.y }); } canvas.renderAll(); });
canvas.on('mouse:up', e=>{ tempObj=null; });

// Brush settings
document.getElementById('brush-color').onchange=()=>{ if(canvas.isDrawingMode) canvas.freeDrawingBrush.color=document.getElementById('brush-color').value; };
document.getElementById('brush-size').onchange=()=>{ if(canvas.isDrawingMode) canvas.freeDrawingBrush.width=parseInt(document.getElementById('brush-size').value); };

// Undo / Redo
document.getElementById('undo').onclick=()=>{ if(history.length>0){ redoStack.push(JSON.stringify(canvas)); canvas.loadFromJSON(history.pop(),()=>canvas.renderAll()); } };
document.getElementById('redo').onclick=()=>{ if(redoStack.length>0){ history.push(JSON.stringify(canvas)); canvas.loadFromJSON(redoStack.pop(),()=>canvas.renderAll()); } };

// Layer list
function updateLayerList(){
  const list=document.getElementById('object-list'); list.innerHTML='';
  canvas.getObjects().forEach((obj,i)=>{ const li=document.createElement('li'); li.textContent=`${obj.type} (${obj.name||''})`; li.onclick=()=>canvas.setActiveObject(obj); list.appendChild(li); });
}
canvas.on('object:added',updateLayerList); canvas.on('object:removed',updateLayerList); canvas.on('object:modified',updateLayerList);

// Upload car / wheel
function uploadImage(type){
  const input=document.createElement('input'); input.type='file'; input.accept='image/*';
  input.onchange=e=>{
    const reader=new FileReader(); reader.onload=evt=>{
      fabric.Image.fromURL(evt.target.result,img=>{
        img.left=512-img.width/2; img.top=256-img.height/2;
        img.set({name:type, selectable:true});
        canvas.add(img); saveState(); updateLayerList();
      });
    }; reader.readAsDataURL(e.target.files[0]);
  }; input.click();
}
document.getElementById('upload-car').onclick=()=>uploadImage('car');
document.getElementById('upload-wheel').onclick=()=>uploadImage('wheel');

// Crosshairs
const crosshairs=[];
document.getElementById('add-crosshair').onclick=e=>{
  const p=canvas.getPointer(e.e); const ch=new fabric.Circle({ left:p.x, top:p.y, radius:5, fill:'red', selectable:false }); crosshairs.push(ch); canvas.add(ch); updateLayerList();
};

// Wheel snapping
canvas.on('object:moving', e=>{
  const obj=e.target; if(obj.name!=='wheel') return;
  crosshairs.forEach(ch=>{ const dist=Math.hypot(obj.left-ch.left,obj.top-ch.top); if(dist<20){ obj.left=ch.left; obj.top=ch.top; } });
});

// Sliders capped at 100
const accelSlider=document.getElementById("acceleration"); const speedSlider=document.getElementById("topSpeed");
function updateSliders(){ const total=parseInt(accelSlider.value)+parseInt(speedSlider.value); if(total>100) speedSlider.value=100-parseInt(accelSlider.value); }
accelSlider.addEventListener("input",updateSliders); speedSlider.addEventListener("input",updateSliders);

// Email validation
function isValidEmail(email){ return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }

// Export
document.getElementById('export-car').onclick=()=>{ const car=canvas.getObjects().find(o=>o.name==='car'); if(!car) return alert('No car'); const c=new fabric.StaticCanvas(null,{width:car.width*2,height:car.height*2}); c.add(car.clone()); const url=c.toDataURL({format:'png'}); downloadURL(url,'car.png'); };
document.getElementById('export-wheels').onclick=()=>{ const wheels=canvas.getObjects().filter(o=>o.name==='wheel'); const c=new fabric.StaticCanvas(null,{width:1024,height:512}); wheels.forEach(w=>c.add(w.clone())); downloadURL(c.toDataURL({format:'png'}),'wheels.png'); };
document.getElementById('export-json').onclick=()=>{
  const carName=document.getElementById('carName').value; const teamName=document.getElementById('teamName').value; const email=document.getElementById('email').value;
  const wheels=canvas.getObjects().filter(o=>o.name==='wheel'); const data={carName,teamName,email,acceleration:accelSlider.value,topSpeed:speedSlider.value,wheels:wheels.map(w=>({x:w.left,y:w.top}))};
  downloadURL("data:application/json,"+encodeURIComponent(JSON.stringify(data)),'car.json');
};
function downloadURL(url,name){ const a=document.createElement('a'); a.href=url; a.download=name; a.click(); }
