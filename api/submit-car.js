import nodemailer from "nodemailer";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  try {
    const { carData } = req.body;

    if (!carData) {
      return res.status(400).json({ message: "Missing car data" });
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });

    const mailOptions = {
      from: `"CrazyRaces" <${process.env.GMAIL_USER}>`,
      to: process.env.SUBMISSION_EMAIL,
      subject: `New CrazyRaces Car: ${carData.carName}`,
      text: `
Car Name: ${carData.carName}
Team Name: ${carData.teamName}
Acceleration: ${carData.acceleration}
Top Speed: ${carData.topSpeed}
User Email: ${carData.email}
      `,
      attachments: [
        {
          filename: "car.png",
          content: carData.carImageData.split("base64,")[1],
          encoding: "base64",
        },
        {
          filename: "wheel.png",
          content: carData.wheelImageData.split("base64,")[1],
          encoding: "base64",
        },
      ],
    };

    await transporter.sendMail(mailOptions);

    return res.status(200).json({ message: "Submission successful" });
  } catch (error) {
    console.error("Email error:", error);
    return res.status(500).json({ message: "Email failed" });
  }
}
