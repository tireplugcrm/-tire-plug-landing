import '../styles/globals.css';
import Script from 'next/script';

// Analytics scaffolding. These switch on automatically once the IDs are set as
// Vercel env vars — no code change needed:
//   NEXT_PUBLIC_GA_ID          e.g. "G-XXXXXXXXXX"   (Google Analytics 4)
//   NEXT_PUBLIC_META_PIXEL_ID  e.g. "123456789012345" (Meta / Facebook Pixel)
// Booking submissions fire a "generate_lead" (GA4) and "Lead" (Meta) conversion
// event — see components/BookingForm.js — so you can see which ads produce leads.
const GA_ID = process.env.NEXT_PUBLIC_GA_ID;
const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;


export default function App({ Component, pageProps }) {
  return (
    <>
      {GA_ID && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
          <Script id="ga4-init" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${GA_ID}');
            `}
          </Script>
        </>
      )}

      {PIXEL_ID && (
        <Script id="meta-pixel" strategy="afterInteractive">
          {`
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window,document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '${PIXEL_ID}');
            fbq('track', 'PageView');
          `}
        </Script>
      )}


      <Component {...pageProps} />
    </>
  );
}
