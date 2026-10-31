/**
 * Local demo of the admin for training (/admin-demo). Keeps a sample shop in this server's memory and
 * answers the admin's /api/admin/<route> calls from it (lib/admin-demo.js). Not on the live site.
 *   POST { route, body }  -> what /api/admin/<route> would return
 *   POST { route: "reset" } -> start the sample shop over
 */
import { adminDemoSeed, adminDemo } from "../../lib/admin-demo.js";

export default async function handler(req, res) {
  if (process.env.NODE_ENV === "production") return res.status(404).end();
  if (req.method !== "POST") return res.status(405).end();
  res.setHeader("Cache-Control", "no-store");
  // globalThis keeps the sample shop when the dev server reloads this file.
  if (req.body?.route === "reset" || !globalThis.__adminDemo) globalThis.__adminDemo = adminDemoSeed();
  return res.status(200).json(await adminDemo(globalThis.__adminDemo, req.body?.route, req.body?.body || {}));
}
