import axios from "axios";
import * as cheerio from "cheerio";
import type { ScrapedRetailerListing } from "../../types/retailerScraper";

type JsonRecord = Record<string, unknown>;

const BOWLING_COM_HOSTS = new Set(["www.bowling.com", "bowling.com"]);

function cleanText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function assertBowlingComUrl(url: string) {
  const parsedUrl = new URL(url);

  if (!BOWLING_COM_HOSTS.has(parsedUrl.hostname)) {
    throw new Error(`URL is not a Bowling.com URL: ${parsedUrl.hostname}`);
  }

  if (!parsedUrl.pathname.startsWith("/products/")) {
    throw new Error("Bowling.com URL must be a product page URL.");
  }
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : null;
}

function getJsonLdType(value: JsonRecord) {
  const type = value["@type"];

  if (typeof type === "string") {
    return type;
  }

  if (Array.isArray(type)) {
    return type.filter((item) => typeof item === "string").join(",");
  }

  return null;
}

function collectJsonLdObjects(value: unknown): JsonRecord[] {
  if (Array.isArray(value)) {
    return value.flatMap(collectJsonLdObjects);
  }

  if (!isRecord(value)) {
    return [];
  }

  const graph = value["@graph"];

  if (Array.isArray(graph)) {
    return [value, ...graph.flatMap(collectJsonLdObjects)];
  }

  return [value];
}

function parseJsonLdBlocks($: cheerio.CheerioAPI) {
  const blocks: JsonRecord[] = [];

  $('script[type="application/ld+json"]').each((_index, element) => {
    const rawText = $(element).text();

    if (!rawText.trim()) {
      return;
    }

    try {
      const parsed = JSON.parse(rawText);
      blocks.push(...collectJsonLdObjects(parsed));
    } catch {
      // Ignore malformed JSON-LD blocks.
    }
  });

  return blocks;
}

function findProductJsonLd($: cheerio.CheerioAPI) {
  const blocks = parseJsonLdBlocks($);

  return blocks.find((block) => {
    return getJsonLdType(block)?.toLowerCase().includes("product");
  });
}

function normalizeOffers(value: unknown): JsonRecord[] {
  if (Array.isArray(value)) {
    return value.filter(isRecord);
  }

  if (isRecord(value)) {
    return [value];
  }

  return [];
}

function parsePrice(value: unknown) {
  const raw = typeof value === "number" ? value.toString() : getString(value);

  if (!raw) {
    return null;
  }

  const parsed = Number(raw.replace(/[^0-9.]/g, ""));

  return Number.isFinite(parsed) ? parsed : null;
}

function getOfferPrice(offer: JsonRecord) {
  return parsePrice(offer.price);
}

function getBestOffer(offers: JsonRecord[]) {
  const offersWithPrice = offers
    .map((offer) => ({
      offer,
      price: getOfferPrice(offer),
    }))
    .filter((item): item is { offer: JsonRecord; price: number } => {
      return item.price !== null;
    });

  if (offersWithPrice.length === 0) {
    return null;
  }

  offersWithPrice.sort((a, b) => a.price - b.price);

  return offersWithPrice[0];
}

function parseStockStatus(availability: unknown): ScrapedRetailerListing["stockStatus"] {
  const raw = getString(availability)?.toLowerCase() ?? "";

  if (
    raw.includes("instock") ||
    raw.includes("in_stock") ||
    raw.includes("in stock")
  ) {
    return "in_stock";
  }

  if (
    raw.includes("outofstock") ||
    raw.includes("out_of_stock") ||
    raw.includes("out of stock") ||
    raw.includes("soldout") ||
    raw.includes("sold out")
  ) {
    return "out_of_stock";
  }

  return "unknown";
}

function getFallbackTitle($: cheerio.CheerioAPI) {
  const h1 = cleanText($("h1").first().text());

  if (h1) {
    return h1;
  }

  const title = cleanText($("title").first().text());

  return title || null;
}

export function parseBowlingComProductHtml(
  url: string,
  html: string
): ScrapedRetailerListing {
  assertBowlingComUrl(url);

  const $ = cheerio.load(html);
  const product = findProductJsonLd($);

  if (!product) {
    throw new Error("Could not find Product JSON-LD on Bowling.com page.");
  }

  const listingTitle = getString(product.name) ?? getFallbackTitle($);

  if (!listingTitle) {
    throw new Error("Could not determine Bowling.com product title.");
  }

  const offers = normalizeOffers(product.offers);
  const bestOffer = getBestOffer(offers);

  if (!bestOffer) {
    throw new Error("Could not determine Bowling.com product price.");
  }

  const offerUrl = getString(bestOffer.offer.url) ?? url;

  return {
    retailerName: "bowling.com",
    retailerType: "verified_retailer",
    listingTitle,
    listingUrl: offerUrl,
    currentPrice: bestOffer.price,
    stockStatus: parseStockStatus(bestOffer.offer.availability),
    condition: "new",
  };
}

export async function scrapeBowlingComProductPage(url: string) {
  assertBowlingComUrl(url);

  const response = await axios.get(url, {
    headers: {
      "User-Agent":
        "BowlingBallSeeker/0.1.0 (+https://github.com/kev-lewis/bowling-ball-seeker)",
      Accept: "text/html,application/xhtml+xml",
    },
    timeout: 15000,
  });

  return parseBowlingComProductHtml(url, response.data);
}