// Admin dashboard: the Email tab (branded blasts with tire deals, preview, test, schedule, stats)
// and the Businesses tab (cold outreach to local businesses). Server side: lib/email.js,
// /api/admin/send-email and /api/admin/prospects.
import React, { useState, useEffect, useMemo, useRef } from "react";
import { T, Icon, ui } from "./ui.js";

const RED = T.red;
const inp = ui.input;
const cta = { ...ui.primary, height: 38, fontSize: 14 };
const ghostBtn = { ...ui.btn, height: 36 };
const fieldLabel = ui.label;
const card = { ...ui.card, padding: "1rem 1.15rem" };
const subHead = ui.h2;
const hint = { color: T.textMuted, fontSize: 12.5, lineHeight: 1.5, margin: "0.2rem 0 0.6rem" };
const chipStyle = (on) => ({ ...ui.btn, height: 32, padding: "0 0.75rem", fontSize: 13, background: on ? T.blueSoft : T.surface, color: on ? T.blue : T.text, borderColor: on ? T.blue : T.borderStrong });
const msgStyle = (r) => ({ color: r.error ? "#b91c1c" : T.green, fontSize: 13.5, margin: "0.4rem 0" });
const pct = (n, d) => (d ? `${Math.round((100 * (n || 0)) / d)}%` : "—");
const fmt = (s) => (s ? new Date(s).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "");

function useApi(path, auth) {
  return async (body) => {
    try {
      const r = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...auth, ...body }) });
      const d = await r.json().catch(() => ({}));
      return r.ok ? d : { error: d.error || `Request failed (${r.status})` };
    } catch { return { error: "Network error" }; }
  };
}

