import React, { useEffect } from "react";
import Head from "next/head";
import Header from "../../components/Header";
import Footer from "../../components/Footer";
import TireSizeSearch from "../../components/TireSizeSearch";
import StockTireCard from "../../components/StockTireCard";
import FinancingNote from "../../components/FinancingNote";
import { INSTALL_FROM, sizeToSlug, slugToKey, tiresForSize } from "../../lib/tire-catalog";
import { allSizes, stockForSize, nextDayForSize } from "../../lib/inventory";

// One page per tire size, e.g. /tires/265-70r17: what's on our shelf in that size (from Tekmetric),
// then every tire we can order in it, cheapest first.
// Listed and stocked sizes are prebuilt; any other valid size renders on demand with a "text us" fallback.
const SIZE_RE = /^(\d{3}\/\d{2}R\d{2}|\d{2}X\d{1,2}\.\d{2}R\d{2})$/;
const SMS = "+15625004625";
const money = (n) => `$${Number(n).toFixed(2).replace(/\.00$/, "")}`;

export async function getStaticPaths() {
  return { paths: (await allSizes()).map((s) => ({ params: { size: s.slug } })), fallback: "blocking" };
}

export async function getStaticProps({ params }) {
  const key = slugToKey(params.size);
  if (!SIZE_RE.test(key)) return { notFound: true };
  if (sizeToSlug(key) !== params.size) return { redirect: { destination: `/tires/${sizeToSlug(key)}`, permanent: true } };
  const tires = tiresForSize(key);
  const stock = await stockForSize(key);
  const nextDay = await nextDayForSize(key);
  const rim = Number(key.match(/R(\d{2})$/)[1]);
  const nearby = (await allSizes()).filter((s) => s.rim === rim && s.key !== key).slice(0, 12);
  return { props: { sizeKey: key, tires, stock, nextDay, nearby }, revalidate: 3600 };
}

