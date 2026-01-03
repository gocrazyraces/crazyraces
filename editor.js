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
    wheelCanvas.style.display=(currentTab==='wheel') ? 'block':'none';
  };
});

// ====================
// IMAGE DATA
// ====================
let bodyImages = [];
let wheelImage = null;
let placedWheels = [];

// ====================
// BODY UPLOAD
// ====================
document.getElementById('uploadBody').onchange=function(e){
  if(!this.files.length) return;
  const reader = new FileReader();
  reader.onload=function(ev){
    const img = new Image();
    img.onload = ()=>{
      bodyImages.push({img, x:100, y:100, width:img.width, height:img.height});
      drawBodyCanvas();
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(this.files[0]);
};
document.getElementById('clearBodyBtn').onclick=()=>{
  bodyImages=[];
  drawBodyCanvas();
};

// ====================
// WHEEL UPLOAD
// ====================
document.getElementById('uploadWheel').onchange=function(e){
  if(!this.files.length) return;
  const reader = new FileReader();
  reader.onload=function(ev){
    const img = new Image();
    img.onload = ()=>{
      wheelImage = {img, x:128, y:128, width:img.width, height:img.height, scale:1};
      drawWheelCanvas();
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(this.files[0]);
};
document.getElementById('clearWheelBtn').onclick=()=>{
  wheelImage=null;
  drawWheelCanvas();
};

// Draw wheel placeholder
function drawWheelCanvas(){
  wheelCtx.clearRect(0,0,256,256);
  wheelCtx.fillStyle='rgba(200,200,200,0.5)';
  wheelCtx.beginPath();
  wheelCtx.arc(128,128,64,0,2*Math.PI);
  wheelCtx.fill();
  if(wheelImage){
    wheelCtx.drawImage(
      wheelImage.img,
      wheelImage.x - wheelImage.width/2,
      wheelImage.y - wheelImage.height/2,
      wheelImage.width*wheelImage.scale,
      wheelImage.height*wheelImage.scale
    );
  }
}

// ====================
// BODY CANVAS DRAW
// ====================
function drawBodyCanvas(){
  bodyCtx.clearRect(0,0,1024,768);
  bodyImages.forEach(obj=>{
    bodyCtx.drawImage(obj.img,obj.x,obj.y,obj.width,obj.height);
  });
  placedWheels.forEach(obj=>{
    bodyCtx.drawImage(obj.img,obj.x - obj.width/2,obj.y - obj.height/2,obj.width*obj.scale,obj.height*obj.scale);
  });
}

// ====================
// PLACEMENT
// ====================
document.getElementById('addWheelBtn').onclick=()=>{
  if(!wheelImage) return alert("No wheel uploaded!");
  placedWheels.push({
    img: wheelImage.img,
    x:200, y:400,
    width: wheelImage.width,
    height: wheelImage.height,
    scale: wheelImage.scale
  });
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
