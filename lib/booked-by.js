// "Who booked this?" for website bookings. A staff member opens the site from their own link
// (e.g. tireplugla.com/?by=belen, the "Book a customer" button on /belen); the name is kept for that
// browser tab only (sessionStorage), and /book sends it with the booking as bookedBy, which is saved in
// leads.raw.bookedBy, the same field the admin Front Desk uses for its bookings. Browser only.
const KEY = "tp_booked_by";
const NAMES = { belen: "Belen" }; // only these links count

export function rememberBookedBy() {
  try {
    const by = new URLSearchParams(window.location.search).get("by");
    if (by && NAMES[by.toLowerCase()]) sessionStorage.setItem(KEY, NAMES[by.toLowerCase()]);
  } catch { /* private mode */ }
}

export function bookedByName() {
  try { return sessionStorage.getItem(KEY) || null; } catch { return null; }
}
