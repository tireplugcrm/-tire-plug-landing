import React from "react";
import Head from "next/head";
import Header from "../../components/Header";
import Footer from "../../components/Footer";
import TireSizeSearch from "../../components/TireSizeSearch";
import { INSTALL_FROM } from "../../lib/tire-catalog";
import { allSizes } from "../../lib/inventory";
import { PHONE } from "../../lib/shop";

// /tires: search by size, plus every size we list or have in stock (grouped by rim) for browsing and for Google.
export async function getStaticProps() {
  return { props: { sizes: await allSizes() }, revalidate: 3600 };
}

const URL = "https://tireplugla.com/tires";
const TITLE = "Shop Tires by Size in Los Angeles | Every Option, Every Price | The Tire Plug";
const DESCRIPTION = "Search your tire size and see every tire The Tire Plug carries in it, cheapest first: Kumho, RBP and more. 2331 E Olympic Blvd, Downtown LA. Install & balance from $25 per wheel.";

export default function TiresIndex({ sizes }) {
  const rims = [...new Set(sizes.map((s) => s.rim))];
  return (
    <>
      <Head>
        <title>{TITLE}</title>
        <meta name="description" content={DESCRIPTION} />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="canonical" href={URL} />
        <meta property="og:title" content={TITLE} />
        <meta property="og:description" content={DESCRIPTION} />
        <meta property="og:url" content={URL} />
      </Head>
      <Header />
      <main className="ti">
        <section className="ti-top">
          <div className="wrap">
            <span className="eyebrow">Shop tires by size</span>
            <h1>Find your size. <span>See every option.</span></h1>
            <p className="lead">Pick the size on your tire's sidewall and we'll show every tire we carry in it, cheapest first.</p>
            <div className="box"><TireSizeSearch /></div>
            <p className="install">Install &amp; balance start at <b>${INSTALL_FROM} per wheel</b>. In-stock tires go on today at our Downtown LA shop.</p>
          </div>
        </section>
        <section className="wrap all">
          <h2>All {sizes.length} sizes we carry</h2>
          {rims.map((rim) => (
            <div className="rim" key={rim}>
              <h3>{rim}"</h3>
              <div className="chips">
                {sizes.filter((s) => s.rim === rim).map((s) => (
                  <a key={s.key} href={`/tires/${s.slug}`}>
                    {s.key.replace("X", "x")} <span>{s.label}</span>
                    {s.stock > 0 && <i className="dot" title="In stock" />}
                  </a>
                ))}
              </div>
            </div>
          ))}
          <p className="note">Don't see your size? Pick it above anyway, or text us at <a href={PHONE.sms}>{PHONE.display}</a>. We can usually get it fast.</p>
        </section>
      </main>
      <Footer />
      <style jsx global>{`
        .ti { background: #fff; color: #111; padding-bottom: 4rem; }
        .ti .wrap { max-width: 900px; margin: 0 auto; padding: 0 1.25rem; }
        .ti-top { padding: 9.5rem 0 2.5rem; background: radial-gradient(600px 300px at 85% 0%, rgba(224,27,34,0.07), transparent 70%), #fff; border-bottom: 1px solid #ececec; text-align: center; }
        .ti .eyebrow { color: #E01B22; font-size: 0.78rem; font-weight: 800; letter-spacing: 0.16em; text-transform: uppercase; }
        .ti h1 { font-size: clamp(2.2rem, 6vw, 3.6rem); font-weight: 900; letter-spacing: -0.03em; line-height: 1.02; margin: 0.6rem 0 0.75rem; }
        .ti h1 span { color: #E01B22; display: block; }
        .ti .lead { color: #555; font-size: 1.05rem; margin: 0 auto 1.5rem; max-width: 560px; }
        .ti .box { max-width: 520px; margin: 0 auto; text-align: left; background: #fff; border: 1px solid #e6e6e6; border-radius: 18px; padding: 1.25rem; box-shadow: 0 10px 30px rgba(0,0,0,0.06); }
        .ti .install { color: #555; font-size: 0.9rem; margin: 1.25rem 0 0; }
        .ti .install b { color: #E01B22; }
        .ti .all h2 { font-size: 1.5rem; font-weight: 900; margin: 2.5rem 0 0.5rem; }
        .ti .rim { padding: 1rem 0; border-bottom: 1px solid #ececec; }
        .ti .rim h3 { font-size: 1.1rem; font-weight: 900; margin: 0 0 0.6rem; }
        .ti .chips { display: flex; flex-wrap: wrap; gap: 0.5rem; }
        .ti .chips a { background: #fff; border: 1px solid #dcdcdc; border-radius: 50px; padding: 0.45rem 0.9rem; color: #111; font-weight: 700; font-size: 0.88rem; text-decoration: none; }
        .ti .chips a span { color: #6b6b6b; font-weight: 500; margin-left: 0.25rem; }
        .ti .chips a:hover { border-color: #E01B22; }
        .ti .chips .dot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: #1b9a4a; margin-left: 0.4rem; vertical-align: middle; }
        .ti .note { color: #555; margin-top: 1.5rem; }
        .ti .note a { color: #E01B22; font-weight: 700; }
        @media (max-width: 560px) { .ti-top { padding-top: 8.5rem; } }
      `}</style>
    </>
  );
}
