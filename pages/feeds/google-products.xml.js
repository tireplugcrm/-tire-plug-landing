import { productsXml, serveFeed } from "../../lib/google-feed";

// Google Merchant Center primary feed (lib/google-feed.js). Merchant Center fetches it daily.
export async function getServerSideProps({ res }) {
  await serveFeed(res, productsXml);
  return { props: {} };
}

export default function Feed() {
  return null;
}
