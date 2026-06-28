import axios from "axios";
import * as cheerio from "cheerio";
import type { ManufacturerBallInput } from "../../types/catalog";
import type { CoreType, CoverstockType } from "../../types/ball";
import { toAbsoluteUrl } from "../../utils/urlUtils";

export interface BrunswickFamilyCatalogOptions {
  sourceUrl?: string;
  brandName?: string | null;
  maxPages?: number | null;
  scrapeDelayMs?: number | null;
}

export interface BrunswickFamilyScraperConfig {
  host: string;
  defaultSourceUrl: string;
  defaultBrandName: string;
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
    .map((part) => {
      if (part.toLowerCase() === "dv8") return "DV8";
      if (part.toLowerCase() === "tzone") return "TZone";
      if (part.toLowerCase() === "78u") return "78U";
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(" ");
}

function nameFromUrl(url: string) {
  const slug = new URL(url).pathname.split("/").filter(Boolean).pop();

  return slug ? titleCaseFromSlug(slug) : "Unknown Ball";
}

function cleanName(value: string) {
  return cleanText(value)
    .replace(/\s*\|.*$/g, "")
    .replace(/\s*>.*$/g, "")
    .replace(/\s+Bowling Ball$/i, "")
    .replace(/\s+Bowling Balls?$/i, "")
    .trim();
}

function inferCoverstockType(value: string | null | undefined): CoverstockType {
  const normalized = cleanText(value).toLowerCase();

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
  if (!coreName) return "unknown";
  if (mbDifferential !== null && mbDifferential > 0) return "asymmetric";
  return "symmetric";
}

function parseWeights(value: string | null | undefined) {
  const cleaned = cleanText(value);

  const rangeMatch = cleaned.match(/(\d{1,2})\s*-\s*(\d{1,2})/);

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

function isCurrentBallUrl(url: string, host: string) {
  try {
    const parsedUrl = new URL(url);

    if (parsedUrl.hostname !== host) {
      return false;
    }

    const match = parsedUrl.pathname.match(
      /^\/products\/balls\/current\/([^/?#]+)\/?$/i
    );

    if (!match) {
      return false;
    }

    const slug = match[1].toLowerCase();

    return !/^p\d+$/.test(slug);
  } catch {
    return false;
  }
}

function buildCatalogPageUrls(sourceUrl: string, maxPages: number) {
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

function discoverProductLinks(html: string, sourceUrl: string, host: string) {
  const $ = cheerio.load(html);
  const products = new Map<string, string>();

  $("a[href]").each((_index, element) => {
    const linkElement = $(element);
    const href = linkElement.attr("href");
    const absoluteUrl = href ? toAbsoluteUrl(href, sourceUrl) : null;

    if (!absoluteUrl || !isCurrentBallUrl(absoluteUrl, host)) {
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
      // Ignore bad JSON-LD.
    }
  });

  return objects;
}

function getMetaContent($: cheerio.CheerioAPI, selector: string) {
  return cleanText($(selector).first().attr("content")) || null;
}

function getImageUrl($: cheerio.CheerioAPI, detailUrl: string) {
  const jsonLdImage = getJsonLdObjects($)
    .flatMap((object) => object?.image ?? [])
    .find((image) => typeof image === "string");

  if (jsonLdImage) {
    return toAbsoluteUrl(jsonLdImage, detailUrl);
  }

  const ogImage = getMetaContent($, "meta[property='og:image']");

  if (ogImage) {
    return toAbsoluteUrl(ogImage, detailUrl);
  }

  const imageSrc =
    cleanText($("img[alt*='bowling' i]").first().attr("src")) ||
    cleanText($("img").first().attr("src"));

  return imageSrc ? toAbsoluteUrl(imageSrc, detailUrl) : null;
}

function parseStatsTable($: cheerio.CheerioAPI) {
  const fields = new Map<string, string>();

  $("table.c-stats tr").each((_index, row) => {
    const label = cleanText($(row).find("th").first().text());
    const value = cleanText($(row).find("td").first().text());

    if (label && value) {
      fields.set(label.toLowerCase(), value);
    }
  });

  return {
    coreName: fields.get("core") ?? null,
    coverstockName: fields.get("coverstock") ?? null,
    coverType: fields.get("cover type") ?? null,
    factoryFinish: fields.get("finish") ?? null,
    weightsText: fields.get("weights") ?? null,
  };
}

function parseCoreNumbersTable($: cheerio.CheerioAPI) {
  const table = $("#core-numbers table").first();

  if (!table.length) {
    return {
      rg: null,
      differential: null,
      mbDifferential: null,
    };
  }

  const headers = table
    .find("tr")
    .first()
    .find("td,th")
    .toArray()
    .map((cell) => cleanText($(cell).text()));

  const weights = headers.map((header) => {
    const match = header.match(/\b(\d{1,2})\s*lb\b/i);
    return match ? Number(match[1]) : null;
  });

  const targetColumnIndex = weights.indexOf(15) >= 0 ? weights.indexOf(15) : weights.findIndex(Boolean);

  function getRowValue(labelPattern: RegExp) {
    let selected: number | null = null;

    table.find("tr").each((_index, row) => {
      const cells = $(row).find("td,th").toArray();
      const label = cleanText($(cells[0]).text());

      if (!labelPattern.test(label)) {
        return;
      }

      const values = cells.slice(1).map((cell) => {
        const parsed = Number(cleanText($(cell).text()).replace(/[^0-9.]/g, ""));
        return Number.isFinite(parsed) ? parsed : null;
      });

      const valueIndex = targetColumnIndex > 0 ? targetColumnIndex - 1 : 0;
      selected = values[valueIndex] ?? values.find((value) => value !== null) ?? null;
    });

    return selected;
  }

  return {
    rg: getRowValue(/^RG$/i),
    differential: getRowValue(/^DIFF$/i),
    mbDifferential: getRowValue(/^(ASY|INT DIFF)$/i),
  };
}

function getSpecRootText($: cheerio.CheerioAPI) {
  const selectors = [
    "[class*='spec' i]",
    "[id*='spec' i]",
    "[class*='product' i]",
    "main",
    "body",
  ];

  for (const selector of selectors) {
    const text = cleanText($(selector).text());

    if (
      /Coverstock|Cover Type|Core|Finish|Weights|RG|DIFF|ASY|Release Date/i.test(text)
    ) {
      return text;
    }
  }

  return cleanText($.root().text());
}

function getFieldFromText(text: string, label: string) {
  const labels = [
    "Level",
    "Part Number",
    "Color",
    "Core",
    "Coverstock",
    "Cover Type",
    "Finish",
    "Weights",
    "Warranty",
    "Release Date",
    "Performance Index",
    "RG",
    "DIFF",
    "ASY",
    "HIGH:",
    "PRO:",
    "ADVANCED:",
    "AFFORDABLE:",
    "POLYESTER:",
  ];

  const escapedNextLabels = labels
    .filter((item) => item !== label)
    .map((item) => item.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");

  const pattern = new RegExp(
    `${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*:?\\s+([\\s\\S]*?)(?=\\s+(?:${escapedNextLabels})\\s*:?\\s+|$)`,
    "i"
  );

  return cleanText(text.match(pattern)?.[1] ?? null) || null;
}

function parseCoreNumber(rootText: string, label: "RG" | "DIFF" | "ASY") {
  const normalized = rootText.replace(/\s+/g, " ");
  const labelMatch = normalized.match(
    new RegExp(`${label}\\s+((?:\\d+\\.\\d+\\s*){1,8})`, "i")
  );

  if (!labelMatch) {
    return null;
  }

  const values = (labelMatch[1].match(/\d+\.\d+/g) ?? []).map(Number);

  if (!values.length) {
    return null;
  }

  const nearbyBefore = normalized.slice(0, labelMatch.index ?? 0).slice(-120);
  const weights = (nearbyBefore.match(/\b(?:16|15|14|13|12|11|10|9|8|7|6)\s*lb\b/gi) ?? [])
    .map((value) => Number(value.match(/\d+/)?.[0]))
    .filter(Boolean);

  const index15 = weights.indexOf(15);
  const selectedIndex = index15 >= 0 ? index15 : 0;

  return Number.isFinite(values[selectedIndex]) ? values[selectedIndex] : values[0] ?? null;
}

function parseDetailPage(
  html: string,
  detailUrl: string,
  fallbackName: string,
  brandName: string
): ManufacturerBallInput {
  const $ = cheerio.load(html);

  const jsonLdProduct = getJsonLdObjects($).find((object) => {
    const type = object?.["@type"];
    return type === "Product" || (Array.isArray(type) && type.includes("Product"));
  });

  const canonicalName =
    cleanName($("h1").first().text()) ||
    cleanName(jsonLdProduct?.name) ||
    cleanName(getMetaContent($, "meta[property='og:title']") ?? "") ||
    cleanName(fallbackName) ||
    nameFromUrl(detailUrl);

  const stats = parseStatsTable($);
  const coreNumbers = parseCoreNumbersTable($);
  const coverstockType = inferCoverstockType(stats.coverType ?? stats.coverstockName);
  const coreType =
    coverstockType === "plastic" && !stats.coreName
      ? "symmetric"
      : inferCoreType(stats.coreName, coreNumbers.mbDifferential);

  return {
    id: buildBallId(brandName, canonicalName),
    canonicalName,
    brand: brandName,
    manufacturer: brandName,
    coverstockName: stats.coverstockName,
    coverstockType,
    coreName: stats.coreName,
    coreType,
    factoryFinish: stats.factoryFinish,
    rg: coreNumbers.rg,
    differential: coreNumbers.differential,
    mbDifferential: coreNumbers.mbDifferential,
    availableWeights: parseWeights(stats.weightsText),
    officialUrl: detailUrl,
    imageUrl: getImageUrl($, detailUrl),
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

export async function scrapeBrunswickFamilyManufacturerCatalog(
  config: BrunswickFamilyScraperConfig,
  options: BrunswickFamilyCatalogOptions = {}
) {
  const brandName = cleanText(options.brandName) || config.defaultBrandName;
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
      const html = await fetchHtml(productUrl, config.host, 12000);
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
