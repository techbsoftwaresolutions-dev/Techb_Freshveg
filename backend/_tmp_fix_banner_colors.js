require('dotenv').config();
const mongoose = require('mongoose');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const Banner = mongoose.connection.collection('banners');
  const before = await Banner.find({ placement: 'home_strip' }).toArray();
  console.log('Before:', before.map(b => ({ id: b._id.toString(), title: b.title, backgroundColor: b.backgroundColor })));

  const result = await Banner.updateMany(
    { placement: 'home_strip' },
    { $set: { backgroundColor: '#10632f' } }
  );
  console.log('Matched:', result.matchedCount, 'Modified:', result.modifiedCount);

  const after = await Banner.find({ placement: 'home_strip' }).toArray();
  console.log('After:', after.map(b => ({ id: b._id.toString(), title: b.title, backgroundColor: b.backgroundColor })));

  await mongoose.disconnect();
}
main().catch((err) => { console.error(err); process.exit(1); });
