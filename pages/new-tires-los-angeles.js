import ServicePage from "../components/ServicePage";
export default function P() {
  return <ServicePage svc={{
    slug: "new-tires-los-angeles", label: "New Tires",
    title: "New Tires in Los Angeles | The Tire Plug — All Brands, Same-Day",
    description: "Buy new tires in Los Angeles at The Tire Plug. Budget to premium brands (Goodyear, Falken, Michelin, Continental, Lexani), every size, expert install. Honest pricing, same-day, Downtown LA on Olympic Blvd. Call (562) 500-4625.",
    h1: "New Tires in Los Angeles",
    intro: [
      "The Tire Plug carries new tires for every vehicle and budget in Los Angeles — from value brands to premium names like Goodyear, Falken, Michelin and Continental. Tell us your size or vehicle and we'll quote you the best options, mounted and balanced the same day.",
      "Not sure what you need? Send a photo of your tire's sidewall or your vehicle info and we'll find the right fit and give you an honest, upfront price.",
    ],
  }} />;
}
