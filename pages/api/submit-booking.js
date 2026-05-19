import axios from 'axios';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { name, phone, email, vehicle, service, date, time } = req.body;

  if (!name || !phone || !email || !service || !date || !time) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // For now, just log the booking (we'll connect to GHL later)
    console.log('✓ New booking received:', { name, phone, email, vehicle, service, date, time });

    // TODO: Send to GHL webhook (we'll set this up in Week 2)
    // const ghlResponse = await axios.post(process.env.GHL_WEBHOOK_URL, { ... });

    return res.status(200).json({
      success: true,
      message: 'Booking submitted successfully',
      data: { name, phone, email, service, date, time },
    });

  } catch (error) {
    console.error('✗ Error submitting booking:', error.message);
    
    return res.status(500).json({
      success: false,
      error: 'Failed to submit booking',
    });
  }
}