import { Db, MongoClient, ObjectId } from 'mongodb';

var MONGO_URL = 'mongodb://localhost:27017/arb';
export let mongodb: MongoClient;
export let arbdb: Db;

export let InitMongodb = async () => {
  if (arbdb) {
    return arbdb;
  }
  mongodb = await MongoClient.connect(MONGO_URL);
  console.log('数据库连接成功!');
  arbdb = mongodb.db('arb');
  try {
    await arbdb.createCollection('pools');
  } catch {}
  try {
    await arbdb.createCollection('tokens');
  } catch {}
  try {
    await arbdb.createCollection('factories');
  } catch {}
  // const updateResult = await dbase
  //   .collection('tick_positions2')
  //   .updateOne({ name: 'fatter4' }, { $set: { name: 'fatter5' } }, { upsert: true });
  // console.log('xxxxx:', updateResult);
  // // dbase.collection('tick_positions2').insertOne({ _id: new ObjectId(1), name: 'fatter1' });
  // dbase.collection('tick_positions2').findOne({ name: 'fatter5' }, (err, result) => {
  //   console.log('mongo', err, result._id.toHexString(), result.name);
  // });
  return arbdb;
  // huobiClient.reconnect();
};
