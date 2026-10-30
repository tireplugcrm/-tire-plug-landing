/**
 * Lexi's Commission Tracker (server-only). See lib/commission-schema.sql.
 * Lexi reports an RO (RO # + RO name) at /lexi?k=<key>; matchReport() pulls that repair order from
 * Tekmetric (parts, labor, fees, quantities, total) and figures her commission at app_settings
 * commission_rate. Until the Tekmetric API is connected, reports stay "pending" and get matched by
 * hand (Claude reads the RO in Tekmetric and fills lines / sold_total).
 */
import { supabaseAdmin } from "./supabaseAdmin.js";
import { setting, shopDay, SITE } from "./invoices.js";

export { setting, shopDay };

export async function keyOk(k) {
  const key = await setting("commission_key");
  return !!key && typeof k === "string" && k === key;
}

export async function reportLink() {
  return `${SITE}/lexi?k=${await setting("commission_key")}`;
}

export async function rate() {
  const v = String(await setting("commission_rate")).trim();
  if (!v) return null;
  const n = parseFloat(v);
  if (!Number.isFinite(n)) return null;
  return v.includes("%") || n > 1 ? n / 100 : n;
}

const money = (cents) => Math.round(Number(cents) || 0) / 100;
const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z]/g, "");

// Tekmetric repair-orders API (same app credentials as lib/tekmetric.mjs). Amounts are in cents.
async function tekmetricRO(roNumber) {
  if (!(process.env.TEKMETRIC_CLIENT_ID && process.env.TEKMETRIC_CLIENT_SECRET && process.env.TEKMETRIC_SHOP_ID)) return { off: true };
  const host = process.env.TEKMETRIC_ENV === "production" ? "https://shop.tekmetric.com" : "https://sandbox.tekmetric.com";
  const basic = Buffer.from(`${process.env.TEKMETRIC_CLIENT_ID}:${process.env.TEKMETRIC_CLIENT_SECRET}`).toString("base64");
  const t = await fetch(`${host}/api/v1/oauth/token`, { method: "POST", headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" }, body: "grant_type=client_credentials" }).then((r) => r.json());
  const get = (p) => fetch(`${host}${p}`, { headers: { Authorization: `Bearer ${t.access_token}` } }).then((r) => (r.ok ? r.json() : null));
  const res = await get(`/api/v1/repair-orders?shop=${encodeURIComponent(process.env.TEKMETRIC_SHOP_ID)}&search=${encodeURIComponent(roNumber)}&size=25`);
  const ro = (res?.content || []).find((r) => String(r.repairOrderNumber) === String(roNumber).replace(/\D/g, ""));
  if (!ro) return { ro: null };
  const cust = ro.customerId ? await get(`/api/v1/customers/${ro.customerId}`) : null;
  return { ro, customer: cust ? `${cust.firstName || ""} ${cust.lastName || ""}`.trim() : "" };
}

/** RO -> [{ kind, name, qty, amount }] and the total before tax. */
export function roLines(ro) {
  const lines = [];
  for (const job of ro.jobs || []) {
    for (const p of job.parts || []) lines.push({ kind: "part", job: job.name, name: [p.brand, p.model || p.name].filter(Boolean).join(" ") || p.name || "Part", qty: Number(p.quantity) || 1, amount: money((p.retail || 0) * (p.quantity || 1)) });
    for (const l of job.labor || []) lines.push({ kind: "labor", job: job.name, name: l.name || job.name || "Labor", qty: Number(l.hours) || 1, amount: money((l.rate || 0) * (l.hours || 0)) });
  }
  for (const f of ro.fees || []) lines.push({ kind: "fee", name: f.name || "Fee", qty: 1, amount: money(f.total) });
  const total = ro.totalSales != null ? money(ro.totalSales) - money(ro.taxes || 0) : lines.reduce((s, x) => s + x.amount, 0);
  const labor = lines.filter((x) => x.kind === "labor").reduce((s, x) => s + x.amount, 0);
  return { lines, total: Math.round(total * 100) / 100, labor: Math.round(labor * 100) / 100 };
}

/** Try to match one report to its Tekmetric RO. Returns the updated row (or the old one if Tekmetric is off). */
export async function matchReport(row) {
  let r;
  try { r = await tekmetricRO(row.ro_number); } catch (e) { return row; }
  if (r.off) return row;
  if (!r.ro) {
    const { data } = await supabaseAdmin.from("commission_reports").update({ status: "no-match", notes: "No Tekmetric RO with this number." }).eq("id", row.id).select("*").single();
    return data || row;
  }
  const { lines, total, labor } = roLines(r.ro);
  return applyMatch(row, { ro_number: row.ro_number, customer: r.customer, writer_id: r.ro.serviceWriterId, writer: r.ro.serviceWriterName || "", lines, total, labor });
}

/**
 * Save a Tekmetric RO onto a report. ro: { ro_number, customer, writer_id, writer, day?, lines, total, labor }.
 * row = her report, or null for an RO Tekmetric says she wrote that she didn't report (it's added).
 * Lexy is the service writer in Tekmetric on ROs she sells (app_settings commission_writer_id);
 * a report where someone else is the writer gets flagged for the owner to approve.
 */
export async function applyMatch(row, ro) {
  const pct = await rate();
  const lexiId = String(await setting("commission_writer_id"));
  const hers = !!lexiId && String(ro.writer_id || "") === lexiId;
  const flags = [];
  if (row && !hers) flags.push(`Service writer in Tekmetric is ${ro.writer || "someone else"}, not Lexy. Approve or reject.`);
  if (!row) flags.push("Lexy is the service writer in Tekmetric but didn't report it on the form.");
  if (row?.ro_name && ro.customer && !(norm(ro.customer).includes(norm(row.ro_name).slice(0, 4)) || norm(row.ro_name).includes(norm(ro.customer).slice(0, 4)))) {
    flags.push(`Name doesn't match Tekmetric (${ro.customer}).`);
  }
  // Commission is on labor only: tire/part margins are too thin to share.
  const fields = {
    status: "matched", lines: ro.lines, sold_total: ro.total, labor_total: ro.labor,
    commission: pct == null ? null : Math.round(ro.labor * pct * 100) / 100,
    tekmetric_name: ro.customer || null, tekmetric_writer: ro.writer || null, matched_at: new Date().toISOString(),
    notes: flags.join(" ") || null,
  };
  const q = row
    ? supabaseAdmin.from("commission_reports").update(fields).eq("id", row.id)
    : supabaseAdmin.from("commission_reports").upsert({ day: ro.day, ro_number: String(ro.ro_number), ro_name: ro.customer || "", ...fields }, { onConflict: "rep,ro_number" });
  const { data } = await q.select("*").single();
  return data || row;
}

/** Monday of the shop week holding `day` (YYYY-MM-DD). */
export function weekStart(day) {
  const d = new Date(`${day}T12:00:00Z`);
  const back = (d.getUTCDay() + 6) % 7;
  return new Date(d.getTime() - back * 864e5).toISOString().slice(0, 10);
}

/** Totals for today / this week / this month, plus today's rows. */
export async function totals(day = shopDay(0)) {
  const month = `${day.slice(0, 7)}-01`;
  const from = weekStart(day) < month ? weekStart(day) : month;
  const { data } = await supabaseAdmin.from("commission_reports").select("*").gte("day", from).lte("day", day).order("created_at");
  const rows = data || [];
  const sum = (list) => ({
    count: list.length,
    pending: list.filter((x) => x.status !== "matched").length,
    sold: list.reduce((s, x) => s + Number(x.sold_total || 0), 0),
    commission: list.reduce((s, x) => s + Number(x.commission || 0), 0),
  });
  return {
    day,
    today: sum(rows.filter((x) => x.day === day)),
    week: sum(rows.filter((x) => x.day >= weekStart(day))),
    month: sum(rows.filter((x) => x.day >= month)),
    todayRows: rows.filter((x) => x.day === day),
  };
}