// Live preview of the real email HTML, refreshed shortly after typing stops.
function Preview({ load, deps, height = 640 }) {
  const [html, setHtml] = useState("");
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const t = setTimeout(async () => { const d = await load(); if (d.html) setHtml(d.html); }, 600);
    return () => clearTimeout(t);
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div style={{ position: "sticky", top: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
        <span style={fieldLabel}>Live preview</span>
        <div style={{ display: "flex", gap: "0.3rem" }}>
          <button onClick={() => setMobile(false)} style={chipStyle(!mobile)}>Desktop</button>
          <button onClick={() => setMobile(true)} style={chipStyle(mobile)}>Phone</button>
        </div>
      </div>
      <div style={{ background: "#e9e9e9", borderRadius: 14, padding: mobile ? "12px 0" : 0, display: "flex", justifyContent: "center", overflow: "hidden" }}>
        <iframe title="Email preview" srcDoc={html} sandbox="" style={{ width: mobile ? 375 : "100%", height, border: "none", background: "#fff", borderRadius: mobile ? 18 : 14 }} />
      </div>
    </div>
  );
}

function TestSend({ onSend }) {
  const [to, setTo] = useState("");
  const [r, setR] = useState(null);
  const [busy, setBusy] = useState(false);
  return (
    <div>
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="Send a test to… (blank = you)" style={{ ...inp, marginBottom: 0 }} />
        <button disabled={busy} onClick={async () => { setBusy(true); setR(await onSend(to.trim())); setBusy(false); }} style={{ ...ghostBtn, whiteSpace: "nowrap" }}>{busy ? "Sending…" : <><Icon name="send" size={18} />Send test</>}</button>
      </div>
      {r && <p style={msgStyle(r)}>{r.error ? `${r.error}` : `Test sent to ${r.to}. Check the inbox (and spam folder).`}</p>}
    </div>
  );
}

/* ================= EMAIL TAB (blasts) ================= */
export function EmailTab({ auth, campaigns, onChanged }) {
  const api = useApi("/api/admin/send-email", auth);
  const [audience, setAudience] = useState("subscribers");
  const [count, setCount] = useState(null);
  const [subject, setSubject] = useState("");
  const [headline, setHeadline] = useState("");
  const [message, setMessage] = useState("");
  const [tires, setTires] = useState([]);
  const [allTires, setAllTires] = useState([]);
  const [tq, setTq] = useState("");
  const [when, setWhen] = useState("now");
  const [date, setDate] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => { api({ action: "tires" }).then((d) => setAllTires(d.tires || [])); }, []); // eslint-disable-line
  useEffect(() => { setCount(null); api({ action: "count", audience }).then((d) => setCount(d.error ? null : d.total)); }, [audience]); // eslint-disable-line

  const shown = useMemo(() => {
    const q = tq.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
    return allTires.filter((t) => !q || `${t.brand}${t.model}${t.size}`.toLowerCase().replace(/[^a-z0-9]/g, "").includes(q)).slice(0, 40);
  }, [allTires, tq]);
  const toggleTire = (id) => setTires((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length >= 6 ? s : [...s, id]));

  async function send() {
    setBusy(true); setResult(null);
    const body = { audience, subject, headline, message, tires };
    const d = when === "now" ? await api({ action: "send", ...body }) : await api({ action: "schedule", ...body, sendAt: `${date}T07:00:00Z` });
    setResult(d); setBusy(false); setConfirm(false);
    if (!d.error) onChanged && onChanged();
  }

  const content = { subject, headline, message, tires };
  const ready = subject.trim() && message.trim() && (when === "now" || date);
  const tomorrow = new Date(Date.now() + 864e5).toISOString().slice(0, 10);

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: "1.75rem", alignItems: "start" }}>
        <div style={{ display: "grid", gap: "1rem" }}>
          <div>
            <label style={fieldLabel}>Send to</label>
            <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
              {[["subscribers", "Subscribers"], ["leads", "Leads"], ["both", "Everyone"]].map(([id, l]) => (
                <button key={id} onClick={() => setAudience(id)} style={chipStyle(audience === id)}>{l}</button>
              ))}
            </div>
            <p style={hint}>{count === null ? "Counting…" : <><strong>{count}</strong> people (unsubscribed and bounced addresses are skipped automatically).</>}</p>
          </div>
          <div>
            <label style={fieldLabel}>Subject line</label>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. {name}, new tires delivered tomorrow" style={inp} />
            <label style={fieldLabel}>Headline in the email (optional)</label>
            <input value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="Defaults to the subject" style={inp} />
            <label style={fieldLabel}>Message</label>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={7} placeholder={"Hi {name},\n\nWrite your message here. Leave a blank line between paragraphs."} style={{ ...inp, resize: "vertical", lineHeight: 1.6 }} />
            <p style={hint}>{"{name}"} becomes their first name. Your logo, Google rating, a real review, call/quote buttons, the shop address and an unsubscribe link are added automatically.</p>
          </div>

          <div style={card}>
            <label style={fieldLabel}>Feature tire deals ({tires.length}/6)</label>
            <input value={tq} onChange={(e) => setTq(e.target.value)} placeholder="Search size, brand or model (e.g. 225/65R17)" style={inp} />
            <div style={{ maxHeight: 230, overflowY: "auto", display: "grid", gap: "0.3rem" }}>
              {shown.map((t) => {
                const on = tires.includes(t.id);
                return (
                  <label key={t.id} style={{ display: "flex", alignItems: "center", gap: "0.6rem", padding: "0.35rem 0.5rem", borderRadius: 8, background: on ? "rgba(255,31,31,0.07)" : "transparent", cursor: "pointer", fontSize: "0.84rem" }}>
                    <input type="checkbox" checked={on} onChange={() => toggleTire(t.id)} />
                    {t.img ? <img src={t.img} alt="" width={30} height={30} style={{ objectFit: "contain" }} /> : <span style={{ width: 30 }} />}
                    <span style={{ flex: 1 }}><strong>{t.brand}</strong> {t.model} · {t.size}</span>
                    <strong style={{ color: RED }}>${t.price}</strong>
                  </label>
                );
              })}
              {!shown.length && <p style={hint}>No next-day tires match.</p>}
            </div>
          </div>

          <TestSend onSend={(to) => api({ action: "test", to, ...content })} />

          <div style={card}>
            <label style={fieldLabel}>When</label>
            <div style={{ display: "flex", gap: "0.4rem", alignItems: "center", flexWrap: "wrap" }}>
              <button onClick={() => setWhen("now")} style={chipStyle(when === "now")}>Send now</button>
              <button onClick={() => setWhen("later")} style={chipStyle(when === "later")}>Schedule</button>
              {when === "later" && <input type="date" min={tomorrow} value={date} onChange={(e) => setDate(e.target.value)} style={{ ...inp, width: "auto", marginBottom: 0 }} />}
            </div>
            {when === "later" && <p style={hint}>Scheduled emails go out around 9 AM on that day.</p>}
            <div style={{ marginTop: "0.8rem" }}>
              {!confirm ? (
                <button onClick={() => setConfirm(true)} disabled={!ready} style={{ ...cta, background: RED, opacity: ready ? 1 : 0.4 }}>Review &amp; {when === "now" ? "send" : "schedule"}</button>
              ) : (
                <div>
                  <p style={{ fontSize: "0.9rem", margin: "0 0 0.6rem" }}>{when === "now" ? "Send" : `Schedule for ${date}:`} <strong>“{subject}”</strong> to <strong>{count ?? "?"}</strong> people?</p>
                  <button onClick={send} disabled={busy} style={{ ...cta, background: RED }}>{busy ? "Working…" : "Yes, do it"}</button>{" "}
                  <button onClick={() => setConfirm(false)} style={ghostBtn}>Cancel</button>
                </div>
              )}
              {result && <p style={msgStyle(result)}>{result.error ? `${result.error}` : result.scheduled ? `Scheduled for ${fmt(result.sendAt)}.` : `Sent to ${result.sent} of ${result.total}${result.errors ? ` (${result.errors} failed)` : ""}.`}</p>}
            </div>
          </div>
        </div>

        <Preview load={() => api({ action: "preview", ...content })} deps={[subject, headline, message, tires.join(",")]} />
      </div>

      <CampaignStats api={api} campaigns={campaigns} onChanged={onChanged} />
    </div>
  );
}

