import React from 'react';
import PromoPopup from '../components/PromoPopup';
import Head from 'next/head';
import Header from '../components/Header';
import PromoHero from '../components/PromoHero';
import Reviews from '../components/Reviews';
import Locations from '../components/Locations';
import Footer from '../components/Footer';
import { PHONE, ADDRESS, OPENING_HOURS } from '../lib/shop';

const SERVICE_NAMES = ["New Tires", "Used Tires", "Wheel Alignment", "TPMS Sensors", "Oil Change", "Brake Service", "Tire Rotation & Balance", "Tire Repair"];
function makeLocation(name, street, zip) {
  return {
    "@context": "https://schema.org", "@type": ["TireShop", "AutoRepair"],
    name, image: "https://tireplugla.com/images/logo.webp", url: "https://tireplugla.com/",
    telephone: PHONE.schema, priceRange: "$$",
    address: { "@type": "PostalAddress", streetAddress: street, addressLocality: "Los Angeles", addressRegion: "CA", postalCode: zip, addressCountry: "US" },
    areaServed: { "@type": "City", name: "Los Angeles" },
    openingHoursSpecification: OPENING_HOURS,
    makesOffer: SERVICE_NAMES.map((s) => ({ "@type": "Offer", itemOffered: { "@type": "Service", name: s } })),
  };
}
const TIRE_PLUG_SCHEMA = [
  makeLocation("The Tire Plug — Olympic", ADDRESS.street, ADDRESS.zip),
];

export default function Home() {
  return (
    <>
      <Head>
        <title>Tire Shop in Los Angeles | The Tire Plug — Tires, Alignments & Oil Changes</title>
        <meta name="description" content="The Tire Plug is a Los Angeles tire shop in Downtown LA (Olympic Blvd). New & used tires, wheel alignment, TPMS sensors, oil changes & brakes — honest pricing, same-day appointments. Call 562-500-4625." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="canonical" href="https://tireplugla.com/" />
        <meta name="keywords" content="tire shop Los Angeles, tires near me, new tires, used tires, wheel alignment, TPMS sensors, oil change, brakes, Olympic Blvd, Los Angeles tires" />
        <meta name="robots" content="index, follow" />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="The Tire Plug" />
        <meta property="og:title" content="The Tire Plug — Tire Shop in Los Angeles" />
        <meta property="og:description" content="New & used tires, wheel alignment, TPMS, oil changes & brakes. Downtown LA on Olympic Blvd. Honest pricing, same-day appointments. Call 562-500-4625." />
        <meta property="og:url" content="https://tireplugla.com/" />
        <meta property="og:image" content="https://tireplugla.com/images/logo.webp" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="The Tire Plug — Tire Shop in Los Angeles" />
        <meta name="twitter:description" content="New & used tires, wheel alignment, TPMS, oil changes & brakes. Downtown LA on Olympic Blvd. Same-day appointments." />
        <meta name="twitter:image" content="https://tireplugla.com/images/logo.webp" />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(TIRE_PLUG_SCHEMA) }} />
      </Head>

      <PromoPopup />
      <Header />
      <PromoHero />
      <Reviews />
      <Locations />
      <Footer />
    </>
  );
}