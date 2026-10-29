// Split-screen demo of the Shop Floor, local only (npm run dev → /shop-demo).
// Left: the admin board the front desk and techs use. Right: the bay TV, following the same sample shop live.
// Everything runs on /api/shop-demo's in-memory sample shop; nothing touches Supabase.
import React from "react";
import Head from "next/head";
import ShopFloor from "../components/admin/ShopFloor.js";
import { T, Icon, ui } from "../components/admin/ui.js";

// Local only: the sample shop lives in the dev server's memory, so the live site has no demo page.
export function getServerSideProps() {
  return process.env.NODE_ENV === "production" ? { notFound: true } : { props: {} };
}

export default function ShopDemo() {
  async function reset() {
    await fetch("/api/shop-demo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "reset" }) });
    window.location.reload();
  }
  return (
    <>
      <Head>
        <title>Shop Floor demo · The Tire Plug</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,400,0,0&display=block" />
      </Head>
      <div className="sd">
        <section className="sd-admin tp-admin">
          <header className="sd-bar">
            <img src="/images/logo.webp" alt="" style={{ width: 30, height: 30, borderRadius: "50%", background: "#fff", objectFit: "cover" }} />
            <span style={{ color: "#fff", fontWeight: 600 }}>The Tire Plug</span>
            <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 13 }}>Admin · front desk &amp; techs</span>
            <span style={{ flex: 1 }} />
            <button onClick={reset} style={{ ...ui.btn, height: 30, background: "transparent", color: "#fff", borderColor: "rgba(255,255,255,0.3)" }}><Icon name="restart_alt" size={16} />Reset demo</button>
          </header>
          <div style={{ padding: 20 }}><ShopFloor demo auth={{}} /></div>
        </section>
        <section className="sd-tv">
          <div className="sd-tv-label"><span className="sd-live" />Bay TV — live</div>
          <div className="sd-screen"><iframe src="/shop-tv?demo=live" title="Bay TV" allow="autoplay" /></div>
          <p>Every click on the left shows up here within a second, with a chime for each check-in and each completed job. Sample cars; the tire search uses the real shelf.</p>
        </section>
      </div>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
    </>
  );
}

const CSS = `
  html, body { margin: 0; }
  .sd { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); height: 100vh; }
  .sd-admin { background: ${T.page}; color: ${T.text}; overflow-y: auto; font-size: 14px; -webkit-font-smoothing: antialiased; }
  .sd-admin, .sd-admin button, .sd-admin input, .sd-admin select { font-family: "Inter", system-ui, sans-serif; }
  .sd-admin input:focus, .sd-admin select:focus { border-color: ${T.blue} !important; box-shadow: 0 0 0 3px ${T.blueRing}; outline: none; }
  .sd .material-symbols-outlined { display: inline-flex; align-items: center; justify-content: center; user-select: none; }
  .sd-bar { position: sticky; top: 0; z-index: 5; height: 52px; display: flex; align-items: center; gap: 10px; padding: 0 16px; background: ${T.topbar}; }
  .sd-tv { background: #05080c; display: flex; flex-direction: column; justify-content: center; gap: 12px; padding: 20px; font-family: "Inter", system-ui, sans-serif; }
  .sd-tv-label { display: flex; align-items: center; gap: 8px; color: #e5e7eb; font-weight: 600; font-size: 14px; }
  .sd-live { width: 9px; height: 9px; border-radius: 50%; background: #ef4444; animation: sdlive 1.4s ease-in-out infinite; }
  @keyframes sdlive { 50% { opacity: .3; } }
  .sd-screen { aspect-ratio: 16 / 9; width: 100%; border: 10px solid #1f2937; border-radius: 10px; box-shadow: 0 20px 60px rgba(0,0,0,.6); overflow: hidden; background: #000; }
  .sd-screen iframe { width: 100%; height: 100%; border: 0; display: block; }
  .sd-tv p { margin: 0; color: #6b7280; font-size: 13px; }
  @media (max-width: 900px) {
    .sd { grid-template-columns: minmax(0, 1fr); height: auto; }
    .sd-admin { overflow: visible; }
    .sd-tv { order: -1; }
  }
`;
