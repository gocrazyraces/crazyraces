import nodemailer from 'nodemailer';

export default async function handler(req, res){
  if(req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

  try {
    const { carName, teamName, acceleration, topSpeed, email, crosshairs, carImage, wheelImage } = req.body;

    // Basic validation
    if(!email || !carName || !teamName) return res.status(400).json({ message:'Missing required fields' });

    // Create transporter
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD
      }
    });

    // Prepare JSON attachment
    const carJSON = JSON.stringify({
      carName,
      teamName,
      acceleration,
      topSpeed,
      email,
      wheelPositions: crosshairs
    }, null, 2);

    // Send email
    await transporter.sendMail({
      from: email,             // Use user's email as 'from'
      replyTo: email,
      to: process.env.SUBMISSION_EMAIL,
      subject: `New CrazyRaces Car: ${carName}`,
      text: `CrazyRaces submission from ${email}`,
      attachments: [
        { filename: 'car.json', content: carJSON, contentType: 'application/json' },
        { 
          filename: 'car.png', 
          content: carImage.split('base64,')[1], 
          encoding: 'base64' 
        },
        { 
          filename: 'wheel.png', 
          content: wheelImage.split('base64,')[1], 
          encoding: 'base64' 
        }
      ]
    });

    res.status(200).json({ message:'Submission successful' });

  } catch(err) {
    console.error('Submission error:', err);
    res.status(500).json({ message:'Email failed' });
  }
}
