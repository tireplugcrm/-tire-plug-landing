import React from "react";
import Head from "next/head";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { SERVICE_INDEX } from "../components/ServicePage";
import { KUMHO_MODELS as MODELS } from "../lib/tire-catalog";
import { PHONE } from "../lib/shop";

const URL = "https://tireplugla.com/kumho-tires-los-angeles";
const TITLE = "Kumho Tires in Los Angeles | Ecsta, Crugen, Road Venture, Tesla EV | The Tire Plug";
const DESCRIPTION =
  "Kumho tires at The Tire Plug, 2331 E Olympic Blvd, Los Angeles. Ecsta Sport A/S, Crugen HP71, Road Venture HT and RT, and Majesty 9 Solus TA91 EV with noise-reducing foam for Teslas. Buy a set of 4 and get a 4-wheel alignment for $49. Call (562) 500-4625.";
const IMAGE = "https://tireplugla.com/images/kumho/ecsta-pa71.jpg";
const ALIGNMENT = 49;

// Prices are per tire, product only (install not included), set by The Tire Plug.
// Mount + balance is extra, from $INSTALL per wheel.
const INSTALL = 25;
// Specs from Kumho USA (kumhotireusa.com).
const FAQ = [
  { q: "Is installation included?", a: `Prices shown are for the tire only. Install and balance start at $${INSTALL} per wheel. Get it installed today at our Downtown LA location.` },
  { q: "How does the $49 alignment deal work?", a: `Buy a set of 4 Kumho tires and add a 4-wheel alignment for $${ALIGNMENT}. We do it the same visit.` },
  { q: "What warranty comes with Kumho?", a: "Kumho's own programs:", list: [
    "Treadwear warranty: up to 75,000 miles depending on the tire (shown on each tire above)",
    "Road hazard: a tire ruined by a road hazard is replaced within the first 12 months or 2/32\" of tread",
    "30-day satisfaction guarantee: refund or exchange within 30 days",
    "Coverage up to 72 months from purchase. Exclusions apply; not valid on factory (OE) tires",
  ] },
  { q: "What's the foam in the TA91 for?", a: "The Majesty 9 Solus TA91 EV has noise-reducing foam inside the tire to cut road noise, which you hear more in quiet electric cars like Teslas." },
  { q: "Don't see your size?", a: "Call or text (562) 500-4625. We can usually get other Kumho sizes fast." },
];

const money = (n) => `$${n.toFixed(2)}`;

