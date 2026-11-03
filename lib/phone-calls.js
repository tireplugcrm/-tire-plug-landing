// Phone AI (Mary) call records: turns ElevenLabs' post-call webhook into a phone_calls row
// (lib/phone-calls-schema.sql), and sums rows into the Admin → Phone report.
// What happened (quotes, bookings, leads, texts, transfers) is read from the agent's own tool calls,
// so those numbers are exact. Intent, upsells and objections are ElevenLabs' read of the call
// (DATA_FIELDS), and quality is its grading against QUALITY_CHECKS. Both lists are sent to the
// agent by scripts/voice-agent-setup.mjs, so they live here once.

// ElevenLabs data collection: what to pull out of every call (max 25 on our plan).
export const DATA_FIELDS = {
  intent: ["string", "Main reason for the call, exactly one of: new_tires, used_tires, alignment_only, flat_repair, other_service, existing_job, business, vendor, other. alignment_only = they only wanted an alignment or asked only about alignment."],
  caller_name: ["string", "Caller's first name if they gave it, else empty."],
  vehicle: ["string", "Year make model (and trim) if mentioned, else empty."],
  tire_size: ["string", "Tire size discussed, like 235/40R19, else empty."],
  urgency: ["string", "How soon they need it, one of: today, this_week, shopping, unknown."],
  language: ["string", "Language of the call: en or es."],
  alignment_offered: ["boolean", "Did the agent offer or recommend a wheel alignment?"],
  alignment_accepted: ["boolean", "Did the caller agree to add an alignment?"],
  alignment_question: ["boolean", "Did the caller ask anything about alignments (price, need, time)?"],
  used_tire_request: ["boolean", "Did the caller ask about used tires?"],
  used_tire_size: ["string", "Size they wanted in used tires, if any."],
  objection: ["string", "Main objection the caller raised, one of: price, thinking, walk_in, timing, other, none."],
  lost_reason: ["string", "If no appointment was booked: why not, in under 10 words. Empty if booked."],
  transfer_reason: ["string", "If the call was transferred to a person: why, in under 10 words. Else empty."],
};

// ElevenLabs evaluation criteria: the sales checklist each call is graded on.
// "unknown" (didn't apply to this call) doesn't count for or against the score.
export const QUALITY_CHECKS = {
  greeting_name: ["Greeting and name", "The agent greeted the caller and asked for their name once (not repeatedly), then used it. Unknown if the caller hung up before it could."],
  found_need: ["Found the need", "Before quoting, the agent learned what the caller needs and how soon. Unknown for calls that weren't about buying anything."],
  accurate_quote: ["Accurate quote", "Every price the agent said came from a check_tires result or the shop's listed prices, and it never invented a price, stock, time or promise. Unknown if no price came up."],
  asked_for_booking: ["Asked for the appointment", "The agent asked for the appointment with specific time choices (not just 'want to book?'). Unknown for existing-job, vendor or wrong-number calls."],
  offered_upsell: ["Offered an add-on", "For a tire sale, the agent offered an alignment (or TPMS/road hazard where it fit). Unknown if no tires were discussed."],
  handled_objection: ["Handled objections", "When the caller hesitated (price, thinking it over, walk-in), the agent answered it and tried once more to book or saved a lead. Unknown if there was no objection."],
  captured_contact: ["Captured the customer", "A buying caller ended up booked or saved as a lead with name and number. Unknown for calls that weren't sales."],
  short_clear: ["Short and clear", "The agent asked one question at a time, kept replies short, and didn't talk over or repeat itself."],
  friendly: ["Friendly and confident", "The agent sounded friendly, confident and helpful, never pushy or robotic, and the caller didn't get frustrated with it."],
};

const bool = (v) => (v === true || v === "true" ? true : v === false || v === "false" ? false : null);
const str = (v) => (v == null || v === "" || v === "null" ? null : String(v).trim() || null);
const json = (s) => { try { return typeof s === "string" ? JSON.parse(s) : s; } catch { return null; } };

