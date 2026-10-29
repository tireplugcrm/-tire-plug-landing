// What the shop TVs say, in a hype robot-crew voice. A different line each time so it never gets
// old; every "complete" line ends with where to pick up. {car} = "2018 Honda Civic", {name} = first name.
export const CHECKIN_LINES = [
  "New arrival detected. {car} has entered the zone. Tire crew, power up!",
  "Incoming! {car}, locked in and ready for transformation.",
  "Scanning... scan complete. {car} confirmed. Mission is go!",
  "Alert! Fresh ride on deck. {car}. Let's roll, team!",
  "System online. {car} is checked in. Crew, initiate upgrade sequence.",
  "Target acquired: {car}. Bringing it into the bay. Stand by for greatness.",
  "Attention, Tire Plug crew! {car} just rolled in. Engage!",
  "New mission received. {car}. Wheels up, tools out!",
];

export const COMPLETE_LINES = [
  "Mission complete! {who} is fully upgraded and ready to roll.",
  "Transformation complete. {who} is back in action!",
  "All systems green. {who} is locked, loaded, and ready to ride.",
  "Upgrade successful! {who} has been restored to full power.",
  "Operation finished. {who} is road-ready and looking sharp.",
  "Victory! {who} is complete. Another one rolls out strong.",
  "Power levels at maximum. {who} is good to go!",
];
const PICKUP = "Please come to the front desk to pick up your vehicle.";

let last = {};
function pick(kind, list) {
  let i = Math.floor(Math.random() * list.length);
  if (list.length > 1 && i === last[kind]) i = (i + 1) % list.length; // never the same line twice in a row
  last[kind] = i;
  return list[i];
}

export function checkInLine(car) {
  return pick("checkin", CHECKIN_LINES).replace("{car}", car || "a new vehicle");
}
export function completeLine(name, car) {
  const who = name ? `${name}, your ${car || "vehicle"}` : `The ${car || "vehicle"}`;
  const line = pick("complete", COMPLETE_LINES).replace("{who}", who);
  return `${line[0].toUpperCase()}${line.slice(1)} ${PICKUP}`;
}
