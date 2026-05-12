const { MongoClient } = require('mongodb');
require('dotenv').config();

async function sync() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('❌ MONGODB_URI not found in .env');
    return;
  }

  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');
    
    const db = client.db();
    const collection = db.collection('smtpsenders'); // NestJS defaults to lowercase + plural

    // Prepare update data from .env
    const updateData = {
      userName: process.env.MAIL_USER,
      password: process.env.MAIL_PASS, 
      smtpHost: process.env.MAIL_HOST || 'smtp.gmail.com',
      smtpPort: parseInt(process.env.MAIL_PORT) || 587,
      smtpSecurity: process.env.MAIL_SECURE === 'true' ? 'SSL' : 'TLS',
      fromEmail: process.env.MAIL_USER,
      fromName: 'Bulk Mailer'
    };

    // Update all existing records to use the new App Password
    const result = await collection.updateMany({}, { $set: updateData });

    console.log(`\n🚀 SYNC SUCCESSFUL!`);
    console.log(`Modified ${result.modifiedCount} records.`);
    console.log(`Updated Email: ${updateData.userName}`);
    console.log(`Updated Password: [App Password from .env]`);
    
    if (result.matchedCount === 0) {
      console.warn('⚠️ No records found in smtpsenders collection to update.');
    }

  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await client.close();
  }
}

sync();
