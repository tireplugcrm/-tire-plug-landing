// Brake parts costs per car from AutoZone Pro (the cheapest pads and rotors for each side), so the phone AI can
// give an exact brake price on the call. Kept private in app_settings 'brake_parts' (costs never go in this repo
// or a customer text). Jarvis adds every car it looks up (pages/api/agent.js "brake-parts-save").
// Owner's pricing, before tax: pads cost + $120 an axle ($60 a wheel), + $75 electric parking brake (rear),
// rotors cost + $40 each (2 an axle).
import { supabaseAdmin } from "./supabaseAdmin.js";

export const BRAKE_PRICING = { padsAxle: 120, epb: 75, rotorEach: 40 };
const KEY = "brake_parts";
const flat = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

export async function brakeParts() {
  const { data } = await supabaseAdmin.from("app_settings").select("value").eq("key", KEY).maybeSingle();
  try { return JSON.parse(data?.value || "[]"); } catch { return []; }
}

// "2020 Honda Accord 2.0T" -> the saved car with the same year, make and model; a matching trim wins.
export function matchCar(cars, vehicle) {
  const v = flat(vehicle), year = (String(vehicle || "").match(/\b(19|20)\d{2}\b/) || [])[0];
  if (!year) return null;
  const hits = cars.filter((c) => String(c.year) === year && v.includes(flat(c.make)) && v.includes(flat(c.model)));
  return hits.find((c) => c.trim && v.includes(flat(c.trim))) || hits.find((c) => !c.trim) || hits[0] || null;
}

export async function saveBrakeParts(car) {
  const cars = await brakeParts();
  const same = (c) => String(c.year) === String(car.year) && flat(c.make) === flat(car.make) && flat(c.model) === flat(car.model) && flat(c.trim) === flat(car.trim);
  const next = [...cars.filter((c) => !same(c)), { ...car, updated: new Date().toISOString() }];
  await supabaseAdmin.from("app_settings").upsert({ key: KEY, value: JSON.stringify(next), updated_at: new Date().toISOString() }, { onConflict: "key" });
  return next.length;
}
