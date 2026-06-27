import * as cheerio from "cheerio";
import { toAbsoluteUrl } from "./urlUtils";

export interface RetailerPriceCandidate {
  text: string;
}

export interface RetailerLinkCandidate {
  text: string;
  url: string;
}

export interface RetailerJsonLdBlock {
  type: string | null;
  raw: unknown;
}

export interface RetailerPageInspectionResult {
  url: string;
  hostname: string;
  checkedAt: string;
  title: string | null;
  headings: string[];
  priceCandidates: RetailerPriceCandidate[];
  productLinkCandidates: RetailerLinkCandidate[];
  jsonLdBlocks: RetailerJsonLdBlock[];
  textBlocks: string[];
}

function cleanText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function dedupeStrings(values: string[]) {
  return [...new Set(values.map(cleanText).filter(Boolean))];
}

function looksLikePrice(text: string) {
  return /\$\s?\d+(?:,\d{3})*(?:\.\d{2})?/.test(text);
}

function getJsonLdType(raw: unknown) {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const value = raw as Record<string, unknown>;
  const type = value["@type"];

  if (typeof type === "string") {
    return type;
  }

  if (Array.isArray(type)) {
    return type.filter((item) => typeof item === "string").join(",");
  }

  return null;
}

function parseJsonLdBlocks($: cheerio.CheerioAPI) {
  const blocks: RetailerJsonLdBlock[] = [];

  $('script[type="application/ld+json"]').each((_index, element) => {
    const rawText = $(element).text();

    if (!rawText.trim()) {
      return;
    }

    try {
      const parsed = JSON.parse(rawText);

      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          blocks.push({
            type: getJsonLdType(item),
            raw: item,
          });
        }

        return;
      }

      blocks.push({
        type: getJsonLdType(parsed),
        raw: parsed,
      });
    } catch {
      blocks.push({
        type: null,
        raw: rawText.slice(0, 500),
      });
    }
  });

  return blocks.slice(0, 20);
}

export function inspectRetailerHtmlPage(
  url: string,
  html: string
): RetailerPageInspectionResult {
  const parsedUrl = new URL(url);
  const $ = cheerio.load(html);

  const title = cleanText($("title").first().text()) || null;

  const headings = dedupeStrings(
    $("h1, h2, h3")
      .map((_index, element) => $(element).text())
      .get()
  ).slice(0, 50);

  const textBlocks = dedupeStrings(
    $("p, li, td, th, span, div")
      .map((_index, element) => $(element).text())
      .get()
      .filter((text) => {
        const cleaned = cleanText(text);
        return cleaned.length >= 3 && cleaned.length <= 250;
      })
  ).slice(0, 150);

  const priceCandidates = dedupeStrings(
    $("body *")
      .map((_index, element) => $(element).text())
      .get()
      .filter((text) => {
        const cleaned = cleanText(text);
        return cleaned.length <= 120 && looksLikePrice(cleaned);
      })
  )
    .map((text) => ({ text }))
    .slice(0, 50);

  const productLinkCandidates: RetailerLinkCandidate[] = $("a[href]")
    .map((_index, element) => {
      const href = $(element).attr("href");
      const absoluteUrl = href ? toAbsoluteUrl(href, url) : null;

      if (!absoluteUrl) {
        return null;
      }

      const text = cleanText($(element).text());

      if (!text || text.length < 3 || text.length > 120) {
        return null;
      }

      return {
        text,
        url: absoluteUrl,
      };
    })
    .get()
    .filter((link, index, links) => {
      return (
        links.findIndex((other) => {
          return other.url === link.url && other.text === link.text;
        }) === index
      );
    })
    .slice(0, 80);

  return {
    url,
    hostname: parsedUrl.hostname,
    checkedAt: new Date().toISOString(),
    title,
    headings,
    priceCandidates,
    productLinkCandidates,
    jsonLdBlocks: parseJsonLdBlocks($),
    textBlocks,
  };
}