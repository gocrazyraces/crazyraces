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

// Submit car design and data
async function submitCarDesign() {
    const acceleration = document.getElementById('acceleration').value;
    const topSpeed = document.getElementById('topSpeed').value;
    const carName = document.getElementById('carName').value;
    const teamName = document.getElementById('teamName').value;
    const email = document.getElementById('email').value;

    // Prepare the data to send
    const carData = {
        carName,
        teamName,
        acceleration,
        topSpeed,
        email,
        carImageData: carCanvas.toDataURL(), // Base64 image data for the car
        wheelImageData: wheelCanvas.toDataURL() // Base64 image data for the wheels
    };

    try {
        // Send the data to the backend API
        const response = await fetch('/api/submit-car', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ carData }),
        });

        const result = await response.json();
        if (response.ok) {
            alert('Car submitted successfully 2!');
        } else {
            alert('Error: ' + result.message);
        }
    } catch (error) {
        console.error('Error:', error);
        alert('An error occurred while submitting the car.');
    }
}
