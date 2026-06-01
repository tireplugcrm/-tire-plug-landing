# Tire Plug Leads Dashboard — Setup Guide

This is the new customer-side dashboard at **tireplugla.com/admin**. It uses your
**same hiring password**. It shows everyone who fills out the booking form (Leads)
and the discount popup (Subscribers), lets you email them, and catches their replies.

Your existing GoHighLevel flow is **untouched** — leads still go to GHL exactly as
before. This just *also* saves a copy into your own database so you can see them.

---

## What you need to do (one-time)

### 1. Create the database tables  ✅ required for anything to show up
1. Go to your Supabase project → **SQL Editor** → **New query**.
2. Open the file `lib/crm-schema.sql` from this project, copy everything, paste it in.
3. Click **Run**. (Safe to run more than once.)

That's it for Leads + Subscribers. They'll start filling up as people use the site.

### 2. Turn on email sending  (for the Email tab)
1. In **Resend** → API Keys → copy your key.
2. Add it to your environment as `RESEND_API_KEY` (locally it's in `.env.local`;
   for the live site, add it in **Vercel → Settings → Environment Variables**).
3. Make sure your sending domain is **verified in Resend** (so mail can come from
   `deals@tireplugla.com`). If you'd rather send from a different address, change
   `RESEND_FROM`.
4. Redeploy (Vercel does this automatically when you add a variable and save).

Until `RESEND_API_KEY` is set, the Email tab politely says email isn't set up yet —
nothing breaks.

### 3. (Optional) Catch replies inside the dashboard  (Replies tab)
Sending works without this. This step makes customer **replies** show up in the
Replies tab instead of only in your Gmail.

1. Pick any random secret word/number and set it as `RESEND_INBOUND_SECRET`.
2. In Resend, set up **Inbound** email and point the webhook to:
   `https://tireplugla.com/api/admin/inbound?token=YOUR_SECRET`
   (use the exact same secret as step 1).
3. Add the **MX record** Resend gives you to your domain's DNS.

Even without this, no reply is ever lost — every email's **Reply-To** is your Gmail
(`tiredepotplug@gmail.com`), so replies always reach you.

---

## The environment variables (summary)

| Variable | What it's for | Already set? |
|---|---|---|
| `SUPABASE_URL` | Your database | ✅ yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Your database | ✅ yes |
| `CAREERS_ADMIN_PASSWORD` | Login for /admin AND /careers/admin | ✅ yes |
| `RESEND_API_KEY` | Sending email | ⬜ add this |
| `RESEND_FROM` | The "from" address | default provided |
| `RESEND_REPLY_TO` | Where replies go | default = your Gmail |
| `RESEND_INBOUND_SECRET` | Catching replies in-dashboard | ⬜ optional |

Remember: anything you set locally in `.env.local` must **also** be added in Vercel
for the live site.

---

## How it all fits together

- **Booking form** (`components/BookingForm.js`) → `/api/submit-booking` →
  GoHighLevel **+** your `leads` table.
- **Discount popup** (`components/PromoPopup.js`) → `/api/submit-booking` →
  GoHighLevel **+** your `subscribers` table.
- **Dashboard** (`/admin`) reads everything via `/api/admin/data`.
- **Email tab** → `/api/admin/send-email` → Resend → logged in `email_campaigns`.
- **Replies** → Resend inbound → `/api/admin/inbound` → `email_replies` table.
