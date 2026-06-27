import { scrapeBowlingComProductPage } from "../scrapers/retailers/bowlingComScraper";
import { matchRetailerListingTitle } from "./listingMatchService";
import type { ScrapedRetailerListing } from "../types/retailerScraper";

export interface RetailerMatchCandidateLookupInput {
  listingUrl?: string;
  listingTitle?: string;
  limit?: number;
  minConfidence?: number;
  includeRejected?: boolean;
  currentOnly?: boolean;
}

function isBowlingComUrl(url: string) {
  try {
    const parsedUrl = new URL(url);

    return (
      parsedUrl.hostname === "bowling.com" ||
      parsedUrl.hostname === "www.bowling.com"
    );
  } catch {
    return false;
  }
}

async function scrapeListingForCandidateLookup(
  listingUrl: string
): Promise<ScrapedRetailerListing> {
  if (isBowlingComUrl(listingUrl)) {
    return scrapeBowlingComProductPage(listingUrl);
  }

  throw new Error(
    "Candidate lookup currently supports Bowling.com listing URLs only."
  );
}

function getCandidateWarning(topConfidence: number | null) {
  if (topConfidence === null) {
    return "No candidate matches found.";
  }

  if (topConfidence >= 85) {
    return null;
  }

  if (topConfidence >= 65) {
    return "Top match is likely, but should still be reviewed before resolving.";
  }

  if (topConfidence >= 35) {
    return "Top match needs manual review. Do not resolve unless you are sure.";
  }

  return "Top match is weak. This should usually not be manually resolved unless you have verified it elsewhere.";
}

export async function getRetailerMatchCandidates(
  input: RetailerMatchCandidateLookupInput
) {
  const limit = input.limit ?? 10;
  const minConfidence = input.minConfidence ?? 0;
  const includeRejected = input.includeRejected ?? true;
  const currentOnly = input.currentOnly ?? true;

  let scrapedListing: ScrapedRetailerListing | null = null;
  let listingTitle = input.listingTitle?.trim() ?? "";

  if (input.listingUrl) {
    scrapedListing = await scrapeListingForCandidateLookup(input.listingUrl);
    listingTitle = scrapedListing.listingTitle;
  }

  if (!listingTitle) {
    throw new Error("Either listingUrl or listingTitle is required.");
  }

  const matchResult = await matchRetailerListingTitle(listingTitle, {
    limit,
    minConfidence,
    includeRejected,
    currentOnly,
  });

  const topCandidate = matchResult.data[0] ?? null;

  return {
    lookedUpAt: new Date().toISOString(),
    listingSource: input.listingUrl ? "listing_url" : "listing_title",
    listingUrl: input.listingUrl ?? null,
    listingTitle,
    scrapedListing,
    candidateCount: matchResult.count,
    warning: getCandidateWarning(topCandidate?.confidence ?? null),
    filters: {
      limit,
      minConfidence,
      includeRejected,
      currentOnly,
    },
    candidates: matchResult.data,
  };
}