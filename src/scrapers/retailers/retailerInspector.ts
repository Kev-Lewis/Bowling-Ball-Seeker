import axios from "axios";
import { inspectRetailerHtmlPage } from "../../utils/retailerPageInspection";

const ALLOWED_RETAILER_HOSTS = new Set([
  "www.bowling.com",
  "bowling.com",
  "www.bowlersmart.com",
  "bowlersmart.com",
  "www.buddiesproshop.com",
  "buddiesproshop.com",
  "www.amazon.com",
  "amazon.com",
  "www.ebay.com",
  "ebay.com",
]);

function assertAllowedRetailerUrl(url: string) {
  const parsedUrl = new URL(url);

  if (!ALLOWED_RETAILER_HOSTS.has(parsedUrl.hostname)) {
    throw new Error(
      `Retailer host not allowed yet: ${parsedUrl.hostname}. Add it to ALLOWED_RETAILER_HOSTS before inspecting.`
    );
  }
}

export async function inspectRetailerPage(url: string) {
  assertAllowedRetailerUrl(url);

  const response = await axios.get(url, {
    headers: {
      "User-Agent":
        "BowlingBallSeeker/0.1.0 (+https://github.com/kev-lewis/bowling-ball-seeker)",
      Accept: "text/html,application/xhtml+xml",
    },
    timeout: 15000,
  });

  return inspectRetailerHtmlPage(url, response.data);
}