export function rowFromCall(d) {
  const t = d.transcript || [];
  const calls = t.flatMap((x) => x.tool_calls || []);
  const results = t.flatMap((x) => x.tool_results || []);
  const ok = (name) => results.filter((r) => r.tool_name === name && !r.is_error).map((r) => ({ ...r, value: json(r.result_value) || {} })).filter((r) => r.value.ok !== false);

  const quotes = ok("check_tires").map((r) => ({ size: r.value.size, in_stock: r.value.in_stock || [], next_day: r.value.next_day || [] })).filter((q) => q.size);
  const prices = quotes.flatMap((q) => [...q.in_stock, ...q.next_day].map((x) => x.price)).filter((p) => p != null);
  const bookCall = calls.filter((c) => c.tool_name === "book_appointment").pop();
  const booked = ok("book_appointment").pop();
  const bp = booked && bookCall ? json(bookCall.params_as_json) || {} : null;
  const booking = booked ? { when: booked.value.when, tire: bp?.tire || null, price: bp?.price ?? null, quantity: bp?.quantity ?? null, size: bp?.size || null, availability: bp?.availability || null, service: bp?.service || null } : null;

  const dc = Object.fromEntries(Object.entries(d.analysis?.data_collection_results || {}).map(([k, v]) => [k, v?.value]));
  const ev = d.analysis?.evaluation_criteria_results || {};
  const graded = Object.values(ev).filter((e) => e.result === "success" || e.result === "failure");
  const waits = t.filter((x) => x.role === "agent").map((x) => x.conversation_turn_metrics?.metrics?.convai_ttf_audio_since_silence?.elapsed_time).filter((w) => w > 0 && w < 10);
  const caller = String(d.metadata?.phone_call?.external_number || d.conversation_initiation_client_data?.dynamic_variables?.system__caller_id || "").replace(/\D/g, "").slice(-10) || null;

  return {
    id: d.conversation_id,
    started_at: new Date((d.metadata?.start_time_unix_secs || Date.now() / 1000) * 1000).toISOString(),
    duration_secs: d.metadata?.call_duration_secs ?? null,
    caller,
    caller_name: str(dc.caller_name) || bp?.name || null,
    status: d.status || null,
    ended_by: d.metadata?.termination_reason || null,
    intent: str(dc.intent),
    vehicle: str(dc.vehicle) || bp?.vehicle || null,
    tire_size: quotes[0]?.size || str(dc.tire_size),
    urgency: str(dc.urgency),
    language: str(dc.language),
    quoted: quotes.length > 0,
    quotes: quotes.length ? quotes : null,
    in_stock: quotes.length ? quotes.some((q) => q.in_stock.length > 0) : null,
    lowest_quote: prices.length ? Math.min(...prices) : null,
    booked: !!booked,
    booking,
    booked_value: booking?.price ? booking.price * (booking.quantity || 4) : null,
    lead_saved: ok("save_lead").length > 0,
    text_sent: ok("text_link").length > 0,
    transferred: calls.some((c) => c.tool_name === "transfer_to_number"),
    transfer_reason: str(dc.transfer_reason),
    alignment_offered: bool(dc.alignment_offered),
    alignment_accepted: bool(dc.alignment_accepted),
    alignment_question: bool(dc.alignment_question),
    used_tire_request: bool(dc.used_tire_request),
    used_tire_size: str(dc.used_tire_size),
    objection: str(dc.objection),
    lost_reason: booked ? null : str(dc.lost_reason),
    quality_score: graded.length ? Math.round((100 * graded.filter((e) => e.result === "success").length) / graded.length) : null,
    quality: Object.keys(ev).length ? Object.fromEntries(Object.entries(ev).map(([k, e]) => [k, { result: e.result, rationale: e.rationale }])) : null,
    summary: d.analysis?.transcript_summary || null,
    transcript: t.map((x) => ({ role: x.role, at: x.time_in_call_secs, text: x.message || "", tools: (x.tool_calls || []).map((c) => c.tool_name) })),
    data: dc,
    cost_credits: d.metadata?.cost ?? null,
    avg_wait_secs: waits.length ? Math.round((100 * waits.reduce((a, b) => a + b, 0)) / waits.length) / 100 : null,
  };
}

// The Admin → Phone report for a set of calls.
const pct = (a, b) => (b ? Math.round((100 * a) / b) : null);
export function report(rows) {
  const sales = rows.filter((r) => r.quoted || r.booked || ["new_tires", "used_tires", "alignment_only", "flat_repair", "other_service"].includes(r.intent));
  const tireSales = rows.filter((r) => r.quoted || r.intent === "new_tires");
  const count = (key, list = rows) => {
    const m = new Map();
    for (const r of list) { const v = typeof key === "function" ? key(r) : r[key]; if (v) m.set(v, (m.get(v) || 0) + 1); }
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([name, n]) => ({ name, n }));
  };
  const scored = rows.filter((r) => r.quality_score != null);
  const checks = Object.fromEntries(Object.entries(QUALITY_CHECKS).map(([k, [label]]) => {
    const g = rows.map((r) => r.quality?.[k]?.result).filter((x) => x === "success" || x === "failure");
    return [k, { label, pass: g.filter((x) => x === "success").length, of: g.length, rate: pct(g.filter((x) => x === "success").length, g.length) }];
  }));
  return {
    calls: rows.length,
    minutes: Math.round(rows.reduce((a, r) => a + (r.duration_secs || 0), 0) / 60),
    salesCalls: sales.length,
    booked: rows.filter((r) => r.booked).length,
    bookRate: pct(rows.filter((r) => r.booked).length, sales.length),
    bookedValue: rows.reduce((a, r) => a + (r.booked_value || 0), 0),
    leads: rows.filter((r) => r.lead_saved).length,
    lost: sales.filter((r) => !r.booked && !r.lead_saved).length,
    quoted: rows.filter((r) => r.quoted).length,
    quotedNotInStock: count((r) => (r.quoted && r.in_stock === false ? r.tire_size : null)),
    sizes: count("tire_size", rows.filter((r) => r.quoted)),
    alignment: {
      offered: tireSales.filter((r) => r.alignment_offered).length,
      accepted: rows.filter((r) => r.alignment_accepted).length,
      of: tireSales.length,
      offerRate: pct(tireSales.filter((r) => r.alignment_offered).length, tireSales.length),
      questions: rows.filter((r) => r.alignment_question).length,
      onlyCalls: rows.filter((r) => r.intent === "alignment_only").length,
    },
    used: { requests: rows.filter((r) => r.used_tire_request).length, sizes: count("used_tire_size", rows.filter((r) => r.used_tire_request)) },
    intents: count("intent"),
    objections: count((r) => (r.objection && r.objection !== "none" ? r.objection : null)),
    lostReasons: count("lost_reason", sales.filter((r) => !r.booked)),
    transfers: rows.filter((r) => r.transferred).length,
    texts: rows.filter((r) => r.text_sent).length,
    quality: scored.length ? Math.round(scored.reduce((a, r) => a + r.quality_score, 0) / scored.length) : null,
    checks,
    avgWait: (() => { const w = rows.map((r) => r.avg_wait_secs).filter(Boolean); return w.length ? Math.round((100 * w.reduce((a, b) => a + b, 0)) / w.length) / 100 : null; })(),
    credits: rows.reduce((a, r) => a + (r.cost_credits || 0), 0),
  };
}
