/**
 * Local demo of the Shop Floor (the /shop-demo split screen). Keeps a sample shop in this
 * server's memory, so the admin side and the TV side see the same cars. Not on the live site.
 *   GET                -> the board as the TVs see it
 *   POST { action }    -> same actions as /api/admin/work-orders, plus check_in, reset, and
 *                         shelf (tire search on the real website inventory, read only)
 */
import { demoSeed, demoAction, board } from "../../lib/shop-floor-demo.js";
import { tvBoard } from "../../lib/shop-floor.js";
import { searchShelf } from "../../lib/shelf-search.js";

export default async function handler(req, res) {
  if (process.env.NODE_ENV === "production") return res.status(404).end();
  res.setHeader("Cache-Control", "no-store");
  // globalThis keeps the sample shop when the dev server reloads this file.
  const shop = (globalThis.__shopDemo ||= demoSeed());
  if (req.method === "GET") return res.status(200).json(tvBoard(board(shop)));
  if (req.method === "POST" && req.body?.action === "shelf") return res.status(200).json({ tires: await searchShelf(req.body.q) });
  if (req.method === "POST") return res.status(200).json(demoAction(shop, req.body));
  return res.status(405).end();
}
