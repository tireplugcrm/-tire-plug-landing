/**
 * Builds the RBP distributor letter as a self-contained, print-ready page.
 *
 *   node scripts/distributor-letter.mjs
 *
 * The logo is inlined as a data URI so the file can be emailed or moved
 * without the image breaking. Open it in a browser and print to PDF.
 *
 * Anything in [SQUARE BRACKETS] is a fact only Alex has — distributor name,
 * volumes, terms already agreed. Those are deliberately left blank rather
 * than guessed at: a letter asking for firm pricing is not the place for an
 * invented number.
 */

import fs from "node:fs";

const logo = fs.readFileSync("public/images/logo.webp").toString("base64");
// The file is named .webp but is actually a PNG.
const LOGO = `data:image/png;base64,${logo}`;

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>The Tire Plug — RBP partnership and pricing terms</title>
<style>
  :root {
    --ink: #0B0D0F;
    --body: #22282D;
    --muted: #5B6770;
    --line: #D8DEE4;
    --accent: #0071C5;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: #F4F6F8;
    color: var(--body);
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto,
                 Helvetica, Arial, sans-serif;
    font-size: 11pt;
    line-height: 1.6;
  }
  .sheet {
    max-width: 8.5in;
    min-height: 11in;
    margin: 24px auto;
    background: #fff;
    padding: 0.9in 0.85in 0.8in;
    box-shadow: 0 2px 20px rgba(0,0,0,.08);
  }
  header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 24px;
    border-bottom: 2px solid var(--ink);
    padding-bottom: 14px;
  }
  header img { width: 74px; height: auto; display: block; }
  .org { text-align: right; font-size: 9.5pt; color: var(--muted); line-height: 1.5; }
  .org b { display: block; color: var(--ink); font-size: 12pt; letter-spacing: -0.01em; }

  .meta { margin: 26px 0 4px; font-size: 10.5pt; }
  .meta .to { margin-top: 14px; color: var(--ink); }
  .subject {
    margin: 22px 0 18px;
    padding: 9px 12px;
    background: #F4F6F8;
    border-left: 3px solid var(--accent);
    font-weight: 700;
    color: var(--ink);
  }

  h2 {
    font-size: 10pt;
    letter-spacing: 0.09em;
    text-transform: uppercase;
    color: var(--accent);
    margin: 22px 0 6px;
  }
  p { margin: 0 0 10px; }
  strong { color: var(--ink); }
  ul { margin: 0 0 10px; padding-left: 18px; }
  li { margin-bottom: 6px; }
  .fill {
    background: #FFF8E1;
    border-bottom: 1px solid #C9A227;
    padding: 0 3px;
    font-style: italic;
  }
  .ask {
    border: 1px solid var(--line);
    border-left: 3px solid var(--ink);
    padding: 12px 14px;
    margin: 14px 0;
  }
  .ask ol { margin: 0; padding-left: 18px; }
  .ask li { margin-bottom: 8px; }
  .sign { margin-top: 30px; }
  .sign .line {
    margin-top: 40px;
    border-top: 1px solid var(--ink);
    width: 260px;
    padding-top: 5px;
    font-size: 10pt;
  }
  footer {
    margin-top: 26px;
    border-top: 1px solid var(--line);
    padding-top: 10px;
    font-size: 9pt;
    color: var(--muted);
  }
  @media print {
    body { background: #fff; }
    .sheet { margin: 0; box-shadow: none; padding: 0; max-width: none; }
    @page { size: letter; margin: 0.85in; }
    .fill { background: none; }
  }
</style>
</head>
<body>
<div class="sheet">

  <header>
    <img src="${LOGO}" alt="The Tire Plug">
    <div class="org">
      <b>THE TIRE PLUG</b>
      W Olympic Blvd, Los Angeles, CA<br>
      (562) 500-4625 · tireplugla.com
    </div>
  </header>

  <div class="meta">
    <span class="fill">[Date]</span>
    <div class="to">
      <span class="fill">[Distributor company]</span><br>
      <span class="fill">[Contact name, title]</span><br>
      <span class="fill">[Address]</span>
    </div>
  </div>

  <div class="subject">
    Re: RBP Repulsor A/T — pricing terms, and what we are building around them
  </div>

  <p>Dear <span class="fill">[name]</span>,</p>

  <p>
    We are asking for something specific below, and it will make more sense
    if we explain what we are doing first.
  </p>

  <h2>What we are building</h2>
  <p>
    The Tire Plug is rebuilding tireplugla.com around a <strong>published RBP
    catalogue</strong>. Not a &ldquo;call us for pricing&rdquo; page — real
    prices, out the door, per size, visible to anyone who lands on the site.
    A customer picks their tire, books a fitting time and leaves a deposit,
    without speaking to anybody.
  </p>
  <p>
    Almost nobody in this market publishes tire prices. We intend to, and we
    intend to do it leading with RBP by name.
  </p>

  <h2>Why RBP</h2>
  <p>
    Two reasons, and they are the two that decide what a shop can build a
    reputation on: <strong>the cost gets us to a retail price we can publish
    and still defend</strong>, and <strong>the Rolling Big Promise is a real
    warranty</strong> — 50,000 to 60,000 miles depending on the line, with
    road hazard coverage and a two-year replacement policy behind it.
  </p>
  <p>
    We have learned that customers do not value a warranty they expect to be
    difficult to use. So we are handling registration and claim paperwork at
    our counter rather than handing the customer a leaflet. That turns RBP's
    coverage from a line on a spec sheet into something a customer actually
    experiences — and credits to your brand, not just ours.
  </p>

  <h2>What this is worth to you</h2>
  <ul>
    <li>
      <strong>RBP shown as a lead brand, by name.</strong> Not one row in a
      list of eleven. The catalogue is built around it, in the second largest
      truck market in the country.
    </li>
    <li>
      <strong>Consolidated ordering.</strong> We buy RBP through one
      distributor rather than shopping each job, which is worth more to you
      than a better price on an occasional order is to us.
    </li>
    <li>
      <strong>Forecastable demand.</strong> Deposit-backed online bookings
      tell us what is selling before it ships. We will share that.
    </li>
    <li>
      <strong>Warranty actually claimed and registered.</strong> Coverage that
      gets used is coverage that gets talked about.
    </li>
  </ul>

  <h2>What we need from you</h2>
  <p>
    Publishing prices changes what a cost increase costs us. Once a customer
    has paid a deposit against a number on our website, that is the price we
    owe them. An unannounced change is either absorbed by us or broken faith
    with the customer, and neither one builds a brand.
  </p>

  <div class="ask">
    <ol>
      <li>
        <strong>Firm pricing per size</strong>, held for a stated period,
        rather than quoted per order. The attached sheet has a column for the
        date each price is good through.
      </li>
      <li>
        <strong>Four weeks' written notice before any increase takes
        effect.</strong> Four weeks is what we need to either honour our
        published prices through the notice period or update the site before
        a single customer is affected.
      </li>
      <li>
        <strong>Stock position and lead time per size</strong>, so the site
        only offers what can actually be delivered.
      </li>
    </ol>
  </div>

  <p>
    None of that asks you to be the cheapest. It asks you to be
    <em>predictable</em>, which for what we are building is worth more.
  </p>

  <h2>What we commit to in return</h2>
  <ul>
    <li>RBP led by name on our public catalogue and in our advertising.</li>
    <li>Our RBP volume consolidated with you.</li>
    <li>Warranty registration completed at point of sale, every time.</li>
    <li>
      Sell-through and booking data shared, so you are forecasting from real
      demand rather than from our order history.
    </li>
  </ul>

  <h2>The attached sheet</h2>
  <p>
    <strong>RBP-Repulsor-AT-price-request.xlsx</strong> lists all 58 Repulsor
    A/T Plateau sizes with RBP part numbers, load index, speed rating and load
    range already filled in. The shaded columns are yours: cost each, cost at
    four or more, minimum advertised price, stock, lead time, and the date the
    price holds through.
  </p>
  <p>
    Sizes we expect to move first are marked <strong>A</strong> in the
    priority column. Anything you would rather not quote, leave blank.
  </p>

  <p style="margin-top:16px">
    If it is easier to talk this through, call me directly on
    <strong>(562) 500-4625</strong>.
  </p>

  <div class="sign">
    <p>Regards,</p>
    <div class="line">
      <span class="fill">[Name]</span><br>
      <span style="color:#5B6770">The Tire Plug · Owner</span>
    </div>
  </div>

  <footer>
    The Tire Plug · W Olympic Blvd, Los Angeles, CA · (562) 500-4625 ·
    tireplugla.com<br>
    Enclosure: RBP-Repulsor-AT-price-request.xlsx (58 sizes)
  </footer>

</div>
</body>
</html>
`;

const out = "RBP-distributor-letter.html";
fs.writeFileSync(out, html);
console.log(`${out} — ${(html.length / 1024).toFixed(0)}KB, logo inlined`);
