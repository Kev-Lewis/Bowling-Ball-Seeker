import { scrapeMockRetailerListings } from "../scrapers/retailers/mockRetailerScraper";
import { matchRetailerListingTitle } from "../services/listingMatchService";
import { upsertRetailerListingWithSnapshot } from "../services/retailerListingService";
import {
  completeScrapeRun,
  failScrapeRun,
  startScrapeRun,
} from "../services/scrapeRunService";
import type { ScrapedRetailerListing } from "../types/retailerScraper";

export interface RetailerScrapeJobOptions {
  allowLikelyMatch?: boolean;
  minConfidence?: number;
}

async function processScrapedRetailerListing(
  listing: ScrapedRetailerListing,
  options: RetailerScrapeJobOptions
) {
  const matchResult = await matchRetailerListingTitle(listing.listingTitle, {
    limit: 5,
    minConfidence: options.minConfidence ?? 35,
    includeRejected: false,
    currentOnly: true,
  });

  const topMatch = matchResult.data[0];

  if (!topMatch) {
    return {
      status: "skipped_no_match",
      listing,
      matches: matchResult.data,
    };
  }

  const canSave =
    topMatch.matchStatus === "auto_matched" ||
    (options.allowLikelyMatch === true &&
      topMatch.matchStatus === "likely_match");

  if (!canSave) {
    return {
      status: "skipped_needs_review",
      listing,
      selectedMatch: topMatch,
      matches: matchResult.data,
    };
  }

  const upsert = await upsertRetailerListingWithSnapshot({
    ballId: topMatch.ballId,
    retailerName: listing.retailerName,
    retailerType: listing.retailerType,
    listingTitle: listing.listingTitle,
    listingUrl: listing.listingUrl,
    condition: listing.condition,
    matchConfidence: topMatch.confidence,
    matchStatus: topMatch.matchStatus,
    currentPrice: listing.currentPrice,
    stockStatus: listing.stockStatus,
  });

  return {
    status: "saved",
    listing,
    selectedMatch: topMatch,
    upsert,
    matches: matchResult.data,
  };
}

export async function runMockRetailerScrapeJob(
  options: RetailerScrapeJobOptions = {}
) {
  const startedAt = new Date().toISOString();

  const scrapeRun = await startScrapeRun({
    sourceName: "Mock Retailer",
    sourceType: "retailer_price_scrape",
    metadata: {
      mode: "mock",
      allowLikelyMatch: options.allowLikelyMatch ?? false,
      minConfidence: options.minConfidence ?? 35,
    },
  });

  try {
    const scrapeResult = await scrapeMockRetailerListings();

    const results = [];

    for (const listing of scrapeResult.data) {
      const result = await processScrapedRetailerListing(listing, options);
      results.push(result);
    }

    const savedCount = results.filter((result) => {
      return result.status === "saved";
    }).length;

    const skippedNoMatchCount = results.filter((result) => {
      return result.status === "skipped_no_match";
    }).length;

    const skippedNeedsReviewCount = results.filter((result) => {
      return result.status === "skipped_needs_review";
    }).length;

    const createdListingCount = results.filter((result) => {
      return result.status === "saved" && result.upsert?.action === "created";
    }).length;

    const updatedListingCount = results.filter((result) => {
      return result.status === "saved" && result.upsert?.action === "updated";
    }).length;

    const snapshotCreatedCount = results.filter((result) => {
      return (
        result.status === "saved" &&
        result.upsert?.snapshotAction === "created"
      );
    }).length;

    const snapshotSkippedCount = results.filter((result) => {
      return (
        result.status === "saved" &&
        result.upsert?.snapshotAction === "skipped_unchanged"
      );
    }).length;

    const jobResult = {
      jobName: "mock_retailer_scrape_job",
      scrapeRunId: scrapeRun.id,
      sourceName: scrapeResult.sourceName,
      sourceUrl: scrapeResult.sourceUrl,
      startedAt,
      finishedAt: new Date().toISOString(),
      scrapedCount: scrapeResult.count,
      savedCount,
      skippedNoMatchCount,
      skippedNeedsReviewCount,
      createdListingCount,
      updatedListingCount,
      snapshotCreatedCount,
      snapshotSkippedCount,
      results,
    };

    await completeScrapeRun(scrapeRun.id, {
      itemsFound: scrapeResult.count,
      itemsCreated: createdListingCount + snapshotCreatedCount,
      itemsUpdated: updatedListingCount,
      itemsRemoved: 0,
      metadata: {
        mode: "mock",
        sourceUrl: scrapeResult.sourceUrl,
        savedCount,
        skippedNoMatchCount,
        skippedNeedsReviewCount,
        createdListingCount,
        updatedListingCount,
        snapshotCreatedCount,
        snapshotSkippedCount,
      },
    });

    return jobResult;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown retailer scrape error";

    await failScrapeRun(scrapeRun.id, message, {
      mode: "mock",
      allowLikelyMatch: options.allowLikelyMatch ?? false,
      minConfidence: options.minConfidence ?? 35,
    });

    throw error;
  }
}