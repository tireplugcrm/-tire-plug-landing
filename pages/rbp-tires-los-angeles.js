import React, { useEffect, useState } from "react";
import Head from "next/head";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { SERVICE_INDEX } from "../components/ServicePage";
import { RBP_AT as AT, RBP_RT as RT, RBP_CATALOG as CATALOG, INSTALL_FROM as INSTALL, sizeKey, sizeToSlug } from "../lib/tire-catalog";
import { PHONE } from "../lib/shop";

const URL = "https://tireplugla.com/rbp-tires-los-angeles";
const TITLE = "RBP Repulsor A/T, R/T, X/T & M/T Tires in Los Angeles | Every Size Priced | The Tire Plug";
const DESCRIPTION =
  "RBP Repulsor A/T Plateau all-terrain, R/T rugged-terrain, X/T and M/T mud tires in 15\" to 28\" at The Tire Plug, 2331 E Olympic Blvd, Los Angeles. Every size priced, 2-year road hazard coverage on the A/T Plateau, next-day warranty exchange. Open 7 days, no appointment. Call (562) 500-4625.";
const IMAGE = "https://tireplugla.com/images/rbp/repulsor-at-plateau.png";

const FAQ = [
  { q: "What if my tire pops?", a: "Bring the tire and your receipt to The Tire Plug. We inspect it. If it can be safely plugged or patched, we repair it. If it can't, it's a warranty claim and your replacement tire is ready the next day." },
  { q: "What counts as a road hazard?", a: "Non-repairable damage from everyday road junk:", list: ["Punctures from nails, screws or glass", "Cuts and snags from sharp debris", "Bruises and impact breaks from potholes and debris"] },
  { q: "How long am I covered?", a: "2 years from the date you buy, or until the tread wears down to 3/32\", whichever comes first." },
  { q: "Do I pay anything?", a: "The replacement tire is covered by RBP. You pay for mounting, balancing and tax at the time of the exchange." },
  { q: "What's not covered?", list: ["Repairable flats (we fix those)", "Accidents, vandalism and obvious misuse", "Racing, burnouts, takeovers, donuts and off-road use", "Commercial use, snow chains or studs", "Tires moved to a different vehicle"] },
  { q: "What do I need to claim?", a: "Register your tires right after purchase (ask us at install) and keep your original receipt. Tires bought from online marketplaces like Amazon or Walmart aren't eligible, so buy from an authorized dealer like us." },
];

const allSizes = (c) => c.groups.flatMap((g) => g.sizes);
const isLT = (s) => s.startsWith("LT") || s.endsWith("LT");

