import React, { useEffect, useRef, useState } from "react";
import Head from "next/head";
import { supabaseBrowser } from "../lib/supabaseBrowser.js";

/* The Tire Plug: upload used tires (takeoffs), one single, double or set at a time.
   Photos go to storage, the AI reads size, brand and DOT, and the owner prices it under
   Admin -> Used tires. Nothing shows on the website until then. */

const RED = "#e01b22";
const GROUPS = [[1, "Single"], [2, "Double"], [3, "3 tires"], [4, "Full set"]];
const newBatch = () => Array.from({ length: 12 }, () => "abcdefghijklmnopqrstuvwxyz0123456789"[Math.floor(Math.random() * 36)]).join("");

async function shrink(file, max, quality) {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
  c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
  const blob = await new Promise((r) => c.toBlob(r, "image/jpeg", quality));
  if (!blob) throw new Error("Couldn't open that photo.");
  return blob;
}

export default function Takeoffs() {
  const [k, setK] = useState("");
  const [err, setErr] = useState("");
  const [by, setBy] = useState("");
  const [qty, setQty] = useState(4);
  const [tread, setTread] = useState("");
  const [picked, setPicked] = useState([]); // { file, preview }
  const [busy, setBusy] = useState("");
  const [done, setDone] = useState([]);
  const [state, setState] = useState(null);
  const batch = useRef(newBatch());
  const fileRef = useRef(null);
  const camRef = useRef(null);

  async function call(body, key = k) {
    const res = await fetch("/api/takeoffs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ k: key, ...body }) });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j.error || "Something went wrong. Try again.");
    return j;
  }
  useEffect(() => {
    const key = new URLSearchParams(window.location.search).get("k") || "";
    setK(key);
    try { setBy(localStorage.getItem("tp_invoice_name") || ""); } catch (e) {}
    if (!key) { setErr("Open this page from the link in Admin → Used tires."); return; }
    call({ action: "state" }, key).then(setState).catch((e) => setErr(e.message));
    // eslint-disable-next-line
  }, []);

  const add = (list) => setPicked((p) => [...p, ...list.map((file) => ({ file, preview: URL.createObjectURL(file) }))]);
  const remove = (i) => setPicked((p) => p.filter((_, n) => n !== i));

  async function save() {
    setErr("");
    try { localStorage.setItem("tp_invoice_name", by); } catch (e) {}
    try {
      const photos = [];
      for (let i = 0; i < picked.length; i++) {
        setBusy(`Uploading photo ${i + 1} of ${picked.length}…`);
        const [full, thumb] = await Promise.all([shrink(picked[i].file, 2000, 0.85), shrink(picked[i].file, 720, 0.78)]);
        const s = await call({ action: "sign", batch: batch.current, n: i });
        const store = supabaseBrowser.storage.from("used-tires");
        const [a, b] = await Promise.all([
          store.uploadToSignedUrl(s.full.path, s.full.token, full, { contentType: "image/jpeg" }),
          store.uploadToSignedUrl(s.thumb.path, s.thumb.token, thumb, { contentType: "image/jpeg" }),
        ]);
        if (a.error || b.error) throw new Error((a.error || b.error).message);
        photos.push({ p: s.full.path, t: s.thumb.path });
      }
      setBusy("Reading the size and DOT…");
      const r = await call({ action: "save", batch: batch.current, qty, tread, photos, by });
      setDone((d) => [{ ...r, qty }, ...d]);
      batch.current = newBatch();
      setPicked([]); setTread("");
      window.scrollTo(0, 0);
      call({ action: "state" }).then(setState).catch(() => {});
    } catch (e) { setErr(e.message || "Upload failed. Try again."); }
    setBusy("");
  }

  const warn = (d) => d.error || d.mixed || d.is_tire === false;
  return (
    <div style={{ minHeight: "100vh", background: "#f4f5f7", fontFamily: "Inter, system-ui, -apple-system, Arial, sans-serif", color: "#1f2937" }}>
      <Head>
        <title>Upload Used Tires | The Tire Plug</title>
        <meta name="robots" content="noindex, nofollow" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <header style={{ background: "#1e2833", color: "#fff", padding: "14px 16px" }}>
        <div style={{ fontWeight: 700, fontSize: 17 }}>Upload used tires</div>
        <div style={{ fontSize: 12.5, opacity: 0.7 }}>{state ? `${state.total} uploaded · ${state.drafts} waiting for a price` : "The Tire Plug · Olympic"}</div>
      </header>
      <main style={{ maxWidth: 480, margin: "0 auto", padding: 16 }}>
        {err && <div style={{ background: "#fef2f2", color: "#b91c1c", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 12px", marginBottom: 12, fontSize: 14 }}>{err}</div>}

        {done.map((d) => (
          <div key={d.tag} style={{ background: warn(d) ? "#fff7ed" : "#ecfdf5", border: `1px solid ${warn(d) ? "#fed7aa" : "#a7f3d0"}`, borderRadius: 8, padding: "10px 12px", marginBottom: 8, fontSize: 14 }}>
            <b>U{d.tag}</b> · {d.qty} tire{d.qty === 1 ? "" : "s"} · {[d.size, d.brand, d.model, d.dot_year && `DOT ${d.dot_year}`].filter(Boolean).join(" · ") || "Saved"}
            {d.error && <div>Saved, but the AI couldn&apos;t read it. Fill it in under Admin.</div>}
            {d.mixed && <div>The photos look like different tires. Check this one in Admin.</div>}
            {d.is_tire === false && <div>This doesn&apos;t look like a tire.</div>}
          </div>
        ))}

        {k && <section style={{ background: "#fff", borderRadius: 12, padding: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
          <label style={label}>Your name</label>
          <input value={by} onChange={(e) => setBy(e.target.value)} placeholder="e.g. Belen" style={input} />

          <label style={label}>How many tires in this group?</label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginBottom: 14 }}>
            {GROUPS.map(([n, name]) => (
              <button key={n} onClick={() => setQty(n)} style={{ height: 46, borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", border: `1.5px solid ${qty === n ? RED : "#d1d5db"}`, background: qty === n ? "#fef2f2" : "#fff", color: qty === n ? RED : "#1f2937" }}>{name}</button>
            ))}
          </div>

          <label style={label}>Tread depth in 32nds (lowest tire, if you measured)</label>
          <input value={tread} onChange={(e) => setTread(e.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" placeholder="e.g. 7" style={input} />

          <label style={label}>Photos of this group only: tread, DOT, size, brand</label>
          {picked.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginBottom: 10 }}>
              {picked.map((x, i) => (
                <div key={x.preview} style={{ position: "relative", aspectRatio: "1" }}>
                  <img src={x.preview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 6 }} />
                  {!busy && <button aria-label="Remove photo" onClick={() => remove(i)} style={{ position: "absolute", top: 2, right: 2, width: 24, height: 24, borderRadius: 12, border: "none", background: "rgba(0,0,0,0.65)", color: "#fff", cursor: "pointer", fontSize: 14 }}>×</button>}
                </div>
              ))}
            </div>
          )}
          <button disabled={!!busy} onClick={() => fileRef.current?.click()} style={{ ...big, background: "#fff", color: "#1f2937", border: "1px solid #d1d5db" }}>Pick photos from phone</button>
          <button disabled={!!busy} onClick={() => camRef.current?.click()} style={{ ...big, background: "#fff", color: "#1f2937", border: "1px solid #d1d5db" }}>Take a photo</button>
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => { const l = [...e.target.files]; e.target.value = ""; add(l); }} />
          <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { const l = [...e.target.files]; e.target.value = ""; add(l); }} />

          <button disabled={!!busy || !picked.length} onClick={save} style={{ ...big, background: picked.length && !busy ? RED : "#e5e7eb", color: picked.length && !busy ? "#fff" : "#6b7280", border: "none", marginBottom: 0 }}>
            {busy || (picked.length ? `Save this group (${picked.length} photo${picked.length === 1 ? "" : "s"})` : "Add photos to save")}
          </button>
        </section>}
      </main>
    </div>
  );
}

const label = { fontSize: 13, fontWeight: 500, display: "block", marginBottom: 4 };
const input = { width: "100%", height: 42, padding: "0 12px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 16, boxSizing: "border-box", marginBottom: 14 };
const big = { display: "block", width: "100%", height: 50, borderRadius: 10, fontSize: 16, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", marginBottom: 10 };
