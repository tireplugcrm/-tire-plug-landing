import React from 'react';
import Head from 'next/head';
import Header from '../components/Header';
import Hero from '../components/Hero';
import BookingForm from '../components/BookingForm';
import Footer from '../components/Footer';

export default function Home() {
  return (
    <>
      <Head>
        <title>The Tire:Plug - Best Oil Change Near You in Los Angeles</title>
        <meta name="description" content="Fast, professional oil change service in Los Angeles. Starting at $75. Same day appointments available. 5-star rated." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <Header />
      <Hero />
      <BookingForm />
      <Footer />
    </>
  );
}