// Admin "Alex" tab: the owner's own daily / weekly / monthly duties and his calendar.
// Same data as tireplugla.com/alex (his 4-digit code).
import React, { useState } from "react";
import AlexCalendar from "../AlexCalendar.js";
import TodoTab from "./TodoTab.js";
import { T, ui } from "./ui.js";

const VIEWS = [["daily", "Every day"], ["weekly", "Every week"], ["monthly", "Every month"], ["calendar", "Calendar"]];

export default function AlexTab({ auth }) {
  const [view, setView] = useState("daily");
  const call = async (body) => {
    const res = await fetch("/api/alex", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...auth, ...body }) });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j.error || "Request failed");
    return j;
  };
  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <div role="tablist" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {VIEWS.map(([id, lbl]) => (
            <button key={id} role="tab" aria-selected={view === id} onClick={() => setView(id)}
              style={{ ...ui.btn, background: view === id ? T.blue : T.surface, borderColor: view === id ? T.blue : T.borderStrong, color: "#fff" }}>{lbl}</button>
          ))}
        </div>
        <a href="/alex" target="_blank" rel="noopener noreferrer" style={ui.btn}>Your phone page</a>
      </div>
      {view === "calendar" ? (<><h1 style={{ ...ui.h1, marginBottom: 10 }}>Calendar</h1><AlexCalendar call={call} /></>) : <TodoTab key={view} auth={auth} who="alex" name="Alex" list={view} />}
    </div>
  );
}
