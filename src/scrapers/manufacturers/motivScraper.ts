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
  const pathname = parsedUrl.pathname.toLowerCase().replace(/\/$/, "");

  if (parsedUrl.hostname !== "www.motivbowling.com") {
    return false;
  }

  return (
    /^\/ball-guide\/n_\d+$/.test(pathname) ||
    /^\/products\/balls\/n_\d+$/.test(pathname) ||
    /^\/n_\d+$/.test(pathname)
  );
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
  const cleaned = cleanText(title ?? "");

  if (!cleaned) {
    return null;
  }

  if (/^MOTIV\s*\|\s*Designer Balls/i.test(cleaned)) {
    return "Designer Series";
  }

  return cleaned
    .split("|")[0]
    .replace(/\s+Bowling Balls? for Sale$/i, "")
    .replace(/\s+Bowling Balls?$/i, "")
    .replace(/\s+MOTIV Bowling$/i, "")
    .trim() || null;
}

function inferCoverstockType(coverstockName: string | null): CoverstockType {
  const normalized = cleanText(coverstockName ?? "").toLowerCase();

  if (normalized.includes("polyester") || normalized.includes("plastic")) {
    return "plastic";
  }

  if (normalized.includes("urethane")) {
    return "urethane";
  }

  if (normalized.includes("hybrid")) {
    return "hybrid";
  }

  if (normalized.includes("pearl") || normalized.includes("hfp")) {
    return "pearl";
  }

  if (normalized.includes("solid") || normalized.includes("hfs")) {
    return "solid";
  }

  return "unknown";
}

