import React from "react";
import Head from "next/head";
import Header from "../components/Header";
import Footer from "../components/Footer";

/* ------------------------------------------------------------------
   Road Hazard Protection page — tireplugla.com/warranty
   Destination for the QR code printed on customer warranty materials.

   To update the effective date, change EFFECTIVE_DATE below. That's it.
------------------------------------------------------------------ */
// Declared here, not at the bottom of the file. As a `const` it sits in the
// temporal dead zone until the module finishes evaluating — harmless in the
// browser, fatal when Next pre-renders this page at build time, which is
// exactly how it broke every deploy: "Cannot access 'u' before
// initialization" on /warranty.
const inlineLink = { color: "#ff6666", textDecoration: "none", fontWeight: 700 };

const EFFECTIVE_DATE = "July 27, 2026";

const PHONE_DISPLAY = "(562) 500-4625";
const PHONE_TEL = "5625004625";

const PLANS = [
  {
    term: "12-Month Protection",
    months: "12",
    rate: "20%",
    rateLine: "20% of the original tire purchase price",
    examples: [
      ["$100 tire", "$20 protection"],
      ["$200 tire", "$40 protection"],
    ],
  },
  {
    term: "24-Month Protection",
    months: "24",
    rate: "30%",
    rateLine: "30% of the original tire purchase price",
    examples: [
      ["$100 tire", "$30 protection"],
      ["$200 tire", "$60 protection"],
    ],
    featured: true,
  },
];

const INCLUDED = [
  "One approved replacement per covered tire",
  "Full replacement without prorating",
  "Installation of the replacement tire",
  "Standard wheel balancing",
  "Applicable taxes",
  "Standard tire disposal",
  "Coverage for personal vehicles",
  "Coverage for qualifying commercial and rideshare vehicles",
];

const QUALIFYING = [
  "Nails and screws",
  "Potholes",
  "Accidental road debris",
  "Non-repairable punctures",
  "Accidental sidewall damage",
  "Other accidental road damage that leaves the covered tire unsafe or non-repairable",
];

const EXCLUSIONS = [
  "Intentional, malicious, or purposeful damage",
  "Tire cutting, stabbing, slashing, vandalism, or similar deliberate acts",
  "Cosmetic damage that does not make the tire unsafe",
  "TPMS sensors, valves, programming, diagnostics, or related TPMS service",
  "Damage to wheels, suspension, brakes, bodywork, or other vehicle components",
  "Towing, loss of use, rental vehicles, lost income, or other incidental expenses",
  "Damage to a tire that was not listed as covered on the original invoice or protection record",
];

const CLAIM_STEPS = [
  "Stop driving if continuing could cause additional damage or create an unsafe condition.",
  <>Contact The Tire Plug at <a href={`tel:${PHONE_TEL}`} style={inlineLink}>{PHONE_DISPLAY}</a>.</>,
  "Bring the damaged tire and original receipt or proof of protection to the shop.",
  "Allow The Tire Plug to inspect the tire and determine whether the damage qualifies.",
  "If approved and the tire cannot be safely repaired, The Tire Plug will arrange the covered replacement.",
];

const KEY_TERMS = [
  "Coverage must be purchased on the original installation date.",
  "Coverage applies only to the individual tire identified on the customer’s invoice or protection record.",
  "Each covered tire is eligible for no more than one approved replacement.",
  "Replacement ends coverage for the affected tire.",
  "Replacement tires do not automatically receive new protection.",
  "Exact brand and model availability is not guaranteed.",
  "A comparable or closest reasonably available option may be substituted.",
  "Standard installation, balancing, applicable taxes, and disposal are included in an approved replacement.",
  "TPMS-related products and services are excluded.",
  "Commercial and rideshare use are eligible.",
  "Claims require proof of purchase and inspection by The Tire Plug.",
  "Protection is additional to any applicable manufacturer warranty and does not replace manufacturer warranty rights.",
  "Nothing on this page limits rights that cannot legally be waived under California law.",
];

