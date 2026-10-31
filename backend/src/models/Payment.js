import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  amount: { type: Number, required: true },
  date: Date
}, { collection: 'payments', strict: true, versionKey: false });

export default mongoose.model('Payment', schema);
