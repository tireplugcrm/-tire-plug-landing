// The real admin running on a sample shop, for training videos and practice: local only (404 on the
// live site). The admin's /api/admin/* calls are answered by /api/admin-demo (lib/admin-demo.js) and
// the Shop Floor's by /api/shop-demo, so nothing reaches Supabase, GoHighLevel or Tekmetric.
// /admin-demo?login=1 shows the sign-in screen instead of signing in.
import AdminHub from "./admin/index.js";

const SHOP_FLOOR = { "work-orders": true, "shelf-tires": true };

if (typeof window !== "undefined" && !window.__adminDemoFetch) {
  window.__adminDemoFetch = true;
  const real = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    const url = typeof input === "string" ? input : input.url;
    const m = url.match(/^\/api\/admin\/([\w-]+)/);
    if (!m) return real(input, init);
    const body = init.body ? JSON.parse(init.body) : {};
    if (SHOP_FLOOR[m[1]]) return real("/api/shop-demo", { ...init, body: JSON.stringify(body) });
    return real("/api/admin-demo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ route: m[1], body }) });
  };
  if (!new URLSearchParams(window.location.search).has("login")) sessionStorage.setItem("admin_pw", "demo");
  else sessionStorage.removeItem("admin_pw");
}

export default AdminHub;

export function getServerSideProps() {
  return process.env.NODE_ENV === "production" ? { notFound: true } : { props: {} };
}
