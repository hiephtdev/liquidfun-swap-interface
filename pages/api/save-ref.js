// pages/api/save-ref.js
import connectToDatabase from '@/lib/mongodb';
import Ref from '@/models/Ref';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  await connectToDatabase();

  try {
    const { walletAddress, refParam } = req.body;

    if (!walletAddress || !refParam) {
      return res.status(400).json({ message: 'Missing walletAddress or refParam' });
    }

    if (`${walletAddress}`.toLowerCase() === `${refParam}`.toLowerCase()) {
      return res.status(400).json({ message: 'walletAddress and refParam cannot be the same' });
    }

    // Kiểm tra nếu đã tồn tại `refParam` cho `walletAddress` này
    const existingRef = await Ref.findOne({ walletAddress });
    if (existingRef && existingRef.refParam) {
      return res.status(200).json({ message: 'RefParam already exists, no changes made.', ref: existingRef.refParam });
    }

    // Nếu chưa có, tạo hoặc cập nhật refParam
    await Ref.findOneAndUpdate(
      { walletAddress: { $regex: new RegExp(`^${walletAddress}$`, 'i') } },
      { refParam },
      { upsert: true, new: true }
    );

    res.status(200).json({ message: 'RefParam saved successfully' });
  } catch (error) {
    console.error('Error saving refParam:', error);
    res.status(500).json({ message: 'Failed to save refParam' });
  }
}
