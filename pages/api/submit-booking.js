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

  console.log('New booking received:', bookingData);

  let ghlSuccess = false;

  // STEP 1: Send to GHL (this is what creates the contact + sends email)
  try {
    await axios.post(
      'https://services.leadconnectorhq.com/hooks/uWIoIC6rPbRxDvh7TvRN/webhook-trigger/3f00a391-328b-45a4-ab10-eba6e19e065b',
      bookingData,
      { headers: { 'Content-Type': 'application/json' }, timeout: 8000 }
    );
    ghlSuccess = true;
    console.log('GHL: SUCCESS');
  } catch (ghlError) {
    console.error('GHL: FAILED', ghlError.message);
  }

  // STEP 2: Try N8N (optional - we do not care if it fails)
  try {
    await axios.post(
      'https://tireplug.app.n8n.cloud/webhook/tire-plug-booking',
      bookingData,
      { headers: { 'Content-Type': 'application/json' }, timeout: 5000 }
    );
    console.log('N8N: SUCCESS');
  } catch (n8nError) {
    console.log('N8N: FAILED (not critical)', n8nError.message);
  }

  // STEP 3: As long as GHL worked, return SUCCESS
  if (ghlSuccess) {
    return res.status(200).json({
      success: true,
      message: 'Booking submitted successfully',
    });
  } else {
    return res.status(500).json({
      success: false,
      error: 'Failed to submit booking. Please call 562-513-0217',
    });
  }
}