import Head from "next/head";

// Printable counter sign (letter size): QR to /deals?src=counter. Print from the browser, no header/footer.
export default function DealsSign() {
  return (
    <main className="sign">
      <Head>
        <title>Counter Sign | The Tire Plug</title>
        <meta name="robots" content="noindex" />
      </Head>
      <img className="logo" src="/images/email/logo.png" alt="The Tire Plug" />
      <h1>Get our tire deals by text</h1>
      <p className="es">Reciba ofertas de llantas por texto</p>
      <img className="qr" src="/images/deals-qr-counter.png" alt="QR code: tireplugla.com/deals" />
      <p className="how">Scan with your phone camera · Escanee con la cámara</p>
      <p className="url">tireplugla.com/deals</p>
      <p className="fine">Optional. Up to 4 msgs/month. Reply STOP to opt out. Not required to buy anything.</p>
      <style jsx global>{`
        @page { size: letter; margin: 0.5in; }
        body { margin: 0; background: #fff; }
      `}</style>
      <style jsx>{`
        .sign { font-family: Helvetica, Arial, sans-serif; color: #111; text-align: center; max-width: 7.5in; margin: 0 auto; padding: 0.4in 16px; }
        .logo { width: 1.6in; display: block; margin: 0 auto; }
        h1 { font-size: 44px; font-weight: 900; letter-spacing: -0.02em; line-height: 1.1; margin: 0.25in 0 0.08in; }
        .es { color: #E01B22; font-size: 26px; font-weight: 700; margin: 0; }
        .qr { width: 4.2in; max-width: 100%; margin: 0.3in auto 0.1in; display: block; }
        .how { font-size: 20px; font-weight: 700; margin: 0; }
        .url { font-size: 18px; color: #555; margin: 0.08in 0 0.3in; }
        .fine { font-size: 12px; color: #777; margin: 0; }
      `}</style>
    </main>
  );
}