export default function TireSizePage({ sizeKey, tires, stock, nextDay = [], nearby }) {
  const display = sizeKey.replace("X", "x");
  // Remember the size so the booking form can fill it in.
  useEffect(() => { try { localStorage.setItem("tp_tire_size", display); } catch (_) {} }, [display]);
  const url = `https://tireplugla.com/tires/${sizeToSlug(sizeKey)}`;
  const has = tires.length > 0;
  const inStock = stock.length > 0;
  const hasNextDay = nextDay.length > 0;
  const from = has ? tires[0].price : null;
  const stockBrands = [...new Set(stock.map((t) => t.brand))].join(", ");
  // Lowest in-stock price (stock is sorted cheapest first; null when prices aren't shown).
  const stockFrom = stock.find((t) => t.price != null)?.price ?? null;
  const nextDayFrom = nextDay.length ? Math.min(...nextDay.map((t) => t.price)) : null;
  // Lowest price on the page, for the title Google shows: "Cheap 205/55R16 Tires in Los Angeles from $49".
  const lowest = [stockFrom, from, nextDayFrom].filter((p) => p != null).reduce((a, b) => Math.min(a, b), Infinity);
  const hasLowest = Number.isFinite(lowest);
  const today = inStock ? ", Installed Today" : "";
  const title = hasLowest
    ? `Cheap ${display} Tires in Los Angeles from ${money(lowest)}${today} | The Tire Plug`
    : inStock
      ? `${display} Tires in Stock in Los Angeles, Installed Today | The Tire Plug`
      : `${display} Tires in Los Angeles | The Tire Plug`;
  const allBrands = [...new Set([...stock, ...nextDay, ...tires].map((t) => t.brand))].slice(0, 5).join(", ");
  const description = hasLowest || inStock
    ? `Cheap ${display} tires in Los Angeles${hasLowest ? ` from ${money(lowest)} per tire` : ""}${inStock ? `, ${stock.length} ${stock.length === 1 ? "option" : "options"} in stock and installed today` : ""} at The Tire Plug, 2331 E Olympic Blvd. ${allBrands}. Install & balance from $${INSTALL_FROM} per wheel. Financing with Snap Finance. Open 7 days.`
    : `Need ${display} tires in Los Angeles? Text The Tire Plug your size and we'll find the best price. 2331 E Olympic Blvd · (562) 500-4625.`;

  // Product + Offer for every priced tire on the page: shelf stock first (with availability), then catalog.
  const seller = { "@type": "TireShop", name: "The Tire Plug", telephone: "+1-562-500-4625", url: "https://tireplugla.com/",
    address: { "@type": "PostalAddress", streetAddress: "2331 E Olympic Blvd", addressLocality: "Los Angeles", addressRegion: "CA", postalCode: "90021", addressCountry: "US" } };
  const product = (t, availability) => ({
    "@type": "Product",
    name: `${t.brand} ${t.model} ${t.size || display} tire`.replace(/\s+/g, " "),
    brand: { "@type": "Brand", name: t.brand },
    ...(t.img && !t.imgGeneric ? { image: `https://tireplugla.com${t.img}` } : {}),
    ...(t.specs?.partNumber ? { mpn: t.specs.partNumber } : {}),
    offers: { "@type": "Offer", price: t.price, priceCurrency: "USD", url, itemCondition: "https://schema.org/NewCondition",
      ...(availability ? { availability } : {}), seller },
  });
  const schemaItems = [
    ...stock.filter((t) => t.price != null).map((t) => product(t, t.level === "low" ? "https://schema.org/LimitedAvailability" : "https://schema.org/InStock")),
    ...tires.map((t) => product(t, null)),
  ];
  const schema = schemaItems.length > 0 && {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${display} tires at The Tire Plug`,
    itemListElement: schemaItems.map((item, i) => ({ "@type": "ListItem", position: i + 1, item })),
  };

  const smsFor = (t) => `sms:${SMS}?&body=${encodeURIComponent(`Hi Tire Plug! I'd like the ${t.brand} ${t.model} in ${t.size} (${money(t.price)} each). Do you have it in stock?`)}`;
  const smsAsk = `sms:${SMS}?&body=${encodeURIComponent(`Hi Tire Plug! I'm looking for tires in ${display}. Can you send me options and prices?`)}`;
  const smsNextDay = (t) => `sms:${SMS}?&body=${encodeURIComponent(`Hi Tire Plug! I'd like to order the ${t.brand} ${t.model} in ${display} (${money(t.price)} each) for next-day install. Can you order a set for me?`)}`;
  const smsStock = (t) => `sms:${SMS}?&body=${encodeURIComponent(t.price != null
    ? `Hi Tire Plug! I saw you have the ${t.brand} ${t.model} in ${display} in stock for ${money(t.price)} each. Can you hold a set for me?`
    : `Hi Tire Plug! I saw you have the ${t.brand} ${t.model} in ${display} in stock. What's the price, and can you hold a set for me?`)}`;

  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="canonical" href={url} />
        {!has && !inStock && !hasNextDay && <meta name="robots" content="noindex, follow" />}
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={url} />
        {has && tires[0].img && <meta property="og:image" content={`https://tireplugla.com${tires[0].img}`} />}
        {schema && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />}
      </Head>
      <Header />

      <main className="ts">
        <section className="ts-top">
          <div className="wrap ts-top-grid">
            <div>
              <a className="crumb" href="/tires">← All tire sizes</a>
              <h1>{display} <span>tires</span></h1>
              <p className="lead">
                {inStock && <><b>{stock.length} {stock.length === 1 ? "option" : "options"} in stock</b> at our shop today. </>}
                {hasNextDay && <><b>{nextDay.length} more next day</b>: order today, installed tomorrow. </>}
                {has
                  ? <>{tires.length} option{tires.length > 1 ? "s" : ""} from <b>{money(from)}</b> per tire. Cheapest first.</>
                  : inStock
                    ? stockFrom != null ? <>From <b>{money(stockFrom)}</b> per tire. Cheapest first.</> : <>Text us for today's price.</>
                    : <>We don't have {display} listed online yet, but we can usually get it fast.</>}
              </p>
            </div>
            <div className="ts-search top">
              <span className="lbl">Search another size</span>
              <TireSizeSearch initial={sizeKey} compact />
            </div>
          </div>
        </section>

        <div className="wrap">
          <a className="install" href="tel:5625004625">
            <b>Install &amp; balance start at ${INSTALL_FROM} per wheel</b>
            <span>Get it installed today at our Downtown LA location →</span>
          </a>
          <div className="fin-row"><FinancingNote /></div>

          {inStock && (
            <section className="stock">
              <h2>In stock at our shop</h2>
              <ul className="list">
                {stock.map((t) => (
                  <StockTireCard key={`${t.brand}-${t.model}-${t.lt}`} tire={t} size={display} smsHref={smsStock(t)} />
                ))}
              </ul>
            </section>
          )}

          {hasNextDay && (
            <section className="stock nextday">
              <h2>Next-day order</h2>
              <p className="nd-sub">Order today, installed tomorrow or any day after. Install &amp; balance from ${INSTALL_FROM} per wheel.</p>
              <ul className="list">
                {nextDay.map((t) => (
                  <StockTireCard key={`nd-${t.brand}-${t.model}-${t.lt}`} tire={t} size={display} smsHref={smsNextDay(t)} cta="Text to order" ready="Installed tomorrow" />
                ))}
              </ul>
            </section>
          )}

          {has && (inStock || hasNextDay) && <h2 className="order-h">More options we can order</h2>}

          {has ? (
            <ul className="list">
              {tires.map((t, i) => (
                <li className="card" key={`${t.brand}-${t.model}-${t.size}`}>
                  <div className="ph">
                    {i === 0 && tires.length > 1 && <span className="best">Lowest price</span>}
                    {t.img ? <img src={t.img} alt={`${t.brand} ${t.model} tire`} loading={i > 1 ? "lazy" : "eager"} /> : <img className="logo-only" src={t.logo} alt={t.brand} />}
                  </div>
                  <div className="body">
                    <img className="brand" src={t.logo} alt={t.brand} />
                    <h2>{t.model}</h2>
                    <div className="cat">{t.category}</div>
                    <div className="spec">
                      <span>{t.size}</span>{t.lt && <i>LT</i>}<span>{t.loadSpeed}</span>{t.ply && <span>{t.ply} ply</span>}
                    </div>
                    {t.special && <div className="special">★ {t.special}</div>}
                    <div className="price-row">
                      <div><div className="price">{money(t.price)}</div><div className="per">per tire</div></div>
                      <div className="set">{money(t.price * 4)} <span>set of 4</span></div>
                    </div>
                    <a className="btn red book" href={`/book?${new URLSearchParams({ size: display, tire: `${t.brand} ${t.model}` })}`}>Book install</a>
                    <div className="ctas">
                      <a className="btn ghost txt" href={smsFor(t)}>Text to reserve</a>
                      <a className="btn ghost" href="tel:5625004625">Call</a>
                    </div>
                    <a className="more" href={t.page}>{t.brand} {t.model} details →</a>
                  </div>
                </li>
              ))}
            </ul>
          ) : !inStock && (
            <div className="empty">
              <h2>Text us your size</h2>
              <p>We'll check every brand we can get in {display} and text you back real prices, usually within minutes.</p>
              <div className="ctas">
                <a className="btn red" href={smsAsk}>Text us · (562) 500-4625</a>
                <a className="btn ghost" href="tel:5625004625">Call (562) 500-4625</a>
              </div>
            </div>
          )}

          <div className="ts-search bottom">
            <span className="lbl">Search another size</span>
            <TireSizeSearch initial={sizeKey} compact />
          </div>

          {nearby.length > 0 && (
            <section className="nearby">
              <h2>Other {sizeKey.match(/R(\d{2})$/)[1]}" sizes we carry</h2>
              <div className="chips">
                {nearby.map((s) => (
                  <a key={s.key} href={`/tires/${s.slug}`}>{s.key.replace("X", "x")} <span>{s.from != null ? `from ${money(s.from)}` : "in stock"}</span></a>
                ))}
              </div>
            </section>
          )}

          <p className="fine">Prices are per tire, product only, and subject to availability. Install and balance start at ${INSTALL_FROM} per wheel. Tax not included. LT = light-truck construction. In-stock tires are updated daily and can sell out; text us to hold a set.</p>
        </div>
      </main>

      <Footer />

      <style jsx global>{`
        .ts { background: #fff; color: #111; padding-bottom: 4rem; }
        .ts .wrap { max-width: 1100px; margin: 0 auto; padding: 0 1.25rem; }
        .ts-top { padding: 9.5rem 0 2rem; background: radial-gradient(600px 300px at 85% 0%, rgba(224,27,34,0.07), transparent 70%), #fff; border-bottom: 1px solid #ececec; }
        .ts-top-grid { display: grid; grid-template-columns: 1.2fr 0.8fr; gap: 2rem; align-items: end; }
        .ts .crumb { color: #E01B22; font-weight: 700; font-size: 0.85rem; text-decoration: none; }
        .ts h1 { font-size: clamp(2.4rem, 7vw, 4rem); font-weight: 900; letter-spacing: -0.03em; line-height: 1; margin: 0.6rem 0 0.75rem; }
        .ts h1 span { color: #E01B22; }
        .ts .lead { color: #555; font-size: 1.05rem; margin: 0; }
        .ts .lead b { color: #111; }
        .ts-search { background: #fff; border: 1px solid #e6e6e6; border-radius: 16px; padding: 1.1rem; box-shadow: 0 6px 18px rgba(0,0,0,0.05); }
        .ts-search .lbl { display: block; font-size: 0.72rem; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: #E01B22; margin-bottom: 0.6rem; }
        .ts .install { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.4rem 1rem; margin: 1.5rem 0; padding: 0.9rem 1.1rem; border-radius: 12px; background: rgba(224,27,34,0.08); border: 1px solid rgba(224,27,34,0.3); color: #111; text-decoration: none; }
        .ts .fin-row { margin: -0.75rem 0 1.5rem; }
        .ts .install b { font-weight: 800; text-transform: uppercase; font-size: 0.95rem; }
        .ts .install span { color: #555; font-size: 0.9rem; }
        .ts .list { list-style: none; padding: 0; margin: 0; display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; }
        .ts .card { display: grid; grid-template-columns: 170px 1fr; background: #fff; border: 1px solid #e6e6e6; border-radius: 16px; overflow: hidden; box-shadow: 0 6px 18px rgba(0,0,0,0.05); }
        .ts .ph { position: relative; display: grid; place-items: center; padding: 0.75rem; border-right: 1px solid #f0f0f0; }
        .ts .ph img { width: 100%; max-height: 190px; object-fit: contain; }
        .ts .ph img.logo-only { width: 70%; }
        .ts .best { position: absolute; top: 10px; left: 10px; background: #E01B22; color: #fff; font-size: 0.68rem; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; padding: 0.3rem 0.55rem; border-radius: 6px; }
        .ts .body { padding: 1rem 1.1rem; display: flex; flex-direction: column; gap: 0.35rem; }
        .ts .brand { height: 22px; width: auto; align-self: flex-start; }
        .ts .body h2 { font-size: 1.25rem; font-weight: 800; margin: 0.15rem 0 0; line-height: 1.15; }
        .ts .cat { color: #6b6b6b; font-size: 0.82rem; }
        .ts .spec { display: flex; flex-wrap: wrap; gap: 0.35rem; margin-top: 0.15rem; }
        .ts .spec span { font-size: 0.78rem; font-weight: 700; background: #f5f5f5; border: 1px solid #e6e6e6; padding: 0.15rem 0.5rem; border-radius: 6px; }
        .ts .spec i { font-style: normal; font-size: 0.7rem; font-weight: 800; background: #111; color: #fff; padding: 0.2rem 0.45rem; border-radius: 5px; }
        .ts .special { color: #E01B22; font-size: 0.82rem; font-weight: 700; }
        .ts .price-row { display: flex; align-items: flex-end; justify-content: space-between; gap: 0.5rem; margin-top: 0.35rem; }
        .ts .price { font-size: 2rem; font-weight: 900; letter-spacing: -0.03em; line-height: 1; color: #111; }
        .ts .per { color: #6b6b6b; font-size: 0.75rem; }
        .ts .set { color: #555; font-weight: 700; font-size: 0.9rem; text-align: right; }
        .ts .set span { display: block; color: #8a8a8a; font-weight: 500; font-size: 0.72rem; }
        .ts .ctas { display: flex; gap: 0.5rem; margin-top: 0.5rem; }
        .ts .btn.book { display: block; margin-top: 0.5rem; }
        .ts .btn.ghost.txt { flex: 1; }
        .ts .btn { flex: 1; text-align: center; text-decoration: none; padding: 0.75rem 0.9rem; border-radius: 50px; font-weight: 800; font-size: 0.9rem; }
        .ts .btn.red { background: linear-gradient(135deg, #FF1F1F 0%, #B30000 100%); color: #fff; box-shadow: 0 8px 20px rgba(224,27,34,0.2); }
        .ts .btn.ghost { background: #fff; color: #111; border: 1px solid #dcdcdc; flex: 0 0 auto; padding-left: 1.2rem; padding-right: 1.2rem; }
        .ts .more { color: #E01B22; font-size: 0.82rem; font-weight: 700; text-decoration: none; margin-top: 0.2rem; }
        .ts .stock { margin-bottom: 2rem; }
        .ts .nd-sub { color: #555; font-size: 0.9rem; margin: -0.4rem 0 0.9rem; }
        .ts .stock h2, .ts .order-h { font-size: 1.3rem; font-weight: 900; margin: 0 0 0.75rem; }
        .ts .empty { background: #f5f5f5; border: 1px solid #e6e6e6; border-radius: 16px; padding: 2rem 1.5rem; text-align: center; }
        .ts .empty h2 { font-size: 1.6rem; font-weight: 900; margin: 0 0 0.5rem; }
        .ts .empty p { color: #555; margin: 0 auto 1rem; max-width: 520px; }
        .ts .empty .ctas { max-width: 480px; margin: 0 auto; }
        .ts .nearby { margin-top: 2.5rem; }
        .ts .nearby h2 { font-size: 1.2rem; font-weight: 800; margin: 0 0 0.75rem; }
        .ts .chips { display: flex; flex-wrap: wrap; gap: 0.5rem; }
        .ts .chips a { background: #fff; border: 1px solid #dcdcdc; border-radius: 50px; padding: 0.45rem 0.9rem; color: #111; font-weight: 700; font-size: 0.85rem; text-decoration: none; }
        .ts .chips a span { color: #6b6b6b; font-weight: 500; margin-left: 0.25rem; }
        .ts .chips a:hover, .ts .btn.ghost:hover { border-color: #E01B22; }
        .ts .fine { color: #8a8a8a; font-size: 0.78rem; margin-top: 2rem; }
        .ts-search.bottom { display: none; }
        @media (max-width: 900px) {
          .ts-top-grid { grid-template-columns: 1fr; }
          .ts-search.top { display: none; }
          .ts-search.bottom { display: block; margin-top: 1.5rem; }
          .ts .list { grid-template-columns: 1fr; }
        }
        @media (max-width: 560px) {
          .ts-top { padding-top: 8.5rem; }
          .ts .card { grid-template-columns: 110px 1fr; }
          .ts .ph img { max-height: 130px; }
          .ts .price { font-size: 1.7rem; }        }
      `}</style>
    </>
  );
}
