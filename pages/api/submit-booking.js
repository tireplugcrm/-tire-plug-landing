import { supabaseAdmin } from '../../lib/supabaseAdmin.js';
import { sendSms } from '../../lib/sms.js';
import { digits10 } from '../../lib/phone.js';
import { GREETING_TEXT } from '../../lib/shop-facts.js';

// Booking + newsletter intake. Everything runs through our own platform (Supabase
// + the admin dashboard) — no GoHighLevel, no n8n. The lead is saved first and is
// the source of truth, so the customer is never shown a false "failed" message.
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
    source,
    promoCode,
    smsConsent,
  } = req.body || {};

  const isSubscriber = leadPriority === 'SUBSCRIBER' || source === 'Website Discount Popup';

  // ---- Tags (used for filtering/segmenting in the admin dashboard) ----
  let tags = [];
  if (isSubscriber) {
    tags = ['NEWSLETTER', 'Website Popup', 'Discount Club'];
  } else {
    tags = ['BOOKING'];
    if (leadPriority === 'HOT') tags.push('Booking - HOT');
    else if (leadPriority === 'WARM') tags.push('Booking - WARM');
    else if (serviceTiming === 'Just Pricing') tags.push('Booking - SHOPPING');

    if (service) {
      const s = service.toLowerCase();
      if (s.includes('oil')) tags.push('Service - Oil Change');
      if (s.includes('tire') && !s.includes('rotation')) tags.push('Service - New Tires');
      if (s.includes('alignment')) tags.push('Service - Alignment');
      if (s.includes('tpms')) tags.push('Service - TPMS');
      if (s.includes('brake')) tags.push('Service - Brakes');
      if (s.includes('rotation')) tags.push('Service - Rotation');
    }
    tags.push('Customer - New');
  }

  // Our platform must be reachable to capture the lead.
  if (!supabaseAdmin) {
    return res.status(500).json({ success: false, error: 'Booking is temporarily unavailable. Please call 562-500-4625.' });
  }

  try {
    // ---- Newsletter / discount-popup signup ----
    if (isSubscriber) {
      await supabaseAdmin.from('subscribers').insert({
        name: name || null,
        email: email || null,
        source: source || 'Website Discount Popup',
        tags,
      });
      return res.status(200).json({ success: true, pipeline: 'SUBSCRIBER', tags });
    }

    // ---- Booking lead ----
    const cleanPhone = phone && phone !== 'N/A' ? phone : null;
    const { data: inserted, error } = await supabaseAdmin.from('leads').insert({
      name: name || null,
      phone: cleanPhone,
      email: email && email !== 'N/A' ? email : null,
      vehicle: vehicle && vehicle !== 'N/A' ? vehicle : null,
      tire_size: tireSize && tireSize !== 'N/A' ? tireSize : null,
      tire_type: tireType && tireType !== 'N/A' ? tireType : null,
      service: service || null,
      service_timing: serviceTiming || null,
      lead_priority: serviceTiming === 'Just Pricing' ? 'SHOPPING' : (leadPriority || 'WARM'),
      source: source || 'Website Booking Form',
      promo_code: promoCode && promoCode !== 'N/A' ? promoCode : null,
      tags,
      raw: req.body,
    }).select('id').single();

    if (error) throw error;

    // SPEED-TO-LEAD: auto-text the greeting the instant the lead arrives —
    // ONLY if they actually ticked the SMS-consent box (TCPA/A2P compliance).
    if (inserted && cleanPhone && smsConsent === true) {
      const sms = await sendSms({ to: cleanPhone, body: GREETING_TEXT });
      if (sms.ok) {
        await supabaseAdmin.from('lead_messages').insert({
          lead_id: inserted.id,
          direction: 'outbound',
          phone: digits10(cleanPhone),
          body: GREETING_TEXT,
          twilio_sid: sms.sid,
          status: sms.status,
          read: true,
        });
      }
    }

    return res.status(200).json({ success: true, pipeline: 'BOOKING', tags });
  } catch (err) {
    console.error('Booking save error:', err);
    return res.status(500).json({ success: false, error: 'Something went wrong. Please call 562-500-4625.' });
  }
}