export default function RbpTires() {
  const [rimIdx, setRimIdx] = useState(1); // 16" by default

  // Open a rim size from the URL, e.g. /rbp-tires-los-angeles#sizes-20
  useEffect(() => {
    const m = window.location.hash.match(/sizes-(\d+)/);
    if (m) {
      const i = CATALOG.findIndex((c) => c.rim === +m[1]);
      if (i >= 0) setRimIdx(i);
    }
  }, []);

  const onTabKey = (e) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const n = (rimIdx + (e.key === "ArrowRight" ? 1 : -1) + CATALOG.length) % CATALOG.length;
    setRimIdx(n);
    document.getElementById(`rim-tab-${CATALOG[n].rim}`)?.focus();
  };

  const cur = CATALOG[rimIdx];

  const schema = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: "RBP Repulsor A/T Plateau",
    brand: { "@type": "Brand", name: "RBP" },
    description: "All-weather, all-terrain light truck and SUV tire. 3PMSF rated, 50,000-mile limited treadwear warranty, 2-year road hazard replacement.",
    image: IMAGE,
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "USD",
      lowPrice: Math.min(...CATALOG.flatMap(allSizes).map((s) => s[3])),
      highPrice: Math.max(...CATALOG.flatMap(allSizes).map((s) => s[3])),
      seller: { "@type": "AutoRepair", name: "The Tire Plug", telephone: PHONE.schema, url: "https://tireplugla.com/" },
    },
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
        <meta property="og:title" content="RBP Repulsor tires at The Tire Plug" />
        <meta property="og:description" content="Every size priced. 2-year road hazard. Next-day warranty exchange. Downtown LA, open 7 days." />
        <meta property="og:url" content={URL} />
        <meta property="og:image" content={IMAGE} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..900&family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet" />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      </Head>
      <Header />

      <main className="rbp">
        <header className="hero">
          <div className="wrap hero-grid">
            <div>
              <span className="eyebrow">At The Tire Plug · in stock or next day</span>
              <h1 className="display">RBP Repulsor.<br /><span className="r">Every size, priced.</span></h1>
              <p className="sub serif">All-terrain, rugged, extreme and mud-terrain tires for trucks &amp; SUVs. 15" to 28", no surprises.</p>
              <div className="ctas">
                <a className="btn btn-red" href="#sizes">Find your size →</a>
                <a className="btn btn-ghost" href={PHONE.tel}>Call {PHONE.display}</a>
              </div>
            </div>
            <img className="tire" src="/images/rbp/repulsor-at-plateau.png" alt="RBP Repulsor A/T Plateau all-terrain tire" />
          </div>
          <div className="wrap">
            <div className="perks">
              <div><small>Snow rated</small><b>3PMSF + M+S</b></div>
              <div><small>Treadwear</small><b>50,000-mile warranty</b></div>
              <div><small>Road hazard</small><b>2-year coverage</b></div>
              <div><small>Warranty exchange</small><b>Next day</b></div>
            </div>
          </div>
        </header>

        <section className="block" id="sizes">
          <div className="wrap">
            <div className="head">
              <div><span className="eyebrow">Size catalog</span><h2 className="display">Find your <span className="r">size.</span></h2></div>
              <p>Pick your rim size, then tap your size to see what's in stock and book. Prices are per tire, product only. Don't see your size? Call or text us and we'll check.</p>
            </div>
            <div className="install"><b>Install &amp; balance start at ${INSTALL} per wheel</b><span>In stock goes on today. Not on the shelf? We order it in and install it tomorrow.</span></div>
            <div className="tabs" role="tablist" aria-label="Rim size" onKeyDown={onTabKey}>
              {CATALOG.map((c, i) => (
                <button
                  key={c.rim} id={`rim-tab-${c.rim}`} type="button" role="tab" className="tab"
                  aria-selected={i === rimIdx} aria-controls="rim-panel" tabIndex={i === rimIdx ? 0 : -1}
                  onClick={() => setRimIdx(i)}
                >
                  <b>{c.rim}"</b><span>from ${Math.min(...allSizes(c).map((s) => s[3]))}</span>
                </button>
              ))}
            </div>
            <div className="panel" role="tabpanel" id="rim-panel" aria-labelledby={`rim-tab-${cur.rim}`}>
              {cur.groups.map((g) => (
                <div className="group" key={g.model}>
                  <h3>{g.model}<span>{g.note}</span></h3>
                  <table>
                    <thead><tr><th>Size</th><th>Load / speed</th><th className="ply">Ply</th><th>Per tire</th></tr></thead>
                    <tbody>
                      {g.sizes.map(([s, ls, ply, p]) => (
                        <tr key={s}>
                          <td className="size"><a href={`/tires/${sizeToSlug(sizeKey(s))}`}>{s}{isLT(s) && <i>LT</i>}</a></td>
                          <td className="spec">{ls}</td>
                          <td className="spec ply">{ply || "—"}</td>
                          <td className="price"><span className="c">$</span>{p}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
              <div className="foot">
                <span>{allSizes(cur).length} sizes in {cur.rim}". Product-only prices. Install &amp; balance start at ${INSTALL} per wheel.</span>
                <a className="btn btn-red" href={PHONE.tel}>Call to reserve</a>
              </div>
            </div>
          </div>
        </section>

        <section className="block" id="road-hazard">
          <div className="wrap">
            <div className="head">
              <div><span className="eyebrow">RBP Rolling Big Promise</span><h2 className="display">Tire popped?<br /><span className="r">We've got you.</span></h2></div>
              <p>Every Repulsor A/T Plateau comes with RBP's 2-year road hazard coverage, and we do the warranty exchange next day.</p>
            </div>
            <div className="rh">
              <div className="stat-card">
                <div className="v">2</div>
                <div className="l">Years of road<br />hazard coverage</div>
                <p>If a road hazard damages your tire and it can't be safely repaired, RBP replaces it.</p>
                <ul><li>Free replacement tire</li><li>Next-day exchange</li><li>We handle the claim</li></ul>
              </div>
              <div>
                {FAQ.map((f, i) => (
                  <details key={f.q} open={i === 0}>
                    <summary>{f.q}</summary>
                    <div className="ans">
                      {f.a}
                      {f.list && <ul>{f.list.map((li) => <li key={li}>{li}</li>)}</ul>}
                    </div>
                  </details>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="block" id="visit">
          <div className="wrap visit">
            <div className="card">
              <span className="eyebrow">Visit us</span>
              <h2 className="display" style={{ marginTop: 14 }}>Pull up.<br /><span className="r">No appointment.</span></h2>
              <div className="addr">2331 E Olympic Blvd, Los Angeles</div>
              <div className="meta">Downtown LA · {PHONE.display} · @tireplugcali</div>
              <div className="ctas">
                <a className="btn btn-red" href={PHONE.tel}>Call now</a>
                <a className="btn btn-ghost" href="https://www.google.com/maps/search/?api=1&query=2331+E+Olympic+Blvd+Los+Angeles+CA" target="_blank" rel="noopener noreferrer">Get directions</a>
                <a className="btn btn-ghost" href="https://www.instagram.com/tireplugcali" target="_blank" rel="noopener noreferrer">Instagram</a>
              </div>
            </div>
            <div className="card hours">
              <span className="eyebrow">Hours</span>
              <div style={{ marginTop: 14 }}>Open<span>7 days a week</span></div>
              <div>Appointments<span>Not needed</span></div>
              <div>Warranty exchange<span>Next day</span></div>
            </div>
          </div>
        </section>

        <section className="block more">
          <div className="wrap">
            <h2 className="more-h">More services</h2>
            <div className="chips">
              {SERVICE_INDEX.map((s) => <a key={s.slug} href={`/${s.slug}`}>{s.label}</a>)}
            </div>
            <p className="fine">Prices are per tire, product only, and subject to availability. Install and balance start at ${INSTALL} per wheel. Tax not included.</p>
            <p className="fine">Rolling Big Promise road hazard coverage applies to RBP Repulsor A/T Plateau and Guarantor H/T bought on or after Jan 1, 2026, per RBP terms: 2 years or 3/32" tread, whichever comes first. Product registration and original sales invoice required. Repulsor R/T sizes carry RBP's standard road hazard program. 50,000-mile limited treadwear warranty applies to Repulsor A/T Plateau.</p>
            <p style={{ marginTop: "1.5rem" }}><a href="/" className="back">← Back to The Tire Plug home</a></p>
          </div>
        </section>
      </main>

      <Footer />

      <style jsx global>{`
        .rbp {
          --ink: #ffffff; --ink-2: #f5f5f5; --card: #ffffff; --paper: #111111; --muted: #6b6b6b;
          --line: #e6e6e6; --red: #e01b22; --red-2: #ff3b42; --gutter: 24px;
          --shadow: 0 6px 18px rgba(0,0,0,.05);
          background: var(--ink); color: var(--paper);
          font-family: "Archivo", system-ui, sans-serif; line-height: 1.5;
        }
        .rbp .wrap { max-width: 1160px; margin: 0 auto; padding: 0 var(--gutter); }
        .rbp .eyebrow {
          font-family: "JetBrains Mono", monospace; font-size: 13px; font-weight: 700; letter-spacing: .22em; text-transform: uppercase; color: var(--red);
          display: inline-flex; align-items: center; gap: 12px;
        }
        .rbp .eyebrow::before { content: ""; width: 28px; height: 2px; background: var(--red); }
        .rbp .display { font-weight: 900; font-stretch: 62%; text-transform: uppercase; line-height: .86; letter-spacing: -.01em; }
        .rbp .r { color: var(--red); }
        .rbp .serif { font-family: "Instrument Serif", serif; font-style: italic; font-weight: 400; }

        .rbp .btn {
          display: inline-flex; align-items: center; gap: 10px; text-decoration: none;
          font-weight: 800; font-stretch: 85%; font-size: 17px; text-transform: uppercase; letter-spacing: .02em;
          padding: 15px 22px; border-radius: 6px; border: 1px solid transparent; transition: transform .15s, background .15s;
        }
        .rbp .btn:hover { transform: translateY(-1px); }
        .rbp .btn-red { background: linear-gradient(135deg, #FF1F1F 0%, #B30000 100%); color: #fff; box-shadow: 0 8px 20px rgba(224,27,34,.2); }
        .rbp .btn-red:hover { background: linear-gradient(135deg, #FF3B42 0%, #C40000 100%); }
        .rbp .btn-ghost { border-color: #dcdcdc; background: #fff; color: #111; }
        .rbp .btn-ghost:hover { border-color: var(--red); }

        .rbp .hero { position: relative; overflow: hidden; padding: 170px 0 40px;
          background: radial-gradient(700px 520px at 80% 45%, rgba(224,27,34,.05), transparent 70%), #fff; }
        .rbp .hero-grid { position: relative; display: grid; grid-template-columns: 1.1fr .9fr; align-items: center; gap: 24px; }
        .rbp .hero h1 { font-size: clamp(64px, 10vw, 136px); margin-top: 18px; }
        .rbp .hero .sub { font-size: clamp(26px, 3vw, 36px); line-height: 1.12; margin-top: 18px; max-width: 520px; color: #333; }
        .rbp .ctas { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 30px; }
        .rbp .hero .tire { width: 120%; max-width: 620px; transform: rotate(-9deg); margin-left: -4%;
          filter: drop-shadow(0 24px 30px rgba(0,0,0,.15)); }
        .rbp .perks { position: relative; display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-top: 48px; }
        .rbp .perks div { border: 1px solid var(--line); background: var(--card); box-shadow: var(--shadow); border-radius: 8px; padding: 16px 18px; }
        .rbp .perks small { display: block; font-family: "JetBrains Mono", monospace; font-size: 11.5px; letter-spacing: .12em; text-transform: uppercase; color: var(--muted); }
        .rbp .perks b { display: block; margin-top: 4px; font-weight: 800; font-stretch: 82%; font-size: 21px; text-transform: uppercase; line-height: 1.1; }

        .rbp .block { padding: 96px 0; border-top: 1px solid var(--line); scroll-margin-top: 110px; }
        .rbp #road-hazard, .rbp .more { background: var(--ink-2); }
        .rbp .head { display: flex; justify-content: space-between; align-items: flex-end; gap: 24px; flex-wrap: wrap; margin-bottom: 36px; }
        .rbp .head h2 { font-size: clamp(54px, 7vw, 96px); margin-top: 14px; }
        .rbp .head p { max-width: 420px; color: var(--muted); font-size: 17px; }

        .rbp .install { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin: -12px 0 22px; padding: 14px 18px; border-radius: 10px; background: rgba(224,27,34,.08); border: 1px solid rgba(224,27,34,.3); color: #111; text-decoration: none; }
        .rbp .install b { font-weight: 900; font-stretch: 75%; font-size: 20px; text-transform: uppercase; }
        .rbp .install span { font-size: 15px; color: #333; }
        .rbp .tabs { display: grid; grid-template-columns: repeat(7, 1fr); gap: 8px; margin-bottom: 22px; }
        .rbp .tab {
          appearance: none; cursor: pointer; text-align: left; color: var(--paper); font-family: inherit;
          background: var(--card); border: 1px solid var(--line); box-shadow: var(--shadow); border-radius: 8px; padding: 14px 16px 12px; transition: border-color .15s, background .15s;
        }
        .rbp .tab b { display: block; font-weight: 900; font-stretch: 62%; font-size: 44px; line-height: .9; }
        .rbp .tab span { font-family: "JetBrains Mono", monospace; font-size: 12px; color: var(--muted); }
        .rbp .tab:hover { border-color: var(--red); }
        .rbp .tab[aria-selected="true"] { background: var(--red); border-color: var(--red); color: #fff; }
        .rbp .tab[aria-selected="true"] span { color: rgba(255,255,255,.85); }
        .rbp .tab:focus-visible { outline: 2px solid #111; outline-offset: 2px; }

        .rbp .panel { background: var(--card); border: 1px solid var(--line); box-shadow: var(--shadow); border-radius: 10px; padding: 8px 28px 20px; }
        .rbp .group + .group { margin-top: 18px; }
        .rbp .group h3 { display: flex; justify-content: space-between; align-items: baseline; padding: 18px 0 4px; font-weight: 800; font-stretch: 85%; font-size: 19px; text-transform: uppercase; }
        .rbp .group h3 span { font-family: "JetBrains Mono", monospace; font-weight: 500; font-size: 12px; letter-spacing: .12em; color: var(--muted); }
        .rbp table { width: 100%; border-collapse: collapse; }
        .rbp th { text-align: left; font-family: "JetBrains Mono", monospace; font-weight: 500; font-size: 11.5px; letter-spacing: .14em; text-transform: uppercase; color: var(--muted); padding: 14px 0 10px; border-bottom: 1px solid var(--line); }
        .rbp td { padding: 14px 0; border-bottom: 1px solid var(--line); }
        .rbp th:last-child, .rbp td:last-child, .rbp th:nth-last-child(2), .rbp td.price { text-align: right; }
        .rbp td.inst { font-weight: 800; font-stretch: 80%; font-size: 18px; color: #555; padding-left: 14px; white-space: nowrap; }
        .rbp th.inst { padding-left: 14px; }
        .rbp td.size { font-weight: 800; font-stretch: 80%; font-size: 24px; padding-right: 10px; }
        .rbp td.size a { color: inherit; text-decoration: underline; text-decoration-color: var(--red, #E01B22); text-underline-offset: 3px; white-space: nowrap; }
        .rbp td.size i { font-style: normal; font-family: "JetBrains Mono", monospace; font-weight: 700; font-size: 11px; color: #fff; background: #111; padding: 2px 6px; border-radius: 3px; margin-left: 8px; vertical-align: 4px; }
        .rbp td.spec { font-family: "JetBrains Mono", monospace; font-size: 14px; color: #555; }
        .rbp td.price { font-weight: 900; font-stretch: 66%; font-size: 34px; line-height: 1; }
        .rbp td.price .c { color: var(--red); font-size: 20px; vertical-align: 10px; margin-right: 1px; }
        .rbp .panel .foot { display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap; padding-top: 20px; color: var(--muted); font-size: 14px; }

        .rbp .rh { display: grid; grid-template-columns: .8fr 1.2fr; gap: 40px; align-items: start; }
        .rbp .stat-card { position: sticky; top: 130px; background: var(--red); color: #fff; border-radius: 12px; padding: 34px 32px; overflow: hidden; box-shadow: 0 8px 20px rgba(224,27,34,.2); }
        .rbp .stat-card .v { font-weight: 900; font-stretch: 62%; font-size: 160px; line-height: .8; }
        .rbp .stat-card .l { font-weight: 900; font-stretch: 72%; font-size: 40px; line-height: .95; text-transform: uppercase; margin-top: 10px; }
        .rbp .stat-card p { margin-top: 18px; font-size: 17px; color: rgba(255,255,255,.9); }
        .rbp .stat-card ul { list-style: none; margin-top: 22px; border-top: 1px solid rgba(255,255,255,.25); }
        .rbp .stat-card li { padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,.25); font-weight: 800; font-stretch: 85%; font-size: 18px; text-transform: uppercase; }
        .rbp .stat-card li::before { content: "✓"; margin-right: 10px; }

        .rbp details { border-bottom: 1px solid var(--line); }
        .rbp details:first-of-type { border-top: 1px solid var(--line); }
        .rbp summary {
          list-style: none; cursor: pointer; display: flex; justify-content: space-between; align-items: center; gap: 20px;
          padding: 24px 0; font-weight: 900; font-stretch: 70%; font-size: clamp(26px, 3vw, 34px); text-transform: uppercase; line-height: 1;
        }
        .rbp summary::-webkit-details-marker { display: none; }
        .rbp summary::after { content: "+"; flex: none; width: 36px; height: 36px; border-radius: 50%; border: 1px solid var(--line); display: grid; place-items: center; font-size: 22px; color: var(--red); background: #fff; transition: transform .2s; }
        .rbp details[open] summary::after { transform: rotate(45deg); }
        .rbp summary:focus-visible { outline: 2px solid #111; outline-offset: 4px; }
        .rbp .ans { padding: 0 0 26px; color: #333; font-size: 18px; max-width: 640px; }
        .rbp .ans ul { margin: 10px 0 0 20px; }
        .rbp .ans li { margin: 4px 0; }

        .rbp .visit { display: grid; grid-template-columns: 1.2fr .8fr; gap: 24px; }
        .rbp .visit .card { background: var(--card); border: 1px solid var(--line); box-shadow: var(--shadow); border-radius: 12px; padding: 34px; }
        .rbp .visit h2 { font-size: clamp(54px, 7vw, 92px); }
        .rbp .visit .addr { font-size: 24px; font-weight: 800; margin-top: 22px; }
        .rbp .visit .meta { color: var(--muted); margin-top: 6px; }
        .rbp .visit .hours div { display: flex; justify-content: space-between; padding: 14px 0; border-bottom: 1px solid var(--line); font-weight: 700; }
        .rbp .visit .hours div span { color: var(--muted); font-weight: 500; }

        .rbp .more { padding: 64px 0 80px; }
        .rbp .more-h { font-size: 1.4rem; font-weight: 800; margin-bottom: 1rem; }
        .rbp .chips { display: flex; gap: .5rem; flex-wrap: wrap; margin-bottom: 2rem; }
        .rbp .chips a { background: #fff; border: 1px solid #dcdcdc; border-radius: 50px; padding: .5rem 1rem; color: #111; font-size: .85rem; font-weight: 600; text-decoration: none; }
        .rbp .chips a:hover { border-color: var(--red); }
        .rbp .fine { color: var(--muted); font-size: 13.5px; line-height: 1.6; max-width: 900px; margin-top: 8px; }
        .rbp .back { color: var(--red); font-weight: 700; }

        @media (max-width: 900px) {
          .rbp .hero-grid, .rbp .rh, .rbp .visit { grid-template-columns: 1fr; }
          .rbp .hero-grid > * { min-width: 0; }
          .rbp .hero .tire { width: 92%; margin: 10px auto 0; }
          .rbp .perks { grid-template-columns: repeat(2, 1fr); }
          .rbp .install { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin: -12px 0 22px; padding: 14px 18px; border-radius: 10px; background: rgba(224,27,34,.08); border: 1px solid rgba(224,27,34,.3); color: #111; text-decoration: none; }
        .rbp .install b { font-weight: 900; font-stretch: 75%; font-size: 20px; text-transform: uppercase; }
        .rbp .install span { font-size: 15px; color: #333; }
        .rbp .tabs { grid-template-columns: repeat(4, 1fr); }
          .rbp .stat-card { position: static; }
          .rbp .block { padding: 72px 0; }
        }
        @media (max-width: 560px) {
          .rbp { --gutter: 16px; }
          .rbp .hero { padding-top: 150px; }
          .rbp .panel { padding: 4px 16px 16px; }
          .rbp td.size { font-size: 19px; }
          .rbp td.price { font-size: 24px; }
          .rbp td.inst { font-size: 15px; padding-left: 8px; }
          .rbp th.inst { padding-left: 8px; }
          .rbp th.ply, .rbp td.ply { display: none; }
          .rbp td.spec { font-size: 12px; }
          .rbp .tab b { font-size: 34px; }
          .rbp .btn { padding: 14px 18px; font-size: 15px; }
        }
      `}</style>
    </>
  );
}
