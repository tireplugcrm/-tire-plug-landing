import axios from 'axios';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { name, phone, email, vehicle, service, date, time } = req.body;

  if (!name || !phone || !email || !service || !date || !time) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const bookingData = {
    name,
    phone,
    email,
    vehicle,
    service,
    date,
    time,
    source: 'vercel-website',
    timestamp: new Date().toISOString(),
  };

  try {
    console.log('✓ New booking received:', { name, phone, email, vehicle, service, date, time });

    // 1. Send to GHL webhook (creates contact + sends confirmation email)
    await axios.post(
      'https://services.leadconnectorhq.com/hooks/uWIoIC6rPbRxDvh7TvRN/webhook-trigger/3f00a391-328b-45a4-ab10-eba6e19e065b',
      bookingData,
      { headers: { 'Content-Type': 'application/json' } }
    );
    console.log('✓ Sent to GHL successfully');

    // 2. Send to N8N for automation workflows
    await axios.post(
      'https://tireplug.app.n8n.cloud/webhook-test/tire-plug-booking',
      bookingData,
      { headers: { 'Content-Type': 'application/json' } }
    );
    console.log('✓ Sent to N8N successfully');

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
      details: error.message,
    });
  }
}