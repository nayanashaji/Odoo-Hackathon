import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  status: { type: String, required: true },
  lines: [{ product_id: String, quantity: Number, total_amount: Number }]
}, { collection: 'subscriptions', strict: true, versionKey: false });

export default mongoose.model('Subscription', schema);
