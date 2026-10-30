import React from "react";
import Head from "next/head";
import Header from "../components/Header";
import Footer from "../components/Footer";
import StockTireCard from "../components/StockTireCard";
import { sizeToSlug } from "../lib/tire-catalog";
import { commercialStock, commercialNextDay } from "../lib/inventory";
import { COMMERCIAL_ACCOUNT_SAVINGS } from "../lib/pricing-engine";
import { PHONE, ADDRESS, OPENING_HOURS } from "../lib/shop";

// /commercial-tires: every commercial tire on our shelf (19.5", 22.5"...), grouped by size, from the
// same stock and prices as /tires/<size>. Ordered by text or call, not booked online; resale-license
// and commercial accounts get $10 off per tire. Rebuilt hourly, so it follows the stock on its own.
const URL = "https://tireplugla.com/commercial-tires";
const money = (n) => `$${Number(n).toFixed(2).replace(/\.00$/, "")}`;
const SAVINGS = `Save $${COMMERCIAL_ACCOUNT_SAVINGS} per tire with a resale license & commercial account`;

export async function getStaticProps() {
  const stock = await commercialStock();
  const nextDay = await commercialNextDay();
  const sizes = [];
  const group = (t) => {
    let g = sizes.find((s) => s.key === t.key);
    if (!g) sizes.push((g = { key: t.key, slug: sizeToSlug(t.key), rim: t.rim, tires: [], nextDay: [] }));
    return g;
  };
  for (const t of stock) group(t).tires.push(t);
  for (const t of nextDay) group(t).nextDay.push(t);
  sizes.sort((a, b) => a.rim - b.rim || a.key.localeCompare(b.key, "en", { numeric: true }));
  const prices = [...stock, ...nextDay].map((t) => t.price).filter((p) => p != null);
  return { props: { sizes, count: stock.length, nextCount: nextDay.length, from: prices.length ? Math.min(...prices) : null }, revalidate: 3600 };
}

