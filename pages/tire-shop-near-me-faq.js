import React, { useState } from "react";
import Head from "next/head";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { SERVICE_INDEX } from "../components/ServicePage";

const URL = "https://tireplugla.com/tire-shop-near-me-faq";
const TITLE = "Tire Shop Near Me in Los Angeles — FAQ | The Tire Plug";
const DESCRIPTION =
  "Answers to the most-asked questions about finding a tire shop near you in Los Angeles: tire prices, same-day install, used tires, brands, wheel alignment, hours & locations. The Tire Plug — two LA shops. Call (562) 513-0217.";

// Q&A pairs — plain-language answers that double as the FAQPage rich-result content.
const FAQS = [
  {
    q: "Where is the best tire shop near me in Los Angeles?",
    a: "The Tire Plug has two convenient Los Angeles locations: Downtown at 2331 E Olympic Blvd (LA 90021) and South LA at 2220 E Manchester Ave (LA 90001). Both offer new and used tires, wheel alignments, oil changes, brakes and TPMS service with honest, upfront pricing and same-day appointments. Walk-ins are welcome at either shop.",
  },
  {
    q: "How much do new tires cost in Los Angeles?",
    a: "New tire prices depend on your tire size and the brand you choose — we carry everything from affordable value brands to premium names like Michelin, Goodyear, Falken and Continental. The fastest way to get an exact price is to text us a photo of your tire's sidewall (the numbers like 225/45R17) or your vehicle info to (562) 513-0217 and we'll send you an honest, upfront quote with mounting and balancing included.",
  },
  {
    q: "Do you sell used tires, and how much are they?",
    a: "Yes. We carry quality, inspected used tires at a fraction of new-tire prices — a great option when you need to get back on the road affordably. Tell us your tire size or vehicle and we'll quote you what's in stock. Every used tire is checked for tread depth and safety before it goes on your car.",
  },
  {
    q: "Can I get tires installed the same day?",
    a: "Almost always, yes. The Tire Plug does same-day tire installation at both LA locations. Call ahead at (562) 513-0217 or send us your size so we can confirm we have your tire in stock and get you in and out fast.",
  },
  {
    q: "What tire brands do you carry?",
    a: "We stock a full range of brands and budgets — premium (Michelin, Goodyear, Continental, Bridgestone), mid-tier (Falken, Hankook, Yokohama), and reliable value brands — plus inspected used tires. If we don't have your exact tire on the shelf, we can usually get it the same or next day.",
  },
  {
    q: "How do I know what tire size I need?",
    a: "Your tire size is printed right on the sidewall of your current tires — it looks like 225/45R17 or P215/65R15. You can also find it on a sticker inside the driver's door jamb. Not sure? Just snap a photo of the sidewall and text it to (562) 513-0217 — we'll read it for you and quote the right fit.",
  },
  {
    q: "Do you do wheel alignments?",
    a: "Yes. A proper wheel alignment keeps your car driving straight, stops uneven tire wear and protects your new tires. We recommend an alignment whenever you buy new tires or if you notice pulling, vibration or uneven tread wear. Ask us to check your alignment when you come in.",
  },
  {
    q: "How often should I replace my tires?",
    a: "Most tires last 3–6 years or about 25,000–50,000 miles depending on the tire and your driving. Replace them when the tread is worn to 2/32\" (the legal limit), if you see cracking or bulges, or if they're more than 6 years old. We'll do a free tire inspection and tell you honestly whether you need new tires yet — no upselling.",
  },
  {
    q: "Do you offer oil changes, brakes and TPMS service?",
    a: "Yes — The Tire Plug is a full-service tire and auto shop. Along with new and used tires we do oil changes, brake service and TPMS (tire-pressure sensor) repair and programming. You can take care of tires and routine maintenance in one stop.",
  },
  {
    q: "Do you take walk-ins or do I need an appointment?",
    a: "Both work. Walk-ins are welcome at both LA locations, but calling ahead at (562) 513-0217 — or getting a quote first — means we can confirm your tire is in stock and minimize your wait.",
  },
  {
    q: "What are your hours and locations?",
    a: "The Tire Plug has two Los Angeles shops: Downtown / East LA at 2331 E Olympic Blvd (LA 90021) and South LA at 2220 E Manchester Ave (LA 90001). Call (562) 513-0217 for current hours at each location — we're open 7 days a week with same-day service.",
  },
  {
    q: "How do I get a tire quote fast?",
    a: "The fastest way: text a photo of your tire sidewall or your year/make/model to (562) 513-0217, or fill out the quick quote form at tireplugla.com. We reply with honest, upfront pricing — no pressure, no hidden fees.",
  },
];

