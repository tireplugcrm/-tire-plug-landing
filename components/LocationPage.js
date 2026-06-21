import React from "react";
import Head from "next/head";
import Header from "./Header";
import Footer from "./Footer";

const SERVICES = ["New Tires", "Used Tires", "Wheel Alignment", "TPMS Sensors", "Oil Changes", "Brake Service", "Tire Rotation & Balance", "Free Tire Inspection", "Battery Service", "Free Air Check"];

export default function LocationPage({ loc }) {
  const url = `https://tireplugla.com/${loc.slug}`;
  const weekday = loc.weekday || [{ dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"], opens: "09:00", closes: "18:00" }];
  const hours = weekday.map((w) => ({ "@type": "OpeningHoursSpecification", dayOfWeek: w.dayOfWeek, opens: w.opens, closes: w.closes }));
  if (loc.sunday) hours.push({ "@type": "OpeningHoursSpecification", dayOfWeek: "Sunday", opens: loc.sunday[0], closes: loc.sunday[1] });
  const schema = {
    "@context": "https://schema.org", "@type": "AutoRepair",
    name: `The Tire Plug — ${loc.label}`, image: "https://tireplugla.com/images/logo.webp", url,
    telephone: "+1-562-513-0217", priceRange: "$$",
    address: { "@type": "PostalAddress", streetAddress: loc.street, addressLocality: "Los Angeles", addressRegion: "CA", postalCode: loc.zip, addressCountry: "US" },
    areaServed: loc.neighborhoods.map((n) => ({ "@type": "Place", name: n })),
    openingHoursSpecification: hours,
    makesOffer: SERVICES.map((s) => ({ "@type": "Offer", itemOffered: { "@type": "Service", name: s } })),
  };
  return (
    <>
      <Head>
        <title>{loc.title}</title>
        <meta name="description" content={loc.description} />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="canonical" href={url} />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="The Tire Plug" />
        <meta property="og:title" content={loc.title} />
        <meta property="og:description" content={loc.description} />
        <meta property="og:url" content={url} />
        <meta property="og:image" content="https://tireplugla.com/images/logo.webp" />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      </Head>
      <Header />
      <main style={{ background: "#000", color: "#fff", fontFamily: "system-ui, -apple-system, sans-serif", minHeight: "60vh" }}>
        <section style={{ padding: "4rem 1.5rem 2.5rem", maxWidth: 940, margin: "0 auto" }}>
          <span style={{ color: "#FF1F1F", fontWeight: 800, letterSpacing: "0.15em", textTransform: "uppercase", fontSize: "0.76rem" }}>{loc.tag} · {loc.label}</span>
          <h1 style={{ fontSize: "2.3rem", fontWeight: 900, lineHeight: 1.1, margin: "0.6rem 0 1rem" }}>{loc.h1}</h1>
          <p style={{ color: "rgba(255,255,255,0.72)", fontSize: "1.05rem", lineHeight: 1.6, maxWidth: 700 }}>{loc.intro}</p>
          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", margin: "2rem 0 1.5rem" }}>
            <div style={card}><div style={cardLabel}>📍 Address</div><div style={cardVal}>{loc.street}<br />Los Angeles, CA {loc.zip}</div></div>
            <div style={card}><div style={cardLabel}>🕐 Hours</div><div style={cardVal}>{(loc.hoursLines || ["Mon–Sat · 9AM–6PM", loc.sundayText]).map((line, i) => (<React.Fragment key={i}>{i > 0 && <br />}{line}</React.Fragment>))}</div></div>
            <div style={card}><div style={cardLabel}>📞 Phone</div><div style={cardVal}>(562) 513-0217</div></div>
          </div>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <a href="tel:5625130217" style={ctaRed}>📞 Call Now</a>
            <a href={loc.directionsUrl} target="_blank" rel="noopener noreferrer" style={ctaGhost}>🗺️ Get Directions</a>
            <a href="/#booking" style={ctaGhost}>Get a Quote</a>
          </div>
        </section>

        <section style={{ padding: "1.5rem 1.5rem 2.5rem", maxWidth: 940, margin: "0 auto", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          <h2 style={h2}>Services at our {loc.label} tire shop</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "0.6rem" }}>
            {SERVICES.map((s) => <div key={s} style={chip}>{s}</div>)}
          </div>
        </section>

        <section style={{ padding: "0 1.5rem 4rem", maxWidth: 940, margin: "0 auto" }}>
          <h2 style={h2}>Proudly serving {loc.areaText}</h2>
          <p style={{ color: "rgba(255,255,255,0.6)", lineHeight: 1.6, maxWidth: 720 }}>
            Drivers around {loc.neighborhoods.join(", ")} trust The Tire Plug for honest pricing and same-day tire service.
            Come by {loc.street} in Los Angeles or call <a href="tel:5625130217" style={{ color: "#FF6666" }}>(562) 513-0217</a> for a fast quote on new or used tires, an alignment, or an oil change.
          </p>
          <p style={{ marginTop: "1.25rem" }}><a href="/" style={{ color: "#FF6666", fontWeight: 700 }}>← Back to The Tire Plug home</a></p>
        </section>
      </main>
      <Footer />
    </>
  );
}

const card = { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14, padding: "1rem 1.25rem", minWidth: 200 };
const cardLabel = { color: "#FF6666", fontSize: "0.7rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.4rem" };
const cardVal = { color: "#fff", fontSize: "0.95rem", lineHeight: 1.5 };
const h2 = { fontSize: "1.4rem", fontWeight: 800, margin: "0 0 1rem" };
const chip = { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "0.7rem 1rem", color: "rgba(255,255,255,0.85)", fontSize: "0.88rem", fontWeight: 600 };
const ctaRed = { background: "linear-gradient(180deg, #FF2A2A 0%, #C20000 100%)", color: "#fff", padding: "0.85rem 1.5rem", borderRadius: 10, fontWeight: 800, textDecoration: "none", fontSize: "0.9rem" };
const ctaGhost = { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)", color: "#fff", padding: "0.85rem 1.5rem", borderRadius: 10, fontWeight: 700, textDecoration: "none", fontSize: "0.9rem" };
