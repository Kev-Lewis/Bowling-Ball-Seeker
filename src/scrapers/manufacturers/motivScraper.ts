import axios from "axios";
import * as cheerio from "cheerio";
import type { ManufacturerBallInput } from "../../types/catalog";
import type { CoreType, CoverstockType } from "../../types/ball";
import type {
  DiscoveredProductLink,
  ProductDiscoveryResult,
} from "../../types/scraper";
import { inspectHtmlPage } from "../../utils/pageInspection";
import {
  removeTrailingSlash,
  toAbsoluteUrl,
} from "../../utils/urlUtils";

const MOTIV_BALL_GUIDE_URL =
  "https://www.motivbowling.com/ball-guide/ball-guide.html";

function cleanText(value: string) {
  return value.replace(/\s+/g, " ").trim();
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

function normalizeMotivBallGuideUrl(url: string) {
  const parsedUrl = new URL(url);
  const pathname = parsedUrl.pathname;

  const match = pathname.match(/\/?(?:ball-guide\/)?(n_\d+)$/);

  if (!match) {
    return url;
  }

  return `https://www.motivbowling.com/${match[1]}`;
}

function isLikelyMotivBallGuideProductUrl(url: string) {
  const parsedUrl = new URL(url);
  const pathname = parsedUrl.pathname.toLowerCase();

  if (parsedUrl.hostname !== "www.motivbowling.com") {
    return false;
  }

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

function getTableValue(
  tableRows: { cells: string[] }[],
  label: string
): string | null {
  const target = label.toLowerCase();

  const row = tableRows.find((tableRow) => {
    return tableRow.cells[0]?.toLowerCase() === target;
  });

  return row?.cells[1] ?? null;
}

function parseBallNameFromTitle(title: string | null) {
  if (!title) {
    return null;
  }

  return title.split("|")[0]?.trim() || null;
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

function inferCoreType(
  coreName: string | null,
  headings: string[],
  textBlocks: string[]
): CoreType {
  const searchableText = [...headings, ...textBlocks]
    .map((value) => value.toLowerCase())
    .join(" ");

  const normalizedCoreName = coreName?.toLowerCase() ?? "";

  if (normalizedCoreName) {
    const matchingCoreText = [...headings, ...textBlocks]
      .filter((value) => value.toLowerCase().includes(normalizedCoreName))
      .join(" ")
      .toLowerCase();

    if (matchingCoreText.includes("asym")) {
      return "asymmetric";
    }

    if (matchingCoreText.includes("sym")) {
      return "symmetric";
    }
  }

  if (searchableText.includes("asym")) {
    return "asymmetric";
  }

  if (searchableText.includes("symmetrical") || searchableText.includes("symmetric")) {
    return "symmetric";
  }

  return "unknown";
}

function parseAvailableWeights(weightRange: string | null) {
  if (!weightRange) {
    return [];
  }

  return [...new Set(weightRange.match(/\d+/g)?.map(Number) ?? [])].sort(
    (a, b) => a - b
  );
}

interface WeightSpec {
  weight: number;
  rg: number;
  differential: number;
  mbDifferential: number | null;
}

function parseNumber(value: string | undefined) {
  if (!value) {
    return null;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
}

function parseWeightSpecs(textBlocks: string[]): WeightSpec[] {
  const combinedText = textBlocks.join(" ");

  const regex =
    /(\d{2})#?\s*Radius of Gyration\s*([.]?\d+(?:\.\d+)?)\s*Max Differential\s*([.]?\d+(?:\.\d+)?)(?:\s*Int\.?\s*Differential\s*([.]?\d+(?:\.\d+)?))?/gi;

  const specs: WeightSpec[] = [];

  for (const match of combinedText.matchAll(regex)) {
    const weight = parseNumber(match[1]);
    const rg = parseNumber(match[2]);
    const differential = parseNumber(match[3]);
    const mbDifferential = parseNumber(match[4]);

    if (weight === null || rg === null || differential === null) {
      continue;
    }

    specs.push({
      weight,
      rg,
      differential,
      mbDifferential,
    });
  }

  return specs;
}

function chooseReferenceWeightSpec(weightSpecs: WeightSpec[]) {
  const preferred15 = weightSpecs.find((spec) => spec.weight === 15);

  if (preferred15) {
    return preferred15;
  }

  return weightSpecs[0] ?? null;
}

async function fetchMotivHtml(url: string) {
  const parsedUrl = new URL(url);

  if (parsedUrl.hostname !== "www.motivbowling.com") {
    throw new Error("Only motivbowling.com URLs are allowed.");
  }

  const response = await axios.get(url, {
    headers: {
      "User-Agent":
        "BowlingBallSeeker/0.1.0 (+https://github.com/kev-lewis/bowling-ball-seeker)",
      Accept: "text/html,application/xhtml+xml",
    },
    timeout: 15000,
  });

  return response.data;
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
      url: normalizeMotivBallGuideUrl(absoluteUrl),
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

export async function inspectMotivBallPage(url: string) {
  const html = await fetchMotivHtml(url);

  return inspectHtmlPage("Motiv", url, html);
}

export async function parseMotivBallPage(
  url: string
): Promise<ManufacturerBallInput> {
  const html = await fetchMotivHtml(url);
  const inspection = inspectHtmlPage("Motiv", url, html);

  const canonicalName = parseBallNameFromTitle(inspection.title);

  if (!canonicalName) {
    throw new Error("Could not parse MOTIV ball name from page title.");
  }

  const coverstockName = getTableValue(inspection.tableRows, "Cover Stock");
  const coreName = getTableValue(inspection.tableRows, "Weight Block");
  const factoryFinish = getTableValue(inspection.tableRows, "Finish");
  const weightRange = getTableValue(inspection.tableRows, "Weight Range");

  const weightSpecs = parseWeightSpecs(inspection.textBlocks);
  const referenceSpec = chooseReferenceWeightSpec(weightSpecs);

  return {
    id: buildBallId("Motiv", canonicalName),
    canonicalName,
    brand: "Motiv",
    manufacturer: "Motiv",
    coverstockName,
    coverstockType: inferCoverstockType(coverstockName),
    coreName,
    coreType: inferCoreType(coreName, inspection.headings, inspection.textBlocks),
    factoryFinish,
    rg: referenceSpec?.rg ?? null,
    differential: referenceSpec?.differential ?? null,
    mbDifferential: referenceSpec?.mbDifferential ?? null,
    availableWeights: parseAvailableWeights(weightRange),
    officialUrl: url,
    imageUrl: null,
  };
}