export default function TireShopFaq() {
  const [open, setOpen] = useState(0);

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <>
      <Head>
        <title>{TITLE}</title>
        <meta name="description" content={DESCRIPTION} />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="canonical" href={URL} />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="The Tire Plug" />
        <meta property="og:title" content={TITLE} />
        <meta property="og:description" content={DESCRIPTION} />
        <meta property="og:url" content={URL} />
        <meta property="og:image" content="https://tireplugla.com/images/logo.webp" />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      </Head>
      <Header />
      <main style={{ background: "#000", color: "#fff", fontFamily: "system-ui, -apple-system, sans-serif", minHeight: "60vh" }}>
        <section style={{ padding: "4rem 1.5rem 2rem", maxWidth: 860, margin: "0 auto" }}>
          <span style={{ color: "#FF1F1F", fontWeight: 800, letterSpacing: "0.15em", textTransform: "uppercase", fontSize: "0.76rem" }}>The Tire Plug · Los Angeles</span>
          <h1 style={{ fontSize: "2.3rem", fontWeight: 900, lineHeight: 1.1, margin: "0.6rem 0 1rem" }}>Tire Shop Near Me — Los Angeles FAQ</h1>
          <p style={{ color: "rgba(255,255,255,0.72)", fontSize: "1.05rem", lineHeight: 1.65, maxWidth: 720, marginBottom: "1rem" }}>
            Looking for a tire shop near you in Los Angeles? Here are honest answers to the questions we hear most — about pricing, same-day install, used tires, brands and what we offer. Still have a question? Call or text us at <a href="tel:5625130217" style={{ color: "#FF6666", fontWeight: 700 }}>(562) 513-0217</a>.
          </p>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginTop: "1.25rem" }}>
            <a href="tel:5625130217" style={ctaRed}>📞 Call (562) 513-0217</a>
            <a href="/#booking" style={ctaGhost}>Get a Free Quote</a>
          </div>
        </section>

        <section style={{ padding: "1rem 1.5rem 2.5rem", maxWidth: 860, margin: "0 auto" }}>
          <div style={{ display: "grid", gap: "0.75rem" }}>
            {FAQS.map((f, i) => {
              const isOpen = open === i;
              return (
                <div key={i} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14, overflow: "hidden" }}>
                  <button
                    onClick={() => setOpen(isOpen ? -1 : i)}
                    style={{ width: "100%", textAlign: "left", background: "none", border: "none", color: "#fff", padding: "1.1rem 1.25rem", fontSize: "1.02rem", fontWeight: 700, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", fontFamily: "inherit", lineHeight: 1.35 }}
                  >
                    <span>{f.q}</span>
                    <span style={{ color: "#FF6666", flexShrink: 0, transform: isOpen ? "rotate(45deg)" : "none", transition: "transform 0.2s", fontSize: "1.4rem", lineHeight: 1 }}>+</span>
                  </button>
                  {isOpen && (
                    <p style={{ color: "rgba(255,255,255,0.78)", fontSize: "0.97rem", lineHeight: 1.65, padding: "0 1.25rem 1.25rem", margin: 0 }}>{f.a}</p>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section style={{ padding: "0 1.5rem 2.5rem", maxWidth: 860, margin: "0 auto" }}>
          <h2 style={h2}>Two convenient LA locations</h2>
          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
            <a href="/olympic" style={locCard}><strong style={{ color: "#fff" }}>Downtown · Olympic Blvd</strong><br /><span style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.85rem" }}>2331 E Olympic Blvd, LA 90021</span></a>
            <a href="/manchester" style={locCard}><strong style={{ color: "#fff" }}>South LA · Manchester Ave</strong><br /><span style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.85rem" }}>2220 E Manchester Ave, LA 90001</span></a>
          </div>
        </section>

        <section style={{ padding: "0 1.5rem 4rem", maxWidth: 860, margin: "0 auto" }}>
          <h2 style={h2}>Our services</h2>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            {SERVICE_INDEX.map((s) => <a key={s.slug} href={`/${s.slug}`} style={chipLink}>{s.label}</a>)}
            <a href="/tire-size-guide" style={chipLink}>Tire Size Guide</a>
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
