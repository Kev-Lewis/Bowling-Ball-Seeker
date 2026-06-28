import axios from "axios";
import * as cheerio from "cheerio";
import type { ManufacturerBallInput } from "../../types/catalog";
import { toAbsoluteUrl } from "../../utils/urlUtils";

const DV8_HOST = "dv8bowling.com";
const DEFAULT_DV8_CURRENT_URL =
  "https://dv8bowling.com/products/balls/current";

export interface DV8CatalogOptions {
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

function nameFromDV8Url(url: string) {
  const slug = new URL(url).pathname.split("/").filter(Boolean).pop();

  return slug ? titleCaseFromSlug(slug) : "Unknown Ball";
}

function cleanDV8Name(value: string) {
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

async function fetchDV8Html(url: string) {
  const parsedUrl = new URL(url);

  if (parsedUrl.hostname !== DV8_HOST) {
    throw new Error("Only dv8bowling.com URLs are allowed.");
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

function canonicalizeDV8ProductUrl(url: string) {
  const parsedUrl = new URL(url);
  parsedUrl.search = "";
  parsedUrl.hash = "";

  return parsedUrl.toString().replace(/\/$/, "");
}

function isDV8CurrentBallUrl(url: string) {
  try {
    const parsedUrl = new URL(url);

    if (parsedUrl.hostname !== DV8_HOST) {
      return false;
    }

    const match = parsedUrl.pathname.match(
      /^\/products\/balls\/current\/([^/?#]+)\/?$/i
    );

    if (!match) {
      return false;
    }

    const slug = match[1].toLowerCase();

    if (/^p\d+$/.test(slug)) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

function buildDV8CatalogPageUrls(sourceUrl: string, maxPages: number) {
  const urls = new Set<string>();
  const source = new URL(sourceUrl);
  const basePath = source.pathname.replace(/\/p\d+\/?$/i, "").replace(/\/$/, "");

  for (let page = 1; page <= maxPages; page++) {
    const pageUrl = new URL(source.toString());

    pageUrl.pathname = page === 1 ? basePath : `${basePath}/p${page}`;
    pageUrl.searchParams.set("sort", "newest");

    urls.add(pageUrl.toString());
  }

  return [...urls];
}

function discoverDV8ProductLinks(html: string, sourceUrl: string) {
  const $ = cheerio.load(html);
  const products = new Map<string, string>();

  $("a[href]").each((_index, element) => {
    const linkElement = $(element);
    const href = linkElement.attr("href");
    const absoluteUrl = href ? toAbsoluteUrl(href, sourceUrl) : null;

    if (!absoluteUrl || !isDV8CurrentBallUrl(absoluteUrl)) {
      return;
    }

    const canonicalUrl = canonicalizeDV8ProductUrl(absoluteUrl);
    const name = nameFromDV8Url(canonicalUrl);

    if (!products.has(canonicalUrl)) {
      products.set(canonicalUrl, name);
    }
  });

  return [...products.entries()].map(([url, name]) => ({ url, name }));
}

function dv8LinkToManufacturerBall(
  productUrl: string,
  productName: string,
  brandName: string
): ManufacturerBallInput {
  const canonicalName =
    cleanDV8Name(productName) || nameFromDV8Url(productUrl);

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

export async function scrapeDV8ManufacturerCatalog(
  options: DV8CatalogOptions = {}
) {
  const brandName = cleanText(options.brandName) || "DV8";
  const sourceUrl = options.sourceUrl ?? DEFAULT_DV8_CURRENT_URL;
  const maxPages = options.maxPages ?? 3;
  const catalogPageUrls = buildDV8CatalogPageUrls(sourceUrl, maxPages);

  const productLinks = new Map<string, string>();
  const parseFailures: {
    name: string;
    url: string;
    error: string;
  }[] = [];

  for (const pageUrl of catalogPageUrls) {
    try {
      const html = await fetchDV8Html(pageUrl);

      for (const product of discoverDV8ProductLinks(html, pageUrl)) {
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
      dv8LinkToManufacturerBall(productUrl, productName, brandName)
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
