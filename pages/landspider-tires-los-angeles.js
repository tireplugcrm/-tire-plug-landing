import React from "react";
import Head from "next/head";
import Header from "../components/Header";
import Footer from "../components/Footer";
import StockTireCard from "../components/StockTireCard";
import { INSTALL_FROM, sizeToSlug } from "../lib/tire-catalog";
import { stockForSize } from "../lib/inventory";

// Landspider special: the 8 sizes from the October 2026 Landspider buy. Cards, stock and prices come
// from the same place as /tires/<size> (lib/inventory.js -> lib/pricing.js), so a price changed in
// admin -> Inventory & Pricing shows here too. A size that sells out drops off on its own.
const URL = "https://tireplugla.com/landspider-tires-los-angeles";
const LINES = [
  { model: "Citytraxx G/P", title: "Citytraxx G/P", sub: "Everyday all-season for sedans and compacts", sizes: ["195/65R15", "205/65R15", "205/55R16", "215/60R16"] },
  { model: "Citytraxx H/P", title: "Citytraxx H/P", sub: "Performance all-season for coupes, sedans and crossovers", sizes: ["235/45R18", "235/40R19", "245/45R20", "245/50R20"] },
];
const SMS = "5625004625";
const money = (n) => `$${Number(n).toFixed(2).replace(/\.00$/, "")}`;

export async function getStaticProps() {
  const lines = [];
  for (const line of LINES) {
    const tires = [];
    for (const size of line.sizes) {
      const stock = await stockForSize(size);
      for (const t of stock) if (t.brand === "Landspider" && t.model === line.model) tires.push({ ...t, size });
    }
    lines.push({ ...line, tires });
  }
  // Prices can change in admin; the autopilot doesn't rebuild this page, so refresh it every 10 minutes.
  return { props: { lines }, revalidate: 600 };
}

export default function LandspiderTires({ lines }) {
  const all = lines.flatMap((l) => l.tires);
  const priced = all.filter((t) => t.price != null);
  const from = priced.length ? Math.min(...priced.map((t) => t.price)) : null;
  const title = `Landspider Tires in Los Angeles${from ? ` from ${money(from)}` : ""} | The Tire Plug`;
  const description = `Landspider Citytraxx G/P and H/P tires in stock at The Tire Plug, 2331 E Olympic Blvd, Los Angeles.${from ? ` From ${money(from)} a tire.` : ""} Install and balance $${INSTALL_FROM} per wheel. Call (562) 500-4625.`;
  const smsFor = (t) => `sms:${SMS}?&body=${encodeURIComponent(`Hi Tire Plug! I saw the Landspider ${t.model} in ${t.size}${t.price != null ? ` for ${money(t.price)} each` : ""}. Can you hold a set for me?`)}`;

  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="canonical" href={URL} />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="The Tire Plug" />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={URL} />
        <meta property="og:image" content="https://tireplugla.com/images/tires/landspider-citytraxx-h-p.webp" />
      </Head>
      <Header />

      <main className="ls">
        <section className="ls-top">
          <div className="wrap">
            <img className="logo" src="/images/brands/landspider.png" alt="Landspider" />
            <span className="kicker">Landspider special · while supplies last</span>
            <h1>Brand-new Landspider tires {from ? <>from <span>{money(from)}</span></> : null}</h1>
            <p className="lead">
              {all.length ? <><b>{all.length} sizes in stock</b>, 15" to 20". </> : null}
              Install &amp; balance <b>${INSTALL_FROM} per wheel</b>. Downtown LA, open 7 days.
            </p>
            <div className="ctas">
              <a className="btn red" href="/book">Book install →</a>
              <a className="btn ghost" href="tel:5625004625">Call (562) 500-4625</a>
            </div>
          </div>
        </section>

        <div className="wrap">
          {lines.map((line) => (
            <section className="line" key={line.model}>
              <h2>Landspider {line.title}</h2>
              <p className="sub">{line.sub}</p>
              {line.tires.length ? (
                <ul className="list">
                  {line.tires.map((t) => (
                    <StockTireCard key={`${t.size}-${t.lt}`} tire={t} size={t.size} smsHref={smsFor(t)} />
                  ))}
                </ul>
              ) : (
                <p className="empty">These sizes just sold out. <a href="tel:5625004625">Call (562) 500-4625</a> and we'll find you a set.</p>
              )}
              <p className="sizes">
                {line.sizes.map((s) => <a key={s} href={`/tires/${sizeToSlug(s)}`}>{s}</a>)}
              </p>
            </section>
          ))}
        </div>
      </main>

      <Footer />
      <style jsx>{`
        .ls { background: #fff; color: #111; padding-bottom: 4rem; }
        .ls .wrap { max-width: 1100px; margin: 0 auto; padding: 0 1.25rem; }
        .ls-top { padding: 10.75rem 0 2rem; background: radial-gradient(600px 300px at 85% 0%, rgba(124,179,77,0.12), transparent 70%), #fff; border-bottom: 1px solid #ececec; margin-bottom: 1.5rem; }
        .ls .logo { height: 34px; width: auto; display: block; margin-bottom: 0.9rem; }
        .ls .kicker { display: inline-block; background: rgba(224,27,34,0.08); border: 1px solid rgba(224,27,34,0.35); color: #E01B22; font-size: 0.75rem; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; padding: 0.35rem 0.75rem; border-radius: 50px; }
        .ls h1 { font-size: clamp(2.2rem, 6vw, 3.6rem); font-weight: 900; letter-spacing: -0.03em; line-height: 1.02; margin: 0.7rem 0 0.75rem; }
        .ls h1 span { color: #E01B22; }
        .ls .lead { color: #555; font-size: 1.05rem; margin: 0 0 1.1rem; }
        .ls .lead b { color: #111; }
        .ls .ctas { display: flex; gap: 0.6rem; flex-wrap: wrap; }
        .ls .btn { text-align: center; text-decoration: none; padding: 0.8rem 1.3rem; border-radius: 50px; font-weight: 800; font-size: 0.95rem; }
        .ls .btn.red { background: linear-gradient(135deg, #FF1F1F 0%, #B30000 100%); color: #fff; box-shadow: 0 8px 20px rgba(224,27,34,0.2); }
        .ls .btn.ghost { background: #fff; color: #111; border: 1px solid #dcdcdc; }
        .ls .line { margin-bottom: 2.5rem; }
        .ls .line h2 { font-size: 1.5rem; font-weight: 900; margin: 0; }
        .ls .sub { color: #555; margin: 0.25rem 0 1rem; }
        .ls .list { list-style: none; padding: 0; margin: 0; display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; }
        .ls .empty { background: #f5f5f5; border: 1px solid #e6e6e6; border-radius: 12px; padding: 1rem 1.25rem; }
        .ls .sizes { display: flex; flex-wrap: wrap; gap: 0.5rem; margin: 0.9rem 0 0; }
        .ls .sizes a { font-size: 0.85rem; font-weight: 700; color: #111; text-decoration: none; border: 1px solid #e6e6e6; border-radius: 50px; padding: 0.3rem 0.8rem; }
        .ls .sizes a:hover { border-color: #E01B22; color: #E01B22; }
        @media (max-width: 760px) { .ls .list { grid-template-columns: 1fr; } .ls-top { padding-top: 9rem; } }
      `}</style>
    </>
  );
}
