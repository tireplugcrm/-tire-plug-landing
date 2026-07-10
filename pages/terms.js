import React from "react";
import { Legal, P, H, B, A, Ul } from "./privacy";

export default function Terms() {
  return (
    <Legal title="Terms of Service" updated="May 31, 2026">
      <P>
        Welcome to The Tire Plug. By using our website (tireplugla.com) and submitting a request, you
        agree to these Terms of Service. If you do not agree, please do not use the site.
      </P>

      <H>Services & quotes</H>
      <P>
        Quotes provided through our website, text, or email are estimates based on the information you
        give us and may change after we inspect your vehicle or confirm parts availability and pricing.
        Submitting a form is a request for service or a quote, not a confirmed appointment until we
        contact you to schedule.
      </P>

      <H>Text messaging program</H>
      <P>
        By providing your phone number and opting in, you agree to receive text messages from The Tire
        Plug about your quote, appointment, service reminders, and promotions. Message frequency varies.
        Message and data rates may apply. Reply <B>STOP</B> to opt out at any time, or <B>HELP</B> for
        help. Consent to texts is not a condition of any purchase. See our <A href="/privacy">Privacy Policy</A>
        for how we handle your information.
      </P>

      <H>Your responsibilities</H>
      <Ul items={[
        "Provide accurate vehicle and contact information",
        "Only submit a phone number that you own or are authorized to use",
        "Show up for, or cancel, scheduled appointments in good faith",
      ]} />

      <H>Limitation of liability</H>
      <P>
        Our website and communications are provided “as is.” To the fullest extent allowed by law, The
        Tire Plug is not liable for indirect or incidental damages arising from use of the website or
        reliance on estimated quotes.
      </P>

      <H>Contact us</H>
      <P>
        The Tire Plug<br />
        Phone: <A href="tel:562-500-4625">562-500-4625</A><br />
        Email: <A href="mailto:tiredepotplug@gmail.com">tiredepotplug@gmail.com</A>
      </P>
    </Legal>
  );
}