export default function KumhoTires() {
  const allPrices = MODELS.flatMap((m) => m.sizes.map((s) => s[2]));
  const schema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Kumho tires at The Tire Plug",
    itemListElement: MODELS.map((m, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: {
        "@type": "Product",
        name: `Kumho ${m.name}`,
        brand: { "@type": "Brand", name: "Kumho" },
        ...(m.img ? { image: `https://tireplugla.com${m.img}` } : {}),
        offers: {
          "@type": "AggregateOffer", priceCurrency: "USD",
          lowPrice: Math.min(...m.sizes.map((s) => s[2])), highPrice: Math.max(...m.sizes.map((s) => s[2])),
          seller: { "@type": "AutoRepair", name: "The Tire Plug", telephone: PHONE.schema, url: "https://tireplugla.com/" },
        },
      },
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
        <meta property="og:title" content="Kumho tires at The Tire Plug · $49 alignment with a set" />
        <meta property="og:description" content="Ecsta, Crugen, Road Venture and Tesla-ready TA91 EV. Every size priced. Downtown LA, open 7 days." />
        <meta property="og:url" content={URL} />
        <meta property="og:image" content={IMAGE} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..900&family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet" />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      </Head>
      <Header />

      <main className="kp">
        <header className="hero">
          <div className="wrap hero-grid">
            <div>
              <img className="brand" src="/images/kumho/kumho-logo.png" alt="Kumho Tires" />
              <h1 className="display">Kumho tires.<br /><span className="r">Priced and in stock.</span></h1>
              <p className="sub serif">Performance, SUV, truck and Tesla EV tires, from {money(Math.min(...allPrices))} a tire.</p>
              <div className="ctas">
                <a className="btn btn-red" href="#tires">See tires &amp; prices →</a>
                <a className="btn btn-ghost" href={PHONE.tel}>Call {PHONE.display}</a>
              </div>
            </div>
            <div className="deal">
              <span className="deal-k">Kumho special</span>
              <div className="deal-v"><span className="c">$</span>{ALIGNMENT}</div>
              <div className="deal-l">4-wheel alignment</div>
              <p>When you buy a set of 4 Kumho tires.</p>
            </div>
          </div>
        </header>

        <section className="block" id="tires">
          <div className="wrap">
            <div className="head">
              <div><span className="eyebrow">The lineup</span><h2 className="display">Pick your <span className="r">Kumho.</span></h2></div>
              <p>Prices are per tire, product only. Set-of-4 price shown for each size. Add a 4-wheel alignment for ${ALIGNMENT} with any set.</p>
            </div>
            <a className="install" href={PHONE.tel}><b>Install &amp; balance start at ${INSTALL} per wheel</b><span>Get it installed today at our Downtown LA location →</span></a>
            <div className="grid">
              {MODELS.map((m) => (
                <article className={`card${m.tesla ? " tesla" : ""}`} key={m.id} id={m.id}>
                  <div className="photo">
                    {m.img ? <img src={m.img} alt={`Kumho ${m.name} tire`} /> : <img className="ph-logo" src="/images/kumho/kumho-logo.png" alt="Kumho" />}
                    {m.tesla && <span className="flag">Tesla / EV · foam</span>}
                  </div>
                  <div className="body">
                    <div className="cat">{m.category}</div>
                    <h3>{m.name} <span>{m.code}</span></h3>
                    <div className="fits">For {m.fits}</div>
                    <ul className="ben">{m.benefits.map((b) => <li key={b}>{b}</li>)}</ul>
                    <div className="chips">{m.chips.map((c) => <span key={c}>{c}</span>)}</div>
                    <table>
                      <thead><tr><th>Size</th><th>Load / speed</th><th>Per tire</th><th>Set of 4</th></tr></thead>
                      <tbody>
                        {m.sizes.map(([s, ls, p]) => (
                          <tr key={s}>
                            <td className="size">{s}</td>
                            <td className="spec">{ls}</td>
                            <td className="price">{money(p)}</td>
                            <td className="set">{money(p * 4)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="block" id="faq">
          <div className="wrap">
            <div className="head">
              <div><span className="eyebrow">Good to know</span><h2 className="display">Questions, <span className="r">answered.</span></h2></div>
            </div>
            {FAQ.map((f, i) => (
              <details key={f.q} open={i === 0}>
                <summary>{f.q}</summary>
                <div className="ans">{f.a}{f.list && <ul>{f.list.map((li) => <li key={li}>{li}</li>)}</ul>}</div>
              </details>
            ))}
          </div>
        </section>

        <section className="block" id="visit">
          <div className="wrap visit">
            <div className="card-v">
              <span className="eyebrow">Visit us</span>
              <h2 className="display" style={{ marginTop: 14 }}>Pull up.<br /><span className="r">No appointment.</span></h2>
              <div className="addr">2331 E Olympic Blvd, Los Angeles</div>
              <div className="meta">Downtown LA · {PHONE.display} · @tireplugcali · Open 7 days</div>
              <div className="ctas">
                <a className="btn btn-red" href={PHONE.tel}>Call now</a>
                <a className="btn btn-ghost" href="https://www.google.com/maps/search/?api=1&query=2331+E+Olympic+Blvd+Los+Angeles+CA" target="_blank" rel="noopener noreferrer">Get directions</a>
                <a className="btn btn-ghost" href="/rbp-tires-los-angeles">See RBP tires</a>
              </div>
            </div>
          </div>
        </section>

        <section className="block more">
          <div className="wrap">
            <h2 className="more-h">More services</h2>
            <div className="chips-l">
              {SERVICE_INDEX.map((s) => <a key={s.slug} href={`/${s.slug}`}>{s.label}</a>)}
            </div>
            <p className="fine">Prices are per tire, product only, and subject to availability. Install and balance start at ${INSTALL} per wheel. Tax not included. $49 4-wheel alignment requires purchase of 4 Kumho tires in the same visit.</p>
            <p className="fine">Warranty programs are Kumho's (kumhotireusa.com); exclusions apply and they are not valid on original-equipment tires. Treadwear warranty shown per tire line.</p>
            <p style={{ marginTop: "1.5rem" }}><a href="/" className="back">← Back to The Tire Plug home</a></p>
          </div>
        </section>
      </main>

      <Footer />

      <style jsx global>{`
        .kp {
          --ink: #ffffff; --ink-2: #f5f5f5; --card: #ffffff; --paper: #111111; --muted: #6b6b6b;
          --line: #e6e6e6; --red: #e01b22; --red-2: #ff3b42; --gutter: 24px;
          --shadow: 0 6px 18px rgba(0,0,0,.05);
          background: var(--ink); color: var(--paper);
          font-family: "Archivo", system-ui, sans-serif; line-height: 1.5;
        }
        .kp .wrap { max-width: 1160px; margin: 0 auto; padding: 0 var(--gutter); }
        .kp .eyebrow {
          font-family: "JetBrains Mono", monospace; font-size: 13px; font-weight: 700; letter-spacing: .22em; text-transform: uppercase; color: var(--red);
          display: inline-flex; align-items: center; gap: 12px;
        }
        .kp .eyebrow::before { content: ""; width: 28px; height: 2px; background: var(--red); }
        .kp .display { font-weight: 900; font-stretch: 62%; text-transform: uppercase; line-height: .86; letter-spacing: -.01em; }
        .kp .r { color: var(--red); }
        .kp .serif { font-family: "Instrument Serif", serif; font-style: italic; font-weight: 400; }
        .kp .btn {
          display: inline-flex; align-items: center; gap: 10px; text-decoration: none;
          font-weight: 800; font-stretch: 85%; font-size: 17px; text-transform: uppercase; letter-spacing: .02em;
          padding: 15px 22px; border-radius: 6px; border: 1px solid transparent; transition: transform .15s, background .15s;
        }
        .kp .btn:hover { transform: translateY(-1px); }
        .kp .btn-red { background: linear-gradient(135deg, #FF1F1F 0%, #B30000 100%); color: #fff; box-shadow: 0 8px 20px rgba(224,27,34,.2); }
        .kp .btn-red:hover { background: linear-gradient(135deg, #FF3B42 0%, #C40000 100%); }
        .kp .btn-ghost { border-color: #dcdcdc; background: #fff; color: #111; }
        .kp .btn-ghost:hover { border-color: var(--red); }
        .kp .ctas { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 30px; }

        .kp .hero { padding: 170px 0 72px; position: relative; overflow: hidden;
          background: radial-gradient(700px 520px at 80% 45%, rgba(224,27,34,.05), transparent 70%), #fff; }
        .kp .hero-grid { display: grid; grid-template-columns: 1.3fr .7fr; align-items: center; gap: 40px; }
        .kp .brand { height: 54px; border-radius: 3px; }
        .kp .hero h1 { font-size: clamp(60px, 9vw, 124px); margin-top: 24px; }
        .kp .hero .sub { font-size: clamp(24px, 2.6vw, 32px); line-height: 1.15; margin-top: 18px; max-width: 560px; color: #333; }
        .kp .deal { background: var(--red); color: #fff; border-radius: 14px; padding: 32px 30px; box-shadow: 0 8px 20px rgba(224,27,34,.2); }
        .kp .deal-k { font-family: "JetBrains Mono", monospace; font-size: 12px; font-weight: 700; letter-spacing: .2em; text-transform: uppercase; opacity: .9; }
        .kp .deal-v { font-weight: 900; font-stretch: 62%; font-size: 150px; line-height: .8; margin-top: 14px; }
        .kp .deal-v .c { font-size: 60px; vertical-align: 56px; margin-right: 2px; }
        .kp .deal-l { font-weight: 900; font-stretch: 72%; font-size: 34px; text-transform: uppercase; line-height: .95; margin-top: 8px; }
        .kp .deal p { margin-top: 12px; font-size: 16px; opacity: .92; }

        .kp .block { padding: 96px 0; border-top: 1px solid var(--line); scroll-margin-top: 110px; }
        .kp #faq, .kp .more { background: var(--ink-2); }
        .kp .head { display: flex; justify-content: space-between; align-items: flex-end; gap: 24px; flex-wrap: wrap; margin-bottom: 36px; }
        .kp .head h2 { font-size: clamp(54px, 7vw, 96px); margin-top: 14px; }
        .kp .head p { max-width: 420px; color: var(--muted); font-size: 17px; }

        .kp .install { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin: -12px 0 22px; padding: 14px 18px; border-radius: 10px; background: rgba(224,27,34,.08); border: 1px solid rgba(224,27,34,.3); color: #111; text-decoration: none; }
        .kp .install b { font-weight: 900; font-stretch: 75%; font-size: 20px; text-transform: uppercase; }
        .kp .install span { font-size: 15px; color: #333; }
        .kp .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 18px; }
        .kp .card { background: var(--card); border: 1px solid var(--line); box-shadow: var(--shadow); border-radius: 12px; overflow: hidden; display: grid; grid-template-columns: 200px 1fr; scroll-margin-top: 110px; }
        .kp .card.tesla { border-color: rgba(224,27,34,.6); box-shadow: 0 0 0 1px rgba(224,27,34,.25), var(--shadow); }
        .kp .photo { position: relative; background: #fff; border-right: 1px solid var(--line); display: grid; place-items: center; padding: 12px; }
        .kp .photo img { width: 100%; height: 100%; max-height: 260px; object-fit: contain; }
        .kp .photo img.ph-logo { max-width: 150px; height: auto; }
        .kp .flag { position: absolute; top: 10px; left: 10px; background: var(--red); color: #fff; font-family: "JetBrains Mono", monospace; font-size: 10.5px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; padding: 5px 8px; border-radius: 3px; }
        .kp .body { padding: 22px 22px 18px; }
        .kp .cat { font-family: "JetBrains Mono", monospace; font-size: 11.5px; letter-spacing: .12em; text-transform: uppercase; color: var(--red); }
        .kp h3 { font-weight: 900; font-stretch: 70%; font-size: 34px; text-transform: uppercase; line-height: 1; margin-top: 6px; }
        .kp h3 span { font-family: "JetBrains Mono", monospace; font-weight: 500; font-size: 13px; color: var(--muted); vertical-align: 6px; letter-spacing: .08em; }
        .kp .fits { color: var(--muted); font-size: 15px; margin-top: 4px; }
        .kp .ben { list-style: none; margin: 14px 0 0; display: grid; grid-template-columns: 1fr 1fr; gap: 4px 12px; }
        .kp .ben li { font-size: 14.5px; padding-left: 18px; position: relative; color: #333; }
        .kp .ben li::before { content: "✓"; position: absolute; left: 0; color: var(--red); font-weight: 800; }
        .kp .chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 14px; }
        .kp .chips span { font-size: 12px; font-weight: 700; border: 1px solid rgba(224,27,34,.3); border-radius: 50px; padding: 4px 10px; background: rgba(224,27,34,.08); color: #111; }
        .kp table { width: 100%; border-collapse: collapse; margin-top: 14px; }
        .kp th { text-align: left; font-family: "JetBrains Mono", monospace; font-weight: 500; font-size: 10.5px; letter-spacing: .12em; text-transform: uppercase; color: var(--muted); padding: 8px 0 6px; border-bottom: 1px solid var(--line); }
        .kp td { padding: 10px 0; border-bottom: 1px solid var(--line); }
        .kp th:nth-child(n+3), .kp td:nth-child(n+3) { text-align: right; }
        .kp td.size { font-weight: 800; font-stretch: 80%; font-size: 19px; }
        .kp td.spec { font-family: "JetBrains Mono", monospace; font-size: 12.5px; color: #555; }
        .kp td.price { font-weight: 900; font-stretch: 66%; font-size: 28px; line-height: 1; }
        .kp td.set { color: var(--muted); font-size: 14px; font-weight: 700; padding-left: 10px; }

        .kp details { border-bottom: 1px solid var(--line); }
        .kp details:first-of-type { border-top: 1px solid var(--line); }
        .kp summary { list-style: none; cursor: pointer; display: flex; justify-content: space-between; align-items: center; gap: 20px;
          padding: 24px 0; font-weight: 900; font-stretch: 70%; font-size: clamp(24px, 3vw, 32px); text-transform: uppercase; line-height: 1; }
        .kp summary::-webkit-details-marker { display: none; }
        .kp summary::after { content: "+"; flex: none; width: 36px; height: 36px; border-radius: 50%; border: 1px solid var(--line); display: grid; place-items: center; font-size: 22px; color: var(--red); background: #fff; transition: transform .2s; }
        .kp details[open] summary::after { transform: rotate(45deg); }
        .kp summary:focus-visible { outline: 2px solid #111; outline-offset: 4px; }
        .kp .ans { padding: 0 0 26px; color: #333; font-size: 18px; max-width: 760px; }
        .kp .ans ul { margin: 10px 0 0 20px; }

        .kp .card-v { background: var(--card); border: 1px solid var(--line); box-shadow: var(--shadow); border-radius: 12px; padding: 34px; }
        .kp .card-v h2 { font-size: clamp(54px, 7vw, 92px); }
        .kp .addr { font-size: 24px; font-weight: 800; margin-top: 22px; }
        .kp .meta { color: var(--muted); margin-top: 6px; }

        .kp .more { padding: 64px 0 80px; }
        .kp .more-h { font-size: 1.4rem; font-weight: 800; margin-bottom: 1rem; }
        .kp .chips-l { display: flex; gap: .5rem; flex-wrap: wrap; margin-bottom: 2rem; }
        .kp .chips-l a { background: #fff; border: 1px solid #dcdcdc; border-radius: 50px; padding: .5rem 1rem; color: #111; font-size: .85rem; font-weight: 600; text-decoration: none; }
        .kp .chips-l a:hover { border-color: var(--red); }
        .kp .fine { color: var(--muted); font-size: 13.5px; line-height: 1.6; max-width: 900px; margin-top: 8px; }
        .kp .back { color: var(--red); font-weight: 700; }

        @media (max-width: 1000px) {
          .kp .install { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin: -12px 0 22px; padding: 14px 18px; border-radius: 10px; background: rgba(224,27,34,.08); border: 1px solid rgba(224,27,34,.3); color: #111; text-decoration: none; }
        .kp .install b { font-weight: 900; font-stretch: 75%; font-size: 20px; text-transform: uppercase; }
        .kp .install span { font-size: 15px; color: #333; }
        .kp .grid { grid-template-columns: 1fr; }
        }
        @media (max-width: 900px) {
          .kp .hero-grid { grid-template-columns: 1fr; }
          .kp .block { padding: 72px 0; }
        }
        @media (max-width: 600px) {
          .kp { --gutter: 16px; }
          .kp .hero { padding-top: 150px; }
          .kp .card { grid-template-columns: 1fr; }
          .kp .photo { border-right: 0; border-bottom: 1px solid var(--line); }
          .kp .photo img { max-height: 200px; }
          .kp .ben { grid-template-columns: 1fr; }
          .kp .deal-v { font-size: 120px; }
          .kp td.size { font-size: 16px; }
          .kp td.price { font-size: 24px; }
          .kp .btn { padding: 14px 18px; font-size: 15px; }
        }
      `}</style>
    </>
  );
}
