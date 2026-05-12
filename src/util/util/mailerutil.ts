const nodemailer = require('nodemailer');

export const generateOTP = () => {
  return Math.floor(Math.random() * 900000) + 100000;
};

export const sendEmail = async (to, subject, text, html) => {
  console.log('Preparing to send email to:', process.env.MAIL_USER); // 🔥
  const transporter = nodemailer.createTransport({
    host: process.env.MAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.MAIL_PORT || '587'),
    secure: parseInt(process.env.MAIL_PORT || '587') === 465,
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS,
    },
  });

  const mailOptions: any = {
    from: process.env.MAIL_FROM || process.env.MAIL_USER,
    to,
    subject,
    text,
  };
  
  if (html) {
    mailOptions.html = html;
  }

  await transporter.sendMail(mailOptions);
};