export default function Warranty() {
  const url = "https://tireplugla.com/warranty";
  const title = "Road Hazard Protection | The Tire Plug Los Angeles";
  const description =
    "Protect tires purchased from The Tire Plug with 12- or 24-month road hazard protection, including eligible tire replacement, installation, and balancing.";

  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="canonical" href={url} />
        <meta name="robots" content="index, follow" />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="The Tire Plug" />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={url} />
        <meta property="og:image" content="https://tireplugla.com/images/logo.webp" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
        <meta name="twitter:image" content="https://tireplugla.com/images/logo.webp" />
      </Head>

      <Header />

      <main className="wty">
        {/* ---------------- HERO ---------------- */}
        <section className="wty-hero">
          <div className="wty-tread" aria-hidden="true" />
          <div className="wty-inner">
            <span className="wty-eyebrow">The Tire Plug · Los Angeles</span>
            <h1 className="wty-h1">Protect Your Tires From the Unexpected</h1>
            <p className="wty-sub">
              Choose 12 or 24 months of protection against qualifying accidental road-hazard damage.
            </p>
            <p className="wty-support">
              Full replacement, installation, and balancing are included for an approved claim.
            </p>
            <div className="wty-cta-row no-print">
              <a href={`tel:${PHONE_TEL}`} className="wty-btn wty-btn-red">📞 Call or Text Us</a>
              <a href="#coverage-terms" className="wty-btn wty-btn-ghost">View Coverage Terms</a>
            </div>
            <p className="wty-effective">Effective Date: {EFFECTIVE_DATE}</p>
          </div>
        </section>

        {/* ---------------- PRICING ---------------- */}
        <Section>
          <h2 className="wty-h2">Choose Your Protection</h2>
          <div className="wty-plans">
            {PLANS.map((p) => (
              <div key={p.term} className={`wty-plan${p.featured ? " wty-plan-featured" : ""}`}>
                {p.featured && <span className="wty-badge">Longest Coverage</span>}
                <span className="wty-plan-months">{p.months}<span className="wty-plan-mo">mo</span></span>
                <h3 className="wty-plan-term">{p.term}</h3>
                <p className="wty-plan-rate">{p.rate}</p>
                <p className="wty-plan-rateline">of the original tire purchase price</p>
                <div className="wty-plan-examples">
                  {p.examples.map(([a, b], i) => (
                    <div key={i} className="wty-plan-ex">
                      <span>{a}</span>
                      <span className="wty-plan-ex-eq">=</span>
                      <span className="wty-plan-ex-val">{b}</span>
                    </div>
                  ))}
                </div>
                <a href={`tel:${PHONE_TEL}`} className="wty-btn wty-btn-red wty-plan-btn no-print">Get Covered</a>
              </div>
            ))}
          </div>
          <div className="wty-notice">
            <strong>Important:</strong> Road Hazard Protection must be purchased on the same day the covered tire is
            purchased and installed. It cannot be added later.
          </div>
        </Section>

        {/* ---------------- WHAT'S INCLUDED ---------------- */}
        <Section>
          <h2 className="wty-h2">What Your Protection Includes</h2>
          <ul className="wty-check-list">
            {INCLUDED.map((it) => (
              <li key={it}><span className="wty-check" aria-hidden="true">✓</span>{it}</li>
            ))}
          </ul>
          <p className="wty-fineprint">
            TPMS service, TPMS sensors, TPMS repair, and TPMS programming are not included.
          </p>
        </Section>

        {/* ---------------- QUALIFYING DAMAGE ---------------- */}
        <Section>
          <h2 className="wty-h2">Examples of Qualifying Road Hazards</h2>
          <ul className="wty-check-list">
            {QUALIFYING.map((it) => (
              <li key={it}><span className="wty-check" aria-hidden="true">✓</span>{it}</li>
            ))}
          </ul>
          <p className="wty-fineprint">
            All claims require inspection and approval by The Tire Plug. A tire that can be safely repaired may be
            repaired instead of replaced.
          </p>
        </Section>

        {/* ---------------- REPLACEMENT TERMS ---------------- */}
        <Section>
          <h2 className="wty-h2">How Replacement Works</h2>
          <p className="wty-p">
            For an approved claim, the covered damaged tire will receive one full replacement, including standard
            installation and balancing.
          </p>
          <p className="wty-p">
            Whenever reasonably available, The Tire Plug will use the same tire brand and model. If the exact tire is
            unavailable, discontinued, or cannot be obtained within a reasonable period, The Tire Plug may provide the
            closest reasonably available replacement option.
          </p>
          <div className="wty-callout">
            <strong>Important:</strong> The replacement tire does not receive a new road hazard protection plan.
            Coverage for that tire ends once its approved replacement has been provided. A new protection plan cannot
            be assumed or automatically transferred to the replacement.
          </div>
        </Section>

        {/* ---------------- EXCLUSIONS ---------------- */}
        <Section>
          <h2 className="wty-h2">What Is Not Covered</h2>
          <p className="wty-p">Protection does not cover:</p>
          <ul className="wty-x-list">
            {EXCLUSIONS.map((it) => (
              <li key={it}><span className="wty-x" aria-hidden="true">✕</span>{it}</li>
            ))}
          </ul>
          <p className="wty-fineprint">
            Commercial and rideshare use are eligible under this program.
          </p>
        </Section>

        {/* ---------------- CLAIM PROCESS ---------------- */}
        <Section>
          <h2 className="wty-h2">How to Make a Claim</h2>
          <ol className="wty-steps">
            {CLAIM_STEPS.map((step, i) => (
              <li key={i}>
                <span className="wty-step-num" aria-hidden="true">{i + 1}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
          <p className="wty-fineprint">
            A customer must retain the damaged tire until it has been inspected. Reimbursement for a tire purchased or
            replaced somewhere else is not automatically provided.
          </p>
        </Section>

        {/* ---------------- IMPORTANT / FULL TERMS ---------------- */}
        <section id="coverage-terms" className="wty-section wty-terms">
          <div className="wty-inner">
            <div className="wty-terms-head">
              <h2 className="wty-h2" style={{ margin: 0 }}>Important Coverage Terms</h2>
              <button type="button" className="wty-btn wty-btn-ghost wty-print-btn no-print" onClick={() => { if (typeof window !== "undefined") window.print(); }}>
                🖨️ Print / Save Terms
              </button>
            </div>
            <ul className="wty-term-list">
              {KEY_TERMS.map((t) => <li key={t}>{t}</li>)}
            </ul>
          </div>
        </section>

        {/* ---------------- CONTACT ---------------- */}
        <section className="wty-section wty-contact">
          <div className="wty-inner">
            <h2 className="wty-h2">Questions About Your Coverage?</h2>
            <div className="wty-contact-card">
              <div className="wty-contact-grid">
                <div>
                  <span className="wty-contact-label">Business</span>
                  <span className="wty-contact-val">The Tire Plug</span>
                </div>
                <div>
                  <span className="wty-contact-label">Address</span>
                  <span className="wty-contact-val">2331 E Olympic Blvd<br />Los Angeles, CA</span>
                </div>
                <div>
                  <span className="wty-contact-label">Phone</span>
                  <a href={`tel:${PHONE_TEL}`} className="wty-contact-val wty-contact-link">{PHONE_DISPLAY}</a>
                </div>
                <div>
                  <span className="wty-contact-label">Instagram</span>
                  <a href="https://www.instagram.com/tireplugcali" target="_blank" rel="noopener noreferrer" className="wty-contact-val wty-contact-link">@tireplugcali</a>
                </div>
                <div>
                  <span className="wty-contact-label">Website</span>
                  <a href="https://tireplugla.com" className="wty-contact-val wty-contact-link">tireplugla.com</a>
                </div>
              </div>
              <a href={`tel:${PHONE_TEL}`} className="wty-btn wty-btn-red wty-contact-btn no-print">📞 Call or Text The Tire Plug</a>
            </div>
          </div>
        </section>
      </main>

      <Footer />

      <style jsx global>{`
        .wty {
          background: #0a0a0a;
          color: #fff;
          font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
          overflow-x: hidden;
        }
        .wty-inner { max-width: 940px; margin: 0 auto; padding: 0 1.5rem; }
        .wty-section { padding: 3rem 0; border-top: 1px solid rgba(255, 255, 255, 0.08); }
        .wty-section .wty-inner > .wty-h2 { margin-top: 0; }

        /* ---- Hero ---- */
        .wty-hero {
          position: relative;
          background: radial-gradient(120% 100% at 50% 0%, #1a1a1c 0%, #050505 70%);
          padding: 4.5rem 0 3.5rem;
          overflow: hidden;
        }
        .wty-tread {
          position: absolute;
          inset: 0;
          background-image: repeating-linear-gradient(
            -45deg,
            rgba(255, 255, 255, 0.04) 0px,
            rgba(255, 255, 255, 0.04) 3px,
            transparent 3px,
            transparent 16px
          );
          -webkit-mask-image: linear-gradient(180deg, #000 0%, transparent 90%);
          mask-image: linear-gradient(180deg, #000 0%, transparent 90%);
          pointer-events: none;
        }
        .wty-hero .wty-inner { position: relative; }
        .wty-eyebrow {
          display: inline-block;
          color: #ff1f1f;
          font-weight: 800;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          font-size: 0.76rem;
        }
        .wty-h1 {
          font-size: clamp(2rem, 6vw, 3.1rem);
          font-weight: 900;
          line-height: 1.05;
          letter-spacing: -0.02em;
          margin: 0.7rem 0 1rem;
          text-transform: uppercase;
        }
        .wty-sub {
          color: rgba(255, 255, 255, 0.85);
          font-size: clamp(1.05rem, 2.4vw, 1.25rem);
          line-height: 1.55;
          max-width: 640px;
          margin: 0 0 0.6rem;
        }
        .wty-support {
          color: rgba(255, 255, 255, 0.62);
          font-size: 1rem;
          line-height: 1.6;
          max-width: 640px;
          margin: 0 0 1.6rem;
        }
        .wty-cta-row { display: flex; gap: 0.75rem; flex-wrap: wrap; }
        .wty-effective {
          margin: 1.4rem 0 0;
          color: rgba(255, 255, 255, 0.4);
          font-size: 0.8rem;
          letter-spacing: 0.02em;
        }

        /* ---- Buttons ---- */
        .wty-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.4rem;
          padding: 0.9rem 1.6rem;
          border-radius: 10px;
          font-weight: 800;
          font-size: 0.92rem;
          text-decoration: none;
          border: 1px solid transparent;
          cursor: pointer;
          transition: transform 0.15s ease, opacity 0.15s ease;
          line-height: 1;
        }
        .wty-btn-red { background: linear-gradient(180deg, #ff2a2a 0%, #c20000 100%); color: #fff; }
        .wty-btn-ghost { background: rgba(255, 255, 255, 0.06); border-color: rgba(255, 255, 255, 0.18); color: #fff; }
        .wty-btn:hover { transform: translateY(-1px); opacity: 0.94; }
        .wty-btn:focus-visible { outline: 3px solid #ff6666; outline-offset: 2px; }

        /* ---- Headings & text ---- */
        .wty-h2 {
          font-size: clamp(1.4rem, 3.2vw, 1.8rem);
          font-weight: 900;
          letter-spacing: -0.01em;
          margin: 0 0 1.25rem;
          text-transform: uppercase;
        }
        .wty-p {
          color: rgba(255, 255, 255, 0.75);
          font-size: 1.02rem;
          line-height: 1.68;
          max-width: 720px;
          margin: 0 0 1.1rem;
        }
        .wty-fineprint {
          color: rgba(255, 255, 255, 0.5);
          font-size: 0.9rem;
          line-height: 1.6;
          margin: 1.25rem 0 0;
          max-width: 720px;
        }

        /* ---- Pricing plans ---- */
        .wty-plans {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
          gap: 1.25rem;
        }
        .wty-plan {
          position: relative;
          background: rgba(255, 255, 255, 0.035);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 18px;
          padding: 2rem 1.75rem;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
        }
        .wty-plan-featured {
          border-color: rgba(255, 42, 42, 0.55);
          background: linear-gradient(180deg, rgba(255, 42, 42, 0.08) 0%, rgba(255, 255, 255, 0.03) 100%);
          box-shadow: 0 0 0 1px rgba(255, 42, 42, 0.15), 0 24px 60px rgba(0, 0, 0, 0.5);
        }
        .wty-badge {
          position: absolute;
          top: -0.7rem;
          left: 1.75rem;
          background: linear-gradient(180deg, #ff2a2a 0%, #c20000 100%);
          color: #fff;
          font-size: 0.66rem;
          font-weight: 800;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          padding: 0.35rem 0.7rem;
          border-radius: 50px;
        }
        .wty-plan-months {
          font-size: 2.6rem;
          font-weight: 900;
          line-height: 1;
          color: #fff;
          letter-spacing: -0.03em;
        }
        .wty-plan-mo { font-size: 1rem; font-weight: 700; color: rgba(255, 255, 255, 0.5); margin-left: 0.25rem; }
        .wty-plan-term {
          font-size: 1.1rem;
          font-weight: 800;
          margin: 0.5rem 0 1rem;
          text-transform: uppercase;
          letter-spacing: 0.01em;
        }
        .wty-plan-rate { font-size: 2rem; font-weight: 900; color: #ff4141; line-height: 1; margin: 0; }
        .wty-plan-rateline { color: rgba(255, 255, 255, 0.6); font-size: 0.9rem; margin: 0.4rem 0 1.25rem; }
        .wty-plan-examples { width: 100%; border-top: 1px solid rgba(255, 255, 255, 0.1); padding-top: 1rem; margin-bottom: 1.5rem; }
        .wty-plan-ex {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.95rem;
          color: rgba(255, 255, 255, 0.8);
          padding: 0.3rem 0;
        }
        .wty-plan-ex-eq { color: rgba(255, 255, 255, 0.35); }
        .wty-plan-ex-val { color: #fff; font-weight: 800; margin-left: auto; }
        .wty-plan-btn { margin-top: auto; width: 100%; }

        .wty-notice {
          margin-top: 1.5rem;
          background: rgba(255, 31, 31, 0.08);
          border: 1px solid rgba(255, 31, 31, 0.28);
          border-radius: 12px;
          padding: 1rem 1.25rem;
          color: rgba(255, 255, 255, 0.85);
          font-size: 0.95rem;
          line-height: 1.6;
        }
        .wty-notice strong, .wty-callout strong, .wty-term-list strong { color: #fff; }

        /* ---- Check / X lists ---- */
        .wty-check-list, .wty-x-list {
          list-style: none;
          padding: 0;
          margin: 0;
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 0.7rem 1.5rem;
          max-width: 820px;
        }
        .wty-check-list li, .wty-x-list li {
          position: relative;
          padding-left: 1.9rem;
          color: rgba(255, 255, 255, 0.82);
          font-size: 0.98rem;
          line-height: 1.5;
        }
        .wty-check {
          position: absolute; left: 0; top: 0;
          color: #22c55e;
          font-weight: 900;
        }
        .wty-x {
          position: absolute; left: 0; top: 0;
          color: #ff5252;
          font-weight: 900;
        }

        /* ---- Callout ---- */
        .wty-callout {
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-left: 3px solid #ff2a2a;
          border-radius: 12px;
          padding: 1.1rem 1.35rem;
          color: rgba(255, 255, 255, 0.82);
          font-size: 0.97rem;
          line-height: 1.65;
          max-width: 760px;
          margin-top: 0.5rem;
        }

        /* ---- Claim steps ---- */
        .wty-steps { list-style: none; padding: 0; margin: 0; display: grid; gap: 1rem; max-width: 760px; counter-reset: step; }
        .wty-steps li { display: flex; gap: 1rem; align-items: flex-start; color: rgba(255, 255, 255, 0.82); font-size: 1rem; line-height: 1.55; }
        .wty-step-num {
          flex-shrink: 0;
          width: 34px; height: 34px;
          display: inline-flex; align-items: center; justify-content: center;
          background: linear-gradient(180deg, #ff2a2a 0%, #c20000 100%);
          color: #fff; font-weight: 900; font-size: 0.95rem;
          border-radius: 50%;
        }

        /* ---- Terms ---- */
        .wty-terms { background: rgba(255, 255, 255, 0.02); }
        .wty-terms-head { display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; margin-bottom: 1.25rem; }
        .wty-term-list { margin: 0; padding-left: 1.25rem; max-width: 820px; }
        .wty-term-list li { color: rgba(255, 255, 255, 0.78); font-size: 0.97rem; line-height: 1.55; margin-bottom: 0.7rem; }

        /* ---- Contact ---- */
        .wty-contact-card {
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 18px;
          padding: 1.75rem;
          max-width: 760px;
        }
        .wty-contact-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 1.25rem;
          margin-bottom: 1.75rem;
        }
        .wty-contact-label {
          display: block;
          color: #ff4141;
          font-size: 0.7rem;
          font-weight: 800;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          margin-bottom: 0.35rem;
        }
        .wty-contact-val { display: block; color: #fff; font-size: 1rem; font-weight: 600; line-height: 1.45; }
        .wty-contact-link { text-decoration: none; }
        .wty-contact-link:hover { color: #ff6666; }
        .wty-contact-btn { width: 100%; }

        @media (max-width: 640px) {
          .wty-section { padding: 2.5rem 0; }
          .wty-cta-row .wty-btn, .wty-contact-btn { width: 100%; }
          .wty-plan { padding: 1.75rem 1.4rem; }
        }

        /* ---- Print-friendly stylesheet ---- */
        @media print {
          nav, footer, .no-print { display: none !important; }
          .wty, .wty-hero, .wty-section, .wty-terms, .wty-contact { background: #fff !important; }
          .wty, .wty-p, .wty-sub, .wty-support, .wty-h1, .wty-h2, .wty-plan-term, .wty-plan-months,
          .wty-check-list li, .wty-x-list li, .wty-steps li, .wty-term-list li, .wty-contact-val,
          .wty-notice, .wty-callout { color: #111 !important; }
          .wty-eyebrow, .wty-contact-label, .wty-plan-rate { color: #c20000 !important; }
          .wty-tread { display: none !important; }
          .wty-section, .wty-hero { border-color: #ccc !important; padding: 1rem 0 !important; }
          .wty-plan, .wty-callout, .wty-notice, .wty-contact-card, .wty-terms {
            border: 1px solid #ccc !important;
            box-shadow: none !important;
            background: #fff !important;
            break-inside: avoid;
          }
          .wty-check { color: #111 !important; }
          .wty-x { color: #111 !important; }
          .wty-step-num { background: #c20000 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          a[href^="tel:"]::after, .wty-contact-link::after { content: ""; }
        }
      `}</style>
    </>
  );
}

function Section({ children }) {
  return (
    <section className="wty-section">
      <div className="wty-inner">{children}</div>
    </section>
  );
}
