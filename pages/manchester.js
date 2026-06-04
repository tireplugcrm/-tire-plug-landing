import LocationPage from "../components/LocationPage";

export default function Manchester() {
  return (
    <LocationPage
      loc={{
        slug: "manchester",
        label: "South LA",
        tag: "Express Location",
        street: "2220 E Manchester Ave",
        zip: "90001",
        sunday: ["10:00", "16:00"],
        sundayText: "Sunday · 10AM–4PM",
        directionsUrl: "https://www.google.com/maps/dir/?api=1&destination=2220+E+Manchester+Ave+Los+Angeles+CA+90001",
        title: "Tire Shop in South LA | The Tire Plug — Manchester Ave",
        description: "Tire shop on E Manchester Ave in South Los Angeles. New & used tires, wheel alignment, oil changes & brakes. Walk-ins welcome, open 7 days. Call (562) 513-0217.",
        h1: "South LA Tire Shop on Manchester Ave",
        intro: "Our South LA express shop at 2220 E Manchester Ave offers new and used tires, alignments, oil changes, brakes, and TPMS sensors — walk-ins welcome 7 days a week, fast and fairly priced.",
        areaText: "South Los Angeles & nearby",
        neighborhoods: ["South LA", "Florence-Firestone", "Huntington Park", "Walnut Park", "Watts", "Vermont-Slauson"],
      }}
    />
  );
}
