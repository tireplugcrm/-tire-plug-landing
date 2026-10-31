// Sample shop for demos: a full day of cars, techs and appointments, and the same board actions
// as /api/admin/work-orders (+ Front Desk check-in), applied in memory instead of Supabase.
// Used by /shop-tv?demo=1 (still picture) and /shop-demo (split screen: admin + live TV, local only).
import { STAGE_KEYS, HOLD_KEYS, TV_UNDO_MINS, fixTireTypes, cleanRo } from "./shop-floor.js";

export function demoSeed() {
  const ago = (m) => new Date(Date.now() - m * 60000).toISOString();
  const at = (m) => new Date(Date.now() + m * 60000).toISOString();
  const staff = [{ id: "a", name: "Carlos" }, { id: "b", name: "Luis" }, { id: "c", name: "Miguel" }, { id: "d", name: "Jose" }];
  const j = (n, status, vehicle, customer_name, job_types, extra = {}) => ({
    id: String(n), ticket_no: n, status, vehicle, customer_name, job_types, parts_status: "na", created_at: ago(extra.age || 10), ...extra,
  });
  const appt = (n, mins, vehicle, name, tire_qty, tire_size, service, tire) => ({ id: `ap${n}`, appointment_at: at(mins), vehicle, name, tire_qty, tire_size, service: service || null, tire_name: tire ? `${tire[0]} ${tire[1]}` : null, tire });
  return {
    nextTicket: 1044,
    showAppointments: true,
    staff,
    appointments: [
      appt(1, -18, "2017 Honda Accord · Black", "Luis Ramirez", 4, "225/50R17", null, ["Arroyo", "Grand Sport A/S", "arroyo-grand-sport-a-s"]),
      appt(2, 5, "2020 Toyota RAV4 · Silver", "Jenny Tran", 4, "225/65R17", null, ["BFGoodrich", "Advantage Control", "bfgoodrich-advantage-control"]),
      appt(3, 40, "2013 Ford Mustang · Red", "Marco Diaz", 2, "255/40R19", null, ["Lexani", "LX-Twenty", "lexani-lx-twenty"]),
      appt(4, 95, "2019 Hyundai Elantra · White", "Priya Shah", null, null, "Alignment"),
      appt(5, 150, "2016 Chevy Tahoe · Black", "Ray Walker", 4, "265/70R17", null, ["Evoluxx", "Rotator H/T", "evoluxx-rotator-h-t"]),
    ],
    todayDone: [{ created_at: ago(300), started_at: ago(290), done_at: ago(240) }, { created_at: ago(200), started_at: ago(170), done_at: ago(120) }, { created_at: ago(150), started_at: ago(140), done_at: ago(95) }],
    orders: [
      j(1041, "waiting", "2018 Honda Civic · Gray", "Maria Gonzalez", ["tires", "alignment"], { age: 8, waiter: true, tire_qty: 4, tire_brand: "Falken", tire_model: "Sincera SN250 A/S", tire_img: "/images/tires/falken-sincera-sn250-a-s.webp", tire_size: "215/55R16", phone: "562-555-0100",
        ro: { email: "maria@example.com", plate: "8ABC123", vin: "", mileage: "84210", concern: "Front tires worn, car pulls right", tire_price: 95, labor: [{ job: "tires", desc: "Mount & balance", price: 80 }, { job: "alignment", desc: "4-wheel alignment", price: 99 }], fees: [{ desc: "Tire disposal", price: 12 }] } }),
      j(1042, "waiting", "2015 Ford F-150 · White", "Dave Romero", ["used"], { age: 27, assigned_staff_id: "c", tire_qty: 2, tire_size: "275/65R18", service: "Used set from the back rack" }),
      j(1043, "waiting", "2021 Tesla Model 3 · Black", "Ana Perez", ["repair"], { age: 1, rush: true, waiter: true, tire_qty: 1, tire_size: "235/45R18" }),
      j(1037, "in_bay", "2019 Toyota Camry · White", "Kevin Lee", ["tires", "tpms"], { age: 50, started_at: ago(35), assigned_staff_id: "a", bay: "1", promised_at: at(20), tire_qty: 4, tire_brand: "Goodyear", tire_model: "Eagle LS-2", tire_img: "/images/tires/goodyear-eagle-ls-2.webp", tire_size: "235/45R18", service: "New TPMS sensors" }),
      j(1038, "in_bay", "2012 Chevy Silverado · Red", "Rosa Martinez", ["rotate"], { age: 95, started_at: ago(70), assigned_staff_id: "b", bay: "2", promised_at: ago(5) }),
      j(1039, "in_bay", "2020 Nissan Altima · Blue", "Tom Harris", ["alignment"], { age: 30, started_at: ago(12), assigned_staff_id: "d", bay: "Alignment rack" }),
      j(1035, "on_hold", "2016 Jeep Wrangler · Green", "Chris Brown", ["alignment"], { age: 120, started_at: ago(90), hold_since: ago(18), hold_reason: "approval", bay: "Alignment rack" }),
      j(1036, "on_hold", "2017 BMW 328i · Silver", "Lena Klein", ["tires"], { age: 140, hold_since: ago(40), hold_reason: "parts", parts_status: "ordered", tire_qty: 4, tire_brand: "Evoluxx", tire_model: "Capricorn UHP", tire_img: "/images/tires/evoluxx-capricorn-uhp.webp", tire_size: "225/45R18" }),
      j(1033, "done", "2014 Mazda 3 · White", "Sam Wilson", ["tires", "alignment"], { age: 80, started_at: ago(60), done_at: ago(12), assigned_staff_id: "a", tire_qty: 4, tire_brand: "GT Radial", tire_model: "Maxtour LX", tire_img: "/images/tires/gt-radial-maxtour-lx.webp", tire_size: "205/60R16" }),
      j(1034, "done", "2022 Kia Sportage · Gray", "Nina Flores", ["repair"], { age: 40, started_at: ago(30), done_at: ago(1), assigned_staff_id: "b", tire_qty: 1, tire_size: "235/60R18" }),
    ],
  };
}

