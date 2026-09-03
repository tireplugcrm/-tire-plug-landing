import Head from "next/head";
import Script from "next/script";

/*
  Text-message consent page.

  WHY THIS PAGE EXISTS AND WHY IT IS EMPTY
    A2P 10DLC registration asks the business to attest that the chat widget is
    the ONLY thing collecting phone numbers for SMS consent on the page the
    carriers are given. That is not true of tireplugla.com — the homepage
    renders QuoteByText, and /sms has its own opt-in form. Ticking that box
    against either would be signing something untrue to a carrier, and those
    attestations get audited after complaints.

    So this page carries the widget and nothing else. No booking form, no promo
    popup, no quote block, no second input anywhere. That makes the attestation
    honest, which is the only reason to have it.

  WHY THE WIDGET LOADS HERE AND NOT IN _app
    Loading it site-wide would put a second consent collector on every page
    that already has a form, which is the exact problem this page exists to
    avoid. It is scoped to this route deliberately — do not move it.
*/

const GHL_WIDGET_ID =
  process.env.NEXT_PUBLIC_GHL_WIDGET_ID ?? "6a99f879ba70a028e7bf1226";

const wrap = {
  maxWidth: 680,
  margin: "0 auto",
  padding: "64px 24px 96px",
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
  color: "#111",
  lineHeight: 1.6,
};

export default function TextUs() {
  return (
    <>
      <Head>
        <title>Text The Tire Plug — SMS consent</title>
        <meta
          name="description"
          content="Start a text conversation with The Tire Plug about tires, pricing or an appointment."
        />
      </Head>

      <main style={wrap}>
        <h1 style={{ fontSize: 32, lineHeight: 1.15, margin: "0 0 16px" }}>
          Text The Tire Plug
        </h1>

        <p style={{ fontSize: 18, margin: "0 0 24px" }}>
          Use the chat button on this page to start a text conversation with our
          shop about tires, pricing, or booking an appointment.
        </p>

        <h2 style={{ fontSize: 20, margin: "32px 0 8px" }}>
          What you are agreeing to
        </h2>
        <p style={{ margin: "0 0 16px" }}>
          By giving us your mobile number here, you agree to receive text
          messages from The Tire Plug about your enquiry — tire pricing,
          availability, appointment times and reminders. These are replies to a
          conversation you started. We do not send marketing or promotional
          texts to numbers collected here, and we never sell or share your
          number with anyone for their own marketing.
        </p>

        <ul style={{ margin: "0 0 24px", paddingLeft: 22 }}>
          <li>Message frequency varies, based on your conversation with us.</li>
          <li>Message and data rates may apply.</li>
          <li>
            Reply <strong>STOP</strong> at any time to stop receiving messages.
          </li>
          <li>
            Reply <strong>HELP</strong> for help, or call the shop during
            opening hours.
          </li>
          <li>Consent is not a condition of any purchase.</li>
        </ul>

        <p style={{ margin: "0 0 32px" }}>
          See our{" "}
          <a href="/privacy" style={{ color: "#0071c5" }}>
            Privacy Policy
          </a>{" "}
          and{" "}
          <a href="/terms" style={{ color: "#0071c5" }}>
            Terms of Service
          </a>
          .
        </p>

        <p style={{ fontSize: 14, color: "#666", margin: 0 }}>
          The Tire Plug · Olympic Blvd, Los Angeles
        </p>
      </main>

      {/*
        The only thing on this page that collects a phone number. Scoped to
        this route on purpose — see the note at the top of the file.
      */}
      {GHL_WIDGET_ID && (
        <Script
          id="ghl-chat-widget"
          src="https://widgets.leadconnectorhq.com/loader.js"
          data-resources-url="https://widgets.leadconnectorhq.com/chat-widget/loader.js"
          data-widget-id={GHL_WIDGET_ID}
          data-source="WEB_USER"
          strategy="lazyOnload"
        />
      )}
    </>
  );
}
