import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    if (!req.body || !req.body.carData) {
      console.error('Request body missing carData:', req.body);
      return res.status(400).json({ message: 'Missing carData' });
    }

    const {
      carName,
      teamName,
      email,
      acceleration,
      topSpeed,
      wheelPositions,
      carImageData,
      wheelImageData
    } = req.body.carData;

    if (!email || !carImageData) {
      console.error('Missing required fields');
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD
      }
    });

    const jsonAttachment = JSON.stringify(
      {
        carName,
        teamName,
        email,
        acceleration,
        topSpeed,
        wheelPositions
      },
      null,
      2
    );

    await transporter.sendMail({
      from: email,
      replyTo: email,
      to: process.env.SUBMISSION_EMAIL,
      subject: `CrazyRaces Submission: ${carName}`,
      text: `New submission from ${email}`,

      attachments: [
        {
          filename: 'car.json',
          content: jsonAttachment,
          contentType: 'application/json'
        },
        {
          filename: 'car.png',
          content: carImageData.split('base64,')[1],
          encoding: 'base64'
        },
        {
          filename: 'wheel.png',
          content: wheelImageData.split('base64,')[1],
          encoding: 'base64'
        }
      ]
    });

    return res.status(200).json({ message: 'Submission successful' });

  } catch (err) {
    console.error('Submission error:', err);
    return res.status(500).json({ message: 'Email failed' });
  }
}