// Apply one board action to the demo shop (mutates it). Mirrors the real API's rules.
export function demoAction(shop, body = {}) {
  const now = new Date().toISOString();
  const { action, id } = body;
  const find = () => shop.orders.find((o) => o.id === id);
  if (action === "reset") Object.assign(shop, demoSeed());
  if (action === "showAppointments") shop.showAppointments = !!body.on;
  if (action === "create" && body.order) {
    shop.orders.push({ ...fixTireTypes(body.order), id: `n${shop.nextTicket}`, ticket_no: shop.nextTicket++, status: "waiting", created_at: now, tire_qty: Number(body.order.tire_qty) || null, assigned_staff_id: body.order.assigned_staff_id || null, ro: cleanRo(body.order.ro) });
  }
  if (action === "update" && find()) Object.assign(find(), fixTireTypes(body.patch || {}), { tire_qty: Number(body.patch?.tire_qty) || null, assigned_staff_id: body.patch?.assigned_staff_id || null }, body.patch?.ro ? { ro: cleanRo(body.patch.ro) } : {});
  if (action === "assign" && find()) find().assigned_staff_id = body.assigned_staff_id || null;
  if (action === "setStatus" && find() && STAGE_KEYS.includes(body.status)) {
    const o = find();
    Object.assign(o, { status: body.status, hold_reason: null, hold_since: null });
    if (body.status === "in_bay" && !o.started_at) o.started_at = now;
    if (body.status === "done") { o.done_at = now; shop.todayDone.push({ created_at: o.created_at, started_at: o.started_at, done_at: now }); }
    if (body.status === "waiting") o.done_at = null;
    if (body.status === "on_hold") Object.assign(o, { hold_reason: HOLD_KEYS.includes(body.hold_reason) ? body.hold_reason : "other", hold_since: now });
  }
  if (action === "archive") shop.orders = shop.orders.filter((o) => o.id !== id);
  if (action === "remove" && find()) {
    if (find().status === "done") shop.todayDone.pop(); // a removed job doesn't count as completed
    shop.orders = shop.orders.filter((o) => o.id !== id);
  }
  if (action === "clearCompleted") shop.orders = shop.orders.filter((o) => o.status !== "done");
  // The bay TV's two buttons (same limits as /api/shop-tv).
  if (action === "complete" && find() && find().status !== "done") return demoAction(shop, { action: "setStatus", id, status: "done" });
  if (action === "undo" && find()?.status === "done" && Date.now() - new Date(find().done_at).getTime() < TV_UNDO_MINS * 60000) {
    shop.todayDone.pop();
    return demoAction(shop, { action: "setStatus", id, status: "waiting" });
  }
  if (action === "check_in") {
    const a = shop.appointments.find((x) => x.id === id);
    if (a) {
      shop.appointments = shop.appointments.filter((x) => x.id !== id);
      const t = a.tire ? { tire_brand: a.tire[0], tire_model: a.tire[1], tire_img: `/images/tires/${a.tire[2]}.webp` } : {};
      shop.orders.push({ ...t, id: `n${shop.nextTicket}`, ticket_no: shop.nextTicket++, status: "waiting", customer_name: a.name, vehicle: a.vehicle, tire_qty: a.tire_qty, tire_size: a.tire_size, service: a.service, job_types: a.tire_size ? ["tires"] : ["alignment"], parts_status: "na", created_at: now });
    }
  }
  return board(shop);
}

export const board = (shop) => ({ orders: shop.orders, staff: shop.staff, todayDone: shop.todayDone, appointments: shop.appointments, showAppointments: shop.showAppointments !== false });
