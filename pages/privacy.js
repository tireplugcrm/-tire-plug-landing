import React from "react";
import Head from "next/head";

export default function Privacy() {
  return (
    <Legal title="Privacy Policy" updated="May 31, 2026">
      <P>
        The Tire Plug (“we,” “us,” “our”) operates the website tireplugla.com and provides
        tire and automotive services at our Los Angeles locations. This Privacy Policy explains
        what information we collect, how we use it, and the choices you have. By using our website
        or submitting a form, you agree to this policy.
      </P>

      <H>Information we collect</H>
      <P>When you fill out a form on our site (a service/quote request or our discount sign-up), we may collect:</P>
      <Ul items={[
        "Your name, phone number, and email address",
        "Vehicle information (year, make, model, tire size)",
        "The service you’re interested in and how soon you need it",
        "Any messages you send us",
      ]} />

      <H>How we use your information</H>
      <Ul items={[
        "To respond to your request and prepare your quote",
        "To contact you by phone, text message, or email about your request and appointment",
        "To send service reminders and occasional offers if you opted in",
        "To improve our services and customer experience",
      ]} />

      <H>Text messaging (SMS)</H>
      <P>
        If you provide your phone number and opt in, we may send you text messages related to your
        quote, appointment, service reminders, and promotions. Message frequency varies. Message and
        data rates may apply. You can opt out at any time by replying <B>STOP</B>, and you can reply
        <B> HELP</B> for help. Consent to receive text messages is not a condition of purchasing any
        goods or services.
      </P>
      <P style={{ background: "rgba(255,31,31,0.06)", border: "1px solid rgba(255,31,31,0.2)", borderRadius: 10, padding: "1rem 1.25rem" }}>
        <B>We do not sell or share your information.</B> No mobile information — including your phone
        number and your consent to receive text messages — will be shared with or sold to third parties
        or affiliates for their marketing or promotional purposes. Text messaging originator opt-in data
        and consent will not be shared with any third parties.
      </P>

      <H>How we share information</H>
      <P>
        We only share information with trusted service providers who help us operate our business (for
        example, our scheduling, messaging, and email tools), and only as needed to provide our services
        to you. We may also disclose information if required by law. We never sell your personal information.
      </P>

      <H>Data security & retention</H>
      <P>
        We take reasonable steps to protect your information and keep it only as long as needed to serve
        you and meet our legal obligations.
      </P>

      <H>Your choices</H>
      <P>
        You can opt out of texts by replying STOP, unsubscribe from emails using the link in any email,
        or contact us to update or delete your information.
      </P>

      <H>Contact us</H>
      <P>
        The Tire Plug<br />
        2331 E Olympic Blvd, Los Angeles, CA 90021<br />
        Phone: <A href="tel:562-500-4625">562-500-4625</A><br />
        Email: <A href="mailto:tiredepotplug@gmail.com">tiredepotplug@gmail.com</A>
      </P>
    </Legal>
  );
}

/* ---- shared legal page layout (also used by /terms) ---- */
export function Legal({ title, updated, children }) {
  return (
    <>
      <Head><title>{title} · The Tire Plug</title><meta name="viewport" content="width=device-width, initial-scale=1" /></Head>
      <main style={{ background: "#000", minHeight: "100vh", padding: "3.5rem 1.5rem 6rem", fontFamily: "system-ui, -apple-system, sans-serif" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <a href="/" style={{ color: "#FF3838", textDecoration: "none", fontSize: "0.8rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>← The Tire Plug</a>
          <h1 style={{ color: "#fff", fontWeight: 900, fontSize: "2rem", textTransform: "uppercase", letterSpacing: "-0.02em", margin: "1.25rem 0 0.4rem" }}>{title}</h1>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.8rem", marginBottom: "2.5rem" }}>Last updated: {updated}</p>
          <div style={{ color: "rgba(255,255,255,0.75)", fontSize: "0.95rem", lineHeight: 1.7 }}>{children}</div>
        </div>
      </main>
    </>
  );
}
export const P = ({ children, style }) => <p style={{ marginBottom: "1.1rem", ...style }}>{children}</p>;
export const H = ({ children }) => <h2 style={{ color: "#fff", fontWeight: 800, fontSize: "1.15rem", margin: "2rem 0 0.75rem", textTransform: "uppercase", letterSpacing: "0.02em" }}>{children}</h2>;
export const B = ({ children }) => <strong style={{ color: "#fff" }}>{children}</strong>;
export const A = ({ href, children }) => <a href={href} style={{ color: "#FF3838", textDecoration: "none" }}>{children}</a>;
export const Ul = ({ items }) => (
  <ul style={{ margin: "0 0 1.1rem", paddingLeft: "1.25rem" }}>
    {items.map((it, i) => <li key={i} style={{ marginBottom: "0.4rem" }}>{it}</li>)}
  </ul>
);
