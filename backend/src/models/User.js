import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  role: { type: String, enum: ['admin', 'staff', 'customer'], default: 'customer', required: true }
}, { timestamps: true, versionKey: false });

export default mongoose.model('User', userSchema);
