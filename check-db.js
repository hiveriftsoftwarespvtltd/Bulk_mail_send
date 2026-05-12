const { MongoClient } = require('mongodb');
require('dotenv').config();

async function check() {
  const uri = process.env.MONGODB_URI;
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db();
    
    console.log('--- SMTP ACCOUNTS ---');
    const smtpCollection = db.collection('smtpsenders');
    const smtpAccounts = await smtpCollection.find({}).toArray();
    console.log(`Found ${smtpAccounts.length} SMTP accounts.`);
    smtpAccounts.forEach(acc => {
      console.log(`ID: ${acc._id} | User: ${acc.userName} | TenantID: ${acc.tenantId}`);
    });

    console.log('\n--- GOOGLE ACCOUNTS ---');
    const googleCollection = db.collection('googlemails');
    const googleAccounts = await googleCollection.find({}).toArray();
    console.log(`Found ${googleAccounts.length} Google accounts.`);
    googleAccounts.forEach(acc => {
      console.log(`ID: ${acc._id} | Email: ${acc.email} | TenantID: ${acc.tenantId}`);
    });

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.close();
  }
}

check();
