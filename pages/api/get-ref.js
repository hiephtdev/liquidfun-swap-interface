// pages/api/get-ref.js
import connectToDatabase from '@/lib/mongodb';
import Ref from '@/models/Ref';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  await connectToDatabase();

  try {
    const { walletAddress } = req.query;
    const result = await Ref.findOne({ walletAddress });
    res.status(200).json({ refParam: result ? result.refParam : null });
  } catch (error) {
    console.error('Error fetching refParam:', error);
    res.status(500).json({ message: 'Failed to fetch refParam' });
  }
}
