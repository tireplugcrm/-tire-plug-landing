# Texting (SMS) — Final Setup Reference

> Account identifiers and shared secrets are deliberately NOT written here.
> GitHub push protection blocked this file once, which is the system working:
> a setup note in a repo is not a password manager. Real values live in Vercel
> environment variables.

Two-way texting for the leads dashboard runs through **Twilio**. This is the
one-page record of the correct accounts, numbers, and URLs.

## The correct Twilio account
- **Account SID:** `AC… (see Vercel env: TWILIO_ACCOUNT_SID)`
- **Auth Token:** *(secret — stored in `.env.local` and in Vercel, not written here)*
- **Sending number:** **+1 323-328-8219** (the number Alex bought)
- **Messaging Service:** "The Tire Plug Texts" (`MG… (see Vercel env)`)
- **A2P Brand:** APPROVED ✅
- **A2P Campaign:** RESUBMITTED 2026-06-02 as **Low Volume Mixed** and now IN REVIEW.
  - The earlier "Marketing" submission was **rejected** (error 30886 — the use case
    didn't match the actual messages, which are mostly quotes/reminders, not promos).
    Refiled under "Low Volume Mixed" with a tightened description + matching samples.
  - Texting to customers stays carrier-filtered until this shows **Approved/Verified**.

> ⚠️ Ignore the *other* Twilio account (SID `AC… (see Vercel env)…`, trial number 886-3555,
> created May 19). It was wired in by mistake early on and has no brand/campaign.
> The account above is the real one.

## Vercel environment variables (production)
Set these in Vercel → Settings → Environment Variables:

| Key | Value |
|---|---|
| `TWILIO_ACCOUNT_SID` | `AC… (see Vercel env: TWILIO_ACCOUNT_SID)` |
| `TWILIO_AUTH_TOKEN` | *(the auth token)* |
| `TWILIO_PHONE_NUMBER` | `+13233288219` |
| `TWILIO_INBOUND_SECRET` | `(see Vercel env: TWILIO_INBOUND_SECRET)` |

## Inbound replies webhook
Set on the **Messaging Service** (not the number):
Messaging → Services → "The Tire Plug Texts" → **Integration** → **Send a webhook** →
Request URL (HTTP POST):
```
https://tireplugla.com/api/admin/sms-inbound?token=(see Vercel env: TWILIO_INBOUND_SECRET)
```

## How texting works in the app
- **Send:** lead drawer → "Text messages" box, or the "📲 Text quote" button →
  `/api/admin/send-sms` → Twilio → logged to the conversation.
- **Receive:** customer reply → Twilio → `/api/admin/sms-inbound` → saved to the
  lead's conversation (matched by phone) + shows a 💬 unread badge.

## Go-live checklist
- [x] Correct Twilio account identified + number 323-328-8219
- [x] A2P Brand approved
- [x] Vercel keys updated to the correct account
- [x] Inbound webhook set on the Messaging Service
- [x] A2P Campaign resubmitted as Low Volume Mixed (2026-06-02) — in review
- [ ] **A2P Campaign approved** ← waiting on carriers
- [ ] Live end-to-end test text (do once campaign is approved)
