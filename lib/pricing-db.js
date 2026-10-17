// The handful of table operations lib/pricing.js needs, over two backends:
//   supabaseDb(client) - production (service-role key, server only)
//   fileDb(path)       - local preview and tests: the same tables in one JSON file, so the whole
//                        pricing loop (stock sync, publish, undo, autopilot) runs without Supabase.
//
// select(table, { eq, in, order, desc, limit, columns }) -> rows
// upsert(table, rows, conflictColumns)                    -> rows written (merging into existing)
// insert(table, rows)                                     -> rows with generated ids
// update(table, patch, { eq, in })                        -> updated rows
// remove(table, { eq, in })

import fs from "node:fs";

export function supabaseDb(client) {
  const filtered = (q, { eq, in: inn } = {}) => {
    for (const [k, v] of Object.entries(eq || {})) q = v === null ? q.is(k, null) : q.eq(k, v);
    for (const [k, v] of Object.entries(inn || {})) q = q.in(k, v);
    return q;
  };
  const run = async (q, what) => {
    const { data, error } = await q;
    if (error) throw new Error(`${what}: ${error.message}`);
    return data || [];
  };
  return {
    kind: "supabase",
    async select(table, opts = {}) {
      // PostgREST caps a response at 1000 rows: page through bigger tables.
      const out = [];
      const limit = opts.limit ?? Infinity;
      for (let from = 0; out.length < limit; from += 1000) {
        let q = filtered(client.from(table).select(opts.columns || "*"), opts);
        if (opts.order) q = q.order(opts.order, { ascending: !opts.desc });
        const to = Math.min(from + 999, from + (limit - out.length) - 1);
        const rows = await run(q.range(from, to), `read ${table}`);
        out.push(...rows);
        if (rows.length < to - from + 1) break;
      }
      return out;
    },
    async upsert(table, rows, conflict) {
      if (!rows.length) return [];
      const out = [];
      for (let i = 0; i < rows.length; i += 500) {
        out.push(...await run(client.from(table).upsert(rows.slice(i, i + 500), { onConflict: conflict.join(",") }).select(), `save ${table}`));
      }
      return out;
    },
    async insert(table, rows) {
      return rows.length ? run(client.from(table).insert(rows).select(), `save ${table}`) : [];
    },
    async update(table, patch, where) {
      return run(filtered(client.from(table).update(patch), where).select(), `update ${table}`);
    },
    async remove(table, where) {
      await run(filtered(client.from(table).delete(), where), `delete from ${table}`);
    },
  };
}

// Primary keys of the pricing tables, for the file backend.
const KEYS = {
  tire_stock: ["id"], tire_prices: ["id"], site_prices: ["id"], app_settings: ["key"],
  pricing_rules: ["id"], pricing_drafts: ["id"], price_publishes: ["id"], site_changes: ["id"], agent_chats: ["id"],
};
const SERIAL = new Set(["pricing_rules", "pricing_drafts", "price_publishes", "site_changes"]);

export function fileDb(file) {
  const load = () => { try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return { tables: {}, seq: {} }; } };
  const save = (d) => fs.writeFileSync(file, JSON.stringify(d));
  const matches = (row, { eq, in: inn } = {}) =>
    Object.entries(eq || {}).every(([k, v]) => (row[k] ?? null) === v) &&
    Object.entries(inn || {}).every(([k, v]) => v.includes(row[k]));
  const same = (a, b, cols) => cols.every((c) => a[c] === b[c]);
  const withDefaults = (table, row, d) => {
    const r = { ...row };
    if (SERIAL.has(table) && r.id == null) r.id = d.seq[table] = (d.seq[table] || 0) + 1;
    if (table === "agent_chats" && !r.id) r.id = `c${Date.now()}${Math.random().toString(36).slice(2, 7)}`;
    if (!r.created_at && ["pricing_drafts", "price_publishes", "site_changes", "agent_chats"].includes(table)) r.created_at = new Date().toISOString();
    return r;
  };
  return {
    kind: "file",
    async select(table, opts = {}) {
      let rows = (load().tables[table] || []).filter((r) => matches(r, opts));
      if (opts.order) rows = rows.sort((a, b) => (a[opts.order] > b[opts.order] ? 1 : a[opts.order] < b[opts.order] ? -1 : 0) * (opts.desc ? -1 : 1));
      return rows.slice(0, opts.limit ?? Infinity).map((r) => ({ ...r }));
    },
    async upsert(table, rows, conflict) {
      const d = load();
      const t = (d.tables[table] ||= []);
      const out = rows.map((row) => {
        const i = t.findIndex((r) => same(r, row, conflict));
        if (i >= 0) { t[i] = { ...t[i], ...row }; return { ...t[i] }; }
        const r = withDefaults(table, row, d);
        t.push(r);
        return { ...r };
      });
      save(d);
      return out;
    },
    async insert(table, rows) {
      const d = load();
      const t = (d.tables[table] ||= []);
      const out = rows.map((row) => { const r = withDefaults(table, row, d); t.push(r); return { ...r }; });
      save(d);
      return out;
    },
    async update(table, patch, where) {
      const d = load();
      const out = [];
      for (const r of d.tables[table] || []) if (matches(r, where)) { Object.assign(r, patch); out.push({ ...r }); }
      save(d);
      return out;
    },
    async remove(table, where) {
      const d = load();
      d.tables[table] = (d.tables[table] || []).filter((r) => !matches(r, where));
      save(d);
    },
  };
}
export const TABLE_KEYS = KEYS;
