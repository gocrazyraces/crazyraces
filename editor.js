// ====================
// FABRIC CANVASES
// ====================
const canvas = new fabric.Canvas('canvas', { preserveObjectStacking: true });
const wheelCanvas = new fabric.Canvas('wheelCanvas', { preserveObjectStacking: true });

canvas.selection = true;
wheelCanvas.selection = true;

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
    if(currentTab==='wheel') wheelCanvas.getElement().style.display='block';
    else wheelCanvas.getElement().style.display='none';
  };
});

// ====================
// BODY UPLOAD
// ====================
document.getElementById('uploadBody').onchange=function(e){
  if(!this.files.length) return;
  const reader = new FileReader();
  reader.onload=function(ev){
    fabric.Image.fromURL(ev.target.result, img=>{
      img.set({ left:100, top:100, selectable:true });
      canvas.add(img);
      canvas.setActiveObject(img);
      canvas.renderAll();
    });
  };
  reader.readAsDataURL(this.files[0]);
};

document.getElementById('clearBodyBtn').onclick=()=>canvas.clear();

// ====================
// WHEEL UPLOAD
// ====================
const wheelImages = []; // store uploaded wheel images
document.getElementById('uploadWheel').onchange=function(e){
  if(!this.files.length) return;
  const reader = new FileReader();
  reader.onload=function(ev){
    fabric.Image.fromURL(ev.target.result, img=>{
      img.set({ left:128, top:128, originX:'center', originY:'center', selectable:true });
      img.scaleToWidth(128); // square guidance
      wheelCanvas.add(img);
      wheelCanvas.setActiveObject(img);
      wheelCanvas.renderAll();
      wheelImages.push(img);
    });
  };
  reader.readAsDataURL(this.files[0]);
};

document.getElementById('clearWheelBtn').onclick=()=>wheelCanvas.clear();

// Draw grey placeholder circle on wheel canvas
function drawWheelPlaceholder(){
  wheelCanvas.clear();
  const circ = new fabric.Circle({
    left:128, top:128, radius:64,
    fill:'rgba(200,200,200,0.5)',
    originX:'center', originY:'center',
    selectable:false
  });
  wheelCanvas.add(circ);
}
drawWheelPlaceholder();

// ====================
// PLACEMENT
// ====================
document.getElementById('addWheelBtn').onclick=()=>{
  const activeWheel = wheelCanvas.getActiveObject();
  if(!activeWheel) return alert("Select a wheel to add!");
  const dataUrl = activeWheel.toDataURL({ format:'png' });
  fabric.Image.fromURL(dataUrl, img=>{
    img.set({ left:200, top:400, originX:'center', originY:'center', selectable:true });
    img.scaleX = activeWheel.scaleX; img.scaleY = activeWheel.scaleY;
    img.customId = Date.now();
    canvas.add(img);
    canvas.setActiveObject(img);
    canvas.renderAll();
  });
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
  if(!carName || !teamName || !email){ alert('Fill Car Name, Team Name, Email'); return; }

  const bodyDataURL = canvas.toDataURL({ format:'png' });

  // Wheel placements on body
  const wheelPlacements = [];
  canvas.getObjects().forEach(obj=>{
    if(obj.customId){
      wheelPlacements.push({
        wheelId: obj.customId,
        x: obj.left,
        y: obj.top,
        scale: obj.scaleX
      });
    }
  });

  const payload = {
    carData: {
      carName, teamName, email,
      acceleration: parseInt(accSlider.value),
      topSpeed: parseInt(speedSlider.value),
      carImageData: bodyDataURL,
      wheelImageData: '', // optional, we could include the wheel canvas if needed
      wheelPositions: wheelPlacements
    }
  };

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
