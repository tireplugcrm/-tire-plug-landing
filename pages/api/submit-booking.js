export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    name,
    phone,
    email,
    vehicle,
    tireSize,
    tireType,
    service,
    serviceTiming,
    leadPriority,
    date,
    time,
    source,
    promoCode,
  } = req.body;

  // ============================================
  // DETERMINE LEAD TYPE & BUILD TAGS
  // ============================================
  const isSubscriber = leadPriority === 'SUBSCRIBER' || source === 'Website Discount Popup';

  let tags = [];

  if (isSubscriber) {
    // PIPELINE B: NEWSLETTER SUBSCRIBER
    tags = [
      'NEWSLETTER',
      'Website Popup',
      'Discount Club',
    ];
  } else {
    // PIPELINE A: BOOKING LEAD
    tags = ['BOOKING'];

    // Priority tag (HOT/WARM/SHOPPING)
    if (leadPriority === 'HOT') {
      tags.push('Booking - HOT');
    } else if (leadPriority === 'WARM') {
      tags.push('Booking - WARM');
    } else if (serviceTiming === 'Just Pricing') {
      tags.push('Booking - SHOPPING');
    }

    // Service type tags (parse from service string)
    if (service) {
      const serviceLower = service.toLowerCase();
      if (serviceLower.includes('oil')) tags.push('Service - Oil Change');
      if (serviceLower.includes('tire') && !serviceLower.includes('rotation')) tags.push('Service - New Tires');
      if (serviceLower.includes('alignment')) tags.push('Service - Alignment');
      if (serviceLower.includes('tpms')) tags.push('Service - TPMS');
      if (serviceLower.includes('brake')) tags.push('Service - Brakes');
      if (serviceLower.includes('rotation')) tags.push('Service - Rotation');
    }

    // Customer status (new by default — GHL can upgrade later)
    tags.push('Customer - New');
  }

  // ============================================
  // BUILD GHL PAYLOAD
  // ============================================
  const ghlPayload = {
    first_name: name?.split(' ')[0] || name || 'Subscriber',
    last_name: name?.split(' ').slice(1).join(' ') || '',
    email: email,
    phone: phone !== 'N/A' ? phone : '',
    tags: tags,
    source: source || (isSubscriber ? 'Website Discount Popup' : 'Website Booking Form'),
    customFields: {
      lead_priority: leadPriority || 'WARM',
      service_requested: service || 'Newsletter Signup',
      service_timing: serviceTiming || 'N/A',
      vehicle: vehicle || 'N/A',
      tire_size: tireSize || 'N/A',
      tire_type: tireType || 'N/A',
      preferred_date: date || 'N/A',
      preferred_time: time || 'N/A',
      promo_code: promoCode || 'N/A',
    },
  };

  // ============================================
  // ROUTE TO CORRECT GHL WEBHOOK
  // ============================================
  const SUBSCRIBER_WEBHOOK = 'https://services.leadconnectorhq.com/hooks/uWIoIC6rPbRxDvh7TvRN/webhook-trigger/7c368f50-25cd-46b1-bd54-35bdfb5ff024';
  const BOOKING_WEBHOOK = 'https://services.leadconnectorhq.com/hooks/uWIoIC6rPbRxDvh7TvRN/webhook-trigger/ac7b9d88-9767-44c7-a8ac-00e4b9c778ef';

  const webhookUrl = isSubscriber ? SUBSCRIBER_WEBHOOK : BOOKING_WEBHOOK;

  // ============================================
  // SEND TO GHL (PRIMARY — MUST SUCCEED)
  // ============================================
  let ghlSuccess = false;
  try {
    const ghlResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ghlPayload),
    });
    ghlSuccess = ghlResponse.ok;
  } catch (err) {
    console.error('GHL submission error:', err);
  }

  // ============================================
  // SEND TO N8N (SECONDARY — ONLY FOR BOOKINGS)
  // ============================================
  if (!isSubscriber && ghlSuccess) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      await fetch(
        'https://tireplug.app.n8n.cloud/webhook/tire-plug-booking',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...req.body,
            tags: tags,
            pipeline: 'BOOKING',
          }),
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);
    } catch (err) {
      console.error('N8N submission error (non-blocking):', err);
    }
  }

  // ============================================
  // RESPOND
  // ============================================
  if (ghlSuccess) {
    return res.status(200).json({
      success: true,
      pipeline: isSubscriber ? 'SUBSCRIBER' : 'BOOKING',
      tags: tags,
    });
  } else {
    return res.status(500).json({
      success: false,
      error: 'Submission failed. Please call 562-513-0217',
    });
  }
}