// Brand logos for the tire cards, in /public/images/brands (Kumho and RBP live with their brand pages).
// Sources: each brand's own site, Wikimedia Commons, or SimpleTire's logo library for small brands.
// Brands without a logo show their name as a wordmark instead.
const LOGOS = {
  Kumho: "/images/kumho/kumho-logo.png",
  RBP: "/images/rbp/rbp-logo.png",
  Advanta: "advanta.svg", "American Roadstar": "american-roadstar.svg", Arisun: "arisun.svg", Arroyo: "arroyo.svg",
  ATLander: "atlander.svg", BFGoodrich: "bfgoodrich.svg", Blackhawk: "blackhawk.png", Bridgestone: "bridgestone.svg",
  Continental: "continental.svg", Delium: "delium.png", Dunlop: "dunlop.svg", Evoluxx: "evoluxx.svg", Falken: "falken.svg",
  Firestone: "firestone.svg", GeoDrive: "geodrive.png", Goodyear: "goodyear.svg", Groundspeed: "groundspeed.png",
  "GT Radial": "gt-radial.svg", Hankook: "hankook.svg", Jinyu: "jinyu.png", Landsail: "landsail.png",
  Landspider: "landspider.png", Lexani: "lexani.png", Lionhart: "lionhart.png", Michelin: "michelin.webp",
  Mileking: "mileking.svg", Nexen: "nexen.png", Nitto: "nitto.svg", Otani: "otani.svg", Pirelli: "pirelli.svg",
  Prinx: "prinx.png", Remington: "remington.svg", "Royal Black": "royal-black.svg", Tornel: "tornel.svg",
  Toyo: "toyo.svg", Vantage: "vantage.svg", "Venom Power": "venom-power.png", Yokohama: "yokohama.svg",
};

// Logos drawn in light colors (yellow, white) that need a dark plate behind them.
const ON_DARK = new Set(["Blackhawk", "Goodyear", "Prinx"]);

export const brandLogo = (brand) => {
  const f = LOGOS[brand];
  return f ? (f.startsWith("/") ? f : `/images/brands/${f}`) : null;
};
export const logoOnDark = (brand) => ON_DARK.has(brand);
