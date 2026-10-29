import React from "react";
import Head from "next/head";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { fleetCatalog } from "../lib/fleet-catalog";
import { sizeToSlug } from "../lib/tire-catalog";
import { PHONE, smsHref } from "../lib/shop";

// /fleet: the business & fleet price list the outreach emails link to. Live public prices only
// (lib/fleet-catalog.js), rebuilt hourly. "Save as PDF" prints the same page as the PDF catalog.
// Not indexed until the owner approves the content.
const APPROVED = false;

export async function getStaticProps() {
  return { props: { cat: await fleetCatalog() }, revalidate: 3600 };
}

const URL = "https://tireplugla.com/fleet";
const TITLE = "Fleet & Business Tire Accounts in Downtown LA | The Tire Plug";
const DESCRIPTION = "Tire prices for business vehicles: work trucks, vans, SUVs and rideshare cars. Priority same-day service, one point of contact, quotes by text. 2331 E Olympic Blvd, Los Angeles.";
const money = (n) => `$${Number(n).toFixed(2).replace(/\.00$/, "")}`;
const WHEN = { today: "In stock", nextday: "Next day", order: "Order" };
const PERKS = [
  ["Priority same-day service", "We put business vehicles first, so your vans and trucks can get back on the road the same day whenever possible."],
  ["One point of contact", "One person at the shop handles your account and keeps track of your vehicles. Call or text anytime we are open."],
  ["Quotes by text", "Budget, mid-range and premium options for each vehicle, sent by text so you can approve them from the road."],
  ["Free inspections & repairs", "Free tire inspections, and free repairs on repairable punctures for the first 365 days after you buy."],
];

