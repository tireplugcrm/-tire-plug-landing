import React, { useMemo, useState } from "react";
import { PHONE, smsHref } from "../lib/shop";

// Used tires in stock, on /used-tires-los-angeles: each card is one real single, double or set,
// with its own photos. Sold by text or call.
const GROUP = { 1: "Single tire", 2: "Pair (2 tires)", 3: "3 tires", 4: "Full set of 4" };
const norm = (s) => String(s || "").toUpperCase().replace(/[^0-9]/g, "");
const money = (n) => `$${Number(n).toFixed(2).replace(/\.00$/, "")}`;

function Card({ t }) {
  const [shown, setShown] = useState(0);
  const name = [t.brand, t.model].filter(Boolean).join(" ");
  const facts = [t.dot_year && `Made ${t.dot_year}`, t.tread_32 != null && `${t.tread_32}/32" tread`, t.load_speed].filter(Boolean);
  const body = `Hi Tire Plug! I want used tire U${t.tag}: ${t.size}${name ? ` ${name}` : ""}, ${GROUP[t.qty]}. Is it still available?`;
  return (
    <article style={{ border: "1px solid #e6e6e6", borderRadius: 12, overflow: "hidden", background: "#fff", display: "flex", flexDirection: "column" }}>
      <a href={t.photos[shown]?.full} target="_blank" rel="noopener noreferrer" style={{ display: "block", position: "relative", overflow: "hidden", aspectRatio: "4 / 3", background: "#f2f2f2" }}>
        {t.photos[shown] && <img src={t.photos[shown].thumb} alt={`Used ${name} ${t.size} tire, photo ${shown + 1}`} loading="lazy" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", display: "block" }} />}
      </a>
      {t.photos.length > 1 && (
        <div style={{ display: "flex", gap: 4, padding: "6px 8px 0", overflowX: "auto" }}>
          {t.photos.map((p, i) => (
            <button key={p.thumb} aria-label={`Show photo ${i + 1}`} onClick={() => setShown(i)} style={{ flex: "0 0 44px", height: 44, padding: 0, border: `2px solid ${i === shown ? "#E01B22" : "transparent"}`, borderRadius: 6, overflow: "hidden", background: "none", cursor: "pointer" }}>
              <img src={p.thumb} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            </button>
          ))}
        </div>
      )}
      <div style={{ padding: "0.8rem 0.9rem 0.9rem", display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
        <div style={{ fontSize: "1.15rem", fontWeight: 800 }}>{t.size}</div>
        {name && <div style={{ color: "#333", fontSize: "0.92rem" }}>{name}</div>}
        <div style={{ color: "#6b6b6b", fontSize: "0.85rem" }}>{[GROUP[t.qty], ...facts].join(" · ")}</div>
        <div style={{ fontSize: "1.05rem", fontWeight: 800, marginTop: 4 }}>
          {money(t.price_each)} <span style={{ fontWeight: 500, fontSize: "0.85rem", color: "#6b6b6b" }}>each{t.qty > 1 ? ` · ${money(t.price_each * t.qty)} for ${t.qty}` : ""}</span>
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: "auto", paddingTop: 8 }}>
          <a href={smsHref(body)} style={{ flex: 1, textAlign: "center", background: "#E01B22", color: "#fff", padding: "0.6rem 0.4rem", borderRadius: 8, fontWeight: 700, fontSize: "0.88rem", textDecoration: "none" }}>Text to reserve</a>
          <a href={PHONE.tel} style={{ textAlign: "center", border: "1px solid #ccc", color: "#111", padding: "0.6rem 0.8rem", borderRadius: 8, fontWeight: 700, fontSize: "0.88rem", textDecoration: "none" }}>Call</a>
        </div>
      </div>
    </article>
  );
}

export default function UsedTireList({ tires }) {
  const [q, setQ] = useState("");
  const shown = useMemo(() => { const n = norm(q); return n ? tires.filter((t) => norm(t.size).includes(n)) : tires; }, [q, tires]);
  if (!tires?.length) return null;
  return (
    <section style={{ padding: "1.5rem 1.5rem 2.5rem", maxWidth: 940, margin: "0 auto", borderTop: "1px solid #e6e6e6" }}>
      <h2 style={{ fontSize: "1.4rem", fontWeight: 900, margin: "0 0 0.4rem" }}>Used tires in stock now</h2>
      <p style={{ color: "#555", fontSize: "0.95rem", margin: "0 0 0.9rem" }}>Real photos of the actual tires. Text us the one you want and we&apos;ll hold it.</p>
      <input value={q} onChange={(e) => setQ(e.target.value)} inputMode="numeric" placeholder="Search your size, e.g. 225 65 17" aria-label="Search by tire size" style={{ width: "100%", maxWidth: 340, height: 44, padding: "0 12px", border: "1px solid #ccc", borderRadius: 8, fontSize: 16, boxSizing: "border-box", marginBottom: "1rem" }} />
      {shown.length === 0 && <p style={{ color: "#555" }}>Nothing in that size right now. Text us and we&apos;ll check what just came in.</p>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "0.9rem" }}>
        {shown.map((t) => <Card key={t.id} t={t} />)}
      </div>
    </section>
  );
}