function inferCoreType(
  coreName: string | null,
  headings: string[],
  mbDifferential: number | null
): CoreType {
  const normalizedCoreName = coreName?.toLowerCase() ?? "";

  if (normalizedCoreName) {
    const matchingHeading = headings.find((heading) => {
      return heading.toLowerCase().includes(normalizedCoreName);
    });

    if (matchingHeading) {
      const normalizedHeading = matchingHeading.toLowerCase();

      if (normalizedHeading.includes("asym")) {
        return "asymmetric";
      }

      if (
        normalizedHeading.includes("symmetrical") ||
        normalizedHeading.includes("symmetric")
      ) {
        return "symmetric";
      }
    }
  }

  if (mbDifferential !== null && mbDifferential > 0) {
    return "asymmetric";
  }

  if (mbDifferential === null || mbDifferential === 0) {
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
  const text = cleanText(textBlocks.join(" "));

  function parseDecimal(raw: string | undefined) {
    const value = cleanText(raw ?? "");

    if (!value) {
      return null;
    }

    if (value.startsWith(".")) {
      const parsed = Number("0" + value);
      return Number.isFinite(parsed) ? parsed : null;
    }

    if (/^\d{2,3}$/.test(value)) {
      const parsed = Number("0." + value.padStart(3, "0"));
      return Number.isFinite(parsed) ? parsed : null;
    }

    const parsed = Number(value.replace(/[^0-9.]/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }

  const specs: WeightSpec[] = [];
  const pattern =
    /(\d{2})\s*Radius of Gyration\s*(\d+\.\d+)\s*Max Differential\s*(\.?\d{2,3}|\d+\.\d+)(?:\s*Int\. Differential\s*(\.?\d{2,3}|\d+\.\d+))?/gi;

  for (const match of text.matchAll(pattern)) {
    const weight = Number(match[1]);
    const rg = parseDecimal(match[2]);
    const differential = parseDecimal(match[3]);
    const mbDifferential = parseDecimal(match[4]);

    if (!Number.isFinite(weight) || rg === null || differential === null) {
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

export async function discoverMotivBallProducts(
  sourceUrl = MOTIV_BALL_GUIDE_URL
): Promise<ProductDiscoveryResult> {
  const response = await axios.get(sourceUrl, {
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

    const absoluteUrl = toAbsoluteUrl(href, sourceUrl);

    if (!absoluteUrl) {
      return;
    }

    if (!isLikelyMotivBallGuideProductUrl(absoluteUrl)) {
      return;
    }

    const linkText = cleanText($(element).text());
    const titleText = cleanText($(element).attr("title") ?? "");
    const ariaText = cleanText($(element).attr("aria-label") ?? "");
    const imageAltText = cleanText($(element).find("img").first().attr("alt") ?? "");

    const lastSegment =
      new URL(absoluteUrl).pathname
        .split("/")
        .filter(Boolean)
        .pop() ?? "";

    const urlNameText = cleanText(
      /^n_\d+$/i.test(lastSegment)
        ? "Motiv " + lastSegment
        : lastSegment.replace(/[-_]+/g, " ")
    );

    const name =
      linkText || titleText || ariaText || imageAltText || urlNameText || "Motiv product";

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
    sourceUrl,
    checkedAt: new Date().toISOString(),
    count: data.length,
    data,
  };
}

export async function inspectMotivBallPage(url: string) {
  const html = await fetchMotivHtml(url);

  return inspectHtmlPage("Motiv", url, html);
}

function applyMotivSpecialFallbacks(ball: any) {
  if (
    ball.brand === "Motiv" &&
    ball.canonicalName === "Designer Series" &&
    ball.officialUrl === "https://www.motivbowling.com/n_2320"
  ) {
    return {
      ...ball,
      coverstockName: ball.coverstockName ?? "Polyester",
      coverstockType: "plastic",
      coreName: ball.coreName ?? "Pancake",
      coreType: "symmetric",
    };
  }

  return ball;
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

  const isDesignerSeries =
    canonicalName === "Designer Series" &&
    url === "https://www.motivbowling.com/n_2320";

  const finalCoverstockName = isDesignerSeries ? "Polyester" : coverstockName;
  const finalCoreName = isDesignerSeries ? "Pancake" : coreName;

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
    coreType: inferCoreType(
        finalCoreName,
        inspection.headings,
        referenceSpec?.mbDifferential ?? null
    ),
    factoryFinish,
    rg: referenceSpec?.rg ?? null,
    differential: referenceSpec?.differential ?? null,
    mbDifferential: referenceSpec?.mbDifferential ?? null,
    availableWeights: parseAvailableWeights(weightRange),
    officialUrl: url,
    imageUrl: null,
  };
}

function normalizeMotivCatalogBall(ball: ManufacturerBallInput): ManufacturerBallInput {
  if (
    ball.brand === "Motiv" &&
    ball.canonicalName === "Designer Series" &&
    ball.officialUrl === "https://www.motivbowling.com/n_2320"
  ) {
    return {
      ...ball,
      coverstockName: "Polyester",
      coverstockType: "plastic",
      coreName: "Pancake",
      coreType: "symmetric",
    };
  }

  return ball;
}

export async function scrapeMotivManufacturerCatalog(sourceUrl = MOTIV_BALL_GUIDE_URL) {
  const discoveryResult = await discoverMotivBallProducts(sourceUrl);

  const parsedBalls: ManufacturerBallInput[] = [];
  const parseFailures: {
    name: string;
    url: string;
    error: string;
  }[] = [];

  for (const product of discoveryResult.data) {
    try {
      const parsedBall = await parseMotivBallPage(product.url);
      parsedBalls.push(normalizeMotivCatalogBall(parsedBall));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown parse error";

      parseFailures.push({
        name: product.name,
        url: product.url,
        error: message,
      });
    }
  }

  return {
    sourceName: "Motiv",
    sourceUrl: discoveryResult.sourceUrl,
    checkedAt: new Date().toISOString(),
    discoveredCount: discoveryResult.count,
    parsedCount: parsedBalls.length,
    failureCount: parseFailures.length,
    parsedBalls,
    parseFailures,
  };
}