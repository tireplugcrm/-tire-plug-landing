import React, { useEffect, useState } from "react";
import Head from "next/head";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { SERVICE_INDEX } from "../components/ServicePage";

const URL = "https://tireplugla.com/rbp-tires-los-angeles";
const TITLE = "RBP Repulsor A/T Tires in Los Angeles | Every Size Priced | The Tire Plug";
const DESCRIPTION =
  "RBP Repulsor A/T Plateau all-terrain tires in 15\" to 24\" at The Tire Plug, 2331 E Olympic Blvd, Los Angeles. Every size priced, 2-year road hazard coverage, next-day warranty exchange. Open 7 days, no appointment. Call (562) 500-4625.";
const IMAGE = "https://tireplugla.com/images/rbp/repulsor-at-plateau.png";

const AT = "Repulsor A/T Plateau";
const RT = "Repulsor R/T";
// Mount + balance per tire, charged on top of the RBP tire-only price.
const INSTALL = 25;
// Prices per tire, tire only (install not included). Each size: [size, load/speed, ply, price]
const CATALOG = [
  { rim: 15, groups: [{ model: AT, note: "All-terrain", sizes: [
    ["235/75R15", "109T", "", 99], ["255/70R15", "108S", "", 109], ["265/70R15", "112S", "", 125],
    ["31X10.50R15LT", "109S", "C/6", 130], ["LT235/75R15", "116/113R", "E/10", 125],
  ] }] },
  { rim: 16, groups: [{ model: AT, note: "All-terrain", sizes: [
    ["245/70R16", "106S", "", 95], ["245/75R16", "115T", "", 95], ["255/70R16", "115T", "", 125],
    ["265/70R16", "112T", "", 100], ["265/75R16", "116T", "", 125], ["LT215/85R16", "115/112R", "E/10", 125],
    ["LT225/75R16", "115/112S", "E/10", 115], ["LT235/85R16", "120/116S", "E/10", 130], ["LT245/75R16", "120/116S", "E/10", 110],
    ["LT265/70R16", "117/114S", "D/8", 130], ["LT265/75R16", "123/120S", "E/10", 135], ["LT285/75R16", "126/123R", "E/10", 160],
    ["LT315/75R16", "127/124R", "E/10", 210],
  ] }] },
  { rim: 17, groups: [{ model: AT, note: "All-terrain", sizes: [
    ["225/65R17", "106T", "", 100], ["235/65R17", "104H", "", 115], ["245/65R17", "111T", "", 110],
    ["245/70R17", "114T", "", 110], ["255/65R17", "114T", "", 110], ["255/70R17", "112T", "", 120],
    ["265/65R17", "116T", "", 125], ["265/70R17", "115T", "", 125], ["285/70R17", "117T", "", 145],
    ["LT235/70R17", "120/117R", "E/10", 130], ["LT235/80R17", "120/117R", "E/10", 125], ["LT245/70R17", "119/116S", "E/10", 115],
    ["LT265/70R17", "123/120S", "E/10", 140], ["LT285/70R17", "126/123S", "E/10", 155],
  ] }] },
  { rim: 18, groups: [{ model: AT, note: "All-terrain", sizes: [
    ["245/60R18", "105H", "", 135], ["255/70R18", "113T", "", 130], ["265/60R18", "114T", "", 125],
    ["265/65R18", "114T", "", 135], ["265/70R18", "116T", "", 130], ["275/65R18", "116T", "", 150],
    ["LT265/65R18", "122/119R", "E/10", 165], ["LT265/70R18", "124/121S", "E/10", 140], ["LT275/65R18", "123/120S", "E/10", 150],
    ["LT275/70R18", "125/122S", "E/10", 155], ["LT285/65R18", "125/122S", "E/10", 165], ["LT295/70R18", "129/126R", "E/10", 195],
    ["LT305/65R18", "128/125R", "F/12", 210], ["LT325/65R18", "121/118T", "D/8", 205],
  ] }] },
  { rim: 20, groups: [{ model: AT, note: "All-terrain", sizes: [
    ["265/50R20", "111H", "", 140], ["275/55R20", "117T", "", 135], ["275/60R20", "115T", "", 145],
    ["35X12.50R20LT", "125R", "F/12", 200], ["LT265/60R20", "121/118S", "E/10", 165], ["LT275/65R20", "126/123S", "E/10", 155],
    ["LT285/60R20", "125/122R", "E/10", 175],
  ] }] },
  { rim: 22, groups: [
    { model: AT, note: "All-terrain", sizes: [["285/45R22", "114T", "", 150]] },
    { model: RT, note: "Rugged-terrain", sizes: [["33X13.50R22", "109Q", "F/12", 230], ["35X13.50R22", "122Q", "F/12", 270], ["305/45R22", "118V", "", 175]] },
  ] },
  { rim: 24, groups: [
    { model: AT, note: "All-terrain", sizes: [["305/35R24", "112H", "", 180]] },
    { model: RT, note: "Rugged-terrain", sizes: [
      ["33X12.50R24", "106Q", "F/12", 230], ["35X12.50R24", "116Q", "F/12", 275], ["33X13.50R24", "102Q", "F/12", 240],
      ["35X13.50R24", "118Q", "E/10", 225], ["305/35R24", "112V", "", 190], ["285/40R24", "112H", "", 185],
    ] },
  ] },
];

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
      seller: { "@type": "AutoRepair", name: "The Tire Plug", telephone: "+1-562-500-4625", url: "https://tireplugla.com/" },
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
        <meta property="og:title" content="RBP Repulsor A/T at The Tire Plug" />
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
              <span className="eyebrow">In stock at The Tire Plug</span>
              <h1 className="display">RBP Repulsor A/T.<br /><span className="r">Every size, priced.</span></h1>
              <p className="sub serif">All-weather, all-terrain tires for trucks &amp; SUVs. 15" to 24", no surprises.</p>
              <div className="ctas">
                <a className="btn btn-red" href="#sizes">Find your size →</a>
                <a className="btn btn-ghost" href="tel:5625004625">Call (562) 500-4625</a>
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
              <p>Pick your rim size. Prices are per tire. Mounting &amp; balancing is ${INSTALL} per tire; the Installed column includes it. Don't see your size? Call or text us.</p>
            </div>
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
                    <thead><tr><th>Size</th><th>Load / speed</th><th className="ply">Ply</th><th>Tire only</th><th className="inst">Installed</th></tr></thead>
                    <tbody>
                      {g.sizes.map(([s, ls, ply, p]) => (
                        <tr key={s}>
                          <td className="size">{s}{isLT(s) && <i>LT</i>}</td>
                          <td className="spec">{ls}</td>
                          <td className="spec ply">{ply || "—"}</td>
                          <td className="price"><span className="c">$</span>{p}</td>
                          <td className="inst">${p + INSTALL}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
              <div className="foot">
                <span>{allSizes(cur).length} sizes in {cur.rim}". Tire-only price + ${INSTALL} per tire for mounting &amp; balancing. Tax not included.</span>
                <a className="btn btn-red" href="tel:5625004625">Call to reserve</a>
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
              <div className="meta">Downtown LA · (562) 500-4625 · @tireplugcali</div>
              <div className="ctas">
                <a className="btn btn-red" href="tel:5625004625">Call now</a>
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
            <p className="fine">Prices are per tire, tire only, and subject to availability. Mounting and balancing: ${INSTALL} per tire. Tax not included.</p>
            <p className="fine">Rolling Big Promise road hazard coverage applies to RBP Repulsor A/T Plateau and Guarantor H/T bought on or after Jan 1, 2026, per RBP terms: 2 years or 3/32" tread, whichever comes first. Product registration and original sales invoice required. Repulsor R/T sizes carry RBP's standard road hazard program. 50,000-mile limited treadwear warranty applies to Repulsor A/T Plateau.</p>
            <p style={{ marginTop: "1.5rem" }}><a href="/" className="back">← Back to The Tire Plug home</a></p>
          </div>
        </section>
      </main>

      <Footer />

      <style jsx global>{`
        .rbp {
          --ink: #0a0a0a; --ink-2: #141414; --card: #171717; --paper: #f2efe8; --muted: #9a978f;
          --line: rgba(242,239,232,.12); --red: #e01b22; --red-2: #ff3b42; --gutter: 24px;
          background: var(--ink); color: var(--paper);
          font-family: "Archivo", system-ui, sans-serif; line-height: 1.5;
        }
        .rbp .wrap { max-width: 1160px; margin: 0 auto; padding: 0 var(--gutter); }
        .rbp .eyebrow {
          font-family: "JetBrains Mono", monospace; font-size: 13px; font-weight: 700; letter-spacing: .22em; text-transform: uppercase; color: var(--red-2);
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
        .rbp .btn-red { background: var(--red); color: #fff; }
        .rbp .btn-red:hover { background: var(--red-2); }
        .rbp .btn-ghost { border-color: var(--line); background: rgba(255,255,255,.03); color: var(--paper); }
        .rbp .btn-ghost:hover { border-color: rgba(242,239,232,.35); }

        .rbp .hero { position: relative; overflow: hidden; padding: 170px 0 40px;
          background: radial-gradient(700px 520px at 80% 45%, rgba(224,27,34,.38), transparent 70%), linear-gradient(180deg, var(--ink-2), var(--ink)); }
        .rbp .hero-grid { position: relative; display: grid; grid-template-columns: 1.1fr .9fr; align-items: center; gap: 24px; }
        .rbp .hero h1 { font-size: clamp(64px, 10vw, 136px); margin-top: 18px; }
        .rbp .hero .sub { font-size: clamp(26px, 3vw, 36px); line-height: 1.12; margin-top: 18px; max-width: 520px; color: rgba(242,239,232,.9); }
        .rbp .ctas { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 30px; }
        .rbp .hero .tire { width: 120%; max-width: 620px; transform: rotate(-9deg); margin-left: -4%;
          filter: drop-shadow(0 40px 50px rgba(0,0,0,.7)) drop-shadow(0 0 60px rgba(224,27,34,.25)); }
        .rbp .perks { position: relative; display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-top: 48px; }
        .rbp .perks div { border: 1px solid var(--line); background: rgba(20,20,20,.8); border-radius: 8px; padding: 16px 18px; }
        .rbp .perks small { display: block; font-family: "JetBrains Mono", monospace; font-size: 11.5px; letter-spacing: .12em; text-transform: uppercase; color: var(--muted); }
        .rbp .perks b { display: block; margin-top: 4px; font-weight: 800; font-stretch: 82%; font-size: 21px; text-transform: uppercase; line-height: 1.1; }

        .rbp .block { padding: 96px 0; border-top: 1px solid var(--line); scroll-margin-top: 110px; }
        .rbp .head { display: flex; justify-content: space-between; align-items: flex-end; gap: 24px; flex-wrap: wrap; margin-bottom: 36px; }
        .rbp .head h2 { font-size: clamp(54px, 7vw, 96px); margin-top: 14px; }
        .rbp .head p { max-width: 420px; color: var(--muted); font-size: 17px; }

        .rbp .tabs { display: grid; grid-template-columns: repeat(7, 1fr); gap: 8px; margin-bottom: 22px; }
        .rbp .tab {
          appearance: none; cursor: pointer; text-align: left; color: var(--paper); font-family: inherit;
          background: var(--card); border: 1px solid var(--line); border-radius: 8px; padding: 14px 16px 12px; transition: border-color .15s, background .15s;
        }
        .rbp .tab b { display: block; font-weight: 900; font-stretch: 62%; font-size: 44px; line-height: .9; }
        .rbp .tab span { font-family: "JetBrains Mono", monospace; font-size: 12px; color: var(--muted); }
        .rbp .tab:hover { border-color: rgba(242,239,232,.3); }
        .rbp .tab[aria-selected="true"] { background: var(--red); border-color: var(--red); }
        .rbp .tab[aria-selected="true"] span { color: rgba(255,255,255,.85); }
        .rbp .tab:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }

        .rbp .panel { background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: 8px 28px 20px; }
        .rbp .group + .group { margin-top: 18px; }
        .rbp .group h3 { display: flex; justify-content: space-between; align-items: baseline; padding: 18px 0 4px; font-weight: 800; font-stretch: 85%; font-size: 19px; text-transform: uppercase; }
        .rbp .group h3 span { font-family: "JetBrains Mono", monospace; font-weight: 500; font-size: 12px; letter-spacing: .12em; color: var(--muted); }
        .rbp table { width: 100%; border-collapse: collapse; }
        .rbp th { text-align: left; font-family: "JetBrains Mono", monospace; font-weight: 500; font-size: 11.5px; letter-spacing: .14em; text-transform: uppercase; color: var(--muted); padding: 14px 0 10px; border-bottom: 1px solid var(--line); }
        .rbp td { padding: 14px 0; border-bottom: 1px solid var(--line); }
        .rbp th:last-child, .rbp td:last-child, .rbp th:nth-last-child(2), .rbp td.price { text-align: right; }
        .rbp td.inst { font-weight: 800; font-stretch: 80%; font-size: 18px; color: rgba(242,239,232,.75); padding-left: 14px; white-space: nowrap; }
        .rbp th.inst { padding-left: 14px; }
        .rbp td.size { font-weight: 800; font-stretch: 80%; font-size: 24px; }
        .rbp td.size i { font-style: normal; font-family: "JetBrains Mono", monospace; font-weight: 700; font-size: 11px; color: var(--ink); background: var(--paper); padding: 2px 6px; border-radius: 3px; margin-left: 8px; vertical-align: 4px; }
        .rbp td.spec { font-family: "JetBrains Mono", monospace; font-size: 14px; color: rgba(242,239,232,.7); }
        .rbp td.price { font-weight: 900; font-stretch: 66%; font-size: 34px; line-height: 1; }
        .rbp td.price .c { color: var(--red-2); font-size: 20px; vertical-align: 10px; margin-right: 1px; }
        .rbp .panel .foot { display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap; padding-top: 20px; color: var(--muted); font-size: 14px; }

        .rbp .rh { display: grid; grid-template-columns: .8fr 1.2fr; gap: 40px; align-items: start; }
        .rbp .stat-card { position: sticky; top: 130px; background: var(--red); border-radius: 12px; padding: 34px 32px; overflow: hidden; }
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
        .rbp summary::after { content: "+"; flex: none; width: 36px; height: 36px; border-radius: 50%; border: 1px solid var(--line); display: grid; place-items: center; font-size: 22px; color: var(--red-2); transition: transform .2s; }
        .rbp details[open] summary::after { transform: rotate(45deg); }
        .rbp summary:focus-visible { outline: 2px solid #fff; outline-offset: 4px; }
        .rbp .ans { padding: 0 0 26px; color: rgba(242,239,232,.85); font-size: 18px; max-width: 640px; }
        .rbp .ans ul { margin: 10px 0 0 20px; }
        .rbp .ans li { margin: 4px 0; }

        .rbp .visit { display: grid; grid-template-columns: 1.2fr .8fr; gap: 24px; }
        .rbp .visit .card { background: var(--card); border: 1px solid var(--line); border-radius: 12px; padding: 34px; }
        .rbp .visit h2 { font-size: clamp(54px, 7vw, 92px); }
        .rbp .visit .addr { font-size: 24px; font-weight: 800; margin-top: 22px; }
        .rbp .visit .meta { color: var(--muted); margin-top: 6px; }
        .rbp .visit .hours div { display: flex; justify-content: space-between; padding: 14px 0; border-bottom: 1px solid var(--line); font-weight: 700; }
        .rbp .visit .hours div span { color: var(--muted); font-weight: 500; }

        .rbp .more { padding: 64px 0 80px; }
        .rbp .more-h { font-size: 1.4rem; font-weight: 800; margin-bottom: 1rem; }
        .rbp .chips { display: flex; gap: .5rem; flex-wrap: wrap; margin-bottom: 2rem; }
        .rbp .chips a { background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.12); border-radius: 50px; padding: .5rem 1rem; color: #fff; font-size: .85rem; font-weight: 600; }
        .rbp .fine { color: var(--muted); font-size: 13.5px; line-height: 1.6; max-width: 900px; margin-top: 8px; }
        .rbp .back { color: #FF6666; font-weight: 700; }

        @media (max-width: 900px) {
          .rbp .hero-grid, .rbp .rh, .rbp .visit { grid-template-columns: 1fr; }
          .rbp .hero-grid > * { min-width: 0; }
          .rbp .hero .tire { width: 92%; margin: 10px auto 0; }
          .rbp .perks { grid-template-columns: repeat(2, 1fr); }
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
