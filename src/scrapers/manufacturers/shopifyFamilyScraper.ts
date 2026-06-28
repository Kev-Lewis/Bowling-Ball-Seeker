import axios from "axios";
import * as cheerio from "cheerio";
import type { ManufacturerBallInput } from "../../types/catalog";
import type { CoreType, CoverstockType } from "../../types/ball";
import { toAbsoluteUrl } from "../../utils/urlUtils";

export interface ShopifyFamilyCatalogOptions {
  sourceUrl?: string;
  brandName?: string | null;
  maxPages?: number | null;
  scrapeDelayMs?: number | null;
}

export interface ShopifyFamilyScraperConfig {
  host: string;
  defaultSourceUrl: string;
  defaultBrandName: string;
}

function cleanText(value: string | null | undefined) {
  return (value ?? "")
    .replace(/\\n/g, "\n")
    .replace(/\\\//g, "/")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .trim();
}

function compactText(value: string | null | undefined) {
  return cleanText(value).replace(/\s+/g, " ").trim();
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
    .map((part) => {
      if (part.toLowerCase() === "gb5") return "GB5";
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(" ");
}

function nameFromUrl(url: string) {
  const slug = new URL(url).pathname.split("/").filter(Boolean).pop();

  return slug ? titleCaseFromSlug(slug) : "Unknown Ball";
}

function cleanName(value: string | null | undefined) {
  return compactText(value)
    .replace(/\s*[–-]\s*(Hammer|Ebonite|Track).*$/i, "")
    .replace(/\s+Bowling Ball$/i, "")
    .replace(/\s+Bowling Balls?$/i, "")
    .trim();
}

function inferCoverstockType(value: string | null | undefined): CoverstockType {
  const normalized = compactText(value).toLowerCase();

  if (normalized.includes("plastic") || normalized.includes("polyester")) {
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

function inferCoreType(coreName: string | null, mbDifferential: number | null): CoreType {
  const normalized = compactText(coreName).toLowerCase();

  if (mbDifferential !== null && mbDifferential > 0) {
    return "asymmetric";
  }

  if (
    normalized.includes("asym") ||
    normalized.includes("gas mask") ||
    normalized.includes("widow")
  ) {
    return "asymmetric";
  }

  if (coreName) {
    return "symmetric";
  }

  return "unknown";
}

function parseWeights(value: string | null | undefined) {
  const cleaned = compactText(value);

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

async function delay(ms: number | null | undefined) {
  if (!ms || ms <= 0) return;

  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function fetchHtml(url: string, host: string, timeout = 15000) {
  const parsedUrl = new URL(url);

  if (parsedUrl.hostname !== host) {
    throw new Error(`Only ${host} URLs are allowed.`);
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

function canonicalizeProductUrl(url: string) {
  const parsedUrl = new URL(url);
  parsedUrl.search = "";
  parsedUrl.hash = "";

  return parsedUrl.toString().replace(/\/$/, "");
}

function isProductUrl(url: string, host: string) {
  try {
    const parsedUrl = new URL(url);

    if (parsedUrl.hostname !== host) {
      return false;
    }

    return (
      /^\/collections\/balls\/products\/[^/?#]+\/?$/i.test(parsedUrl.pathname) ||
      /^\/products\/[^/?#]+\/?$/i.test(parsedUrl.pathname)
    );
  } catch {
    return false;
  }
}

function buildCatalogPageUrls(sourceUrl: string, maxPages: number) {
  const urls = new Set<string>();

  for (let page = 1; page <= maxPages; page++) {
    const pageUrl = new URL(sourceUrl);

    if (page > 1) {
      pageUrl.searchParams.set("page", String(page));
    }

    urls.add(pageUrl.toString());
  }

  return [...urls];
}

function discoverProductLinks(html: string, sourceUrl: string, host: string) {
  const $ = cheerio.load(html);
  const products = new Map<string, string>();

  $("a[href]").each((_index, element) => {
    const href = $(element).attr("href");
    const absoluteUrl = href ? toAbsoluteUrl(href, sourceUrl) : null;

    if (!absoluteUrl || !isProductUrl(absoluteUrl, host)) {
      return;
    }

    const canonicalUrl = canonicalizeProductUrl(absoluteUrl);

    if (!products.has(canonicalUrl)) {
      products.set(canonicalUrl, nameFromUrl(canonicalUrl));
    }
  });

  return [...products.entries()].map(([url, name]) => ({ url, name }));
}

function getJsonLdObjects($: cheerio.CheerioAPI) {
  const objects: any[] = [];

  $("script[type='application/ld+json']").each((_index, element) => {
    const raw = $(element).contents().text();

    try {
      const parsed = JSON.parse(raw);

      if (Array.isArray(parsed)) {
        objects.push(...parsed);
      } else if (parsed?.["@graph"] && Array.isArray(parsed["@graph"])) {
        objects.push(...parsed["@graph"]);
      } else {
        objects.push(parsed);
      }
    } catch {
      // Ignore invalid JSON-LD.
    }
  });

  return objects;
}

function getJsonLdProduct($: cheerio.CheerioAPI) {
  return getJsonLdObjects($).find((object) => {
    const type = object?.["@type"];
    return type === "Product" || (Array.isArray(type) && type.includes("Product"));
  });
}

function getMetaContent($: cheerio.CheerioAPI, selector: string) {
  return compactText($(selector).first().attr("content")) || null;
}

function getImageUrl($: cheerio.CheerioAPI, detailUrl: string, jsonLdProduct: any) {
  const image = jsonLdProduct?.image;

  if (typeof image === "string") {
    return toAbsoluteUrl(image, detailUrl);
  }

  if (image?.url && typeof image.url === "string") {
    return toAbsoluteUrl(image.url, detailUrl);
  }

  if (image?.image && typeof image.image === "string") {
    return toAbsoluteUrl(image.image, detailUrl);
  }

  const ogImage = getMetaContent($, "meta[property='og:image:secure_url']") ||
    getMetaContent($, "meta[property='og:image']");

  if (ogImage) {
    return toAbsoluteUrl(ogImage, detailUrl);
  }

  return null;
}

function getDescriptionText($: cheerio.CheerioAPI, jsonLdProduct: any) {
  const jsonDescription = cleanText(jsonLdProduct?.description);

  if (jsonDescription) {
    return jsonDescription;
  }

  const bodyText = cleanText(
    $("[class*='description' i], [class*='rte' i], .product-single__description")
      .first()
      .text()
  );

  return bodyText || cleanText($("body").text());
}

const SPEC_LABELS = [
  "PERFORMANCE",
  "PART NUMBER",
  "COLOR",
  "CORE",
  "COVERSTOCK",
  "COVER TYPE",
  "FINISH",
  "WEIGHTS",
  "LANE CONDITION",
  "REACTION",
  "WARRANTY",
  "RELEASE DATE",
  "CORE NUMBERS",
  "RG / DIFF / ASY",
  "RG / DIFF",
  "FEATURING",
  "DOWNLOADS",
];

function getLines(text: string) {
  return cleanText(text)
    .split(/\n+/)
    .map((line) => compactText(line))
    .filter(Boolean);
}

function isSpecLabel(value: string) {
  const normalized = value.toUpperCase();

  return SPEC_LABELS.includes(normalized);
}

function getSpecValue(lines: string[], label: string) {
  const normalizedLabel = label.toUpperCase();

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const upper = line.toUpperCase();

    if (upper === normalizedLabel) {
      const next = lines[index + 1];

      if (!next || isSpecLabel(next)) {
        return null;
      }

      return next;
    }

    if (upper.startsWith(`${normalizedLabel} `)) {
      const value = compactText(line.slice(label.length));

      if (value && !isSpecLabel(value)) {
        return value;
      }
    }
  }

  return null;
}

function parseCoreNumbers(text: string) {
  const normalized = compactText(text);
  const rows: {
    weight: number;
    rg: number | null;
    differential: number | null;
    mbDifferential: number | null;
  }[] = [];

  const explicitPattern =
    /(\d{1,2})\s*lb\s*[-–]\s*RG\s*\(?(\d+\.\d+)\)?\s*DIFF\s*\(?(\d+\.\d+)\)?(?:\s*(?:ASY|INT DIFF|MB|MASS BIAS)\s*\(?(\d+\.\d+)\)?)?/gi;

  for (const match of normalized.matchAll(explicitPattern)) {
    rows.push({
      weight: Number(match[1]),
      rg: Number(match[2]),
      differential: Number(match[3]),
      mbDifferential: match[4] ? Number(match[4]) : null,
    });
  }

  if (!rows.length) {
    const tablePattern =
      /(\d{1,2})\s*lb\s+(\d+\.\d+)\s+(\d+\.\d+)(?:\s+(?!\d{1,2}\s*lb)(\d+\.\d+))?/gi;

    for (const match of normalized.matchAll(tablePattern)) {
      rows.push({
        weight: Number(match[1]),
        rg: Number(match[2]),
        differential: Number(match[3]),
        mbDifferential: match[4] ? Number(match[4]) : null,
      });
    }
  }

  const selected =
    rows.find((row) => row.weight === 15) ??
    rows.find((row) => row.weight >= 12 && row.weight <= 16) ??
    rows[0];

  return {
    rg: selected?.rg ?? null,
    differential: selected?.differential ?? null,
    mbDifferential: selected?.mbDifferential ?? null,
  };
}

function parseDetailPage(
  html: string,
  detailUrl: string,
  fallbackName: string,
  brandName: string
): ManufacturerBallInput {
  const $ = cheerio.load(html);
  const jsonLdProduct = getJsonLdProduct($);
  const description = getDescriptionText($, jsonLdProduct);
  const lines = getLines(description);

  const canonicalName =
    cleanName($("h1").first().text()) ||
    cleanName(jsonLdProduct?.name) ||
    cleanName(getMetaContent($, "meta[property='og:title']")) ||
    cleanName(fallbackName) ||
    nameFromUrl(detailUrl);

  const coreName = getSpecValue(lines, "CORE");
  const coverstockName = getSpecValue(lines, "COVERSTOCK");
  const coverType = getSpecValue(lines, "COVER TYPE");
  const factoryFinish = getSpecValue(lines, "FINISH");
  const weightsText = getSpecValue(lines, "WEIGHTS");
  const coreNumbers = parseCoreNumbers(description);
  const coverstockType = inferCoverstockType(coverType ?? coverstockName);
  const isHammerAxe = brandName === "Hammer" && /\baxe\b/i.test(canonicalName);
  const normalizedCoreName = isHammerAxe && coreName === "Bullet" ? "Bullet Pancake" : coreName;
  const finalCoverstockType = isHammerAxe ? "unknown" : coverstockType;
  const coreType =
    finalCoverstockType === "plastic" && !normalizedCoreName
      ? "symmetric"
      : inferCoreType(normalizedCoreName, coreNumbers.mbDifferential);

  return {
    id: buildBallId(brandName, canonicalName),
    canonicalName,
    brand: brandName,
    manufacturer: brandName,
    coverstockName,
    coverstockType: finalCoverstockType,
    coreName: normalizedCoreName,
    coreType,
    factoryFinish,
    rg: coreNumbers.rg,
    differential: coreNumbers.differential,
    mbDifferential: coreNumbers.mbDifferential,
    availableWeights: parseWeights(weightsText),
    officialUrl: detailUrl,
    imageUrl: getImageUrl($, detailUrl, jsonLdProduct),
  };
}

function linkToManufacturerBall(
  productUrl: string,
  productName: string,
  brandName: string
): ManufacturerBallInput {
  const canonicalName = cleanName(productName) || nameFromUrl(productUrl);

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

export async function scrapeShopifyFamilyManufacturerCatalog(
  config: ShopifyFamilyScraperConfig,
  options: ShopifyFamilyCatalogOptions = {}
) {
  const brandName = compactText(options.brandName) || config.defaultBrandName;
  const sourceUrl = options.sourceUrl ?? config.defaultSourceUrl;
  const maxPages = options.maxPages ?? 1;
  const catalogPageUrls = buildCatalogPageUrls(sourceUrl, maxPages);

  const productLinks = new Map<string, string>();
  const parseFailures: {
    name: string;
    url: string;
    error: string;
  }[] = [];

  for (const pageUrl of catalogPageUrls) {
    try {
      const html = await fetchHtml(pageUrl, config.host, 30000);

      for (const product of discoverProductLinks(html, pageUrl, config.host)) {
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

  const productEntries = [...productLinks.entries()];

  const parsedBalls = await mapWithConcurrency(productEntries, 4, async ([productUrl, productName]) => {
    try {
      const html = await fetchHtml(productUrl, config.host, 15000);
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