function CampaignStats({ api, campaigns, onChanged }) {
  if (!campaigns?.length) return null;
  const KIND = { outreach: "Businesses", customers: "Customers", welcome: "Welcome", blast: "Blast" };
  return (
    <div>
      <h2 style={subHead}>Sends &amp; results</h2>
      <p style={hint}>Opens and clicks fill in once the Resend webhook is connected (see setup notes). Apple Mail privacy can inflate opens; clicks and replies are the honest numbers.</p>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.83rem", background: "#fff", borderRadius: 12 }}>
          <thead><tr style={{ textAlign: "left", color: T.textMuted }}>
            {["Email", "Type", "When", "Sent", "Delivered", "Opened", "Clicked", "Bounced", ""].map((h) => <th key={h} style={{ padding: "0.6rem 0.7rem", fontWeight: 700, borderBottom: "1px solid #eee" }}>{h}</th>)}
          </tr></thead>
          <tbody>
            {campaigns.map((c) => {
              const sent = c.sent_count || 0;
              return (
                <tr key={c.id} style={{ borderBottom: "1px solid #f3f3f3" }}>
                  <td style={{ padding: "0.6rem 0.7rem", fontWeight: 600, maxWidth: 280 }}>{c.subject}<div style={{ color: T.textFaint, fontWeight: 400, fontSize: "0.74rem" }}>to {c.audience}</div></td>
                  <td style={{ padding: "0.6rem 0.7rem", whiteSpace: "nowrap" }}>{KIND[c.kind] || "Blast"}</td>
                  <td style={{ padding: "0.6rem 0.7rem", whiteSpace: "nowrap" }}>{c.status === "scheduled" ? <span style={{ color: "#b26b00", fontWeight: 700 }}>⏰ {fmt(c.send_at)}</span> : fmt(c.send_at || c.created_at)}</td>
                  <td style={{ padding: "0.6rem 0.7rem" }}>{c.status === "scheduled" ? "—" : `${sent}/${c.recipient_count || 0}`}</td>
                  <td style={{ padding: "0.6rem 0.7rem" }}>{pct(c.delivered, sent)}</td>
                  <td style={{ padding: "0.6rem 0.7rem", fontWeight: 700 }}>{pct(c.opened, sent)}</td>
                  <td style={{ padding: "0.6rem 0.7rem", fontWeight: 700, color: c.clicked ? "#1a8f4c" : undefined }}>{pct(c.clicked, sent)}</td>
                  <td style={{ padding: "0.6rem 0.7rem", color: c.bounced ? "#d33" : undefined }}>{c.bounced || 0}</td>
                  <td style={{ padding: "0.6rem 0.7rem" }}>{c.status === "scheduled" && <button onClick={async () => { await api({ action: "cancel", id: c.id }); onChanged && onChanged(); }} style={{ ...ghostBtn, padding: "0.3rem 0.6rem" }}>Cancel</button>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ================= BUSINESSES TAB (cold outreach) ================= */
const CATEGORIES = ["Auto dealer / used car lot", "Delivery & courier fleet", "Rideshare / limo / taxi", "Landscaping", "Construction / contractor", "Plumbing / HVAC / electrical", "Towing", "Moving company", "Car rental", "Auto repair / body shop", "Food truck / catering", "Property management"];
const STATUSES = [["new", "New"], ["emailed", "Emailed"], ["replied", "Replied"], ["customer", "Customer"], ["not_interested", "Not interested"], ["unsubscribed", "Unsubscribed"], ["bounced", "Bounced"]];
const STATUS_COLOR = { new: "#666", emailed: "#2563eb", replied: "#1a8f4c", customer: "#0f766e", not_interested: "#999", unsubscribed: "#999", bounced: "#d33" };
const SAMPLE_CSV = "Business,Contact,Email,Phone,Category\nSunset Landscaping,Maria Lopez,maria@sunsetlandscaping.com,323-555-0100,Landscaping";

export function BusinessesTab({ auth }) {
  const api = useApi("/api/admin/prospects", auth);
  const [d, setD] = useState({ prospects: [], sentToday: 0, dailyLimit: 40 });
  const [err, setErr] = useState("");
  const [filter, setFilter] = useState("all");
  const [cat, setCat] = useState("all");
  const [sel, setSel] = useState(new Set());
  const [showImport, setShowImport] = useState(false);
  const [csv, setCsv] = useState("");
  const [importMsg, setImportMsg] = useState(null);
  const [step, setStep] = useState(1);
  const [draftCat, setDraftCat] = useState(CATEGORIES[1]);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [signer, setSigner] = useState({ name: "", title: "Fleet & Commercial Accounts" });
  const [drafting, setDrafting] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const fileRef = useRef(null);

  async function load() { const r = await api({ action: "list" }); if (r.error) setErr(r.error); else { setErr(""); setD(r); } }
  useEffect(() => { load(); try { const s = JSON.parse(localStorage.getItem("tp_outreach_signer") || "null"); if (s) setSigner(s); } catch {} }, []); // eslint-disable-line
  useEffect(() => { try { localStorage.setItem("tp_outreach_signer", JSON.stringify(signer)); } catch {} }, [signer]);

  const cats = useMemo(() => [...new Set(d.prospects.map((p) => p.category).filter(Boolean))].sort(), [d.prospects]);
  const list = d.prospects.filter((p) => (filter === "all" || p.status === filter) && (cat === "all" || p.category === cat));
  const counts = useMemo(() => { const c = {}; d.prospects.forEach((p) => { c[p.status] = (c[p.status] || 0) + 1; }); return c; }, [d.prospects]);
  const eligible = (p) => step === 1 ? p.touches === 0 && ["new"].includes(p.status) : p.touches === 1 && p.status === "emailed" && Date.now() - new Date(p.last_emailed_at).getTime() >= 4 * 864e5;
  const selectedEligible = d.prospects.filter((p) => sel.has(p.id) && eligible(p)).length;
  const room = Math.max(0, d.dailyLimit - d.sentToday);

  async function doImport(text) {
    setImportMsg(null);
    const r = await api({ action: "import", csv: text });
    setImportMsg(r.error ? r : { ok: `Added ${r.added} businesses${r.skipped ? ` (${r.skipped} duplicates skipped)` : ""}.` });
    if (!r.error) { setCsv(""); load(); }
  }
  async function draft() {
    setDrafting(true);
    const r = await api({ action: "draft", category: draftCat, step });
    if (!r.error) { setSubject(r.subject); setMessage(r.message); } else setResult(r);
    setDrafting(false);
  }
  async function send() {
    setBusy(true); setResult(null);
    const r = await api({ action: "send", ids: [...sel], step, subject, message, signer });
    setResult(r); setBusy(false); setConfirm(false);
    if (!r.error) { setSel(new Set()); load(); }
  }
  const update = async (id, patch) => { await api({ action: "update", id, patch }); load(); };
  const selectAllEligible = () => setSel(new Set(list.filter(eligible).slice(0, room).map((p) => p.id)));

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "1rem", marginBottom: "1rem" }}>
        <div>
          <h1 style={ui.h1}>Business outreach</h1>
          <p style={{ ...hint, margin: "0.3rem 0 0", maxWidth: 620 }}>Email local businesses about a fleet/business account. Sends from <strong>{d.from || "your outreach address"}</strong> as a personal letter with your logo, 5.0 Google rating and a real review. Max {d.dailyLimit}/day and 2 emails per business, so your domain stays out of spam.</p>
        </div>
        <button onClick={() => setShowImport((s) => !s)} style={cta}>{showImport ? "Close import" : <><Icon name="add" size={18} />Add businesses</>}</button>
      </div>
      {err && <p style={msgStyle({ error: true })}>{err}</p>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: "0.6rem", marginBottom: "1rem" }}>
        {[["Businesses", d.prospects.length], ["Emailed", (counts.emailed || 0) + (counts.replied || 0) + (counts.customer || 0) + (counts.not_interested || 0)], ["Replied", (counts.replied || 0) + (counts.customer || 0)], ["Customers", counts.customer || 0], ["Sent today", `${d.sentToday}/${d.dailyLimit}`]].map(([l, v]) => (
          <div key={l} style={card}><div style={{ fontSize: 24, fontWeight: 600 }}>{v}</div><div style={{ ...fieldLabel, marginBottom: 0 }}>{l}</div></div>
        ))}
      </div>

      {showImport && (
        <div style={{ ...card, marginBottom: "1rem" }}>
          <label style={fieldLabel}>Paste a spreadsheet (CSV) or upload a file</label>
          <p style={hint}>First row = column names. Needs at least a business name and an email; contact name, phone, category and address are used when present. Good sources: Google Maps listings with an email on their website, your chamber of commerce directory, business cards and past commercial customers. Only email business addresses (info@, owner@, fleet@), never personal ones you bought.</p>
          <textarea value={csv} onChange={(e) => setCsv(e.target.value)} rows={5} placeholder={SAMPLE_CSV} style={{ ...inp, fontFamily: "monospace", fontSize: "0.8rem" }} />
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <button onClick={() => doImport(csv)} disabled={!csv.trim()} style={{ ...cta, opacity: csv.trim() ? 1 : 0.4 }}>Import</button>
            <button onClick={() => fileRef.current?.click()} style={ghostBtn}>Upload .csv</button>
            <input ref={fileRef} type="file" accept=".csv,.tsv,.txt" style={{ display: "none" }} onChange={async (e) => { const f = e.target.files?.[0]; if (f) doImport(await f.text()); e.target.value = ""; }} />
          </div>
          {importMsg && <p style={msgStyle(importMsg)}>{importMsg.error ? `${importMsg.error}` : importMsg.ok}</p>}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.1fr) minmax(0,1fr)", gap: "1.5rem", alignItems: "start" }}>
        <div>
          <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap", marginBottom: "0.5rem" }}>
            <button onClick={() => setFilter("all")} style={chipStyle(filter === "all")}>All ({d.prospects.length})</button>
            {STATUSES.filter(([k]) => counts[k]).map(([k, l]) => <button key={k} onClick={() => setFilter(k)} style={chipStyle(filter === k)}>{l} ({counts[k]})</button>)}
          </div>
          {cats.length > 1 && (
            <select value={cat} onChange={(e) => setCat(e.target.value)} style={{ ...inp, width: "auto", padding: "0.45rem 0.7rem", fontSize: "0.82rem" }}>
              <option value="all">All categories</option>
              {cats.map((c) => <option key={c}>{c}</option>)}
            </select>
          )}
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", margin: "0.3rem 0 0.6rem", fontSize: "0.8rem" }}>
            <button onClick={selectAllEligible} style={{ ...ghostBtn, padding: "0.35rem 0.7rem" }}>Select ready for {step === 1 ? "intro" : "follow-up"}</button>
            {sel.size > 0 && <button onClick={() => setSel(new Set())} style={{ ...ghostBtn, padding: "0.35rem 0.7rem" }}>Clear ({sel.size})</button>}
          </div>
          {!d.prospects.length && !err && <p style={hint}>No businesses yet. Click “Add businesses” to paste or upload a list.</p>}
          <div style={{ display: "grid", gap: "0.4rem", maxHeight: 760, overflowY: "auto" }}>
            {list.map((p) => (
              <div key={p.id} style={{ ...card, padding: "0.65rem 0.85rem", display: "flex", gap: "0.7rem", alignItems: "flex-start", opacity: eligible(p) || sel.has(p.id) ? 1 : 0.75 }}>
                <input type="checkbox" checked={sel.has(p.id)} onChange={() => setSel((s) => { const n = new Set(s); n.has(p.id) ? n.delete(p.id) : n.add(p.id); return n; })} style={{ marginTop: 4 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: "0.9rem" }}>{p.business_name}</div>
                  <div style={{ color: T.textMuted, fontSize: "0.76rem", overflow: "hidden", textOverflow: "ellipsis" }}>{[p.contact_name, p.email, p.phone].filter(Boolean).join(" · ")}</div>
                  <div style={{ color: T.textFaint, fontSize: "0.72rem" }}>{[p.category, p.touches ? `${p.touches} email${p.touches > 1 ? "s" : ""}, last ${fmt(p.last_emailed_at)}` : null].filter(Boolean).join(" · ")}</div>
                </div>
                <select value={p.status} onChange={(e) => update(p.id, { status: e.target.value })} style={{ border: "1px solid rgba(0,0,0,0.12)", borderRadius: 8, padding: "0.25rem 0.4rem", fontSize: "0.74rem", fontWeight: 700, color: STATUS_COLOR[p.status], background: "#fff", fontFamily: "inherit" }}>
                  {STATUSES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
                <button title="Remove" onClick={() => { if (window.confirm(`Remove ${p.business_name}?`)) api({ action: "delete", id: p.id }).then(load); }} style={{ background: "none", border: "none", color: "rgba(0,0,0,0.3)", cursor: "pointer" }}>✕</button>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "grid", gap: "0.9rem" }}>
          <div style={card}>
            <label style={fieldLabel}>Email</label>
            <div style={{ display: "flex", gap: "0.4rem", marginBottom: "0.7rem" }}>
              <button onClick={() => { setStep(1); setSel(new Set()); }} style={chipStyle(step === 1)}>1 · Intro</button>
              <button onClick={() => { setStep(2); setSel(new Set()); }} style={chipStyle(step === 2)}>2 · Follow-up (4+ days later)</button>
            </div>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <select value={draftCat} onChange={(e) => setDraftCat(e.target.value)} style={{ ...inp, marginBottom: 0 }}>
                {[...new Set([...CATEGORIES, ...cats])].map((c) => <option key={c}>{c}</option>)}
              </select>
              <button onClick={draft} disabled={drafting} style={{ ...ghostBtn, whiteSpace: "nowrap" }}>{drafting ? "Writing…" : <><Icon name="auto_awesome" size={18} />Draft with AI</>}</button>
            </div>
            <p style={hint}>Write one email per type of business; it reads more personal than a generic pitch.</p>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject, e.g. tires for {business}'s trucks" style={inp} />
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={9} placeholder={"Hi {name},\n\n…"} style={{ ...inp, resize: "vertical", lineHeight: 1.6 }} />
            <p style={hint}>{"{name}"} = contact's first name, {"{business}"} = business name. Keep it short and personal, no prices you can't honor.</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
              <input value={signer.name} onChange={(e) => setSigner({ ...signer, name: e.target.value })} placeholder="Your name (signature)" style={inp} />
              <input value={signer.title} onChange={(e) => setSigner({ ...signer, title: e.target.value })} placeholder="Title" style={inp} />
            </div>
            <TestSend onSend={(to) => api({ action: "test", to, subject, message, signer })} />
          </div>

          <div style={card}>
            <p style={{ margin: "0 0 0.6rem", fontSize: "0.88rem" }}><strong>{selectedEligible}</strong> selected and ready for {step === 1 ? "an intro" : "a follow-up"} · <strong>{room}</strong> sends left today</p>
            {!confirm ? (
              <button onClick={() => setConfirm(true)} disabled={!selectedEligible || !subject || !message || !room} style={{ ...cta, background: RED, opacity: selectedEligible && subject && message && room ? 1 : 0.4 }}>Review &amp; send</button>
            ) : (
              <div>
                <p style={{ fontSize: "0.88rem", margin: "0 0 0.6rem" }}>Send this {step === 1 ? "intro" : "follow-up"} to <strong>{Math.min(selectedEligible, room)}</strong> businesses?</p>
                <button onClick={send} disabled={busy} style={{ ...cta, background: RED }}>{busy ? "Sending…" : "Yes, send"}</button>{" "}
                <button onClick={() => setConfirm(false)} style={ghostBtn}>Cancel</button>
              </div>
            )}
            {result && <p style={msgStyle(result)}>{result.error ? `${result.error}` : `Sent ${result.sent}${result.skipped ? ` · ${result.skipped} skipped (not eligible or over today's limit)` : ""}. Replies land in the Replies tab and mark the business “Replied”.`}</p>}
          </div>

          <Preview load={() => api({ action: "preview", message, signer })} deps={[message, signer.name, signer.title]} height={720} />
        </div>
      </div>
    </div>
  );
}
