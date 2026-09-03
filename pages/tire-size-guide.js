import React from "react";
import Head from "next/head";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { SERVICE_INDEX } from "../components/ServicePage";

const URL = "https://tireplugla.com/tire-size-guide";
const TITLE = "What Tire Size Do I Need? Tire Size Guide | The Tire Plug — Los Angeles";
const DESCRIPTION =
  "How to read your tire size and find the right tires for your car. Plain-English guide to the numbers on your sidewall (like 225/45R17), where to find your size, and how to get an instant quote. The Tire Plug, Los Angeles — call (562) 500-4625.";

// Decoded example for 225/45R17 94V — each part explained in plain language.
const PARTS = [
  { code: "225", label: "Width", text: "The width of the tire in millimeters, measured across the tread. Bigger number = wider tire." },
  { code: "45", label: "Aspect ratio", text: "The sidewall height as a percentage of the width. A 45 means the sidewall is 45% as tall as the tire is wide — lower numbers look sportier, higher numbers ride softer." },
  { code: "R", label: "Construction", text: "\"R\" means radial — how the tire is built inside. Nearly every modern car tire is radial." },
  { code: "17", label: "Wheel diameter", text: "The diameter of the wheel (rim) the tire fits, in inches. This one fits a 17-inch wheel." },
  { code: "94", label: "Load index", text: "A code for how much weight the tire can safely carry. Match or exceed what your car calls for." },
  { code: "V", label: "Speed rating", text: "The top safe speed for the tire. Stick with the rating your vehicle was built for." },
];

const FIND_SPOTS = [
  { spot: "The tire sidewall", text: "The fastest spot. Look at the outer wall of any current tire for a string like 225/45R17. That's your size." },
  { spot: "The driver's door jamb", text: "Open the driver's door and look for a white/yellow sticker on the frame. It lists the factory tire size and the correct air pressure." },
  { spot: "Your owner's manual", text: "The tire and wheel section lists your original equipment (OEM) size and any approved options." },
  { spot: "Inside the fuel door or glovebox", text: "Some vehicles print the tire placard here instead of the door jamb." },
];

