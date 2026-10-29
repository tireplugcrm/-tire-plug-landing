import React from "react";
import Head from "next/head";
import Header from "../components/Header";
import Footer from "../components/Footer";
import TireSizeSearch from "../components/TireSizeSearch";
import FinancingNote from "../components/FinancingNote";
import { INSTALL_FROM, sizeToSlug } from "../lib/tire-catalog";
import { pricedStock } from "../lib/inventory";
import { PHONE, ADDRESS, OPENING_HOURS } from "../lib/shop";

// /cheap-tires-los-angeles: for "cheap tires near me" / "cheap tires Los Angeles". The cheapest tires
// on our shelf right now (same stock and prices as /tires/<size>), the cheapest per rim size,
// used tires and Snap Finance. Rebuilt hourly, so it follows the stock on its own.
const URL = "https://tireplugla.com/cheap-tires-los-angeles";
const money = (n) => `$${Number(n).toFixed(2).replace(/\.00$/, "")}`;

export async function getStaticProps() {
  const stock = await pricedStock();
  const cheapest = stock.slice(0, 24).map((t) => ({
    brand: t.brand, model: t.model, key: t.key, price: t.price, level: t.level, count: t.count ?? null, lt: t.lt,
    img: t.imgGeneric ? null : t.img, logo: t.logo || null,
  }));
  // Lowest in-stock price per rim size.
  const byRim = new Map();
  for (const t of stock) {
    const cur = byRim.get(t.rim);
    if (!cur || t.price < cur.price) byRim.set(t.rim, { rim: t.rim, price: t.price, key: t.key, sizes: 0 });
  }
  for (const rim of byRim.keys()) byRim.get(rim).sizes = new Set(stock.filter((t) => t.rim === rim).map((t) => t.key)).size;
  return {
    props: { cheapest, rims: [...byRim.values()].sort((a, b) => a.rim - b.rim), count: stock.length, from: stock[0]?.price ?? null },
    revalidate: 3600,
  };
}

