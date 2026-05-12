const nodemailer = require('nodemailer');
const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config();

async function test() {
  const uri = process.env.MONGODB_URI;
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db();
    const collection = db.collection('smtpsenders');

    const config = await collection.findOne({ _id: new ObjectId('69fd78e50b4816fdf641f87d') });
    if (!config) {
        console.error('Config not found!');
        return;
    }

    console.log(`Testing with Email: ${config.fromEmail}`);
    console.log(`Host: ${config.smtpHost} | Port: ${config.smtpPort}`);
    console.log(`User: ${config.userName}`);
    console.log(`Pass: ${config.password}`);

    const transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpPort === 465,
      auth: {
        user: config.userName.trim(),
        pass: config.password.trim(),
      },
      tls: {
        rejectUnauthorized: false
      },
      debug: true, // Show handshake
      logger: true
    });

    console.log('Sending test email...');
    const info = await transporter.sendMail({
      from: `"${config.fromName}" <${config.fromEmail}>`,
      to: 'vineetvineet8006@gmail.com', // Sending to yourself
      subject: 'SMTP TEST SUCCESSFUL',
      text: 'If you see this, your App Password is working!',
    });

    console.log('SUCCESS! Message ID:', info.messageId);

  } catch (err) {
    console.error('FAILED!', err.message);
  } finally {
    await client.close();
  }
}

test();