export default function TireSizeGuide() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "What Tire Size Do I Need? A Plain-English Tire Size Guide",
    description: DESCRIPTION,
    author: { "@type": "Organization", name: "The Tire Plug" },
    publisher: { "@type": "AutoRepair", name: "The Tire Plug", telephone: "+1-562-500-4625", url: "https://tireplugla.com/", image: "https://tireplugla.com/images/logo.webp" },
    mainEntityOfPage: URL,
    image: "https://tireplugla.com/images/logo.webp",
  };

  return (
    <>
      <Head>
        <title>{TITLE}</title>
        <meta name="description" content={DESCRIPTION} />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="canonical" href={URL} />
        <meta property="og:type" content="article" />
        <meta property="og:site_name" content="The Tire Plug" />
        <meta property="og:title" content={TITLE} />
        <meta property="og:description" content={DESCRIPTION} />
        <meta property="og:url" content={URL} />
        <meta property="og:image" content="https://tireplugla.com/images/logo.webp" />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      </Head>
      <Header />
      <main style={{ background: "#000", color: "#fff", fontFamily: "system-ui, -apple-system, sans-serif", minHeight: "60vh" }}>
        <section style={{ padding: "4rem 1.5rem 2rem", maxWidth: 860, margin: "0 auto" }}>
          <span style={{ color: "#FF1F1F", fontWeight: 800, letterSpacing: "0.15em", textTransform: "uppercase", fontSize: "0.76rem" }}>The Tire Plug · Los Angeles</span>
          <h1 style={{ fontSize: "2.3rem", fontWeight: 900, lineHeight: 1.1, margin: "0.6rem 0 1rem" }}>What Tire Size Do I Need?</h1>
          <p style={{ color: "rgba(255,255,255,0.72)", fontSize: "1.05rem", lineHeight: 1.65, maxWidth: 720, marginBottom: "1rem" }}>
            Those numbers on your tire — like <strong style={{ color: "#fff" }}>225/45R17</strong> — tell you exactly what fits your car. Here's what each part means and where to find your size. Or skip the homework: <strong style={{ color: "#fff" }}>snap a photo of your sidewall and text it to us</strong> — we'll read it and quote you in minutes.
          </p>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginTop: "1.25rem" }}>
            <a href="sms:15622503737" style={ctaRed}>📲 Text a Photo for a Quote</a>
            <a href="/#booking" style={ctaGhost}>Get a Free Quote</a>
          </div>
        </section>

        <section style={{ padding: "1rem 1.5rem 2rem", maxWidth: 860, margin: "0 auto", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          <h2 style={h2}>How to read your tire size</h2>
          <p style={{ color: "rgba(255,255,255,0.72)", lineHeight: 1.65, marginBottom: "1.25rem", maxWidth: 720 }}>
            Let's decode a common size — <strong style={{ color: "#fff", fontSize: "1.1rem" }}>225/45R17 94V</strong>:
          </p>
          <div style={{ display: "grid", gap: "0.6rem" }}>
            {PARTS.map((p) => (
              <div key={p.code} style={{ display: "flex", gap: "1rem", alignItems: "flex-start", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "0.9rem 1.1rem" }}>
                <span style={{ background: "linear-gradient(180deg, #FF2A2A 0%, #C20000 100%)", color: "#fff", fontWeight: 900, borderRadius: 8, padding: "0.35rem 0.7rem", minWidth: 48, textAlign: "center", flexShrink: 0 }}>{p.code}</span>
                <div>
                  <strong style={{ color: "#fff", display: "block", marginBottom: "0.2rem" }}>{p.label}</strong>
                  <span style={{ color: "rgba(255,255,255,0.72)", fontSize: "0.95rem", lineHeight: 1.55 }}>{p.text}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section style={{ padding: "1rem 1.5rem 2rem", maxWidth: 860, margin: "0 auto" }}>
          <h2 style={h2}>Where to find your tire size</h2>
          <div style={{ display: "grid", gap: "0.6rem" }}>
            {FIND_SPOTS.map((f, i) => (
              <div key={i} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "0.9rem 1.1rem" }}>
                <strong style={{ color: "#fff", display: "block", marginBottom: "0.2rem" }}>📍 {f.spot}</strong>
                <span style={{ color: "rgba(255,255,255,0.72)", fontSize: "0.95rem", lineHeight: 1.55 }}>{f.text}</span>
              </div>
            ))}
          </div>
        </section>

        <section style={{ padding: "1rem 1.5rem 2rem", maxWidth: 860, margin: "0 auto" }}>
          <h2 style={h2}>Still not sure? Let us do it</h2>
          <p style={{ color: "rgba(255,255,255,0.72)", lineHeight: 1.65, maxWidth: 720 }}>
            You don't need to figure any of this out alone. Send us a <strong style={{ color: "#fff" }}>photo of your tire's sidewall</strong> or just your <strong style={{ color: "#fff" }}>year, make and model</strong> by text, and we'll confirm the exact size, check what's in stock, and send you an honest, upfront price — new or used. Same-day installation at our Downtown LA shop.
          </p>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginTop: "1.25rem" }}>
            <a href="tel:5625004625" style={ctaRed}>📞 Call (562) 500-4625</a>
            <a href="/tire-shop-near-me-faq" style={ctaGhost}>Read the Tire FAQ</a>
          </div>
        </section>

        <section style={{ padding: "0 1.5rem 2.5rem", maxWidth: 860, margin: "0 auto" }}>
          <h2 style={h2}>Our LA location</h2>
          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
            <a href="/olympic" style={locCard}><strong style={{ color: "#fff" }}>Downtown · Olympic Blvd</strong><br /><span style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.85rem" }}>2331 E Olympic Blvd, LA 90021</span></a>
          </div>
        </section>

        <section style={{ padding: "0 1.5rem 4rem", maxWidth: 860, margin: "0 auto" }}>
          <h2 style={h2}>Our services</h2>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            {SERVICE_INDEX.map((s) => <a key={s.slug} href={`/${s.slug}`} style={chipLink}>{s.label}</a>)}
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
