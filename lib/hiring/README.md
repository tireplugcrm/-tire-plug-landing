# The Tire Plug — Hiring System

A self-contained "weed-out" hiring funnel bolted onto tireplugla.com.
Designed to be liftable into Calle Systems later as a resellable feature.

## The funnel (each layer is a finer filter)

```
  tireplugla.com/careers   (applicant)
        │
        ├─ 1. ROLE + CONTACT
        ├─ 2. KNOCKOUT questions ──► fail = auto-rejected, AI never runs (cheap filter)
        ├─ 3. SITUATIONAL SURVEY (10 Qs) ──► AI grades each 0–5 ──► trait scores
        ├─ 4. RESUME (optional) ──► stored + AI review (human-read only, never auto-scores)
        │
        ▼
   Supabase  ──►  tireplugla.com/careers/admin   (owner: ranked list, flags, notes)
```

## Files

| File | What it does |
|------|--------------|
| `scoring-config.json` | **Tune everything here.** Gates (auto-DQ), traits, role weights, score bands. |
| `knockout.json` | The yes/no auto-reject requirements. Edit freely. |
| `questionnaire.json` | The 10 situational questions + answer keys. |
| `scoreAnswer.js` | AI-grades each free-text answer 0–5; rolls into trait scores. |
| `scoreCandidate.js` | Gates + weighted 0–100 strength score + band. |
| `analyzeDocument.js` | Reads resume/certs → highlights, red flags, references (review only). |
| `index.js` | Single import surface + `checkKnockout()`. |
| `schema.sql` | Run once in Supabase. |

## One-time setup

1. **Install deps:** `npm install`
2. **Supabase:** create a project → SQL Editor → paste `schema.sql` → Run.
   Then Storage → New bucket → name `resumes` → **Private**.
3. **Env vars** (`.env.local` locally, and in Vercel for production):
   - `ANTHROPIC_API_KEY` — from console.anthropic.com
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — Supabase → Settings → API
   - `CAREERS_ADMIN_PASSWORD` — anything strong; opens the dashboard
4. `npm run dev` → visit `/careers` to apply, `/careers/admin` to review.

## Notes
- If the AI key or Supabase isn't set yet, the app degrades gracefully — applicants
  still get a friendly response; nothing crashes.
- The service-role key bypasses security rules, so `lib/supabaseAdmin.js` is
  **server-only** (API routes). Never import it into a page/component.
- Resumes never change a score — they're stored for your eyes only.
