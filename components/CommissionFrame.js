// A rep's commission tracker (the same page as /commission?k=..., RO # + RO name) shown inside
// their own page or admin tab. call({ action: "commissionLink" }) returns its address.
import React, { useEffect, useState } from "react";
import { T } from "./admin/ui.js";

export default function CommissionFrame({ call }) {
  const [url, setUrl] = useState("");
  const [err, setErr] = useState("");
  useEffect(() => { call({ action: "commissionLink" }).then((j) => setUrl(j.url)).catch((e) => setErr(e.message)); /* eslint-disable-next-line */ }, []);
  if (!url) return <div style={{ color: T.textMuted, padding: 24, textAlign: "center" }}>{err || "Loading…"}</div>;
  return <iframe title="Commission tracker" src={url} style={{ width: "100%", height: "78vh", minHeight: 560, border: 0, borderRadius: 16, background: "#fff" }} />;
}
