import { localInventoryXml, serveFeed } from "../../lib/google-feed";

// Google Merchant Center local inventory feed (lib/google-feed.js): which tires are on the shelf at our store.
export async function getServerSideProps({ res }) {
  await serveFeed(res, localInventoryXml);
  return { props: {} };
}

export default function Feed() {
  return null;
}
