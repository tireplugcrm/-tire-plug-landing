# Ads Tab — Meta connection setup (Level 0, read-only)

This turns on the **📣 Ads** tab in your admin dashboard. It reads your Meta ad
performance (spend, results, cost-per-result) and shows a rough ROAS against your
booked leads. It is **read-only** — it can never spend money, pause, or change a
campaign. That's a later step.

**Good news:** because you're reading your *own* ad account, you do **NOT** need
Meta's slow "app review." You just need a token. ~15 minutes.

You need two values, both pasted into Vercel at the end:

| Value | What it is |
|---|---|
| `META_AD_ACCOUNT_ID` | Your ad account number — **886261905697554** (you already have this) |
| `META_ACCESS_TOKEN`  | A long-lived token that lets the dashboard *read* your ad stats |

---

## Part A — Create a Meta App (one time, ~3 min)
You only need this so Meta will hand you a token. It stays in "Development" mode —
no review, no public listing.

1. Go to **developers.facebook.com** → log in with the Facebook account that manages the Tire Plug ad account.
2. Top right **My Apps → Create App**.
3. If asked for a type, pick **Business**. Name it `Tire Plug Dashboard`. Create.
4. You can ignore all the product cards it offers. Done — leave it.

## Part B — Get a long-lived token (~8 min)
The cleanest, never-expiring way is a **System User** token in Business Settings.

1. Go to **business.facebook.com/settings** (Business Settings).
2. Left menu → **Users → System users**.
3. **Add** → name it `Ads Dashboard` → role **Admin** → Create.
4. With that system user selected, click **Assign assets** → **Ad accounts** →
   pick the Tire Plug ad account → turn on at least **View performance** (that's
   the `ads_read` permission) → Save.
5. Click **Generate new token**.
   - **App:** choose `Tire Plug Dashboard` (from Part A).
   - **Permissions:** check **`ads_read`**.
   - Generate → **copy the token** (long string). This is your `META_ACCESS_TOKEN`.
   - ⚠️ Copy it now — Meta won't show it again. Paste it somewhere safe for a minute.

> Quick-test alternative (token expires in ~1 hour, fine just to see it work):
> go to **developers.facebook.com/tools/explorer**, pick your app, add the
> `ads_read` permission, Generate Access Token, copy it. Use this only to confirm
> the tab works; replace it with the System User token above for the real thing.

## Part C — Put the two values in Vercel (~3 min)
1. Go to **vercel.com** → your `-tire-plug-landing` project → **Settings → Environment Variables**.
2. Add:
   - Name `META_ACCESS_TOKEN`  → Value: the token you copied. Environment: **Production**.
   - Name `META_AD_ACCOUNT_ID` → Value: `886261905697554`. Environment: **Production**.
3. **Redeploy** (Deployments → ⋯ on the latest → Redeploy). Env vars only take effect on a fresh deploy.

## Part D — Confirm
Open **tireplugla.com/admin → 📣 Ads**. You should see your spend, results, and
campaigns. If it still shows the yellow "connect" card, click **Check again**; if
it mentions the token, it likely expired (the Explorer one does) — use the System
User token from Part B.

---

### What this shows (and its one honest limit)
- **Ad spend / Results / Cost per result** — straight from Meta, accurate.
- **Blended ROAS** — all your *booked* web-lead revenue ÷ ad spend. It's a rough
  directional number: some of that revenue comes from Google or word-of-mouth,
  not only ads. **True per-ad attribution** (knowing exactly which ad drove each
  booking) is the next level — it needs click tracking (UTM/fbclid) added to leads.

### Optional
- `META_GRAPH_VERSION` — defaults to `v21.0`. Only set this if Meta later asks you
  to move to a newer API version.
