import { supabaseAdmin } from '../../lib/supabaseAdmin.js';

// Text-quote intake (Option A / intent capture).
//
// The homepage "Text us your size" box uses a raw sms: link, so the customer's
// phone opens Messages and texts the shop directly — the message itself never
// touches our server. This endpoint captures the INTENT the instant they tap
// send (name + tire size), so everyone who starts a text quote still shows up in
// the admin Leads tab, tagged "TEXT QUOTE".
//
// Note: no phone number is available here — the SMS handoff doesn't return it.
// Called as a fire-and-forget beacon, so we never surface an error to the visitor.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { name, tireSize, sizeUnknown } = req.body || {};

  if (!supabaseAdmin) {
    return res.status(200).json({ success: false });
  }

  const tags = ['TEXT QUOTE', 'Customer - New', 'Service - New Tires'];
  if (sizeUnknown) tags.push('Size - Unknown');

  try {
    await supabaseAdmin.from('leads').insert({
      name: name || null,
      tire_size: tireSize || null,
      service: 'New Tires',
      service_timing: 'Just Pricing',
      lead_priority: 'SHOPPING',
      source: 'Website Text Quote',
      tags,
      raw: req.body,
    });
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Text-quote save error:', err);
    return res.status(200).json({ success: false });
  }
}
