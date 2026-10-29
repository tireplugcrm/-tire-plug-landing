import React from "react";
import Head from "next/head";
import Header from "./Header";
import Footer from "./Footer";
import { PHONE, CTA, smsHref } from "../lib/shop";

// Each page's second button: services book straight into /book, new tires start by
// picking a size and a tire, used tires (not listed online) start with a text.
const BOOK = {
  "wheel-alignment-los-angeles": { href: "/book?service=alignment", label: CTA.bookService },
  "oil-change-los-angeles": { href: "/book?service=oil-change", label: CTA.bookService },
  "tpms-sensors-los-angeles": { href: "/book?service=tpms", label: CTA.bookService },
  "brake-service-los-angeles": { href: "/book?service=brakes", label: CTA.bookService },
  "new-tires-los-angeles": { href: "/tires", label: CTA.shopTires },
  "used-tires-los-angeles": { href: smsHref("Hi Tire Plug! Do you have used tires in my size? My size is: "), label: "Text your size" },
};

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
  "Los Angeles tire shop: Downtown on Olympic Blvd",
  "Free tire inspection & air check",
  "Trusted local shop — quotes by text or phone",
];

export default function ServicePage({ svc }) {
  const url = `https://tireplugla.com/${svc.slug}`;
  const next = BOOK[svc.slug] || { href: "/tires", label: CTA.shopTires };
  const schema = {
    "@context": "https://schema.org", "@type": "Service",
    name: `${svc.label} in Los Angeles`, serviceType: svc.label,
    areaServed: { "@type": "City", name: "Los Angeles" },
    provider: { "@type": "AutoRepair", name: "The Tire Plug", telephone: PHONE.schema, url: "https://tireplugla.com/", image: "https://tireplugla.com/images/logo.webp" },
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
      <main style={{ background: "#fff", color: "#111", fontFamily: "system-ui, -apple-system, sans-serif", minHeight: "60vh" }}>
        <section style={{ padding: "9.5rem 1.5rem 2rem", maxWidth: 940, margin: "0 auto" }}>
          <span style={{ color: "#E01B22", fontWeight: 800, letterSpacing: "0.15em", textTransform: "uppercase", fontSize: "0.76rem" }}>The Tire Plug · Los Angeles</span>
          <h1 style={{ fontSize: "2.3rem", fontWeight: 900, lineHeight: 1.1, margin: "0.6rem 0 1rem" }}>{svc.h1}</h1>
          {svc.intro.map((p, i) => <p key={i} style={{ color: "#555", fontSize: "1.05rem", lineHeight: 1.65, maxWidth: 720, marginBottom: "1rem" }}>{p}</p>)}
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginTop: "1.5rem" }}>
            <a href={PHONE.tel} style={ctaRed}>📞 Call {PHONE.display}</a>
            <a href={next.href} style={ctaGhost}>{next.label}</a>
          </div>
        </section>

        <section style={{ padding: "1.5rem 1.5rem 2.5rem", maxWidth: 940, margin: "0 auto", borderTop: "1px solid #e6e6e6" }}>
          <h2 style={h2}>Why choose The Tire Plug for {svc.label.toLowerCase()} in LA?</h2>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "0.6rem", maxWidth: 720 }}>
            {WHY.map((w) => <li key={w} style={{ color: "#333", fontSize: "0.95rem", paddingLeft: "1.5rem", position: "relative" }}><span style={{ position: "absolute", left: 0, color: "#E01B22" }}>✓</span>{w}</li>)}
          </ul>
        </section>

        <section style={{ padding: "0 1.5rem 2.5rem", maxWidth: 940, margin: "0 auto" }}>
          <h2 style={h2}>Our LA location</h2>
          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
            <a href="/olympic" style={locCard}><strong style={{ color: "#111" }}>Downtown · Olympic Blvd</strong><br /><span style={{ color: "#6b6b6b", fontSize: "0.85rem" }}>2331 E Olympic Blvd, LA 90021</span></a>
          </div>
        </section>

        <section style={{ padding: "0 1.5rem 4rem", maxWidth: 940, margin: "0 auto" }}>
          <h2 style={h2}>More services</h2>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            {related.map((s) => <a key={s.slug} href={`/${s.slug}`} style={chipLink}>{s.label}</a>)}
          </div>
          <p style={{ marginTop: "1.5rem" }}><a href="/" style={{ color: "#E01B22", fontWeight: 700 }}>← Back to The Tire Plug home</a></p>
        </section>
      </main>
      <Footer />
    </>
  );
}

const h2 = { fontSize: "1.4rem", fontWeight: 800, margin: "0 0 1rem" };
const ctaRed = { background: "linear-gradient(135deg, #FF1F1F 0%, #B30000 100%)", color: "#fff", padding: "0.85rem 1.5rem", borderRadius: 10, fontWeight: 800, textDecoration: "none", fontSize: "0.9rem", boxShadow: "0 8px 20px rgba(224,27,34,0.2)" };
const ctaGhost = { background: "#fff", border: "1px solid #dcdcdc", color: "#111", padding: "0.85rem 1.5rem", borderRadius: 10, fontWeight: 700, textDecoration: "none", fontSize: "0.9rem" };
const locCard = { background: "#fff", border: "1px solid #e6e6e6", boxShadow: "0 6px 18px rgba(0,0,0,0.05)", borderRadius: 14, padding: "1rem 1.25rem", minWidth: 240, textDecoration: "none", display: "block" };
const chipLink = { background: "#f5f5f5", border: "1px solid #e6e6e6", borderRadius: 50, padding: "0.5rem 1rem", color: "#111", fontSize: "0.85rem", fontWeight: 600, textDecoration: "none" };
