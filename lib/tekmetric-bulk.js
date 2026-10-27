/**
 * Tekmetric files from the invoice check-in (server-only). No Tekmetric API, so the hand-off is two
 * spreadsheets the owner uploads in Tekmetric:
 *
 *   update file    Tekmetric's own Bulk Editor export (Inventory > Bulk Editor > Download), cut down to
 *                  the parts this delivery changes, with Quantity In-Stock, Unit Cost and Retail Price
 *                  edited. Upload it at Bulk Editor > Upload. The first two columns (Checksum, Id) are
 *                  left exactly as Tekmetric wrote them.
 *   new parts file Tekmetric's Bulk Upload template (lib/tekmetric-upload-template.js) with one row per
 *                  tire that isn't in Tekmetric yet. Upload it at Add Parts > Bulk Upload.
 *
 * Quantity In-Stock in the update file is a number, not "+4": it overwrites Tekmetric. So the file
 * only carries the parts that change, and it should be uploaded soon after the export is downloaded
 * (a tire on one of those rows sold in between would be undone).
 *
 * Lines come from invoice_uploads.read (lib/invoices.js). A delivery adds its quantities and sets the
 * part's cost; a return (RMA slip) subtracts. Matching: part number first (with or without the
 * vendor's brand prefix: 110101923 = YOK110101923), then brand + size + model. Anything that could be
 * two different parts is left for a person ("check"), never guessed.
 */
import ExcelJS from "exceljs";
import { TEMPLATE_XLSX_BASE64 } from "./tekmetric-upload-template.js";

const RETAIL_MARKUP = 1.4; // the shop's Tekmetric retail = cost x 1.4
const BRANDS = { "rolling big power - rbp": "rbp", "ground speed": "groundspeed", "groundspeed tires": "groundspeed", "evolux": "evoluxx", "rbp tires": "rbp" };

const norm = (s) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
const brandKey = (b) => norm(BRANDS[String(b ?? "").trim().toLowerCase()] || b);
const money = (n) => Math.round(Number(n) * 100) / 100;
const num = (v) => { const n = Number(String(v ?? "").replace(/[^0-9.\-]/g, "")); return Number.isFinite(n) ? n : 0; };
const cellText = (v) => (v && typeof v === "object" ? (v.text ?? v.result ?? v.richText?.map((t) => t.text).join("") ?? "") : v ?? "");

// "P255/35R19", "LT265/70R17", "245/40ZR18", "35X1250R20", "33x12.50R20" -> { w, r, d }; truck sizes like 11R22.5 -> { w: 11, r: null, d: 22.5 }.
export function parseSize(s) {
  const t = String(s ?? "").toUpperCase().replace(/\s+/g, "").replace(/^(P|LT|ST)(?=\d)/, "").replace("ZR", "R");
  let m = t.match(/^(\d{2,3})(?:X|\/)(\d{2,4}(?:\.\d+)?)R(\d{2}(?:\.\d)?)$/);
  if (m) {
    let r = Number(m[2]);
    if (Number(m[1]) < 100 && r >= 100) r = r / 100; // 35X1250R20 -> 12.5
    return { w: Number(m[1]), r, d: Number(m[3]) };
  }
  m = t.match(/^(\d{1,2}(?:\.\d+)?)R(\d{2}(?:\.\d)?)$/);
  return m ? { w: Number(m[1]), r: null, d: Number(m[2]) } : null;
}
const sameSize = (a, b) => a && b && a.w === b.w && a.d === b.d && (a.r == null ? b.r == null || b.r === 0 : Math.abs(a.r - (b.r ?? -1)) < 0.01);