export default function CheapTires({ cheapest, rims, count, from }) {
  const title = from != null
    ? `Cheap Tires in Los Angeles from ${money(from)}, Installed Today | The Tire Plug`
    : "Cheap Tires in Los Angeles, Installed Today | The Tire Plug";
  const description = `Cheap new and used tires in Los Angeles at The Tire Plug, 2331 E Olympic Blvd.${count ? ` ${count} tires in stock${from != null ? ` from ${money(from)} each` : ""}, installed today.` : ""} Install & balance from $${INSTALL_FROM} per wheel. Financing with Snap Finance. Open 7 days.`;
  const seller = {
    "@type": "TireShop", "@id": "https://tireplugla.com/#olympic", name: "The Tire Plug", url: "https://tireplugla.com/",
    image: "https://tireplugla.com/images/logo.webp", telephone: PHONE.schema, priceRange: "$",
    address: { "@type": "PostalAddress", streetAddress: ADDRESS.street, addressLocality: ADDRESS.city, addressRegion: ADDRESS.region, postalCode: ADDRESS.zip, addressCountry: "US" },
    openingHoursSpecification: OPENING_HOURS,
  };
  const schema = [
    { "@context": "https://schema.org", ...seller },
    cheapest.length > 0 && {
      "@context": "https://schema.org", "@type": "ItemList", name: "Cheapest tires in stock at The Tire Plug, Los Angeles",
      itemListElement: cheapest.map((t, i) => ({
        "@type": "ListItem", position: i + 1,
        item: {
          "@type": "Product", name: `${t.brand} ${t.model} ${t.key.replace("X", "x")} tire`.replace(/\s+/g, " "), brand: { "@type": "Brand", name: t.brand },
          ...(t.img ? { image: `https://tireplugla.com${t.img}` } : {}),
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
      <main className="ct">
        <section className="ct-top">
          <div className="wrap">
            <span className="eyebrow">Downtown LA · 2331 E Olympic Blvd</span>
            <h1>Cheap tires in Los Angeles, <span>installed today.</span></h1>
            <p className="lead">
              {count > 0 && <><b>{count} tires on the shelf</b>{from != null && <> from <b>{money(from)}</b> each</>}. </>}
              Install &amp; balance from ${INSTALL_FROM} per wheel. Walk in or book, open 7 days.
            </p>
            <div className="box"><TireSizeSearch /></div>
            <div className="fin-row"><FinancingNote /></div>
          </div>
        </section>

        <div className="wrap">
          {cheapest.length > 0 && (
            <section>
              <h2>Cheapest tires in stock right now</h2>
              <p className="sub">Live from our shelf, cheapest first. Prices are per tire, product only.</p>
              <ul className="grid">
                {cheapest.map((t) => (
                  <li key={`${t.brand}-${t.model}-${t.key}-${t.lt}`}>
                    <a href={`/tires/${sizeToSlug(t.key)}`}>
                      <div className="ph">{t.img ? <img src={t.img} alt={`${t.brand} ${t.model} tire`} loading="lazy" /> : t.logo ? <img className="logo" src={t.logo} alt={t.brand} loading="lazy" /> : <span className="nb">{t.brand}</span>}</div>
                      <div className="sz">{t.key.replace("X", "x")}{t.lt && <i>LT</i>}</div>
                      <div className="nm">{t.brand} {t.model}</div>
                      <div className="pr">{money(t.price)} <span>{t.count ? `${t.count} in stock` : t.level === "low" ? "Low stock" : "In stock"}</span></div>
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {rims.length > 0 && (
            <section>
              <h2>Cheapest by wheel size</h2>
              <div className="chips">
                {rims.map((r) => (
                  <a key={r.rim} href={`/tires/${sizeToSlug(r.key)}`}>{r.rim}" <span>from {money(r.price)} · {r.sizes} size{r.sizes > 1 ? "s" : ""}</span></a>
                ))}
              </div>
              <p className="sub">Every size we carry: <a href="/tires">shop tires by size</a>.</p>
            </section>
          )}

          <section className="cols">
            <div className="panel">
              <h2>Used tires, even cheaper</h2>
              <p>We stock quality used tires too, every one inspected for tread and safety before it goes on your car. Text us your size for today's used options and price.</p>
              <div className="ctas">
                <a className="btn red" href={`${PHONE.sms}?&body=${encodeURIComponent("Hi Tire Plug! Do you have used tires in my size? My size is: ")}`}>Text your size</a>
                <a className="btn ghost" href="/used-tires-los-angeles">Used tires</a>
              </div>
            </div>
            <div className="panel">
              <h2>Pay over time</h2>
              <p>Financing available with Snap Finance. Ask in store or call us and we'll walk you through it.</p>
              <div className="ctas">
                <a className="btn red" href="/book">Book install</a>
                <a className="btn ghost" href={PHONE.tel}>Call {PHONE.display}</a>
              </div>
            </div>
          </section>

          <p className="fine">Prices are per tire, product only, and subject to availability. In-stock tires update daily and can sell out; text us to hold a set. Install and balance start at ${INSTALL_FROM} per wheel. Tax not included.</p>
        </div>
      </main>
      <Footer />
      <style jsx global>{`
        .ct { background: #fff; color: #111; padding-bottom: 4rem; }
        .ct .wrap { max-width: 1100px; margin: 0 auto; padding: 0 1.25rem; }
        .ct-top { padding: 9.5rem 0 2.5rem; background: radial-gradient(600px 300px at 85% 0%, rgba(224,27,34,0.07), transparent 70%), #fff; border-bottom: 1px solid #ececec; text-align: center; }
        .ct .eyebrow { color: #E01B22; font-size: 0.78rem; font-weight: 800; letter-spacing: 0.16em; text-transform: uppercase; }
        .ct h1 { font-size: clamp(2.2rem, 6vw, 3.6rem); font-weight: 900; letter-spacing: -0.03em; line-height: 1.02; margin: 0.6rem 0 0.75rem; }
        .ct h1 span { color: #E01B22; display: block; }
        .ct .lead { color: #555; font-size: 1.05rem; margin: 0 auto 1.5rem; max-width: 620px; }
        .ct .lead b { color: #111; }
        .ct .box { max-width: 520px; margin: 0 auto; text-align: left; background: #fff; border: 1px solid #e6e6e6; border-radius: 18px; padding: 1.25rem; box-shadow: 0 10px 30px rgba(0,0,0,0.06); }
        .ct .fin-row { max-width: 620px; margin: 1.25rem auto 0; }
        .ct h2 { font-size: 1.5rem; font-weight: 900; margin: 2.5rem 0 0.4rem; }
        .ct .sub { color: #6b6b6b; font-size: 0.9rem; margin: 0 0 1rem; }
        .ct .sub a { color: #E01B22; font-weight: 700; }
        .ct .grid { list-style: none; padding: 0; margin: 0; display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.75rem; }
        .ct .grid a { display: flex; flex-direction: column; gap: 0.2rem; height: 100%; box-sizing: border-box; padding: 0.8rem; border: 1px solid #e6e6e6; border-radius: 14px; color: #111; text-decoration: none; box-shadow: 0 4px 14px rgba(0,0,0,0.04); }
        .ct .grid a:hover { border-color: #E01B22; }
        .ct .ph { height: 110px; display: grid; place-items: center; margin-bottom: 0.3rem; }
        .ct .ph img { max-height: 110px; max-width: 100%; object-fit: contain; }
        .ct .ph img.logo { max-width: 70%; max-height: 40px; }
        .ct .ph .nb { font-weight: 900; color: #8a8a8a; }
        .ct .sz { font-weight: 900; font-size: 1.05rem; }
        .ct .sz i { font-style: normal; font-size: 0.66rem; font-weight: 800; background: #111; color: #fff; padding: 0.15rem 0.4rem; border-radius: 5px; margin-left: 0.4rem; vertical-align: middle; }
        .ct .nm { color: #555; font-size: 0.85rem; }
        .ct .pr { margin-top: auto; font-size: 1.4rem; font-weight: 900; letter-spacing: -0.02em; }
        .ct .pr span { font-size: 0.72rem; font-weight: 700; color: #1b9a4a; margin-left: 0.3rem; letter-spacing: 0; }
        .ct .chips { display: flex; flex-wrap: wrap; gap: 0.5rem; margin: 0.5rem 0 1rem; }
        .ct .chips a { background: #fff; border: 1px solid #dcdcdc; border-radius: 50px; padding: 0.45rem 0.9rem; color: #111; font-weight: 800; font-size: 0.88rem; text-decoration: none; }
        .ct .chips a span { color: #6b6b6b; font-weight: 500; margin-left: 0.25rem; }
        .ct .chips a:hover { border-color: #E01B22; }
        .ct .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 2rem; }
        .ct .panel { background: #f7f7f7; border: 1px solid #e6e6e6; border-radius: 16px; padding: 1.25rem 1.4rem; }
        .ct .panel h2 { margin: 0 0 0.5rem; font-size: 1.3rem; }
        .ct .panel p { color: #555; margin: 0 0 1rem; }
        .ct .ctas { display: flex; gap: 0.5rem; flex-wrap: wrap; }
        .ct .btn { flex: 1; text-align: center; text-decoration: none; padding: 0.75rem 0.9rem; border-radius: 50px; font-weight: 800; font-size: 0.9rem; white-space: nowrap; }
        .ct .btn.red { background: linear-gradient(135deg, #FF1F1F 0%, #B30000 100%); color: #fff; box-shadow: 0 8px 20px rgba(224,27,34,0.2); }
        .ct .btn.ghost { background: #fff; color: #111; border: 1px solid #dcdcdc; }
        .ct .fine { color: #8a8a8a; font-size: 0.78rem; margin-top: 2rem; }
        @media (max-width: 900px) { .ct .grid { grid-template-columns: repeat(2, 1fr); } .ct .cols { grid-template-columns: 1fr; } }
        @media (max-width: 560px) { .ct-top { padding-top: 8.5rem; } .ct .ph { height: 80px; } .ct .ph img { max-height: 80px; } }
      `}</style>
    </>
  );
}