export default function Fleet({ cat }) {
  const updated = new Date(`${cat.updated}T12:00:00`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  return (
    <>
      <Head>
        <title>{TITLE}</title>
        <meta name="description" content={DESCRIPTION} />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {APPROVED ? <link rel="canonical" href={URL} /> : <meta name="robots" content="noindex" />}
        <meta property="og:title" content={TITLE} />
        <meta property="og:description" content={DESCRIPTION} />
        <meta property="og:url" content={URL} />
      </Head>
      <div className="no-print"><Header /></div>
      <main className="fl">
        <section className="fl-top">
          <div className="wrap">
            <img className="print-logo" src="/images/email/logo.png" alt="The Tire Plug" width="96" />
            <span className="eyebrow">Fleet &amp; business accounts</span>
            <h1>Keep your vehicles <span>on the road.</span></h1>
            <p className="lead">Tires and service for local businesses with vans, trucks, sales cars and rideshare fleets, right in Downtown LA. 5.0 stars on Google, 10,000+ vehicles serviced.</p>
            <div className="ctas no-print">
              <a className="btn red" href={PHONE.tel}>Call {PHONE.display}</a>
              <a className="btn dark" href={smsHref("Hi, I'd like to set up a business account.")}>Text us</a>
              <button className="btn ghost" onClick={() => window.print()}>Save as PDF</button>
            </div>
          </div>
        </section>

        <section className="wrap perks">
          {PERKS.map(([h, p]) => (
            <div className="perk" key={h}><h3>{h}</h3><p>{p}</p></div>
          ))}
        </section>

        <section className="wrap list">
          <h2>Price list</h2>
          <p className="sub">The lowest price we have in each size, per tire, as of {updated}. Install &amp; balance from <b>${cat.install} per wheel</b>. Ask for budget, mid-range and premium options in any size.</p>
          {cat.groups.map((g) => (
            <div className="grp" key={g.id}>
              <h3>{g.title}</h3>
              <p className="blurb">{g.blurb}</p>
              <table>
                <thead><tr><th>Size</th><th>Lowest-priced tire</th><th className="r">Per tire</th><th className="hide-sm">Availability</th></tr></thead>
                <tbody>
                  {g.rows.map((r) => (
                    <tr key={r.key}>
                      <td className="size"><a href={`/tires/${sizeToSlug(r.key)}`}>{r.key.replace("X", "x")}</a></td>
                      <td>{r.brand} {r.model}{r.options > 1 && <span className="more"> · {r.options} options</span>}{r.special && <span className="special">{r.special}</span>}</td>
                      <td className="r price">{money(r.price)}</td>
                      <td className="hide-sm"><span className={`when ${r.today ? "today" : r.when}`}>{r.today ? "In stock" : WHEN[r.when]}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
          <p className="fine">Prices are per tire, before installation and tax, and change with stock and our suppliers; the price on the day we quote is the one you pay. "In stock" means we had that size on the shelf on the date above. Don't see your size? Text us; we can usually get it next day.</p>
        </section>

        <section className="wrap contact">
          <h2>Set up a business account</h2>
          <p>Call or text <a href={PHONE.tel}><b>{PHONE.display}</b></a> and tell us what you drive. We'll set you up with one contact and quote your vehicles by text.</p>
          <p className="addr"><b>The Tire Plug</b> · 2331 E Olympic Blvd, Los Angeles, CA 90021 · Mon–Fri 9–7, Sat 9–6, Sun 10–4 · tireplugla.com</p>
        </section>
      </main>
      <div className="no-print"><Footer /></div>
      <style jsx global>{`
        .fl { background: #fff; color: #111; padding-bottom: 4rem; }
        .fl .wrap { max-width: 900px; margin: 0 auto; padding: 0 1.25rem; }
        .fl-top { padding: 9.5rem 0 2.5rem; background: radial-gradient(600px 300px at 85% 0%, rgba(224,27,34,0.07), transparent 70%), #fff; border-bottom: 1px solid #ececec; text-align: center; }
        .fl .print-logo { display: none; }
        .fl .eyebrow { color: #E01B22; font-size: 0.78rem; font-weight: 800; letter-spacing: 0.16em; text-transform: uppercase; }
        .fl h1 { font-size: clamp(2.2rem, 6vw, 3.6rem); font-weight: 900; letter-spacing: -0.03em; line-height: 1.02; margin: 0.6rem 0 0.75rem; }
        .fl h1 span { color: #E01B22; display: block; }
        .fl .lead { color: #555; font-size: 1.05rem; margin: 0 auto 1.5rem; max-width: 600px; }
        .fl .ctas { display: flex; gap: 0.6rem; justify-content: center; flex-wrap: wrap; }
        .fl .btn { display: inline-block; padding: 0.85rem 1.4rem; border-radius: 10px; font-weight: 800; font-size: 0.9rem; letter-spacing: 0.04em; text-transform: uppercase; text-decoration: none; border: 1px solid transparent; cursor: pointer; font-family: inherit; }
        .fl .btn.red { background: #E01B22; color: #fff; }
        .fl .btn.dark { background: #111; color: #fff; }
        .fl .btn.ghost { background: #fff; color: #111; border-color: #dcdcdc; }
        .fl .perks { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 0.9rem; margin-top: 2rem; }
        .fl .perk { border: 1px solid #ececec; border-radius: 14px; padding: 1rem 1.1rem; }
        .fl .perk h3 { font-size: 1rem; font-weight: 900; margin: 0 0 0.35rem; }
        .fl .perk p { color: #555; font-size: 0.9rem; line-height: 1.45; margin: 0; }
        .fl .list h2, .fl .contact h2 { font-size: 1.6rem; font-weight: 900; margin: 2.5rem 0 0.4rem; }
        .fl .sub { color: #555; margin: 0 0 0.5rem; }
        .fl .sub b { color: #E01B22; }
        .fl .grp { margin-top: 1.6rem; break-inside: auto; }
        .fl .grp h3 { font-size: 1.15rem; font-weight: 900; margin: 0; }
        .fl .blurb { color: #6b6b6b; font-size: 0.88rem; margin: 0.15rem 0 0.6rem; }
        .fl table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
        .fl th { text-align: left; color: #6b6b6b; font-size: 0.72rem; letter-spacing: 0.08em; text-transform: uppercase; font-weight: 800; padding: 0.45rem 0.5rem; border-bottom: 2px solid #111; }
        .fl td { padding: 0.5rem; border-bottom: 1px solid #ececec; vertical-align: top; }
        .fl tr { break-inside: avoid; }
        .fl .r { text-align: right; }
        .fl .size a { color: #111; font-weight: 800; text-decoration: none; white-space: nowrap; }
        .fl .size a:hover { color: #E01B22; }
        .fl .price { font-weight: 900; color: #E01B22; white-space: nowrap; }
        .fl .more { color: #6b6b6b; }
        .fl .special { display: block; color: #1a7f37; font-size: 0.78rem; font-weight: 700; }
        .fl .when { font-size: 0.78rem; font-weight: 700; padding: 0.15rem 0.5rem; border-radius: 50px; background: #f3f3f3; color: #555; white-space: nowrap; }
        .fl .when.today { background: #e8f6ee; color: #1a7f37; }
        .fl .fine { color: #777; font-size: 0.8rem; line-height: 1.5; margin-top: 1.2rem; }
        .fl .contact p { color: #333; }
        .fl .contact a { color: #E01B22; text-decoration: none; }
        .fl .addr { color: #666 !important; font-size: 0.9rem; }
        @media (max-width: 560px) { .fl-top { padding-top: 8.5rem; } .fl .hide-sm { display: none; } }
        @media print {
          @page { margin: 14mm 12mm; }
          .no-print { display: none !important; }
          .fl { padding-bottom: 0; }
          .fl-top { padding: 0 0 1rem; background: none; }
          .fl .print-logo { display: block; margin: 0 auto 0.5rem; }
          .fl h1 { font-size: 2.2rem; }
          .fl .hide-sm { display: table-cell !important; }
          .fl .size a { color: #111; }
          .fl .list h2 { break-before: page; margin-top: 0; }
          .fl .contact h2 { margin-top: 1.5rem; }
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
    </>
  );
}
