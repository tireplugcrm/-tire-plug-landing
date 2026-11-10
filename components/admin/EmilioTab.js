// Admin "Emilio pay" tab: the same tracker Emilio sees at /emilio, with editing (hours, ROs,
// mark paid), plus the steps to give him his own Tekmetric login so his ROs can be found by name.
import React from "react";
import EmilioPay from "../EmilioPay.js";
import { T, ui } from "./ui.js";

export default function EmilioTab({ auth }) {
  const call = async (body) => {
    const res = await fetch("/api/emilio", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...auth, ...body }) });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j.error || "Request failed");
    return j;
  };
  return (
    <div style={{ maxWidth: 640, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <h1 style={ui.h1}>Emilio pay</h1>
        <a href="/emilio" target="_blank" rel="noopener noreferrer" style={ui.btn}>Emilio&apos;s page (code)</a>
      </div>
      <EmilioPay call={call} canEdit />
      <div style={{ ...ui.card, marginTop: 10, fontSize: 13.5, color: T.textMuted, lineHeight: 1.55 }}>
        <div style={{ color: T.text, fontWeight: 600, marginBottom: 6 }}>Give Emilio his own Tekmetric login</div>
        <ol style={{ margin: 0, paddingLeft: 18 }}>
          <li>In Tekmetric, open Settings → Employees and add Emilio as a <strong>Technician</strong> (his email, so he gets the invite).</li>
          <li>Emilio accepts the invite email and sets his password on his phone.</li>
          <li>On every job he does, set <strong>Technician = Emilio</strong> (not Alejandro Lopez).</li>
          <li>Tell Claude when it&apos;s done: his Tekmetric employee id goes in, and his ROs get pulled in by technician name.</li>
        </ol>
        <div style={{ marginTop: 8 }}>Until then, add each weekend&apos;s ROs here by hand (RO #, customer, labor $).</div>
      </div>
    </div>
  );
}
