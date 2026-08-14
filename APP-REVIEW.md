# Instagram App Review — submission package (copy/paste)

App: **The Tire Plug** · Use case: Manage messaging & content on Instagram
Goal: get **Advanced Access** to messaging permissions so any customer's DM is delivered.

> Only request the permissions you actually use. This app does **messaging only**, so
> request **instagram_business_basic** + **instagram_business_manage_messages**. If the
> review flow also lists **instagram_manage_comments** and it's optional, leave it out
> (requesting permissions you don't use gets rejected).

---

## What the app does (the 1-paragraph summary Meta wants)
The Tire Plug is a private operations dashboard for a single tire shop. The shop connects
its own Instagram business account (@tireplugcali) via Instagram business login. When a
customer sends the shop a Direct Message on Instagram, our app receives it, creates a lead
in the shop's CRM, and shows the conversation to shop staff, who reply to the customer
directly from the dashboard. It lets a small shop handle Instagram customer inquiries
(tire quotes, appointments) in one place. The app only accesses the connected business
account and the people who message it.

---

## Permission justifications

**instagram_business_basic**
> We use instagram_business_basic to read the connected Instagram business account's basic
> profile (account ID and username) and the display name of users who message the business.
> This lets us confirm which account is connected and label incoming message threads with
> the sender's name in the shop's dashboard. We do not access any data beyond the connected
> business account and the people who message it.

**instagram_business_manage_messages**
> We use instagram_business_manage_messages so the tire shop can read Direct Messages sent
> to its own Instagram business account and reply to them from our dashboard. When a customer
> DMs the shop, our webhook receives the message, creates a lead in the shop's CRM, and shows
> the conversation to staff, who reply directly from the dashboard. This is core to the app:
> it lets the shop manage Instagram customer inquiries (quotes, appointments) in one inbox.
> We only access messages sent to the connected business account, used solely to display and
> respond to those conversations.

---

## Reviewer instructions (how it works / how to verify)
> This app is an internal tool for one business (The Tire Plug) to manage its own Instagram
> DMs. Flow:
> 1. The business connects its own Instagram business account (@tireplugcali) via Instagram
>    business login (already connected).
> 2. A customer sends a Direct Message to @tireplugcali on Instagram.
> 3. Our webhook (https://tireplugla.com/api/ig/webhook) receives the message; it appears as
>    a lead and conversation in the business dashboard (Leads tab → an "Instagram" conversation).
> 4. Shop staff type a reply in the dashboard and it is sent to the customer through the
>    Instagram messaging API.
> The attached screen recording demonstrates this end-to-end.

---

## Demo video — shot list (record on your phone/screen, ~60–90 sec)
1. **Instagram app:** from a second account, send a DM to @tireplugcali — e.g. "Do you have
   225/45R17 in stock?"
2. **Dashboard (tireplugla.com/admin → Leads):** show the new 📸 Instagram lead appear with
   that message.
3. **Open the conversation**, type a reply ("Yes! We have them — want to come by today?"),
   hit **Send**.
4. **Back to Instagram:** show the reply arrived in the DM thread.
That single clip proves both permissions in action.

---

## Notes
- The demo needs ONE real DM round-trip. In dev mode that means the sender is a tester
  account; add a second IG as an Instagram Tester (App roles → Roles) to record it.
- "Business and access verification" (checklist step 4) may just be confirming business
  details — the Security Center said full org verification isn't required for this case.
