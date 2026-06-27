import axios from "axios";
import * as cheerio from "cheerio";
import type {
  DiscoveredProductLink,
  ProductDiscoveryResult,
} from "../../types/scraper";
import {
  removeTrailingSlash,
  toAbsoluteUrl,
} from "../../utils/urlUtils";

const MOTIV_BALL_GUIDE_URL =
  "https://www.motivbowling.com/ball-guide/ball-guide.html";

function cleanText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function isLikelyMotivBallGuideProductUrl(url: string) {
  const parsedUrl = new URL(url);
  const pathname = parsedUrl.pathname.toLowerCase();

  if (parsedUrl.hostname !== "www.motivbowling.com") {
    return false;
  }

  // MOTIV ball guide links can appear like:
  // /ball-guide/n_114
  // /n_682645258566245868
  return /^\/ball-guide\/n_\d+$/.test(pathname) || /^\/n_\d+$/.test(pathname);
}

function isLikelyBallName(name: string) {
  const normalized = name.toLowerCase();

  if (name.length < 2) {
    return false;
  }

  const excludedNames = [
    "previous",
    "next",
    "view balls",
    "see more",
    "compare",
    "start now",
    "facebook",
    "twitter",
    "youtube",
    "instagram",
    "tiktok",
  ];

  if (excludedNames.includes(normalized)) {
    return false;
  }

  return true;
}

function dedupeProducts(products: DiscoveredProductLink[]) {
  const seen = new Set<string>();
  const deduped: DiscoveredProductLink[] = [];

  for (const product of products) {
    const key = removeTrailingSlash(product.url.toLowerCase());

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(product);
  }

  return deduped;
}

export async function discoverMotivBallProducts(): Promise<ProductDiscoveryResult> {
  const response = await axios.get(MOTIV_BALL_GUIDE_URL, {
    headers: {
      "User-Agent":
        "BowlingBallSeeker/0.1.0 (+https://github.com/kev-lewis/bowling-ball-seeker)",
      Accept: "text/html,application/xhtml+xml",
    },
    timeout: 15000,
  });

  const $ = cheerio.load(response.data);

  const discoveredProducts: DiscoveredProductLink[] = [];

  $("a[href]").each((_index, element) => {
    const href = $(element).attr("href");

    if (!href) {
      return;
    }

    const absoluteUrl = toAbsoluteUrl(href, MOTIV_BALL_GUIDE_URL);

    if (!absoluteUrl) {
      return;
    }

    if (!isLikelyMotivBallGuideProductUrl(absoluteUrl)) {
      return;
    }

    const name = cleanText($(element).text());

    if (!isLikelyBallName(name)) {
      return;
    }

    discoveredProducts.push({
      sourceName: "Motiv",
      name,
      url: absoluteUrl,
    });
  });

  const data = dedupeProducts(discoveredProducts).sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  return {
    sourceName: "Motiv",
    sourceUrl: MOTIV_BALL_GUIDE_URL,
    checkedAt: new Date().toISOString(),
    count: data.length,
    data,
  };
}