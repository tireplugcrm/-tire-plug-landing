import Head from "next/head";

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

  WHY IT IS A PLAIN <script> AND NOT next/script
    next/script injects the tag with JavaScript after the page loads. A human
    sees the chat bubble either way — but anything that FETCHES this page to
    verify the widget is installed sees no widget at all, because it is not in
    the server-rendered HTML. A2P verification does exactly that.

    So this is a plain tag that ships in the HTML. The usual argument for
    next/script is protecting Core Web Vitals; this page has no traffic to
    protect, and being visibly installed is the entire point of it.

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
        <title>Text The Tire Plug — Tire Shop in Los Angeles, CA</title>
        <meta
          name="description"
          content="The Tire Plug, 2331 E Olympic Blvd, Los Angeles CA. Text us your tire size for an out-the-door price. New and used tires, alignments, oil changes, brakes, TPMS."
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

        <p style={{ margin: "0 0 40px" }}>
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

        {/*
          Everything below is here because A2P rejection 30919 asks for it by
          name: company name, a description of services, contact information,
          a privacy policy, and a mention of the SMS programme. A consent
          notice on its own does not let a reviewer confirm a real business is
          behind the number, and the review is done by someone who has never
          heard of this shop.
        */}
        <hr style={{ border: 0, borderTop: "1px solid #e5e5e5", margin: "0 0 32px" }} />

        <h2 style={{ fontSize: 20, margin: "0 0 8px" }}>About The Tire Plug</h2>
        <p style={{ margin: "0 0 16px" }}>
          The Tire Plug is an independent tire and automotive service shop in
          Los Angeles, California, serving drivers across the greater LA area
          since 2019. We sell and install new and used tires, and provide wheel
          alignments, oil changes, brake service, TPMS sensor service, tire
          rotation and balancing, and tire repair.
        </p>
        <p style={{ margin: "0 0 24px" }}>
          Customers text us their tire size and we text back a real
          out-the-door price, usually within a few minutes. That conversation is
          the SMS programme described above — it exists so somebody shopping for
          tires can get a straight answer without waiting on hold.
        </p>

        <h2 style={{ fontSize: 20, margin: "0 0 8px" }}>Contact us</h2>
        <address style={{ fontStyle: "normal", margin: "0 0 24px" }}>
          <strong>The Tire Plug</strong>
          <br />
          2331 E Olympic Blvd
          <br />
          Los Angeles, CA 90021
          <br />
          Phone:{" "}
          <a href="tel:+15625004625" style={{ color: "#0071c5" }}>
            562-500-4625
          </a>
          <br />
          Text:{" "}
          <a href="sms:+15622503737" style={{ color: "#0071c5" }}>
            562-250-3737
          </a>
          <br />
          Email:{" "}
          <a href="mailto:tiredepotplug@gmail.com" style={{ color: "#0071c5" }}>
            tiredepotplug@gmail.com
          </a>
          <br />
          Web:{" "}
          <a href="https://tireplugla.com" style={{ color: "#0071c5" }}>
            tireplugla.com
          </a>
        </address>

        <h2 style={{ fontSize: 20, margin: "0 0 8px" }}>Hours</h2>
        <p style={{ margin: "0 0 32px" }}>
          Monday–Friday 9:00am–7:00pm
          <br />
          Saturday 9:00am–6:00pm
          <br />
          Sunday 10:00am–4:00pm
        </p>

        <p style={{ fontSize: 14, color: "#666", margin: 0 }}>
          {/* Literal, not new Date(): this page is statically exported, so a
              computed year renders one value at build and another in the
              browser, which React reports as a hydration mismatch. */}
          © 2026 The Tire Plug · 2331 E Olympic Blvd, Los Angeles, CA 90021
        </p>
      </main>

      {/*
        The only thing on this page that collects a phone number. Scoped to
        this route on purpose — see the note at the top of the file.
      */}
      {GHL_WIDGET_ID && (
        // eslint-disable-next-line @next/next/no-sync-scripts
        <script
          src="https://widgets.leadconnectorhq.com/loader.js"
          data-resources-url="https://widgets.leadconnectorhq.com/chat-widget/loader.js"
          data-widget-id={GHL_WIDGET_ID}
          data-source="WEB_USER"
        />
      )}
    </>
  );
}