// "LX-Twenty 96W BLK 55K RH" -> { model: "LX-Twenty", load: "96", speed: "W" }
export function cleanModel(s) {
  let load = null, speed = null;
  const words = String(s ?? "").split(/\s+/).filter((w) => {
    const ls = w.match(/^(\d{2,3}(?:\/\d{2,3})?)([A-Z])$/);
    if (ls) { load = load ?? ls[1]; speed = speed ?? ls[2]; return false; }
    return !/^(BLK|BSW|OWL|RWL|MBW|BW|RH|XL|SL|\d{2,3}K|[A-H]|E1|LRE|LRC|LRD)$/i.test(w);
  });
  return { model: words.join(" ").trim(), load, speed };
}
const modelLike = (a, b) => {
  const x = norm(a), y = norm(b);
  if (!x || !y) return false;
  const n = Math.min(5, x.length, y.length);
  return x.startsWith(y.slice(0, n)) || y.startsWith(x.slice(0, n));
};
const pnLike = (a, b) => {
  const x = norm(a), y = norm(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const [s, l] = x.length < y.length ? [x, y] : [y, x];
  return s.length >= 6 && l.endsWith(s);
};

// Header texts by column number (exceljs rows are 1-based; "Quantity In-Stock \n(Required)" -> "quantity in-stock").
const headers = (row) => Array.from({ length: row.cellCount + 1 }, (_, i) => (i ? String(cellText(row.getCell(i).value)).split("\n")[0].trim().toLowerCase() : ""));

function readParts(ws) {
  const head = headers(ws.getRow(1));
  const col = (name) => head.findIndex((h) => h.startsWith(name));
  const c = {
    id: col("id"), brand: col("brand"), name: col("part name"), pn: col("part number"), alt: col("alternate part numbers"), type: col("part type"),
    qty: col("quantity in-stock"), cost: col("unit cost"), retail: col("retail price"), model: col("tire model"), w: col("tire width"), r: col("tire ratio"), d: col("tire diameter"),
  };
  if ([c.id, c.qty, c.cost, c.retail].some((i) => i < 1)) throw new Error("That isn't Tekmetric's Bulk Editor file (Inventory > Bulk Editor > Download).");
  const parts = [];
  ws.eachRow((row, n) => {
    if (n === 1) return;
    const v = (i) => cellText(row.getCell(i).value);
    if (!v(c.id)) return;
    parts.push({
      row: n, id: String(v(c.id)), brand: String(v(c.brand)), model: String(v(c.model) || v(c.name)), pn: String(v(c.pn)), alt: String(v(c.alt)),
      tire: String(v(c.type)).trim() === "Tire", size: { w: num(v(c.w)), r: v(c.r) === "" ? null : num(v(c.r)), d: num(v(c.d)) },
      qty: num(v(c.qty)), cost: num(v(c.cost)), retail: num(v(c.retail)),
    });
  });
  return { parts, c };
}

function findPart(parts, item) {
  const byPn = item.part_no ? parts.filter((p) => pnLike(p.pn, item.part_no) || p.alt.split(/[,;\s]+/).some((a) => pnLike(a, item.part_no))) : [];
  if (byPn.length === 1) return { part: byPn[0], how: "part #" };
  if (byPn.length > 1) return { options: byPn };
  const size = parseSize(item.size);
  if (!size) return {};
  const { model } = cleanModel(item.model);
  const close = parts.filter((p) => p.tire && brandKey(p.brand) === brandKey(item.brand) && sameSize(p.size, size) && modelLike(p.model, model));
  const exact = close.filter((p) => norm(p.model) === norm(model));
  if (exact.length === 1) return { part: exact[0], how: "brand, model, size" };
  if (close.length === 1) return { part: close[0], how: "brand, model, size" };
  if (close.length > 1) return { options: close };
  return {};
}

const isReturn = (read) => read?.is_invoice === false && /\bRMA|return/i.test(`${read.invoice_no} ${read.notes}`);

/**
 * uploads: invoice_uploads rows (with read), already filtered to "not entered, not a duplicate".
 * bulkEdit: Buffer of Tekmetric's Bulk Editor export.
 * -> { lines, updateFile, newFile, counts }   files are Buffers or null.
 */
export async function buildTekmetricFiles({ bulkEdit, uploads }) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(bulkEdit);
  const ws = wb.getWorksheet("Inventory Parts");
  if (!ws) throw new Error("That isn't Tekmetric's Bulk Editor file (it has no Inventory Parts sheet).");
  const { parts, c } = readParts(ws);

  const lines = [], changes = new Map(), newParts = new Map();
  for (const u of uploads) {
    const read = u.read || {};
    const kind = isReturn(read) ? "return" : read.is_invoice === false ? null : "receive";
    if (!kind) continue;
    for (const item of read.items || []) {
      const qty = Math.round(num(item.qty));
      const line = { upload_id: u.id, vendor: read.vendor || null, invoice_no: read.invoice_no || null, kind, qty, size: item.size, brand: item.brand, model: item.model, part_no: item.part_no || null, cost: item.unit_cost == null ? null : money(item.unit_cost) };
      if (!qty) { lines.push({ ...line, result: "check", why: "No quantity on this line." }); continue; }
      const m = findPart(parts, item);
      if (m.part) {
        const ch = changes.get(m.part.id) || { part: m.part, add: 0, cost: null };
        ch.add += kind === "return" ? -qty : qty;
        if (kind === "receive" && line.cost != null) ch.cost = line.cost;
        changes.set(m.part.id, ch);
        lines.push({ ...line, result: kind === "return" ? "remove" : "add", part: `${m.part.brand} ${m.part.model} ${m.part.pn}`.trim(), how: m.how, partId: m.part.id });
      } else if (m.options) {
        lines.push({ ...line, result: "check", why: `Could be ${m.options.length} different Tekmetric parts: ${m.options.slice(0, 3).map((p) => `${p.brand} ${p.model} ${p.pn}`.trim()).join("; ")}. Enter this one by hand.` });
      } else if (kind === "return") {
        lines.push({ ...line, result: "skip", why: "Not in Tekmetric, so there's nothing to take out." });
      } else {
        const size = parseSize(item.size);
        if (!size || line.cost == null || !item.brand) { lines.push({ ...line, result: "check", why: !size ? "Can't read the tire size." : line.cost == null ? "No cost on the invoice line." : "No brand." }); continue; }
        const key = `${norm(item.part_no) || ""}|${brandKey(item.brand)}|${norm(cleanModel(item.model).model)}|${item.size}`;
        const np = newParts.get(key) || { item, size, qty: 0, cost: line.cost, vendor: read.vendor };
        np.qty += qty; np.cost = line.cost;
        newParts.set(key, np);
        lines.push({ ...line, result: "new" });
      }
    }
  }

  // Update file: Tekmetric's export with only the changed rows, values edited in place.
  let updateFile = null;
  const touched = new Set([...changes.values()].map((ch) => ch.part.row));
  for (const ch of changes.values()) {
    const row = ws.getRow(ch.part.row);
    ch.after = Math.max(0, ch.part.qty + ch.add); // Tekmetric takes 0-10,000; a return can't take it below 0
    ch.short = ch.part.qty + ch.add < 0;
    row.getCell(c.qty).value = ch.after;
    if (ch.cost != null) { row.getCell(c.cost).value = ch.cost; row.getCell(c.retail).value = money(ch.cost * RETAIL_MARKUP); }
  }
  for (const l of lines) {
    const ch = l.partId && changes.get(l.partId);
    if (!ch) continue;
    l.before = ch.part.qty; l.after = ch.after;
    if (ch.short) l.why = `Tekmetric only shows ${ch.part.qty}, so this stops at 0. It may already be taken out.`;
  }
  if (touched.size) {
    for (let r = ws.rowCount; r >= 2; r--) if (!touched.has(r)) ws.spliceRows(r, 1);
    updateFile = Buffer.from(await wb.xlsx.writeBuffer());
  }

  // New parts file: Tekmetric's Bulk Upload template, header on row 2, parts from row 3.
  let newFile = null;
  if (newParts.size) {
    const tw = new ExcelJS.Workbook();
    await tw.xlsx.load(Buffer.from(TEMPLATE_XLSX_BASE64, "base64"));
    const sh = tw.getWorksheet("Add Parts Here");
    const head = headers(sh.getRow(2));
    const at = (name) => head.findIndex((h) => h.startsWith(name));
    const vendors = [];
    tw.getWorksheet("VendorList")?.eachRow((row) => vendors.push(String(cellText(row.getCell(1).value)).trim()));
    let r = 3;
    for (const np of newParts.values()) {
      const { model, load, speed } = cleanModel(np.item.model);
      const vendor = vendors.find((v) => v && v !== "N/A" && norm(np.vendor).includes(norm(v)));
      const truck = np.size.r == null; // 11R22.5 etc. don't fit Tekmetric's size fields: size goes in the model
      const set = (name, val) => { const i = at(name); if (i > 0 && val != null && val !== "") sh.getRow(r).getCell(i).value = val; };
      set("part type", "Tire"); set("vendor", vendor); set("brand", np.item.brand); set("part number", np.item.part_no);
      set("unit cost", np.cost); set("retail price", money(np.cost * RETAIL_MARKUP)); set("quantity in-stock", np.qty);
      set("tire model", truck ? `${model} ${np.item.size}`.trim() : model);
      if (!truck) { set("tire width", String(np.size.w)); set("tire ratio", np.size.r); set("tire diameter", np.size.d); }
      set("tire load index", load); set("tire speed rating", speed);
      r++;
    }
    newFile = Buffer.from(await tw.xlsx.writeBuffer());
  }

  const count = (k) => lines.filter((l) => l.result === k).length;
  return {
    lines, updateFile, newFile,
    counts: { parts: changes.size, add: count("add"), remove: count("remove"), new: newParts.size, check: count("check"), skip: count("skip"),
      tiresIn: lines.filter((l) => l.result === "add" || l.result === "new").reduce((s, l) => s + l.qty, 0),
      tiresOut: lines.filter((l) => l.result === "remove").reduce((s, l) => s + l.qty, 0) },
  };
}
