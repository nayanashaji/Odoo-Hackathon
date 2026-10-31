import mongoose from 'mongoose';

// Password hashes and reset tokens are kept out of the public User record.
const credentialSchema = new mongoose.Schema({
  user_id: { type: String, required: true, unique: true, index: true },
  password_hash: { type: String, required: true },
  reset_token_hash: { type: String, default: null },
  reset_token_expires_at: { type: Date, default: null }
}, { timestamps: true, versionKey: false });

export default mongoose.model('Credential', credentialSchema);
