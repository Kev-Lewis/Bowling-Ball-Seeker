import * as cheerio from "cheerio";
import type {
  PageImageCandidate,
  PageInspectionResult,
  PageTableRow,
} from "../types/scraper";

function cleanText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function dedupeStrings(values: string[]) {
  return [...new Set(values.map(cleanText).filter(Boolean))];
}

function toAbsoluteUrl(src: string, baseUrl: string) {
  try {
    return new URL(src, baseUrl).toString();
  } catch {
    return null;
  }
}

export function inspectHtmlPage(
  sourceName: string,
  url: string,
  html: string
): PageInspectionResult {
  const $ = cheerio.load(html);

  const title = cleanText($("title").first().text()) || null;

  const headings = dedupeStrings(
    $("h1, h2, h3")
      .map((_index, element) => $(element).text())
      .get()
  ).slice(0, 40);

  const textBlocks = dedupeStrings(
    $("p, li, td, th, span, div")
      .map((_index, element) => $(element).text())
      .get()
      .filter((text) => {
        const cleaned = cleanText(text);
        return cleaned.length >= 3 && cleaned.length <= 250;
      })
  ).slice(0, 120);

  const tableRows: PageTableRow[] = $("tr")
    .map((_index, row) => {
      const cells = $(row)
        .find("th, td")
        .map((_cellIndex, cell) => cleanText($(cell).text()))
        .get()
        .filter(Boolean);

      return cells.length > 0 ? { cells } : null;
    })
    .get()
    .slice(0, 80);

  const imageCandidates: PageImageCandidate[] = $("img[src]")
    .map((_index, image) => {
      const rawSrc = $(image).attr("src");
      const absoluteSrc = rawSrc ? toAbsoluteUrl(rawSrc, url) : null;

      if (!absoluteSrc) {
        return null;
      }

      return {
        src: absoluteSrc,
        alt: cleanText($(image).attr("alt") ?? ""),
      };
    })
    .get()
    .filter((image) => {
      const src = image.src.toLowerCase();
      return (
        src.includes(".jpg") ||
        src.includes(".jpeg") ||
        src.includes(".png") ||
        src.includes(".webp")
      );
    })
    .slice(0, 40);

  return {
    sourceName,
    url,
    checkedAt: new Date().toISOString(),
    title,
    headings,
    textBlocks,
    tableRows,
    imageCandidates,
  };
}