# The Tire Plug — Shop OS · Master Build Plan 🛞

**The north star:** one system that runs the whole company on the backend — every lead,
conversation, quote, order, dollar, and staff member flowing through ONE data core, with
an AI agent in every department and a **CEO agent** on top telling you where you're leaking
money and where to scale. The Tire Plug is the business *and* the live demo; once proven,
it's a productized "Shop OS" Calle Systems can resell to other shops.

The rule (Alex's insight): **departments live inside each other.** Build the data pipes
first; the AI agents get smarter as more pipes connect.

---

## The architecture

```
                         🧠 CEO AGENT
        "where are we leaking money · where do we scale"
                              ▲
   ┌──────────┬───────────┬───┴────┬──────────┬───────────┐
 Marketing   Sales     Operations  Finance   People/HR   Management
  agent      agent       agent      robot      agent     (scoreboard)
   └──────────┴───────────┴────────┴──────────┴───────────┘
                              ▼
                       ONE DATA CORE
        (customers · leads · conversations · quotes · orders · $$$)
              ▲              ▲                    ▲
        ┌─────┴────┐   ┌─────┴─────┐       ┌──────┴──────┐
   CHANNELS IN     ORDERS IN          AD SPEND IN
   IG DM · SMS ·   TireBase           Meta · Google · TikTok
   phone · forms · (orders, clients,  (daily spend → ROAS)
   email           history — NOT inventory)
```

- **Inventory lives in OUR system** (Inventory / Stock / Stock Entry) — TireBase inventory isn't trusted.
- **TireBase = orders, client list, order history** → feeds revenue, customer history, finance.
- **Channels are native:** an Instagram DM is handled *inside the DM* (no form, no redirect) —
  same AI greet → quote → follow-up engine as SMS, just over Instagram.

---

## The departments (with AI agents)

### 📣 Marketing
- Unified lead inbox: **IG DM · SMS · phone · web form · email**, each tagged by source
- AI ad copy: TPMS / alignment / upsell / tire / story ads
- Ad-spend connect (Meta · Google · TikTok) → **true cost-per-lead + ROAS per channel**
- Auto Google-review requests · referral program · email/SMS blasts (blasts ✅ done)

### 💰 Sales
- Quote builder + AI quotes + follow-ups + pipeline ✅ (built)
- **AI receptionist (text, off-hours)** — auto-greet/qualify/quote 24/7, hand off in AM
- **AI voice receptionist** (phone, off-hours) — bigger build
- Same engine running natively inside **Instagram & TikTok** leads

### 🔧 Operations
- Work orders / shop-floor status (Waiting → In Bay → Done), per location
- Daily goals: tires, alignments, TPMS, brakes, oil (✅ designed by Alex)
- Inventory + Stock (own system)

### 🧾 Finance (the "Finance robot")
- Revenue, costs, net profit, margin, payments by method (cash/card/zelle/check)
- Reads TireBase orders + business costs → flags low-margin work, leaks

### 👥 People / HR
- AI hiring funnel ✅ (built) → staff scheduling, shift reminders, payroll prep, performance

### 📊 Management — the Company Scoreboard
- Alex's Daily-Goals format applied to **every department** (goal vs actual bars)
- Per-location (Olympic vs Manchester) + per-staff performance
- **CEO agent banner** narrating it in plain English

### 🧠 CEO Agent
- Reads every department at once → "Kill Google Ads (0 booked). Scale TikTok (17x).
  40% of IG leads going cold — turn on the AI receptionist. Olympic 2x Manchester."

---

## How a finalized order flows (the loop)
```
TireBase order finalized (4 tires, 1 alignment, 2 TPMS, oil change, $X, cash, Jonathan)
  → revenue +$X · tires +4 · alignments +1 · TPMS +2 · oil +1 · invoices +1
  → staff: Jonathan +$X · payments: cash +$X · net profit recalculated
  → matches CRM lead by name/phone → lead flips to ✓ Booked/Won (+$X)
  → feeds conversion rate, revenue-by-source, customer history, CEO agent
```

---

## Build order (prove-as-we-go, like everything so far)

**Phase 0 — DONE ✅** CRM, quoting, AI assistant, two-way SMS, email, follow-ups,
revenue tracking, Google login + access codes, Recently Active board.

**Phase 1 — Connect the money + the #1 channel** · _status as of 2026-06-02 (audited live)_
1. 🔌 **TireBase integration** (orders, clients, history) → revenue/finance/customer data
   - ✅ **LIVE** — API connected, pulling real orders (~187 invoices/wk). Revenue, payments, service counts all working off real data.
   - ⚠️ Staff leaderboard blank — TireBase returns no salesperson/technician name on any row.
   - ⚠️ Two locations merged — all orders are `store_id=1`; Olympic vs Manchester only appear as text tags in line descriptions. Per-location split not built yet.
2. 📸 **Instagram native DM** → biggest traffic source, AI handled in-DM
   - ✅ Capture works — token valid (@tireplugcali), webhook subscribed to `messages`, inbound DMs log to a lead.
   - ⚠️ Proven only with a synthetic test DM — no real customer DM through Meta yet; verify app is in Live mode + token refresh (~60-day expiry).
   - ⛔ **AI in-DM engine NOT built** — DMs are logged + replied to manually; no auto greet/quote/follow-up yet.
3. 📊 **Company Scoreboard** + first CEO-agent summary
   - ✅ Scoreboard LIVE (real revenue/payments/services). ✅ CEO agent LIVE (AI briefing off real register + CRM).
   - ⚠️ Order→lead auto-close loop is built but **has never fired** — CRM has only ~10 (test) leads, 0 booked, none match a TireBase customer by phone. CEO agent's CRM numbers (booked/mo, revenue-by-source) show 0 until real leads flow in.

> **Phase 1 takeaway:** the money side (TireBase → scoreboard → CEO agent) is genuinely live on real data. The customer side is empty — built but with no real leads in it. Highest-leverage next move: get real customers into the CRM (IG/SMS) so the loop closes and the CEO agent's full picture lights up.

**Phase 2 — Coverage + growth**
4. 🤖 **AI receptionist (text, off-hours)**
5. ⭐ **Auto review requests** + referrals
6. 💵 **Ad-spend connect** (Meta/Google/TikTok) → ROAS in the scoreboard

**Phase 3 — Operations + retention**
7. 🔧 Work orders / shop-floor board
8. 👤 Customer portal · 📞 AI voice receptionist · win-back

**Phase 4 — Productize**
9. 🏢 Multi-tenant + billing → sell "Shop OS" via Calle Systems

---

## Prerequisites — Phase 1 status

- [x] **TireBase API + key** — connected and live (key in `.env.local`, `lib/tirebase.js`)
- [x] **Dashboard code** — lives in this repo at `pages/admin` (Scoreboard + CEO agent tabs)
- [x] **Instagram** — connected as a professional (Creator) account @tireplugcali via Instagram-login API; webhook live
- [ ] **Real leads in the CRM** — the missing fuel: order→lead loop + CEO agent's CRM view stay empty until real IG/SMS customers flow in
- [ ] **Staff attribution source** — decide how a sale maps to an employee (TireBase doesn't provide it)
- [ ] **Location split** — decide how Olympic vs Manchester are distinguished (both are `store_id=1` in TireBase)
- [ ] Later (Phase 2): **Meta Ads, Google Ads, TikTok Ads** account access for spend/ROAS
- [x] Confirmed: inventory stays in our own system ✅ (TireBase = orders/clients only)

**Open decisions blocking full Phase 1:** real-lead capture (IG AI engine), staff attribution, location split.
