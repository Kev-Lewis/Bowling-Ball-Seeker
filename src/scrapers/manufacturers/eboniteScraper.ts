import axios from "axios";
import * as cheerio from "cheerio";
import type { ManufacturerBallInput } from "../../types/catalog";
import { toAbsoluteUrl } from "../../utils/urlUtils";

const EBONITE_HOST = "ebonite.com";
const DEFAULT_EBONITE_BALLS_URL = "https://ebonite.com/collections/balls";

export interface EboniteCatalogOptions {
  sourceUrl?: string;
  brandName?: string | null;
  maxPages?: number | null;
  scrapeDelayMs?: number | null;
}

function cleanText(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function buildBallId(brand: string, canonicalName: string) {
  return `${slugify(brand)}-${slugify(canonicalName)}`;
}

function titleCaseFromSlug(value: string) {
  return value
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function nameFromEboniteUrl(url: string) {
  const slug = new URL(url).pathname.split("/").filter(Boolean).pop();

  return slug ? titleCaseFromSlug(slug) : "Unknown Ball";
}

function cleanEboniteName(value: string) {
  return cleanText(value)
    .replace(/\s*\|.*$/g, "")
    .replace(/\s*>.*$/g, "")
    .replace(/\s+Bowling Ball$/i, "")
    .replace(/\s+Bowling Balls?$/i, "")
    .trim();
}

async function delay(ms: number | null | undefined) {
  if (!ms || ms <= 0) return;

  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function fetchEboniteHtml(url: string) {
  const parsedUrl = new URL(url);

  if (parsedUrl.hostname !== EBONITE_HOST) {
    throw new Error("Only ebonite.com URLs are allowed.");
  }

  const response = await axios.get(url, {
    headers: {
      "User-Agent":
        "BowlingBallSeeker/0.1.0 (+https://github.com/kev-lewis/bowling-ball-seeker)",
      Accept: "text/html,application/xhtml+xml",
    },
    timeout: 30000,
  });

  return response.data;
}

function canonicalizeEboniteProductUrl(url: string) {
  const parsedUrl = new URL(url);
  parsedUrl.search = "";
  parsedUrl.hash = "";

  return parsedUrl.toString().replace(/\/$/, "");
}

function isEboniteBallProductUrl(url: string) {
  try {
    const parsedUrl = new URL(url);

    if (parsedUrl.hostname !== EBONITE_HOST) {
      return false;
    }

    return /^\/collections\/balls\/products\/[^/?#]+\/?$/i.test(
      parsedUrl.pathname
    );
  } catch {
    return false;
  }
}

function buildEboniteCatalogPageUrls(sourceUrl: string, maxPages: number) {
  const urls = new Set<string>();
  const baseUrl = new URL(sourceUrl);

  for (let page = 1; page <= maxPages; page++) {
    const pageUrl = new URL(baseUrl.toString());

    if (page > 1) {
      pageUrl.searchParams.set("page", String(page));
    }

    urls.add(pageUrl.toString());
  }

  return [...urls];
}

function discoverEboniteProductLinks(html: string, sourceUrl: string) {
  const $ = cheerio.load(html);
  const products = new Map<string, string>();

  $("a[href]").each((_index, element) => {
    const linkElement = $(element);
    const href = linkElement.attr("href");
    const absoluteUrl = href ? toAbsoluteUrl(href, sourceUrl) : null;

    if (!absoluteUrl || !isEboniteBallProductUrl(absoluteUrl)) {
      return;
    }

    const canonicalUrl = canonicalizeEboniteProductUrl(absoluteUrl);

    const rawName =
      cleanText(linkElement.find("h2,h3,h4").first().text()) ||
      cleanText(linkElement.text()) ||
      cleanText(linkElement.attr("title")) ||
      cleanText(linkElement.find("img").first().attr("alt")) ||
      nameFromEboniteUrl(canonicalUrl);

    const name = cleanEboniteName(rawName) || nameFromEboniteUrl(canonicalUrl);

    if (!products.has(canonicalUrl)) {
      products.set(canonicalUrl, name);
    }
  });

  return [...products.entries()].map(([url, name]) => ({ url, name }));
}

function eboniteLinkToManufacturerBall(
  productUrl: string,
  productName: string,
  brandName: string
): ManufacturerBallInput {
  const canonicalName =
    cleanEboniteName(productName) || nameFromEboniteUrl(productUrl);

  return {
    id: buildBallId(brandName, canonicalName),
    canonicalName,
    brand: brandName,
    manufacturer: brandName,
    coverstockName: null,
    coverstockType: "unknown",
    coreName: null,
    coreType: "unknown",
    factoryFinish: null,
    rg: null,
    differential: null,
    mbDifferential: null,
    availableWeights: [],
    officialUrl: productUrl,
    imageUrl: null,
  };
}

export async function scrapeEboniteManufacturerCatalog(
  options: EboniteCatalogOptions = {}
) {
  const brandName = cleanText(options.brandName) || "Ebonite";
  const sourceUrl = options.sourceUrl ?? DEFAULT_EBONITE_BALLS_URL;
  const maxPages = options.maxPages ?? 1;
  const catalogPageUrls = buildEboniteCatalogPageUrls(sourceUrl, maxPages);

  const productLinks = new Map<string, string>();
  const parseFailures: {
    name: string;
    url: string;
    error: string;
  }[] = [];

  for (const pageUrl of catalogPageUrls) {
    try {
      const html = await fetchEboniteHtml(pageUrl);

      for (const product of discoverEboniteProductLinks(html, pageUrl)) {
        productLinks.set(product.url, product.name);
      }
    } catch (error) {
      parseFailures.push({
        name: brandName,
        url: pageUrl,
        error:
          error instanceof Error ? error.message : "Unknown catalog page error",
      });
    }

    await delay(options.scrapeDelayMs);
  }

  const parsedBalls = [...productLinks.entries()].map(
    ([productUrl, productName]) =>
      eboniteLinkToManufacturerBall(productUrl, productName, brandName)
  );

  const deduped = [
    ...new Map(parsedBalls.map((ball) => [ball.id, ball])).values(),
  ];

  return {
    sourceName: brandName,
    sourceUrl,
    sourceUrls: catalogPageUrls,
    checkedAt: new Date().toISOString(),
    discoveredCount: deduped.length + parseFailures.length,
    parsedCount: deduped.length,
    failureCount: parseFailures.length,
    parsedBalls: deduped,
    parseFailures,
  };
}
