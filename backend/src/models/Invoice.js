import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  status: { type: String, required: true },
  grand_total: { type: Number, required: true },
  // Optional dates support due-date tracking when invoice records include them.
  issue_date: Date,
  due_date: Date
}, { collection: 'invoices', strict: true, versionKey: false });

export default mongoose.model('Invoice', schema);
