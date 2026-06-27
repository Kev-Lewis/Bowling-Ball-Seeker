import axios from "axios";
import * as cheerio from "cheerio";
import type { ManufacturerBallInput } from "../../types/catalog";
import type { CoreType, CoverstockType } from "../../types/ball";
import { toAbsoluteUrl } from "../../utils/urlUtils";

const STORM_PRODUCTS_HOST = "www.stormbowling.com";

export interface StormProductsCatalogOptions {
  sourceUrl: string;
  brandName: string;
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
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function buildBallId(brand: string, canonicalName: string) {
  return `${slugify(brand)}-${slugify(canonicalName)}`;
}

function normalizeStormValue(value: string | null | undefined) {
  const cleaned = cleanText(value);

  return cleaned
    .replace(/^(S|R|900)_/i, "")
    .replace(/_/g, " ")
    .trim();
}

function normalizeBrand(value: string) {
  const normalized = cleanText(value).toLowerCase();

  if (normalized === "900 global" || normalized === "900-global") {
    return "900 Global";
  }

  if (normalized === "roto grip" || normalized === "roto-grip") {
    return "Roto Grip";
  }

  if (normalized === "storm") {
    return "Storm";
  }

  return cleanText(value);
}

function inferCoverstockType(coverstockName: string | null): CoverstockType {
  const value = coverstockName?.toLowerCase() ?? "";

  if (value.includes("plastic") || value.includes("polyester")) {
    return "plastic";
  }

  if (value.includes("urethane")) {
    return "urethane";
  }

  if (value.includes("hybrid")) {
    return "hybrid";
  }

  if (value.includes("pearl")) {
    return "pearl";
  }

  if (value.includes("solid")) {
    return "solid";
  }

  return "unknown";
}

function inferCoreType(symmetry: string | null): CoreType {
  const value = symmetry?.toLowerCase() ?? "";

  if (value.includes("asym")) {
    return "asymmetric";
  }

  if (value.includes("sym")) {
    return "symmetric";
  }

  return "unknown";
}

function parseNumber(value: string | null | undefined) {
  const cleaned = cleanText(value).replace(/[^0-9.]/g, "");
  const parsed = Number(cleaned);

  return Number.isFinite(parsed) ? parsed : null;
}

function parseWeight(value: string | null | undefined) {
  const parsed = parseNumber(value);

  if (parsed === null) {
    return [];
  }

  return [Math.floor(parsed)];
}

async function delay(ms: number | null | undefined) {
  if (!ms || ms <= 0) return;

  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function fetchStormProductsHtml(url: string) {
  const parsedUrl = new URL(url);

  if (parsedUrl.hostname !== STORM_PRODUCTS_HOST) {
    throw new Error("Only stormbowling.com URLs are allowed.");
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

function isStormProductsDetailBallUrl(url: string) {
  try {
    const parsedUrl = new URL(url);
    const pathname = parsedUrl.pathname.toLowerCase().replace(/\/$/, "");

    if (parsedUrl.hostname !== STORM_PRODUCTS_HOST) {
      return false;
    }

    if (pathname.includes("/products/equipment/bowling-balls")) {
      return false;
    }

    return /^\/(?:storm|roto-grip|900-global)-[a-z0-9-]*bowling-ball[a-z0-9-]*$/i.test(
      pathname
    );
  } catch {
    return false;
  }
}

function inferStormProductsBrandFromUrl(url: string) {
  const pathname = new URL(url).pathname.toLowerCase();

  if (pathname.includes("roto-grip-")) {
    return "Roto Grip";
  }

  if (pathname.includes("900-global-")) {
    return "900 Global";
  }

  return "Storm";
}

function isExpectedStormProductsBrandUrl(url: string, expectedBrandName: string) {
  const expectedBrand = normalizeBrand(expectedBrandName);
  const inferredBrand = inferStormProductsBrandFromUrl(url);

  return inferredBrand === expectedBrand;
}

function titleCaseFromSlug(value: string) {
  return value
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function nameFromStormProductsUrl(url: string) {
  const parsedUrl = new URL(url);
  const slug = parsedUrl.pathname
    .split("/")
    .filter(Boolean)
    .pop()
    ?.replace(/^storm-/, "")
    .replace(/^roto-grip-/, "")
    .replace(/^900-global-/, "")
    .replace(/-bowling-ball-/i, "-")
    .replace(/-bowling-ball$/i, "");

  return slug ? titleCaseFromSlug(slug) : "Unknown Ball";
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function cleanStormProductsName(value: string, brandName: string) {
  return cleanText(value)
    .replace(/\s*\|.*$/g, "")
    .replace(new RegExp("^" + escapeRegex(brandName) + "\\s+", "i"), "")
    .replace(/\s+Bowling Balls?\s+for\s+Sale$/i, "")
    .replace(/\s+Bowling Balls?$/i, "")
    .trim();
}

function discoverStormProductsCatalogPageUrls(
  sourceUrl: string,
  maxPages: number
) {
  const urls = new Set<string>();
  const parsedUrl = new URL(sourceUrl);
  const pathname = parsedUrl.pathname;

  if (/\/products\/equipment\/bowling-balls\/24\/1\/\d+\/?$/i.test(pathname)) {
    for (let page = 1; page <= maxPages; page++) {
      const pageUrl = new URL(sourceUrl);
      pageUrl.pathname = `/products/equipment/bowling-balls/24/1/${page}/`;
      urls.add(pageUrl.toString());
    }

    return [...urls];
  }

  urls.add(sourceUrl);

  for (let page = 2; page <= maxPages; page++) {
    const pageUrl = new URL(sourceUrl);
    pageUrl.pathname = `/products/equipment/bowling-balls/24/1/${page}/`;
    urls.add(pageUrl.toString());
  }

  return [...urls];
}

function discoverStormProductsDetailUrls(
  html: string,
  sourceUrl: string,
  expectedBrandName: string
) {
  const $ = cheerio.load(html);
  const urls = new Set<string>();

  function addUrl(value: string | null | undefined) {
    if (!value) {
      return;
    }

    const absoluteUrl = toAbsoluteUrl(value, sourceUrl);

    if (!absoluteUrl) {
      return;
    }

    if (!isStormProductsDetailBallUrl(absoluteUrl)) {
      return;
    }

    if (!isExpectedStormProductsBrandUrl(absoluteUrl, expectedBrandName)) {
      return;
    }

    urls.add(absoluteUrl);
  }

  $("a[href]").each((_index, element) => {
    addUrl($(element).attr("href"));
  });

  const rawMatches =
    html.match(
      /https?:\/\/www\.stormbowling\.com\/[a-z0-9-]+-bowling-ball|\/[a-z0-9-]+-bowling-ball/gi
    ) ?? [];

  for (const match of rawMatches) {
    addUrl(match);
  }

  return [...urls];
}

function getField(lines: string[], label: string) {
  const labelPrefix = `${label.toLowerCase()}:`;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const normalizedLine = line.toLowerCase();

    if (normalizedLine.startsWith(labelPrefix)) {
      return cleanText(line.slice(label.length + 1));
    }

    if (normalizedLine === labelPrefix && lines[i + 1]) {
      return cleanText(lines[i + 1]);
    }
  }

  return null;
}

function parseCardFields(text: string) {
  const lines = text
    .split(/\r?\n/)
    .map(cleanText)
    .filter(Boolean);

  const fields: Record<string, string> = {};

  const labels = [
    "SKU",
    "Brand",
    "Line",
    "Core",
    "Weight Block",
    "Finish",
    "Durometer",
    "Symmetry",
    "Differential",
    "Flare Potential",
    "Radius of Gyration",
    "Weight",
    "Coverstock",
    "Color",
    "Release Date",
    "Fragrance",
    "Avail. for Sales Orders",
    "PSA",
  ];

  for (const label of labels) {
    const value = getField(lines, label);

    if (value) {
      fields[label] = value;
    }
  }

  return fields;
}

function cardToManufacturerBall(
  name: string,
  url: string,
  fields: Record<string, string>,
  expectedBrandName: string
): ManufacturerBallInput {
  const brand = normalizeBrand(fields.Brand ?? expectedBrandName);
  const coverstockName = normalizeStormValue(fields.Coverstock);
  const coreName =
    normalizeStormValue(fields["Weight Block"]) ||
    normalizeStormValue(fields.Core);
  const factoryFinish = normalizeStormValue(fields.Finish);
  const symmetry = normalizeStormValue(fields.Symmetry);
  const rg = parseNumber(fields["Radius of Gyration"]);
  const differential = parseNumber(fields.Differential);
  const mbDifferential = parseNumber(fields.PSA);

  return {
    id: buildBallId(brand, name),
    canonicalName: name,
    brand,
    manufacturer: brand,
    coverstockName: coverstockName || null,
    coverstockType: inferCoverstockType(coverstockName),
    coreName: coreName || null,
    coreType: inferCoreType(symmetry),
    factoryFinish: factoryFinish || null,
    rg,
    differential,
    mbDifferential,
    availableWeights: parseWeight(fields.Weight),
    officialUrl: url,
    imageUrl: null,
  };
}

function parseStormProductsDetailPage(
  html: string,
  url: string,
  expectedBrandName: string
): ManufacturerBallInput | null {
  const $ = cheerio.load(html);
  const inferredBrand = inferStormProductsBrandFromUrl(url);
  const expectedBrand = normalizeBrand(expectedBrandName);

  const pageText = $.root().text();
  const fields = parseCardFields(pageText);

  const brand = normalizeBrand(fields.Brand ?? inferredBrand);

  if (brand !== expectedBrand) {
    return null;
  }

  const rawName =
    cleanText($("h1").first().text()) ||
    cleanText($(".product-name").first().text()) ||
    cleanText($("title").first().text()) ||
    nameFromStormProductsUrl(url);

  const name =
    cleanStormProductsName(rawName, brand) || nameFromStormProductsUrl(url);

  return cardToManufacturerBall(
    name,
    url,
    {
      ...fields,
      Brand: brand,
    },
    expectedBrandName
  );
}

function parseStormProductsCatalogCards(
  html: string,
  sourceUrl: string,
  expectedBrandName: string
) {
  const $ = cheerio.load(html);
  const expectedBrand = normalizeBrand(expectedBrandName);
  const parsedBalls: ManufacturerBallInput[] = [];
  const seenBalls = new Set<string>();

  function addProduct(
    absoluteUrl: string,
    rawNameInput: string | null | undefined,
    fieldsInput: Record<string, string> = {}
  ) {
    if (!isStormProductsDetailBallUrl(absoluteUrl)) {
      return;
    }

    const brand = inferStormProductsBrandFromUrl(absoluteUrl);

    if (brand !== expectedBrand) {
      return;
    }

    const rawName =
      cleanText(rawNameInput) ||
      nameFromStormProductsUrl(absoluteUrl);

    const name = cleanStormProductsName(rawName, brand);

    if (!name) {
      return;
    }

    const id = buildBallId(brand, name);

    if (seenBalls.has(id)) {
      return;
    }

    seenBalls.add(id);

    parsedBalls.push(
      cardToManufacturerBall(
        name,
        absoluteUrl,
        {
          ...fieldsInput,
          Brand: brand,
        },
        expectedBrandName
      )
    );
  }

  $("a[href]").each((_index, element) => {
    const linkElement = $(element);
    const href = linkElement.attr("href");
    const absoluteUrl = href ? toAbsoluteUrl(href, sourceUrl) : null;

    if (!absoluteUrl) {
      return;
    }

    const cardElement = linkElement.closest(
      ".category-products-listing li.item, li.item, .module-category-product-listing"
    );

    const cardText = cardElement.length ? cardElement.text() : "";
    const fields = parseCardFields(cardText);

    const rawName =
      cleanText(linkElement.text()) ||
      cleanText(linkElement.attr("title")) ||
      cleanText(linkElement.find("img").first().attr("alt")) ||
      nameFromStormProductsUrl(absoluteUrl);

    addProduct(absoluteUrl, rawName, fields);
  });

  return parsedBalls;
}

export async function scrapeStormProductsManufacturerCatalog(
  options: StormProductsCatalogOptions
) {
  const maxPages = options.maxPages ?? 3;
  const catalogPageUrls = discoverStormProductsCatalogPageUrls(
    options.sourceUrl,
    maxPages
  );

  const parsedBalls: ManufacturerBallInput[] = [];
  const parseFailures: {
    name: string;
    url: string;
    error: string;
  }[] = [];

  for (const pageUrl of catalogPageUrls) {
    try {
      const html = await fetchStormProductsHtml(pageUrl);
      const pageBalls = parseStormProductsCatalogCards(
        html,
        pageUrl,
        options.brandName
      );

      parsedBalls.push(...pageBalls);
    } catch (error) {
      parseFailures.push({
        name: options.brandName,
        url: pageUrl,
        error:
          error instanceof Error ? error.message : "Unknown catalog page error",
      });
    }

    await delay(options.scrapeDelayMs);
  }

  const deduped = [
    ...new Map(parsedBalls.map((ball) => [ball.id, ball])).values(),
  ];

  return {
    sourceName: options.brandName,
    sourceUrl: options.sourceUrl,
    sourceUrls: catalogPageUrls,
    checkedAt: new Date().toISOString(),
    discoveredCount: deduped.length + parseFailures.length,
    parsedCount: deduped.length,
    failureCount: parseFailures.length,
    parsedBalls: deduped,
    parseFailures,
  };
}
