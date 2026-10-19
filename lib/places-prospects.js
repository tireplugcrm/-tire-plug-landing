/**
 * Find local businesses with vehicles near the shop through Google's public Places API
 * (the same GOOGLE_PLACES_API_KEY the reviews use). No scraping: Google returns the listing's
 * name, address, phone, website and type. Places never returns an email address, so staff add
 * the business's own published email from its website before anything is sent.
 *
 * Cost: one Text Search call returns up to 20 businesses; a group below is ~5 queries x up to
 * 3 pages, so one search run is at most ~15-30 calls, well inside Google's free monthly calls.
 */

// Owner's picks (2026-10-18): these four groups, 5 miles around 2331 E Olympic Blvd.
export const RADIUS_MILES = 5;
export const GROUPS = {
  "Delivery & trucking": ["trucking company", "courier delivery service", "produce wholesale distributor", "moving company", "logistics company"],
  "Contractors & trades": ["plumber", "electrician", "HVAC contractor", "general contractor", "landscaping company", "commercial cleaning service"],
  "Auto-adjacent": ["used car dealer", "auto repair shop", "auto body shop", "car rental agency", "towing service"],
  "Rideshare & limo": ["limousine service", "shuttle service", "taxi company", "rideshare car rental"],
};
const MAX_PAGES = 3;

// The shop, in case the shop's own Place lookup fails.
const SHOP_FALLBACK = { lat: 34.0196, lng: -118.2318 };

const miles = (a, b) => {
  const r = (d) => (d * Math.PI) / 180, R = 3958.8;
  const x = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
};

async function shopLocation(key) {
  const id = process.env.GOOGLE_PLACE_ID;
  if (!id) return SHOP_FALLBACK;
  try {
    const r = await fetch(`https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(id)}&fields=geometry&key=${encodeURIComponent(key)}`);
    const loc = (await r.json())?.result?.geometry?.location;
    return loc ? { lat: loc.lat, lng: loc.lng } : SHOP_FALLBACK;
  } catch { return SHOP_FALLBACK; }
}

// Places API (New): name, address, phone and website in one call.
async function searchNew(key, query, center, pageToken) {
  const r = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json", "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location,places.nationalPhoneNumber,places.websiteUri,places.primaryTypeDisplayName,places.businessStatus,nextPageToken",
    },
    body: JSON.stringify({
      textQuery: query, pageSize: 20, ...(pageToken ? { pageToken } : {}),
      locationBias: { circle: { center: { latitude: center.lat, longitude: center.lng }, radius: RADIUS_MILES * 1609 } },
    }),
  });
  const d = await r.json();
  if (!r.ok) { const e = new Error(d?.error?.message || `Places error ${r.status}`); e.status = r.status; throw e; }
  return {
    next: d.nextPageToken || null,
    places: (d.places || []).map((p) => ({
      place_id: p.id, name: p.displayName?.text, address: p.formattedAddress, phone: p.nationalPhoneNumber || null,
      website: p.websiteUri || null, type: p.primaryTypeDisplayName?.text || null, status: p.businessStatus,
      loc: p.location ? { lat: p.location.latitude, lng: p.location.longitude } : null,
    })),
  };
}

// Legacy Places API (what the reviews already use), if the New API isn't enabled on the key:
// Text Search for the list, then Place Details for phone + website.
async function searchLegacy(key, query, center, pageToken) {
  const q = pageToken
    ? `pagetoken=${encodeURIComponent(pageToken)}`
    : `query=${encodeURIComponent(query)}&location=${center.lat},${center.lng}&radius=${RADIUS_MILES * 1609}`;
  if (pageToken) await new Promise((r) => setTimeout(r, 2000)); // Google's next page needs a moment
  const d = await (await fetch(`https://maps.googleapis.com/maps/api/place/textsearch/json?${q}&key=${encodeURIComponent(key)}`)).json();
  if (d.status && !["OK", "ZERO_RESULTS"].includes(d.status)) throw new Error(d.error_message || d.status);
  const places = (d.results || []).map((p) => ({
    place_id: p.place_id, name: p.name, address: p.formatted_address, phone: null, website: null,
    type: (p.types || [])[0]?.replace(/_/g, " ") || null, status: p.business_status,
    loc: p.geometry?.location ? { lat: p.geometry.location.lat, lng: p.geometry.location.lng } : null,
  }));
  return { next: d.next_page_token || null, places, legacy: true };
}

async function contactLegacy(key, p) {
  try {
    const d = await (await fetch(`https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(p.place_id)}&fields=formatted_phone_number,website&key=${encodeURIComponent(key)}`)).json();
    return { ...p, phone: d.result?.formatted_phone_number || null, website: d.result?.website || null };
  } catch { return p; }
}

/**
 * Every operating business for one group within the radius, deduped by Google place id.
 * Returns { found: [{ place_id, name, address, phone, website, type, miles }], calls, api }.
 */
export async function findBusinesses(group, { skipIds = new Set() } = {}) {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) throw new Error("GOOGLE_PLACES_API_KEY is not set.");
  const queries = GROUPS[group];
  if (!queries) throw new Error("Unknown business type.");
  const center = await shopLocation(key);
  let search = searchNew, api = "new", calls = 1;
  const byId = new Map();
  for (const query of queries) {
    let token = null;
    for (let page = 0; page < MAX_PAGES; page++) {
      let out;
      try { out = await search(key, query, center, token); }
      catch (e) {
        // New API not enabled on this key: switch to the legacy API once, then retry.
        if (api === "new" && (e.status === 403 || /not been used|disabled|PERMISSION/i.test(e.message))) {
          search = searchLegacy; api = "legacy"; out = await search(key, query, center, null); page = 0;
        } else throw e;
      }
      calls += 1;
      for (const p of out.places) {
        if (!p.place_id || !p.name || !p.loc || byId.has(p.place_id) || skipIds.has(p.place_id)) continue;
        if (p.status && p.status !== "OPERATIONAL") continue;
        const d = miles(center, p.loc);
        if (d > RADIUS_MILES) continue;
        byId.set(p.place_id, { ...p, miles: Math.round(d * 10) / 10 });
      }
      token = out.next;
      if (!token) break;
    }
  }
  let found = [...byId.values()];
  if (api === "legacy") { found = await Promise.all(found.map((p) => contactLegacy(key, p))); calls += found.length; }
  return { found: found.sort((a, b) => a.miles - b.miles), calls, api };
}

// Free webmail: often a person's own inbox. Allowed only when the business itself lists it
// (many small contractors do), so the admin flags these for a human to confirm.
const FREE_MAIL = /@(gmail|googlemail|yahoo|ymail|hotmail|outlook|live|msn|aol|icloud|me|mac|comcast|att|sbcglobal|verizon|protonmail|proton)\.\w+$/i;
export const isFreeMail = (email) => FREE_MAIL.test(String(email || ""));