export default function CommercialTires({ sizes, count, nextCount = 0, from }) {
  const title = from != null
    ? `Commercial Truck Tires in Los Angeles from ${money(from)} | The Tire Plug`
    : "Commercial Truck Tires in Los Angeles | The Tire Plug";
  const description = `Commercial truck tires in Los Angeles at The Tire Plug, 2331 E Olympic Blvd: 19.5" and 22.5" sizes in stock${from != null ? ` from ${money(from)} per tire` : ""}. Text or call ${PHONE.display} to order. ${SAVINGS}.`;
  const smsNextDay = (t) => `${PHONE.sms}?&body=${encodeURIComponent(`Hi Tire Plug! I'd like to order the ${t.brand} ${t.model} in ${t.key} (${money(t.price)} each) for next day. How many can you get?`)}`;
  const smsTire = (t) => `${PHONE.sms}?&body=${encodeURIComponent(t.price != null
    ? `Hi Tire Plug! I'd like to order the ${t.brand} ${t.model || ""} in ${t.key} (${money(t.price)} each). How many can I get?`.replace(/\s+/g, " ")
    : `Hi Tire Plug! I'd like to order the ${t.brand} ${t.model || ""} in ${t.key}. What's the price?`.replace(/\s+/g, " "))}`;
  const smsAccount = `${PHONE.sms}?&body=${encodeURIComponent("Hi Tire Plug! I'd like to set up a commercial account for truck tires. I have a resale license.")}`;
  const smsAsk = `${PHONE.sms}?&body=${encodeURIComponent("Hi Tire Plug! I'm looking for commercial truck tires. My size is: ")}`;
  const schema = [
    {
      "@context": "https://schema.org", "@type": "TireShop", "@id": "https://tireplugla.com/#olympic", name: "The Tire Plug", url: "https://tireplugla.com/",
      telephone: PHONE.schema,
      address: { "@type": "PostalAddress", streetAddress: ADDRESS.street, addressLocality: ADDRESS.city, addressRegion: ADDRESS.region, postalCode: ADDRESS.zip, addressCountry: "US" },
      openingHoursSpecification: OPENING_HOURS,
    },
    count > 0 && {
      "@context": "https://schema.org", "@type": "ItemList", name: "Commercial truck tires in stock at The Tire Plug, Los Angeles",
      itemListElement: sizes.flatMap((s) => s.tires).filter((t) => t.price != null).map((t, i) => ({
        "@type": "ListItem", position: i + 1,
        item: {
          "@type": "Product", name: `${t.brand} ${t.model || ""} ${t.key} tire`.replace(/\s+/g, " "), brand: { "@type": "Brand", name: t.brand },
          offers: { "@type": "Offer", price: t.price, priceCurrency: "USD", url: `https://tireplugla.com/tires/${sizeToSlug(t.key)}`,
            itemCondition: "https://schema.org/NewCondition",
            availability: t.level === "low" ? "https://schema.org/LimitedAvailability" : "https://schema.org/InStock",
            seller: { "@id": "https://tireplugla.com/#olympic" } },
        },
      })),
    },
  ].filter(Boolean);

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
        <meta property="og:image" content="https://tireplugla.com/images/shop-exterior.webp" />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      </Head>
      <Header />
      <main className="cm">
        <section className="cm-top">
          <div className="wrap">
            <span className="eyebrow">Fleets · Box trucks · Delivery · Downtown LA</span>
            <h1>Commercial truck tires, <span>in stock in Los Angeles.</span></h1>
            <p className="lead">
              {count > 0 && <><b>{count} commercial {count === 1 ? "tire" : "tires"} in stock</b>{nextCount > 0 && <> and <b>{nextCount} more next day</b></>}{from != null && <>, from <b>{money(from)}</b> each</>}. </>}
              17.5", 19.5", 22.5" and 24.5" sizes for box trucks, step vans, buses and semis. Text or call to order.
            </p>
            <div className="ctas top">
              <a className="btn red" href={smsAsk}>Text us · {PHONE.display}</a>
              <a className="btn ghost" href={PHONE.tel}>Call {PHONE.display}</a>
            </div>
            <div className="acct">
              <b>{SAVINGS}.</b>
              <a href={smsAccount}>Set up an account →</a>
            </div>
          </div>
        </section>

        <div className="wrap">
          {sizes.length > 0 ? (
            <>
              <div className="chips">
                {sizes.map((s) => <a key={s.key} href={`#${s.slug}`}>{s.key} <span>{s.tires.length > 0 ? "in stock" : "next day"}</span></a>)}
              </div>
              {sizes.map((s) => (
                <section key={s.key} id={s.slug} className="size">
                  <h2><a href={`/tires/${s.slug}`}>{s.key}</a></h2>
                  {s.tires.length > 0 && (
                    <ul className="list">
                      {s.tires.map((t) => (
                        <StockTireCard key={`${t.brand}-${t.model}-${t.lt}`} tire={t} size={t.key} smsHref={smsTire(t)} commercial />
                      ))}
                    </ul>
                  )}
                  {s.nextDay.length > 0 && (
                    <>
                      <h3 className="nd">Next day: order today, here tomorrow</h3>
                      <ul className="list">
                        {s.nextDay.map((t) => (
                          <StockTireCard key={`nd-${t.brand}-${t.model}-${t.lt}`} tire={t} size={t.key} smsHref={smsNextDay(t)} commercial />
                        ))}
                      </ul>
                    </>
                  )}
                </section>
              ))}
            </>
          ) : (
            <div className="empty">
              <h2>Text us your size</h2>
              <p>Our commercial stock moves fast. Text us your size and we'll send you what we have and what we can get, usually within minutes.</p>
              <div className="ctas">
                <a className="btn red" href={smsAsk}>Text us · {PHONE.display}</a>
                <a className="btn ghost" href={PHONE.tel}>Call {PHONE.display}</a>
              </div>
            </div>
          )}

          <p className="fine">Prices are per tire, product only, and subject to availability. Commercial mounting is quoted with your order. {SAVINGS}. Tax not included. Stock updates through the day and can sell out; text us to hold tires.</p>
        </div>
      </main>
      <Footer />
      <style jsx global>{`
        .cm { background: #fff; color: #111; padding-bottom: 4rem; }
        .cm .wrap { max-width: 1100px; margin: 0 auto; padding: 0 1.25rem; }
        .cm-top { padding: 9.5rem 0 2.5rem; background: radial-gradient(600px 300px at 85% 0%, rgba(224,27,34,0.07), transparent 70%), #fff; border-bottom: 1px solid #ececec; text-align: center; }
        .cm .eyebrow { color: #E01B22; font-size: 0.78rem; font-weight: 800; letter-spacing: 0.16em; text-transform: uppercase; }
        .cm h1 { font-size: clamp(2.2rem, 6vw, 3.6rem); font-weight: 900; letter-spacing: -0.03em; line-height: 1.02; margin: 0.6rem 0 0.75rem; }
        .cm h1 span { color: #E01B22; display: block; }
        .cm .lead { color: #555; font-size: 1.05rem; margin: 0 auto 1.25rem; max-width: 640px; }
        .cm .lead b { color: #111; }
        .cm .ctas { display: flex; gap: 0.5rem; flex-wrap: wrap; }
        .cm .ctas.top { max-width: 520px; margin: 0 auto; }
        .cm .btn { flex: 1; text-align: center; text-decoration: none; padding: 0.85rem 1rem; border-radius: 50px; font-weight: 800; font-size: 0.95rem; white-space: nowrap; }
        .cm .btn.red { background: linear-gradient(135deg, #FF1F1F 0%, #B30000 100%); color: #fff; box-shadow: 0 8px 20px rgba(224,27,34,0.2); }
        .cm .btn.ghost { background: #fff; color: #111; border: 1px solid #dcdcdc; }
        .cm .acct { display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 0.4rem 1rem; max-width: 640px; margin: 1.25rem auto 0; padding: 0.9rem 1.1rem; border-radius: 12px; background: #e8f6ec; border: 1px solid #bfe5cb; color: #1b6b34; }
        .cm .acct a { color: #1b6b34; font-weight: 800; text-decoration: underline; white-space: nowrap; }
        .cm .chips { display: flex; flex-wrap: wrap; gap: 0.5rem; margin: 1.75rem 0 0.5rem; }
        .cm .chips a { background: #fff; border: 1px solid #dcdcdc; border-radius: 50px; padding: 0.45rem 0.9rem; color: #111; font-weight: 800; font-size: 0.88rem; text-decoration: none; }
        .cm .chips a span { color: #6b6b6b; font-weight: 500; margin-left: 0.25rem; }
        .cm .chips a:hover { border-color: #E01B22; }
        .cm .size { scroll-margin-top: 7rem; }
        .cm .size h2 { font-size: 1.5rem; font-weight: 900; margin: 2rem 0 0.75rem; }
        .cm .size h2 a { color: #111; text-decoration: none; }
        .cm .size h2 a:hover { color: #E01B22; }
        .cm .size h3.nd { font-size: 1rem; font-weight: 800; color: #6b6b6b; margin: 1.25rem 0 0.75rem; }
        .cm .list { list-style: none; padding: 0; margin: 0; display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; }
        .cm .empty { background: #f5f5f5; border: 1px solid #e6e6e6; border-radius: 16px; padding: 2rem 1.5rem; text-align: center; margin-top: 2rem; }
        .cm .empty h2 { font-size: 1.6rem; font-weight: 900; margin: 0 0 0.5rem; }
        .cm .empty p { color: #555; margin: 0 auto 1rem; max-width: 520px; }
        .cm .empty .ctas { max-width: 480px; margin: 0 auto; }
        .cm .fine { color: #8a8a8a; font-size: 0.78rem; margin-top: 2rem; }
        @media (max-width: 900px) { .cm .list { grid-template-columns: 1fr; } }
        @media (max-width: 560px) { .cm-top { padding-top: 8.5rem; } .cm .btn { white-space: normal; } }
      `}</style>
    </>
  );
}
