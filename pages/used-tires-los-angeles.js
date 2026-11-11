import ServicePage from "../components/ServicePage";
import UsedTireList from "../components/UsedTireList";
import { liveUsedTires } from "../lib/used-tires";

export async function getStaticProps() {
  return { props: { tires: await liveUsedTires() }, revalidate: 900 };
}
export default function P({ tires }) {
  return <ServicePage svc={{
    slug: "used-tires-los-angeles", label: "Used Tires",
    title: "Used Tires in Los Angeles | The Tire Plug — Inspected & Affordable",
    description: "Quality used tires in Los Angeles at The Tire Plug — inspected for safety, plenty of tread, fraction of the price of new. All sizes, same-day install. Downtown LA on Olympic Blvd. Call (562) 500-4625.",
    h1: "Used Tires in Los Angeles",
    intro: [
      "Need a reliable tire without paying for new? The Tire Plug stocks quality used tires in Los Angeles — every one inspected for tread depth and safety before it goes on your car.",
      "It's the affordable way to get back on the road fast. Tell us your size and we'll match you with a safe, budget-friendly option and install it same-day.",
    ],
  }}><UsedTireList tires={tires} /></ServicePage>;
}
