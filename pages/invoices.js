import React, { useEffect, useRef, useState } from "react";
import Head from "next/head";
import { supabaseBrowser } from "../lib/supabaseBrowser.js";

/* The Tire Plug — daily invoice check-in (opened from the 10 AM / 4:30 PM text).
   Snap every delivery invoice, or tap "No deliveries". Photos go straight to the shop's private
   storage and the AI reads them; the owner sees everything under Admin → Invoices. */

const RED = "#e01b22";
const fmtDay = (d, today) => {
  const s = new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
  return d === today ? `Today · ${s}` : s;
};

// Phone photos are 3–12 MB; shrink to a sharp 2400 px JPEG so uploads are quick and the AI can read them.
async function shrink(file) {
  if (!/^image\//.test(file.type) || file.type === "image/gif") return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 2400 / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
    c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.85));
    return blob ? new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" }) : file;
  } catch (e) { return file; }
}

export default function Invoices() {
  const [k, setK] = useState("");
  const [state, setState] = useState(null);
  const [day, setDay] = useState("");
  const [by, setBy] = useState("");
  const [files, setFiles] = useState([]); // { id, name, status: "uploading" | "reading" | "done" | "error", msg }
  const [err, setErr] = useState("");
  const [noneBusy, setNoneBusy] = useState(false);
  const camRef = useRef(null);
  const fileRef = useRef(null);

  async function call(body) {
    const res = await fetch("/api/invoices", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ k, by, ...body }) });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j.error || "Something went wrong. Try again.");
    return j;
  }
  async function load(key = k) {
    try {
      const res = await fetch("/api/invoices", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ k: key, action: "state" }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      setState(j); setDay((d) => d || j.today); setErr("");
    } catch (e) { setErr(e.message || "Couldn't load."); }
  }
  useEffect(() => {
    const key = new URLSearchParams(window.location.search).get("k") || "";
    setK(key);
    try { setBy(localStorage.getItem("tp_invoice_name") || ""); } catch (e) {}
    if (key) load(key); else setErr("Open this page from the link in the text.");
    // eslint-disable-next-line
  }, []);

  const setFile = (id, patch) => setFiles((fs) => fs.map((f) => (f.id === id ? { ...f, ...patch } : f)));

  async function upload(list) {
    try { localStorage.setItem("tp_invoice_name", by); } catch (e) {}
    for (const original of list) {
      const id = Math.random().toString(36).slice(2);
      setFiles((fs) => [...fs, { id, name: original.name, status: "uploading" }]);
      try {
        const file = await shrink(original);
        const s = await call({ action: "sign", day, name: file.name, mime: file.type });
        const { error } = await supabaseBrowser.storage.from("invoices").uploadToSignedUrl(s.path, s.token, file, { contentType: file.type });
        if (error) throw new Error(error.message);
        setFile(id, { status: "reading" });
        const r = await call({ action: "uploaded", day, path: s.path, name: file.name, mime: file.type, size: file.size });
        if (r.duplicate) {
          const when = new Date(`${r.duplicate.day}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
          setFile(id, { status: "dup", msg: `Already uploaded ${when}${r.duplicate.by ? ` by ${r.duplicate.by}` : ""}. ${r.duplicate.reason}. Don't enter these tires again.` });
          continue;
        }
        const msg = r.error ? "Saved. The AI couldn't read it, so the owner will look at it."
          : !r.is_invoice ? "Saved, but this doesn't look like an invoice."
          : [r.vendor, r.invoice_no && `#${r.invoice_no}`, r.tire_count != null && `${r.tire_count} tires`].filter(Boolean).join(" · ") || "Saved";
        setFile(id, { status: r.error || !r.is_invoice ? "warn" : "done", msg });
      } catch (e) {
        setFile(id, { status: "error", msg: e.message });
      }
    }
    load();
  }

  async function noDeliveries() {
    setNoneBusy(true);
    try { localStorage.setItem("tp_invoice_name", by); } catch (e) {}
    try { await call({ action: "none", day }); await load(); } catch (e) { alert(e.message); } finally { setNoneBusy(false); }
  }

  const cur = state?.days.find((d) => d.day === day);
  // Earlier shop days nobody answered (check-ins started Oct 28; Sundays don't count).
  const open = (state?.days || []).filter((d) => d.day !== state.today && d.day >= "2026-10-28" && !d.status && new Date(`${d.day}T12:00:00`).getDay() !== 0);

  return (
    <div style={{ minHeight: "100vh", background: "#f4f5f7", fontFamily: "Inter, system-ui, -apple-system, Arial, sans-serif", color: "#1f2937" }}>
      <Head>
        <title>Delivery Invoices | The Tire Plug</title>
        <meta name="robots" content="noindex, nofollow" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <header style={{ background: "#1e2833", color: "#fff", padding: "14px 16px", display: "flex", alignItems: "center", gap: 10 }}>
        <img src="/images/logo.webp" alt="" width={34} height={34} style={{ borderRadius: 6 }} onError={(e) => { e.currentTarget.style.display = "none"; }} />
        <div>
          <div style={{ fontWeight: 700, fontSize: 17 }}>Delivery invoices</div>
          <div style={{ fontSize: 12.5, opacity: 0.7 }}>The Tire Plug · Olympic</div>
        </div>
      </header>

      <main style={{ maxWidth: 480, margin: "0 auto", padding: 16 }}>
        {err && <div style={{ background: "#fef2f2", color: "#b91c1c", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 12px", marginBottom: 12, fontSize: 14 }}>{err}</div>}
        {!state && !err && <p style={{ color: "#6b7280" }}>Loading…</p>}

        {state && <>
          {open.length > 0 && (
            <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 8, padding: "10px 12px", marginBottom: 12, fontSize: 14 }}>
              <b>Not answered yet:</b>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                {open.map((d) => (
                  <button key={d.day} onClick={() => setDay(d.day)} style={{ ...chip, borderColor: day === d.day ? RED : "#fdba74", color: day === d.day ? RED : "#9a3412" }}>{fmtDay(d.day, state.today)}</button>
                ))}
                {day !== state.today && <button onClick={() => setDay(state.today)} style={chip}>Back to today</button>}
              </div>
            </div>
          )}

          <section style={card}>
            <div style={{ fontSize: 13, color: "#6b7280" }}>Deliveries for</div>
            <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>{fmtDay(day, state.today)}</div>
            <div style={{ fontSize: 14, color: cur?.status ? "#15803d" : "#b45309", marginBottom: 14 }}>
              {cur?.status === "none" ? "Marked: no deliveries." : cur?.uploads ? `${cur.uploads} photo${cur.uploads === 1 ? "" : "s"} uploaded. Add more if another delivery came in.` : "Nothing uploaded yet."}
            </div>

            <label style={{ fontSize: 13, fontWeight: 500, display: "block", marginBottom: 4 }}>Your name</label>
            <input value={by} onChange={(e) => setBy(e.target.value)} placeholder="e.g. Belen" style={{ width: "100%", height: 42, padding: "0 12px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 16, boxSizing: "border-box", marginBottom: 14 }} />

            <button onClick={() => camRef.current?.click()} style={{ ...big, background: RED, color: "#fff", border: "none" }}>Take photo of invoice</button>
            <button onClick={() => fileRef.current?.click()} style={{ ...big, background: "#fff", color: "#1f2937", border: "1px solid #d1d5db" }}>Upload photos or PDF</button>
            <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { const l = [...e.target.files]; e.target.value = ""; if (l.length) upload(l); }} />
            <input ref={fileRef} type="file" accept="image/*,application/pdf" multiple hidden onChange={(e) => { const l = [...e.target.files]; e.target.value = ""; if (l.length) upload(l); }} />
            <p style={{ fontSize: 12.5, color: "#6b7280", margin: "2px 0 0" }}>One photo per page. Lay it flat, fill the screen, no glare.</p>

            {!cur?.uploads && cur?.status !== "none" && (
              <button onClick={noDeliveries} disabled={noneBusy} style={{ ...big, marginTop: 14, background: "#fff", color: "#374151", border: "1px dashed #9ca3af" }}>
                {noneBusy ? "Saving…" : "No deliveries"}
              </button>
            )}
          </section>

          {files.length > 0 && (
            <section style={card}>
              {files.map((f) => (
                <div key={f.id} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "8px 0", borderBottom: "1px solid #f0f0f0", fontSize: 14 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 5, marginTop: 5, flexShrink: 0, background: { uploading: "#9ca3af", reading: "#1a66d6", done: "#15803d", warn: "#b45309", error: "#dc2626", dup: "#dc2626" }[f.status] }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</div>
                    <div style={{ color: f.status === "error" || f.status === "dup" ? "#dc2626" : "#6b7280", fontSize: 13, fontWeight: f.status === "dup" ? 600 : 400 }}>
                      {f.status === "uploading" ? "Uploading…" : f.status === "reading" ? "Uploaded. Reading the invoice…" : f.msg}
                    </div>
                  </div>
                </div>
              ))}
            </section>
          )}
        </>}
      </main>
    </div>
  );
}

const card = { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: 16, marginBottom: 12 };
const big = { display: "block", width: "100%", height: 52, borderRadius: 10, fontSize: 16, fontWeight: 600, marginBottom: 10, cursor: "pointer", fontFamily: "inherit" };
const chip = { background: "#fff", border: "1px solid #d1d5db", borderRadius: 999, padding: "4px 10px", fontSize: 13, cursor: "pointer", fontFamily: "inherit" };
