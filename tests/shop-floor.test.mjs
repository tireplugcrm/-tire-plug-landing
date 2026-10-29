// node --test tests/   (npm test)
// Shop Floor rules shared by the admin board and the shop TVs.
import { test } from "node:test";
import assert from "node:assert/strict";
import { stageSince, timerLevel, sortJobs, floorStats, shortName, fmtMins, bayLabel } from "../lib/shop-floor.js";

const NOW = Date.parse("2026-10-28T20:00:00Z");
const ago = (m) => new Date(NOW - m * 60000).toISOString();

test("timer starts when the job entered its stage", () => {
  assert.equal(stageSince({ status: "waiting", created_at: ago(30) }), ago(30));
  assert.equal(stageSince({ status: "in_bay", created_at: ago(30), started_at: ago(10) }), ago(10));
  assert.equal(stageSince({ status: "on_hold", created_at: ago(30), started_at: ago(10), hold_since: ago(2) }), ago(2));
  assert.equal(stageSince({ status: "done", created_at: ago(30), done_at: ago(1) }), ago(1));
});

test("slow and late timers, and a missed promise is late", () => {
  assert.equal(timerLevel({ status: "waiting", created_at: ago(5) }, NOW), "ok");
  assert.equal(timerLevel({ status: "waiting", created_at: ago(25) }, NOW), "slow");
  assert.equal(timerLevel({ status: "waiting", created_at: ago(45) }, NOW), "late");
  assert.equal(timerLevel({ status: "in_bay", created_at: ago(5), started_at: ago(5), promised_at: ago(1) }, NOW), "late");
  assert.equal(timerLevel({ status: "done", created_at: ago(5), done_at: ago(1), promised_at: ago(3) }, NOW), "ok");
});

test("rush first, then customers waiting, then oldest", () => {
  const list = [
    { id: "old", status: "waiting", created_at: ago(40) },
    { id: "waiter", status: "waiting", created_at: ago(5), waiter: true },
    { id: "rush", status: "waiting", created_at: ago(1), rush: true },
    { id: "new", status: "waiting", created_at: ago(2) },
  ];
  assert.deepEqual(sortJobs(list).map((o) => o.id), ["rush", "waiter", "old", "new"]);
});

test("today's numbers", () => {
  const orders = [
    { status: "waiting", created_at: ago(50) },
    { status: "on_hold", created_at: ago(10), hold_since: ago(1) },
    { status: "done", created_at: ago(90), done_at: ago(5) },
  ];
  const done = [
    { created_at: ago(120), started_at: ago(100), done_at: ago(60) },
    { created_at: ago(90), started_at: ago(80), done_at: ago(50) },
  ];
  assert.deepEqual(floorStats(orders, done, NOW), { active: 2, ready: 1, onHold: 1, doneToday: 2, avgTurn: 50, avgWait: 15, late: 1 });
});

test("TVs show first name and last initial only", () => {
  assert.equal(shortName("maria de la cruz"), "maria C.");
  assert.equal(shortName("Kevin"), "Kevin");
  assert.equal(shortName(""), "");
  assert.equal(fmtMins(75), "1h 15m");
  assert.equal(bayLabel("2"), "Bay 2");
  assert.equal(bayLabel("Alignment"), "Alignment");
});

test("appointments: upcoming, due now, late", async () => {
  const { apptStatus } = await import("../lib/shop-floor.js");
  const at = (m) => new Date(NOW + m * 60000).toISOString();
  assert.deepEqual(apptStatus(at(40), NOW), { text: "In 40m", level: "ok" });
  assert.deepEqual(apptStatus(at(5), NOW), { text: "Due now", level: "slow" });
  assert.deepEqual(apptStatus(at(-25), NOW), { text: "Late 25m", level: "late" });
});

test("announcements vary, never repeat back to back, and always say where to pick up", async () => {
  const { checkInLine, completeLine } = await import("../lib/shop-lines.js");
  let prev = "";
  for (let i = 0; i < 30; i++) {
    const line = completeLine("Maria", "2018 Honda Civic");
    assert.match(line, /Maria, your 2018 Honda Civic/);
    assert.match(line, /front desk to pick up your vehicle\.$/);
    assert.notEqual(line, prev);
    prev = line;
  }
  assert.match(completeLine("", "2014 Mazda 3"), /The 2014 Mazda 3 /);
  assert.match(checkInLine("2017 Honda Accord, Black"), /2017 Honda Accord, Black/);
});

test("a shelf tire is a new tire, never used", async () => {
  const { fixTireTypes } = await import("../lib/shop-floor.js");
  assert.deepEqual(fixTireTypes({ tire_brand: "Blackhawk", job_types: ["used"] }).job_types, ["tires"]);
  assert.deepEqual(fixTireTypes({ tire_brand: "Falken", job_types: ["alignment"] }).job_types, ["tires", "alignment"]);
  assert.deepEqual(fixTireTypes({ tire_brand: "", job_types: ["used"] }).job_types, ["used"]);
});
