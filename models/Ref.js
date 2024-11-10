// models/Ref.js
import mongoose from 'mongoose';

const RefSchema = new mongoose.Schema({
  walletAddress: { type: String, required: true, unique: true },
  refParam: { type: String, required: true },
});

export default mongoose.models.Ref || mongoose.model('Ref', RefSchema);
