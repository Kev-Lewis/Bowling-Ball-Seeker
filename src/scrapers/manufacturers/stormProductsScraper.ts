import axios from "axios";
import * as cheerio from "cheerio";
import type { ManufacturerBallInput } from "../../types/catalog";
import type { CoreType, CoverstockType } from "../../types/ball";
import { toAbsoluteUrl } from "../../utils/urlUtils";

const STORM_PRODUCTS_DEFAULT_URL =
  "https://www.stormbowling.com/products/equipment/bowling-balls/24/1/1/";

interface StormProductsOptions {
  sourceUrl?: string;
  brandName?: string | null;
  maxPages?: number | null;
  maxProducts?: number | null;
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

function normalizeStormValue(value: string | null | undefined) {
  let cleaned = cleanText(value);

  cleaned = cleaned.replace(/^[A-Z0-9]{1,5}_/, "");
  cleaned = cleaned.replace(/_/g, " ");
  cleaned = cleaned.replace(/\s+/g, " ").trim();

  return cleaned || null;
}

function titleCaseFromSlug(value: string) {
  return value
    .split("-")
    .filter(Boolean)
    .map((part) => {
      if (part.toLowerCase() === "iq") return "!Q";
      if (part.toLowerCase() === "ai") return "A.I.";
      if (part.toLowerCase() === "900") return "900";
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(" ");
}

function nameFromUrl(url: string) {
  const slug = new URL(url).pathname.split("/").filter(Boolean).pop() ?? "";
  const withoutBrand = slug
    .replace(/^storm-/, "")
    .replace(/^roto-grip-/, "")
    .replace(/^900-global-/, "")
    .replace(/-bowling-ball.*$/i, "");

  return titleCaseFromSlug(withoutBrand || slug);
}

function idFromUrl(url: string) {
  const slug = new URL(url).pathname.split("/").filter(Boolean).pop() ?? "";

  return slug
    .toLowerCase()
    .replace(/-bowling-ball/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function cleanName(value: string | null | undefined) {
  return cleanText(value)
    .replace(/\s+Bowling Ball.*$/i, "")
    .replace(/^\s*Storm\s+/i, "")
    .replace(/^\s*Roto Grip\s+/i, "")
    .replace(/^\s*900 Global\s+/i, "")
    .replace(/\s+[–-]\s+.*$/g, "")
    .trim();
}

function inferCoverstockType(value: string | null | undefined): CoverstockType {
  const normalized = cleanText(value).toLowerCase();

  if (
    normalized.includes("plastic") ||
    normalized.includes("polyester") ||
    /\bpoly\b/i.test(normalized)
  ) {
    return "plastic";
  }

  if (normalized.includes("urethane")) {
    return "urethane";
  }

  if (normalized.includes("hybrid")) {
    return "hybrid";
  }

  if (normalized.includes("pearl")) {
    return "pearl";
  }

  if (normalized.includes("solid")) {
    return "solid";
  }

  return "unknown";
}

function parseNumber(value: string | null | undefined) {
  const parsed = Number(cleanText(value).replace(/[^0-9.]/g, ""));

  return Number.isFinite(parsed) ? parsed : null;
}

function inferCoreType(
  coreName: string | null,
  symmetry: string | null,
  mbDifferential: number | null
): CoreType {
  const normalizedSymmetry = cleanText(symmetry).toLowerCase();
  const normalizedCore = cleanText(coreName).toLowerCase();

  if (normalizedSymmetry.includes("asym")) return "asymmetric";
  if (normalizedSymmetry.includes("sym")) return "symmetric";
  if (mbDifferential !== null && mbDifferential > 0) return "asymmetric";
  if (normalizedCore.includes("asym")) return "asymmetric";
  if (coreName) return "symmetric";

  return "unknown";
}

function parseWeights(value: string | null | undefined) {
  const cleaned = cleanText(value);

  const rangeMatch = cleaned.match(/(\d{1,2})\s*[-–]\s*(\d{1,2})/);

  if (rangeMatch) {
    const start = Number(rangeMatch[1]);
    const end = Number(rangeMatch[2]);
    const step = start >= end ? -1 : 1;
    const weights: number[] = [];

    for (let weight = start; step < 0 ? weight >= end : weight <= end; weight += step) {
      if (weight >= 6 && weight <= 16) weights.push(weight);
    }

    return weights;
  }

  return [...new Set((cleaned.match(/\d{1,2}/g) ?? []).map(Number))].filter(
    (weight) => weight >= 6 && weight <= 16
  );
}

function parseAvailableWeights($: cheerio.CheerioAPI, fieldWeight: string | null) {
  const optionText = $("option")
    .toArray()
    .map((option) => cleanText($(option).text()))
    .join(" ");

  const parsedFromOptions = parseWeights(optionText);

  if (parsedFromOptions.length) {
    return parsedFromOptions;
  }

  return parseWeights(fieldWeight);
}

async function delay(ms: number | null | undefined) {
  if (!ms || ms <= 0) return;

  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function fetchHtml(url: string, timeout = 15000) {
  const parsedUrl = new URL(url);

  if (parsedUrl.hostname !== "www.stormbowling.com") {
    throw new Error("Only www.stormbowling.com URLs are allowed.");
  }

  const response = await axios.get(url, {
    headers: {
      "User-Agent":
        "BowlingBallSeeker/0.1.0 (+https://github.com/kev-lewis/bowling-ball-seeker)",
      Accept: "text/html,application/xhtml+xml",
    },
    timeout,
  });

  return response.data;
}

async function fetchHtmlWithRetry(url: string, timeout = 45000, attempts = 3) {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fetchHtml(url, timeout);
    } catch (error) {
      lastError = error;

      if (attempt < attempts) {
        await delay(1000 * attempt);
      }
    }
  }

  throw lastError;
}

function canonicalizeProductUrl(url: string) {
  const parsedUrl = new URL(url);
  parsedUrl.search = "";
  parsedUrl.hash = "";

  return parsedUrl.toString().replace(/\/$/, "");
}

function brandPrefix(brandName: string) {
  const slug = slugify(brandName);

  if (slug === "storm") return "storm-";
  if (slug === "roto-grip") return "roto-grip-";
  if (slug === "900-global") return "900-global-";

  return `${slug}-`;
}

function isStormProductsBallUrl(url: string, brandName: string) {
  try {
    const parsedUrl = new URL(url);

    if (parsedUrl.hostname !== "www.stormbowling.com") {
      return false;
    }

    const slug = parsedUrl.pathname.split("/").filter(Boolean).pop()?.toLowerCase() ?? "";

    return slug.startsWith(brandPrefix(brandName)) && slug.includes("bowling-ball");
  } catch {
    return false;
  }
}

function buildCatalogPageUrls(sourceUrl: string, maxPages: number) {
  const urls = new Set<string>();

  for (let page = 1; page <= maxPages; page++) {
    const pageUrl = new URL(sourceUrl);
    pageUrl.pathname = pageUrl.pathname.replace(/\/\d+\/?$/i, `/${page}/`);
    urls.add(pageUrl.toString());
  }

  return [...urls];
}

function discoverProductLinks(html: string, sourceUrl: string, brandName: string) {
  const $ = cheerio.load(html);
  const products = new Map<string, string>();

  $("a[href]").each((_index, element) => {
    const href = $(element).attr("href");
    const absoluteUrl = href ? toAbsoluteUrl(href, sourceUrl) : null;

    if (!absoluteUrl || !isStormProductsBallUrl(absoluteUrl, brandName)) {
      return;
    }

    const canonicalUrl = canonicalizeProductUrl(absoluteUrl);

    if (!products.has(canonicalUrl)) {
      products.set(canonicalUrl, nameFromUrl(canonicalUrl));
    }
  });

  return [...products.entries()].map(([url, name]) => ({ url, name }));
}

function getMetaContent($: cheerio.CheerioAPI, selector: string) {
  return cleanText($(selector).first().attr("content")) || null;
}

function parseCustomFields($: cheerio.CheerioAPI) {
  const fields = new Map<string, string>();

  $(".product-custom-fields p").each((_index, element) => {
    const fullText = cleanText($(element).text());
    const label = cleanText($(element).find("strong").first().text()).replace(/:$/, "");
    const value = cleanText(fullText.replace(new RegExp(`^${label}:?\\s*`, "i"), ""));

    if (label && (value || !fields.has(label))) {
      fields.set(label, value);
    }
  });

  return fields;
}

function parseDetailPage(
  html: string,
  detailUrl: string,
  fallbackName: string,
  brandName: string
): ManufacturerBallInput {
  const $ = cheerio.load(html);
  const fields = parseCustomFields($);

  const canonicalName =
    cleanName($("h1").first().text()) ||
    cleanName(getMetaContent($, "meta[itemprop='name']")) ||
    cleanName(getMetaContent($, "meta[property='og:title']")) ||
    cleanName(fallbackName) ||
    nameFromUrl(detailUrl);

  const isTropicalSurge =
    brandName === "Storm" && /tropical-surge/i.test(detailUrl);

  const coverstockName =
    normalizeStormValue(fields.get("Coverstock")) ??
    (isTropicalSurge ? "Reactor Pearl Reactive" : null);
  const coreName =
    normalizeStormValue(fields.get("Weight Block")) ??
    normalizeStormValue(fields.get("Core")) ??
    (isTropicalSurge ? "Camber" : null);
  const factoryFinish =
    normalizeStormValue(fields.get("Finish")) ??
    (isTropicalSurge ? "1500 Grit Polished" : null);
  const symmetry =
    normalizeStormValue(fields.get("Symmetry")) ??
    (isTropicalSurge ? "Symmetrical" : null);
  const differential =
    parseNumber(fields.get("Differential")) ??
    (isTropicalSurge ? 0.024 : null);
  const rg =
    parseNumber(fields.get("Radius of Gyration")) ??
    (isTropicalSurge ? 2.57 : null);
  const mbDifferential = parseNumber(fields.get("PSA"));
  const fieldWeight = normalizeStormValue(fields.get("Weight"));
  const coverstockType = inferCoverstockType(coverstockName);
  const coreType =
    coverstockType === "plastic" && !coreName
      ? "symmetric"
      : inferCoreType(coreName, symmetry, mbDifferential);

  return {
    id: idFromUrl(detailUrl),
    canonicalName,
    brand: brandName,
    manufacturer: brandName,
    coverstockName,
    coverstockType,
    coreName,
    coreType,
    factoryFinish,
    rg,
    differential,
    mbDifferential,
    availableWeights: isTropicalSurge
      ? [10, 11, 12, 13, 14, 15, 16]
      : parseAvailableWeights($, fieldWeight),
    officialUrl: detailUrl,
    imageUrl:
      getMetaContent($, "meta[property='og:image']") ??
      getMetaContent($, "meta[itemprop='image']"),
  };
}

function linkToManufacturerBall(
  productUrl: string,
  productName: string,
  brandName: string
): ManufacturerBallInput {
  return {
    id: idFromUrl(productUrl),
    canonicalName: cleanName(productName) || nameFromUrl(productUrl),
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

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>
) {
  const results: R[] = [];
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const currentIndex = index++;
      results[currentIndex] = await mapper(items[currentIndex]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker())
  );

  return results;
}

export async function scrapeStormProductsManufacturerCatalog(
  options: StormProductsOptions = {}
) {
  const brandName = cleanText(options.brandName) || "Storm";
  const sourceUrl = options.sourceUrl ?? STORM_PRODUCTS_DEFAULT_URL;
  const maxPages = options.maxPages ?? 3;
  const catalogPageUrls = buildCatalogPageUrls(sourceUrl, maxPages);

  const productLinks = new Map<string, string>();
  const parseFailures: {
    name: string;
    url: string;
    error: string;
  }[] = [];

  for (const pageUrl of catalogPageUrls) {
    try {
      const html = await fetchHtml(pageUrl, 30000);

      for (const product of discoverProductLinks(html, pageUrl, brandName)) {
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

  const productEntries = [...productLinks.entries()].slice(
    0,
    options.maxProducts ?? undefined
  );

  const parsedBalls = await mapWithConcurrency(productEntries, 2, async ([productUrl, productName]) => {
    try {
      const html = await fetchHtmlWithRetry(productUrl, 45000, 3);
      return parseDetailPage(html, productUrl, productName, brandName);
    } catch {
      return linkToManufacturerBall(productUrl, productName, brandName);
    }
  });

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
