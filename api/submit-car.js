const nodemailer = require('nodemailer');

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  // Get car data from the request body
  const { carData } = req.body;

  // Create a transporter object using SMTP transport
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: 'gocrazyraces@gmail.com', // Your email here
      pass: 'Oliver2011!',  // Your email password (or use App Passwords if 2FA is enabled)
    },
  });

  // Define the mail options
  const mailOptions = {
    from: 'gocrazyraces@gmail.com',
    to: 'gocrazyraces@gmail.com', // Your email for submissions
    subject: 'New Car Design Submitted',
    text: `Car Name: ${carData.carName}\nTeam Name: ${carData.teamName}\nAcceleration: ${carData.acceleration}\nTop Speed: ${carData.topSpeed}\nEmail: ${carData.email}`,
    attachments: [
      {
        filename: 'car.png',
        content: carData.carImageData.split('base64,')[1], // Extract base64 image content
        encoding: 'base64',
      },
      {
        filename: 'wheel.png',
        content: carData.wheelImageData.split('base64,')[1], // Extract wheel image content
        encoding: 'base64',
      },
    ],
  };

  try {
    // Send email
    await transporter.sendMail(mailOptions);
    return res.status(200).json({ message: 'Email sent successfully' });
  } catch (error) {
    console.error('Error sending email:', error);
    return res.status(500).json({ message: 'Failed to send email' });
  }
}
