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

function assertBowlingComCategoryUrl(url: string) {
  const parsedUrl = new URL(url);

  if (!BOWLING_COM_HOSTS.has(parsedUrl.hostname)) {
    throw new Error(`URL is not a Bowling.com URL: ${parsedUrl.hostname}`);
  }

  if (!parsedUrl.pathname.startsWith("/shopping/")) {
    throw new Error("Bowling.com category URL must be a shopping page URL.");
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

function getCurrentPageFromUrl(url: string) {
  const parsedUrl = new URL(url);
  const page = Number(parsedUrl.searchParams.get("page") ?? "1");

  if (!Number.isFinite(page) || page < 1) {
    return 1;
  }

  return page;
}

function buildCategoryPageUrl(url: string, page: number) {
  const parsedUrl = new URL(url);

  if (page <= 1) {
    parsedUrl.searchParams.delete("page");
  } else {
    parsedUrl.searchParams.set("page", page.toString());
  }

  return parsedUrl.toString();
}

function isSameCategoryPath(baseUrl: string, candidateUrl: string) {
  const base = new URL(baseUrl);
  const candidate = new URL(candidateUrl);

  return (
    base.hostname === candidate.hostname &&
    base.pathname === candidate.pathname
  );
}

function parseBowlingComCategoryPagination(
  url: string,
  $: cheerio.CheerioAPI
): BowlingComCategoryPagination {
  const currentPage = getCurrentPageFromUrl(url);
  const discoveredPages = new Set<number>([currentPage]);
  let explicitNextPageUrl: string | null = null;

  $("a[href]").each((_index, element) => {
    const href = $(element).attr("href");
    const absoluteUrl = href ? normalizeAbsoluteUrl(href, url) : null;

    if (!absoluteUrl || !isSameCategoryPath(url, absoluteUrl)) {
      return;
    }

    const parsedUrl = new URL(absoluteUrl);
    const page = Number(parsedUrl.searchParams.get("page") ?? "1");

    if (Number.isFinite(page) && page >= 1) {
      discoveredPages.add(page);
    }

    const text = cleanText($(element).text()).toLowerCase();

    if (text === ">" || text.includes("next")) {
      explicitNextPageUrl = absoluteUrl;
    }
  });

  const sortedPages = [...discoveredPages].sort((a, b) => a - b);
  const maxDiscoveredPage =
    sortedPages.length > 0 ? sortedPages[sortedPages.length - 1] : null;

  const numericNextPage =
    maxDiscoveredPage !== null && maxDiscoveredPage > currentPage
      ? buildCategoryPageUrl(url, currentPage + 1)
      : null;

  const nextPageUrl = explicitNextPageUrl ?? numericNextPage;

  return {
    currentPage,
    discoveredPages: sortedPages,
    maxDiscoveredPage,
    nextPageUrl,
    hasNextPage: Boolean(nextPageUrl),
  };
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

export interface BowlingComCategoryProductCandidate {
  name: string;
  url: string;
  brand: string | null;
  imageUrl: string | null;
  currentPrice: number | null;
  source: "json_ld_collection" | "product_link_candidate";
}

export interface BowlingComCategoryPagination {
  currentPage: number;
  discoveredPages: number[];
  maxDiscoveredPage: number | null;
  nextPageUrl: string | null;
  hasNextPage: boolean;
}

export interface BowlingComCategoryPagesOptions {
  startPage?: number;
  maxPages?: number;
}

function getNestedRecord(value: JsonRecord, key: string) {
  const nested = value[key];

  return isRecord(nested) ? nested : null;
}

function getNestedArray(value: JsonRecord, key: string) {
  const nested = value[key];

  return Array.isArray(nested) ? nested : [];
}

function findCollectionPageJsonLd($: cheerio.CheerioAPI) {
  const blocks = parseJsonLdBlocks($);

  return blocks.find((block) => {
    return getJsonLdType(block)?.toLowerCase().includes("collectionpage");
  });
}

function normalizeAbsoluteUrl(url: string, baseUrl: string) {
  try {
    return new URL(url, baseUrl).toString();
  } catch {
    return null;
  }
}

function parseBrandName(value: unknown) {
  if (typeof value === "string") {
    return value.trim() || null;
  }

  if (isRecord(value)) {
    return getString(value.name);
  }

  return null;
}

function parseOfferPriceFromProduct(product: JsonRecord) {
  const offers = normalizeOffers(product.offers);
  const bestOffer = getBestOffer(offers);

  return bestOffer?.price ?? null;
}

function parseCategoryProductsFromJsonLd(
  url: string,
  collectionPage: JsonRecord
): BowlingComCategoryProductCandidate[] {
  const mainEntity = getNestedRecord(collectionPage, "mainEntity");

  if (!mainEntity) {
    return [];
  }

  const itemListElement = getNestedArray(mainEntity, "itemListElement");
  const products: BowlingComCategoryProductCandidate[] = [];

  for (const listItem of itemListElement) {
    if (!isRecord(listItem)) {
      continue;
    }

    const product = getNestedRecord(listItem, "item");

    if (!product) {
      continue;
    }

    const name = getString(product.name);
    const rawUrl = getString(product.url);

    if (!name || !rawUrl) {
      continue;
    }

    const productUrl = normalizeAbsoluteUrl(rawUrl, url);

    if (!productUrl) {
      continue;
    }

    products.push({
      name,
      url: productUrl,
      brand: parseBrandName(product.brand),
      imageUrl: getString(product.image),
      currentPrice: parseOfferPriceFromProduct(product),
      source: "json_ld_collection",
    });
  }

  return products;
}

function parseCategoryProductsFromLinks(
  url: string,
  $: cheerio.CheerioAPI
): BowlingComCategoryProductCandidate[] {
  const products: BowlingComCategoryProductCandidate[] = [];

  $('a[href*="/products/"]').each((_index, element) => {
    const href = $(element).attr("href");
    const productUrl = href ? normalizeAbsoluteUrl(href, url) : null;

    if (!productUrl) {
      return;
    }

    const text = cleanText($(element).text());

    if (!text || text.length < 3) {
      return;
    }

    const nameWithoutPrices = cleanText(
      text
        .replace(/SALE:/gi, "")
        .replace(/\$\s?\d+(?:,\d{3})*(?:\.\d{2})?/g, "")
        .replace(/\bInstant Bonus\b/gi, "")
        .replace(/\bPre-Order\b/gi, "")
        .replace(/\bCloseout\b/gi, "")
    );

    if (!nameWithoutPrices) {
      return;
    }

    products.push({
      name: nameWithoutPrices,
      url: productUrl,
      brand: null,
      imageUrl: null,
      currentPrice: null,
      source: "product_link_candidate",
    });
  });

  return products;
}

function dedupeCategoryProducts(
  products: BowlingComCategoryProductCandidate[]
) {
  const byUrl = new Map<string, BowlingComCategoryProductCandidate>();

  for (const product of products) {
    const existing = byUrl.get(product.url);

    if (!existing) {
      byUrl.set(product.url, product);
      continue;
    }

    if (
      existing.source === "product_link_candidate" &&
      product.source === "json_ld_collection"
    ) {
      byUrl.set(product.url, product);
    }
  }

  return Array.from(byUrl.values());
}

export function parseBowlingComCategoryHtml(url: string, html: string) {
  assertBowlingComCategoryUrl(url);

  const $ = cheerio.load(html);
  const collectionPage = findCollectionPageJsonLd($);

  const jsonLdProducts = collectionPage
    ? parseCategoryProductsFromJsonLd(url, collectionPage)
    : [];

  const linkProducts =
    jsonLdProducts.length > 0 ? [] : parseCategoryProductsFromLinks(url, $);

  const products = dedupeCategoryProducts([
    ...jsonLdProducts,
    ...linkProducts,
  ]);

  return {
    sourceName: "bowling.com",
    sourceUrl: url,
    checkedAt: new Date().toISOString(),
    title: cleanText($("title").first().text()) || null,
    count: products.length,
    sourceStrategy:
      jsonLdProducts.length > 0 ? "json_ld_collection" : "product_links",
    pagination: parseBowlingComCategoryPagination(url, $),
    data: products,
  };
}

export async function scrapeBowlingComCategoryPage(url: string) {
  assertBowlingComCategoryUrl(url);

  const response = await axios.get(url, {
    headers: {
      "User-Agent":
        "BowlingBallSeeker/0.1.0 (+https://github.com/kev-lewis/bowling-ball-seeker)",
      Accept: "text/html,application/xhtml+xml",
    },
    timeout: 15000,
  });

  return parseBowlingComCategoryHtml(url, response.data);
}

export async function scrapeBowlingComCategoryPages(
  url: string,
  options: BowlingComCategoryPagesOptions = {}
) {
  assertBowlingComCategoryUrl(url);

  const startedAt = new Date().toISOString();
  const startPage = options.startPage ?? getCurrentPageFromUrl(url);
  const maxPages = options.maxPages ?? 50;

  const seenProductUrls = new Set<string>();
  const products: BowlingComCategoryProductCandidate[] = [];
  const pages = [];

  let currentPage = startPage;

  while (currentPage <= maxPages) {
    const pageUrl = buildCategoryPageUrl(url, currentPage);
    const pageResult = await scrapeBowlingComCategoryPage(pageUrl);

    let newProductCount = 0;

    for (const product of pageResult.data) {
      if (seenProductUrls.has(product.url)) {
        continue;
      }

      seenProductUrls.add(product.url);
      products.push(product);
      newProductCount += 1;
    }

    pages.push({
      page: currentPage,
      url: pageUrl,
      title: pageResult.title,
      count: pageResult.count,
      newProductCount,
      sourceStrategy: pageResult.sourceStrategy,
      pagination: pageResult.pagination,
    });

    if (pageResult.count === 0) {
      break;
    }

    if (newProductCount === 0 && currentPage > startPage) {
      break;
    }

    if (
      !pageResult.pagination.hasNextPage &&
      (pageResult.pagination.maxDiscoveredPage ?? currentPage) <= currentPage
    ) {
      break;
    }

    currentPage += 1;
  }

  return {
    sourceName: "bowling.com",
    sourceUrl: url,
    startedAt,
    finishedAt: new Date().toISOString(),
    startPage,
    maxPages,
    pageCount: pages.length,
    productCount: products.length,
    pages,
    data: products,
  };
}