/**
 * Welcome email for new discount-popup subscribers, sent the moment they sign up.
 * Never throws: a failed welcome email must not fail the signup.
 * Edit WELCOME below to change the wording (no prices here; the tire cards carry real ones).
 */
import { renderPromo, sendOne, dealTires, unsubPageUrl, personalize, textVersion, suppressedSet } from "./email.js";

export const WELCOME = {
  subject: "Welcome to The Tire Plug, {name} 🛞",
  headline: "You're in",
  message: `Hey {name},

Thanks for joining The Tire Plug deals list. You'll be the first to hear about tire specials, oil change deals and alignment offers — no spam, just real deals.

Need tires now? Text or call us with your tire size (it's on the sidewall, like 225/65R17) and we'll send you three options — budget, mid-range and premium — usually within minutes.

Here are a few of this week's next-day tire deals:`,
};

export async function sendWelcomeEmail({ name, email }) {
  try {
    if (!process.env.RESEND_API_KEY) return;
    const to = String(email).trim().toLowerCase();
    if ((await suppressedSet()).has(to)) return;
    const unsubUrl = unsubPageUrl(to);
    const message = personalize(WELCOME.message, { name });
    const subject = personalize(WELCOME.subject, { name });
    const tires = dealTires().filter((t) => t.img).slice(0, 4).map((t) => t.id);
    await sendOne({
      to, subject, text: textVersion(message, unsubUrl),
      html: renderPromo({ subject, headline: WELCOME.headline, message, tires, unsubUrl, why: "You're getting this because you signed up at tireplugla.com." }),
      tags: { kind: "welcome" },
    });
  } catch (e) {
    console.error("Welcome email error (non-blocking):", e);
  }
}
