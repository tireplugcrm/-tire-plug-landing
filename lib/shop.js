// The shop's public facts: one place for the phone, texting line, address, hours
// and booking-button wording. Pages, components and SHOP_FACTS (lib/shop-facts.js)
// all read from here, so change a fact here and it changes everywhere.
// (lib/booking.js keeps its own minute-based copy of HOURS for the slot math.)

export const PHONE = {
  display: "(562) 500-4625",
  plain: "562-500-4625",
  e164: "+15625004625",
  schema: "+1-562-500-4625",
  tel: "tel:+15625004625",
  sms: "sms:+15625004625",
};

// Our automated texts (deals, reminders, confirmations) come from this GoHighLevel
// line. People call and text us at PHONE; we text them from TEXT_LINE.
export const TEXT_LINE = { display: "(562) 250-3737" };

// An sms: link to the shop with a prefilled message.
export const smsHref = (body) => (body ? `${PHONE.sms}?&body=${encodeURIComponent(body)}` : PHONE.sms);

export const ADDRESS = {
  street: "2331 E Olympic Blvd",
  city: "Los Angeles",
  region: "CA",
  zip: "90021",
  area: "Downtown LA",
  oneLine: "2331 E Olympic Blvd, Los Angeles, CA 90021",
  directions: "https://www.google.com/maps/dir/?api=1&destination=2331+E+Olympic+Blvd+Los+Angeles+CA+90021",
};

// Opening hours, 24h "HH:MM", by weekday (0 = Sunday).
export const HOURS = [
  { days: [1, 2, 3, 4, 5], label: "Mon–Fri", long: "Monday–Friday", opens: "09:00", closes: "19:00" },
  { days: [6], label: "Sat", long: "Saturday", opens: "09:00", closes: "18:00" },
  { days: [0], label: "Sun", long: "Sunday", opens: "10:00", closes: "16:00" },
];

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const hour12 = (hhmm) => {
  const h = +hhmm.slice(0, 2);
  return `${h % 12 || 12}${h < 12 ? "AM" : "PM"}`;
};

// [open, close] in whole hours by weekday, for the open/closed badge.
export const HOURS_BY_DAY = Object.fromEntries(
  HOURS.flatMap((h) => h.days.map((d) => [d, [+h.opens.slice(0, 2), +h.closes.slice(0, 2)]]))
);

// "Mon–Fri · 9AM–7PM", "Sat · 9AM–6PM", "Sun · 10AM–4PM"
export const HOURS_LINES = HOURS.map((h) => `${h.label} · ${hour12(h.opens)}–${hour12(h.closes)}`);
export const HOURS_TEXT = HOURS.map((h) => `${h.label} ${hour12(h.opens)}–${hour12(h.closes)}`).join(", ");

// schema.org openingHoursSpecification
export const OPENING_HOURS = HOURS.map((h) => ({
  "@type": "OpeningHoursSpecification",
  dayOfWeek: h.days.length === 1 ? DAY_NAMES[h.days[0]] : h.days.map((d) => DAY_NAMES[d]),
  opens: h.opens,
  closes: h.closes,
}));

// Wording for the buttons that do the same job on every page.
export const CTA = {
  shopTires: "Shop tires",         // → /tires (pick a size, then a tire)
  bookTire: "Book install",        // → /book?size=…&tire=… (a chosen tire)
  bookService: "Book a service",   // → /book?service=…
  call: "Call",
  callNumber: `Call ${PHONE.display}`,
  text: "Text us",
};
