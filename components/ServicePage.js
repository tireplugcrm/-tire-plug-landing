import React from "react";
import Head from "next/head";
import Header from "./Header";
import Footer from "./Footer";

export const SERVICE_INDEX = [
  { slug: "new-tires-los-angeles", label: "New Tires" },
  { slug: "used-tires-los-angeles", label: "Used Tires" },
  { slug: "wheel-alignment-los-angeles", label: "Wheel Alignment" },
  { slug: "oil-change-los-angeles", label: "Oil Change" },
  { slug: "tpms-sensors-los-angeles", label: "TPMS Sensors" },
  { slug: "brake-service-los-angeles", label: "Brake Service" },
];

const WHY = [
  "Honest, upfront pricing — no surprises",
  "Same-day appointments, walk-ins welcome",
  "Two Los Angeles locations: Downtown (Olympic Blvd) & South LA (Manchester Ave)",
  "Free tire inspection & air check",
  "Trusted local shop — quotes by text or phone",
];

export default function ServicePage({ svc }) {
  const url = `https://tireplugla.com/${svc.slug}`;
  const schema = {
    "@context": "https://schema.org", "@type": "Service",
    name: `${svc.label} in Los Angeles`, serviceType: svc.label,
    areaServed: { "@type": "City", name: "Los Angeles" },
    provider: { "@type": "AutoRepair", name: "The Tire Plug", telephone: "+1-562-513-0217", url: "https://tireplugla.com/", image: "https://tireplugla.com/images/logo.webp" },
    url,
  };
  const related = SERVICE_INDEX.filter((s) => s.slug !== svc.slug);
  return (
    <>
      <Head>
        <title>{svc.title}</title>
        <meta name="description" content={svc.description} />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="canonical" href={url} />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="The Tire Plug" />
        <meta property="og:title" content={svc.title} />
        <meta property="og:description" content={svc.description} />
        <meta property="og:url" content={url} />
        <meta property="og:image" content="https://tireplugla.com/images/logo.webp" />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      </Head>
      <Header />
      <main style={{ background: "#000", color: "#fff", fontFamily: "system-ui, -apple-system, sans-serif", minHeight: "60vh" }}>
        <section style={{ padding: "4rem 1.5rem 2rem", maxWidth: 940, margin: "0 auto" }}>
          <span style={{ color: "#FF1F1F", fontWeight: 800, letterSpacing: "0.15em", textTransform: "uppercase", fontSize: "0.76rem" }}>The Tire Plug · Los Angeles</span>
          <h1 style={{ fontSize: "2.3rem", fontWeight: 900, lineHeight: 1.1, margin: "0.6rem 0 1rem" }}>{svc.h1}</h1>
          {svc.intro.map((p, i) => <p key={i} style={{ color: "rgba(255,255,255,0.72)", fontSize: "1.05rem", lineHeight: 1.65, maxWidth: 720, marginBottom: "1rem" }}>{p}</p>)}
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginTop: "1.5rem" }}>
            <a href="tel:5625130217" style={ctaRed}>📞 Call (562) 513-0217</a>
            <a href="/#booking" style={ctaGhost}>Get a Free Quote</a>
          </div>
        </section>

        <section style={{ padding: "1.5rem 1.5rem 2.5rem", maxWidth: 940, margin: "0 auto", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          <h2 style={h2}>Why choose The Tire Plug for {svc.label.toLowerCase()} in LA?</h2>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "0.6rem", maxWidth: 720 }}>
            {WHY.map((w) => <li key={w} style={{ color: "rgba(255,255,255,0.8)", fontSize: "0.95rem", paddingLeft: "1.5rem", position: "relative" }}><span style={{ position: "absolute", left: 0, color: "#FF6666" }}>✓</span>{w}</li>)}
          </ul>
        </section>

        <section style={{ padding: "0 1.5rem 2.5rem", maxWidth: 940, margin: "0 auto" }}>
          <h2 style={h2}>Two convenient LA locations</h2>
          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
            <a href="/olympic" style={locCard}><strong style={{ color: "#fff" }}>Downtown · Olympic Blvd</strong><br /><span style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.85rem" }}>2331 E Olympic Blvd, LA 90021</span></a>
            <a href="/manchester" style={locCard}><strong style={{ color: "#fff" }}>South LA · Manchester Ave</strong><br /><span style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.85rem" }}>2220 E Manchester Ave, LA 90001</span></a>
          </div>
        </section>

        <section style={{ padding: "0 1.5rem 4rem", maxWidth: 940, margin: "0 auto" }}>
          <h2 style={h2}>More services</h2>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            {related.map((s) => <a key={s.slug} href={`/${s.slug}`} style={chipLink}>{s.label}</a>)}
          </div>
          <p style={{ marginTop: "1.5rem" }}><a href="/" style={{ color: "#FF6666", fontWeight: 700 }}>← Back to The Tire Plug home</a></p>
        </section>
      </main>
      <Footer />
    </>
  );
}

const h2 = { fontSize: "1.4rem", fontWeight: 800, margin: "0 0 1rem" };
const ctaRed = { background: "linear-gradient(180deg, #FF2A2A 0%, #C20000 100%)", color: "#fff", padding: "0.85rem 1.5rem", borderRadius: 10, fontWeight: 800, textDecoration: "none", fontSize: "0.9rem" };
const ctaGhost = { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)", color: "#fff", padding: "0.85rem 1.5rem", borderRadius: 10, fontWeight: 700, textDecoration: "none", fontSize: "0.9rem" };
const locCard = { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14, padding: "1rem 1.25rem", minWidth: 240, textDecoration: "none", display: "block" };
const chipLink = { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 50, padding: "0.5rem 1rem", color: "#fff", fontSize: "0.85rem", fontWeight: 600, textDecoration: "none" };
