import React from 'react';
import PromoPopup from '../components/PromoPopup';
import Head from 'next/head';
import Header from '../components/Header';
import Hero from '../components/Hero';
import QuoteByText from '../components/QuoteByText';
import Services from '../components/Services';
import Promos from '../components/Promos';
import Reviews from '../components/Reviews';
import Locations from '../components/Locations';
import BookingForm from '../components/BookingForm';
import Footer from '../components/Footer';

const SERVICE_NAMES = ["New Tires", "Used Tires", "Wheel Alignment", "TPMS Sensors", "Oil Change", "Brake Service", "Tire Rotation & Balance", "Tire Repair"];
function makeLocation(name, street, zip, sundayHours, weekday) {
  const wk = weekday || [{ dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"], opens: "09:00", closes: "18:00" }];
  const hours = wk.map((w) => ({ "@type": "OpeningHoursSpecification", dayOfWeek: w.dayOfWeek, opens: w.opens, closes: w.closes }));
  if (sundayHours) hours.push({ "@type": "OpeningHoursSpecification", dayOfWeek: "Sunday", opens: sundayHours[0], closes: sundayHours[1] });
  return {
    "@context": "https://schema.org", "@type": "AutoRepair",
    name, image: "https://tireplugla.com/images/logo.webp", url: "https://tireplugla.com/",
    telephone: "+1-562-500-4625", priceRange: "$$",
    address: { "@type": "PostalAddress", streetAddress: street, addressLocality: "Los Angeles", addressRegion: "CA", postalCode: zip, addressCountry: "US" },
    areaServed: { "@type": "City", name: "Los Angeles" },
    openingHoursSpecification: hours,
    makesOffer: SERVICE_NAMES.map((s) => ({ "@type": "Offer", itemOffered: { "@type": "Service", name: s } })),
  };
}
const TIRE_PLUG_SCHEMA = [
  makeLocation("The Tire Plug — Olympic", "2331 E Olympic Blvd", "90021", ["10:00", "16:00"], [
    { dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], opens: "09:00", closes: "19:00" },
    { dayOfWeek: ["Saturday"], opens: "09:00", closes: "18:00" },
  ]),
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
      <QuoteByText />
      <Hero />
      <Services />
      <Promos />
      <Reviews />
      <Locations />
      <BookingForm />
      <Footer />
    </>
  );
}