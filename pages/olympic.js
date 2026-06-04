import LocationPage from "../components/LocationPage";

export default function Olympic() {
  return (
    <LocationPage
      loc={{
        slug: "olympic",
        label: "Downtown LA",
        tag: "Flagship Location",
        street: "2331 E Olympic Blvd",
        zip: "90021",
        sunday: null,
        sundayText: "Sunday · Closed",
        directionsUrl: "https://www.google.com/maps/dir/?api=1&destination=2331+E+Olympic+Blvd+Los+Angeles+CA+90021",
        title: "Tire Shop in Downtown LA | The Tire Plug — Olympic Blvd",
        description: "Tire shop on E Olympic Blvd in Downtown Los Angeles. New & used tires, wheel alignment, oil changes, brakes & TPMS sensors — honest pricing, same-day service. Call (562) 513-0217.",
        h1: "Downtown LA Tire Shop on Olympic Blvd",
        intro: "The Tire Plug's flagship shop at 2331 E Olympic Blvd serves Downtown Los Angeles with new and used tires, wheel alignments, oil changes, brakes, and TPMS sensors — all at honest prices with same-day appointments.",
        areaText: "Downtown Los Angeles & nearby",
        neighborhoods: ["Downtown LA", "Arts District", "Boyle Heights", "Vernon", "Pico-Union", "Lincoln Heights"],
      }}
    />
  );
}
