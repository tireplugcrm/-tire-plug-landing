// Admin "Belen" tab: her to-do list (edit it here, she ticks it on /belen), her "Good to know" list, her pay
// commission calendar (same as Junior's, commission only: ROs, mark paid) and the bookings she made.
// The field-rep bonus / business-accounts tracker (BelenBonus) is hidden until her plan is final.
import React, { useState } from "react";
import JuniorPay from "../JuniorPay.js";
import TodoTab from "./TodoTab.js";
import BelenBookings from "../BelenBookings.js";
import BelenActivity from "./BelenActivity.js";
import { T, ui } from "./ui.js";

export default function BelenTab({ auth }) {
  const [view, setView] = useState("todo");
  const payCall = async (body) => {
    const res = await fetch("/api/belen-pay", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...auth, ...body }) });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j.error || "Request failed");
    return j;
  };
  const call = async (body) => {
    const res = await fetch("/api/belen", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...auth, ...body }) });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j.error || "Request failed");
    return j;
  };
  const seg = (id, lbl) => (
    <button key={id} role="tab" aria-selected={view === id} onClick={() => setView(id)}
      style={{ ...ui.btn, background: view === id ? T.blue : T.surface, borderColor: view === id ? T.blue : T.borderStrong, color: "#fff" }}>{lbl}</button>
  );
  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <BelenActivity auth={auth} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <div role="tablist" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{seg("todo", "To-do")}{seg("know", "Good to know")}{seg("bookings", "Bookings")}{seg("pay", "Pay")}</div>
        <a href="/belen" target="_blank" rel="noopener noreferrer" style={ui.btn}>Belen&apos;s page (code)</a>
      </div>
      {view === "todo" ? <TodoTab key="todo" auth={auth} who="belen" name="Belen" /> : view === "know" ? <TodoTab key="know" auth={auth} who="belen" name="Belen" list="know" /> : view === "bookings" ? <BelenBookings call={payCall} /> : (
        <>
          <h1 style={{ ...ui.h1, marginBottom: 10 }}>Belen&apos;s pay</h1>
          <JuniorPay call={payCall} canEdit />
        </>
      )}
    </div>
  );
}
