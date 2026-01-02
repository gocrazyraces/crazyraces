import nodemailer from 'nodemailer';

export default async function handler(req, res){
  if(req.method!=='POST') return res.status(405).json({message:'Method Not Allowed'});
  try{
    const { carData } = req.body;
    if(!carData) return res.status(400).json({message:'Missing data'});

    const transporter = nodemailer.createTransport({
      service:'gmail',
      auth:{
        user:process.env.GMAIL_USER,
        pass:process.env.GMAIL_APP_PASSWORD
      }
    });

    const carJSON = JSON.stringify({
      carName: carData.carName,
      teamName: carData.teamName,
      acceleration: carData.acceleration,
      topSpeed: carData.topSpeed,
      email: carData.email,
      wheelPositions: carData.wheelPositions
    }, null, 2);

    await transporter.sendMail({
      from: process.env.GMAIL_USER,
      replyTo: carData.email,
      to: process.env.SUBMISSION_EMAIL,
      subject:`New CrazyRaces Car: ${carData.carName}`,
      text:`Submission from ${carData.email}`,
      attachments:[
        { filename:'car.json', content:carJSON, contentType:'application/json' },
        { filename:'car.png', content:carData.carImageData.split('base64,')[1], encoding:'base64' },
        { filename:'wheel.png', content:carData.wheelImageData.split('base64,')[1], encoding:'base64' }
      ]
    });

    res.status(200).json({ message:'Submission successful' });

  } catch(err){ console.error(err); res.status(500).json({message:'Email failed'}); }
}
