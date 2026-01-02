const carCanvas = document.getElementById('carCanvas');
const wheelCanvas = document.getElementById('wheelCanvas');
const carContext = carCanvas.getContext('2d');
const wheelContext = wheelCanvas.getContext('2d');

// Variables for car and wheel drawings
let drawingCar = false;
let drawingWheel = false;
let carImage = null;
let wheelImage = null;

// Clear the car drawing canvas
function clearCanvas() {
    carContext.clearRect(0, 0, carCanvas.width, carCanvas.height);
}

// Clear the wheel drawing canvas
function clearWheelCanvas() {
    wheelContext.clearRect(0, 0, wheelCanvas.width, wheelCanvas.height);
}

// Handle image upload for car body
function uploadCarImage(event) {
    const file = event.target.files[0];
    const reader = new FileReader();
    reader.onload = function(e) {
        carImage = new Image();
        carImage.src = e.target.result;
        carImage.onload = function() {
            clearCanvas();
            carContext.drawImage(carImage, 0, 0, carCanvas.width, carCanvas.height);
        };
    };
    reader.readAsDataURL(file);
}

// Handle image upload for wheel
function uploadWheelImage(event) {
    const file = event.target.files[0];
    const reader = new FileReader();
    reader.onload = function(e) {
        wheelImage = new Image();
        wheelImage.src = e.target.result;
        wheelImage.onload = function() {
            clearWheelCanvas();
            wheelContext.drawImage(wheelImage, 0, 0, wheelCanvas.width, wheelCanvas.height);
        };
    };
    reader.readAsDataURL(file);
}

// Handle form submission (mock)
function submitCarDesign() {
    const acceleration = document.getElementById('acceleration').value;
    const topSpeed = document.getElementById('topSpeed').value;
    const carName = document.getElementById('carName').value;
    const teamName = document.getElementById('teamName').value;
    const email = document.getElementById('email').value;

    // Prepare JSON object for the car design
    const carData = {
        carName,
        teamName,
        acceleration,
        topSpeed,
        email,
        carImageData: carCanvas.toDataURL(), // Base64 image data for the car
        wheelImageData: wheelCanvas.toDataURL() // Base64 image data for the wheels
    };

    console.log('Car data:', carData); // You can replace this with actual submission logic

    alert('Car submitted successfully!');
}
