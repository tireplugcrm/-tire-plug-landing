// One place to record what visitors do, sent to every analytics tool that's switched on:
// Vercel Web Analytics (custom events need a Vercel Pro plan; ignored otherwise),
// Meta Pixel (if NEXT_PUBLIC_META_PIXEL_ID is set) and GA4 (if NEXT_PUBLIC_GA_ID is set).
import { track as vercelTrack } from '@vercel/analytics';

export function track(name, props = {}, meta) {
  if (typeof window === 'undefined') return;
  try { vercelTrack(name, props); } catch {}
  if (window.fbq && meta) window.fbq('track', meta.event, meta.params || {});
  if (window.gtag) window.gtag('event', name.toLowerCase().replace(/\s+/g, '_'), props);
}

// Every "Text" and "Call" button on the site is an sms: / tel: link, so one listener covers
// them all. These are the leads Meta ads should optimize for ("Contact" event).
export function trackContactClicks() {
  const onClick = (e) => {
    const a = e.target.closest && e.target.closest('a[href^="sms:"], a[href^="tel:"]');
    if (!a) return;
    const kind = a.getAttribute('href').startsWith('sms:') ? 'Text' : 'Call';
    const props = { page: window.location.pathname, button: (a.textContent || '').trim().slice(0, 40) };
    track(`${kind} click`, props, { event: 'Contact', params: { content_category: kind.toLowerCase() } });
  };
  document.addEventListener('click', onClick, true);
  return () => document.removeEventListener('click', onClick, true);
}
