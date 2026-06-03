/**
 * Fetch ALL customers, paging past Supabase's ~1000-row read cap.
 * Pages by id (stable order) so no rows are skipped or duplicated at boundaries.
 */
import { supabaseAdmin } from "./supabaseAdmin.js";

export async function fetchAllCustomers(columns = "*") {
  const PAGE = 1000;
  const all = [];
  for (let from = 0; from <= 200000; from += PAGE) {
    const { data, error } = await supabaseAdmin
      .from("customers").select(columns).order("id", { ascending: true }).range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    all.push(...(data || []));
    if (!data || data.length < PAGE) break;
  }
  return all;
}
