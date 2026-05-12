const mongoose = require('mongoose');

async function test() {
  await mongoose.connect('mongodb://rs5045280:xbpneTRReMJD9LAc@ac-qpd9k1n-shard-00-00.sbbouj5.mongodb.net:27017,ac-qpd9k1n-shard-00-01.sbbouj5.mongodb.net:27017,ac-qpd9k1n-shard-00-02.sbbouj5.mongodb.net:27017/bulk_mail_testing?ssl=true&replicaSet=atlas-45jbz5-shard-0&authSource=admin&retryWrites=true&w=majority');
  
  const collections = await mongoose.connection.db.listCollections().toArray();
  console.log("Collections:", collections.map(c => c.name));

  for (const coll of collections) {
    const data = await mongoose.connection.collection(coll.name).find({}).toArray();
    console.log(`Collection ${coll.name} has ${data.length} records`);
    if (data.length > 0) {
        // Look for the specific workspaceId the user provided
        const found = data.filter(d => d.workspaceId === '7550c96a-54d3-4b6c-8f93-3ca121077a06' || d.companyId === '7550c96a-54d3-4b6c-8f93-3ca121077a06');
        if (found.length > 0) {
            console.log(`!!! Found matching records in ${coll.name}`);
        }
    }
  }

  mongoose.disconnect();
}
test();
