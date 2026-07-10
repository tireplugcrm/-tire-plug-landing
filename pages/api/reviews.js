// Live Google reviews for the landing page.
//
// Pulls the shop's latest Google reviews via the Google Places "Place Details"
// API and returns up to 5. Falls back to the curated real reviews whenever the
// API key / Place ID aren't set or Google is unreachable, so the site always
// shows real content and never breaks.
//
// Required Vercel env vars to go live:
//   GOOGLE_PLACES_API_KEY  — a Google Cloud key with the Places API enabled + billing on
//   GOOGLE_PLACE_ID        — the Olympic shop's Place ID (find via Google's Place ID Finder)
//
// Cached at the edge so we call Google at most a few times a day (keeps cost ~$0).
import { REVIEWS_FALLBACK } from "../../lib/reviews-fallback.js";

function mapGoogleReview(r) {
  const name = (r.author_name || "Google User").trim();
  return {
    name,
    initial: (name[0] || "G").toUpperCase(),
    rating: r.rating || 5,
    date: r.relative_time_description || "",
    text: (r.text || "").trim(),
  };
}

export default async function handler(req, res) {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  const placeId = process.env.GOOGLE_PLACE_ID;

  // Edge-cache the response for 6h (serve stale up to a day while revalidating).
  res.setHeader("Cache-Control", "public, s-maxage=21600, stale-while-revalidate=86400");

  // Not configured yet → serve the real fallback reviews.
  if (!key || !placeId) {
    return res.status(200).json({ source: "fallback", reviews: REVIEWS_FALLBACK });
  }

  try {
    const url =
      "https://maps.googleapis.com/maps/api/place/details/json" +
      `?place_id=${encodeURIComponent(placeId)}` +
      "&fields=rating,user_ratings_total,reviews" +
      "&reviews_sort=newest&language=en" +
      `&key=${encodeURIComponent(key)}`;
    const r = await fetch(url);
    const d = await r.json();

    const list = (d.result && d.result.reviews) || [];
    const reviews = list
      .filter((rv) => rv && rv.text && (rv.rating || 0) >= 4)
      .map(mapGoogleReview)
      .slice(0, 5);

    if (!reviews.length) {
      return res.status(200).json({ source: "fallback", reviews: REVIEWS_FALLBACK });
    }
    return res.status(200).json({
      source: "google",
      rating: d.result.rating || null,
      total: d.result.user_ratings_total || null,
      reviews,
    });
  } catch (e) {
    return res.status(200).json({ source: "fallback", reviews: REVIEWS_FALLBACK });
  }
}
