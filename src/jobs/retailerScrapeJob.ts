import {
  scrapeBowlingComCategoryPages,
  scrapeBowlingComProductPage,
} from "../scrapers/retailers/bowlingComScraper";
import { scrapeMockRetailerListings } from "../scrapers/retailers/mockRetailerScraper";
import {
  matchRetailerListingTitle,
  type ListingMatchCandidate,
} from "../services/listingMatchService";
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
  scrapeDelayMs?: number;
}

export interface BowlingComCategoryScrapeJobOptions
  extends RetailerScrapeJobOptions {
  maxPages?: number;
  maxProducts?: number;
}

function normalizeRetailerTitleForLegacy(value: string) {
  return value
    .toLowerCase()
    .replace(/[™®©]/g, "")
    .replace(/[^a-z0-9#./\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function looksLikeLegacyRetailerBall(listingTitle: string) {
  const normalized = normalizeRetailerTitleForLegacy(listingTitle);

  const legacyFamilyWords = [
    "spare",
    "pixel",
    "liberty",
    "stadium",
    "crest",
    "velocity",
    "ascend",
    "thrill",
  ];

  const hasLegacyFamilyWord = legacyFamilyWords.some((word) =>
    normalized.includes(word)
  );

  const hasBrand = /\b(motiv|storm|roto grip|900 global|brunswick|hammer|ebonite|track|radical|dv8)\b/.test(
    normalized
  );

  const hasBallLikeTerm = /\b(pearl|solid|hybrid|spare|urethane|reactive)\b/.test(
    normalized
  );

  return hasBrand && (hasLegacyFamilyWord || hasBallLikeTerm);
}

function isLegacyCandidate(candidate: ListingMatchCandidate | undefined) {
  return Boolean(candidate && candidate.isCurrent === false);
}

function getLegacyReviewReason(
  listingTitle: string,
  candidate: ListingMatchCandidate | undefined
) {
  const normalized = normalizeRetailerTitleForLegacy(listingTitle);

  if (candidate?.isCurrent === false) {
    return "inactive_catalog_candidate";
  }

  if (!candidate) {
    return "retailer_only_legacy_or_discontinued";
  }

  if (/\b(spare|pixel)\b/.test(normalized)) {
    return "current_family_spare_or_colorway_variant";
  }

  if (/\b(ascend|thrill|venom|jackal|primal)\b/.test(normalized)) {
    return "weak_current_family_variant";
  }

  return "legacy_review";
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

  let topMatch = matchResult.data[0];
  let matches = matchResult.data;
  let legacyMatchResult: Awaited<ReturnType<typeof matchRetailerListingTitle>> | null =
    null;

  if (!topMatch || topMatch.confidence < 65) {
    legacyMatchResult = await matchRetailerListingTitle(listing.listingTitle, {
      limit: 5,
      minConfidence: options.minConfidence ?? 35,
      includeRejected: false,
      currentOnly: false,
    });

    const inactiveMatches = legacyMatchResult.data.filter((candidate) => {
      return candidate.isCurrent === false;
    });

    const legacyTopMatch = inactiveMatches[0] ?? null;

    if (!topMatch && legacyTopMatch) {
      topMatch = legacyTopMatch;
      matches = legacyMatchResult.data;
    }
  }

  const shouldLegacyReview =
    isLegacyCandidate(topMatch) ||
    (!topMatch && looksLikeLegacyRetailerBall(listing.listingTitle)) ||
    (topMatch?.matchStatus === "manual_review" &&
      looksLikeLegacyRetailerBall(listing.listingTitle));

  const legacyReviewReason = shouldLegacyReview
    ? getLegacyReviewReason(listing.listingTitle, topMatch)
    : null;

  if (!topMatch) {
    return {
      status: shouldLegacyReview ? "skipped_legacy_review" : "skipped_no_match",
      listing,
      legacyReviewReason,
      matches,
      legacyMatches: legacyMatchResult?.data ?? [],
    };
  }

  const canSave =
    topMatch.matchStatus === "auto_matched" ||
    (options.allowLikelyMatch === true &&
      topMatch.matchStatus === "likely_match");

  if (!canSave) {
    return {
      status: shouldLegacyReview ? "skipped_legacy_review" : "skipped_needs_review",
      listing,
      legacyReviewReason,
      selectedMatch: topMatch,
      matches,
      legacyMatches: legacyMatchResult?.data ?? [],
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
    matches,
  };
}

type RetailerScrapeProcessingResult = Awaited<
  ReturnType<typeof processScrapedRetailerListing>
>;

function summarizeMatchCandidate(candidate: ListingMatchCandidate) {
  return {
    ballId: candidate.ballId,
    canonicalName: candidate.canonicalName,
    brand: candidate.brand,
    manufacturer: candidate.manufacturer,
    isCurrent: candidate.isCurrent,
    catalogState: candidate.isCurrent ? "current" : "legacy",
    confidence: candidate.confidence,
    matchStatus: candidate.matchStatus,
    reasons: candidate.reasons,
  };
}

function buildSkippedListingReviews(
  results: RetailerScrapeProcessingResult[]
) {
  return results
    .filter((result) => {
      return (
        result.status === "skipped_no_match" ||
        result.status === "skipped_needs_review" ||
        result.status === "skipped_legacy_review"
      );
    })
    .map((result) => {
      const selectedMatch =
        "selectedMatch" in result && result.selectedMatch
          ? summarizeMatchCandidate(result.selectedMatch)
          : null;

      const legacyReviewReason =
        "legacyReviewReason" in result ? result.legacyReviewReason : null;

      return {
        status: result.status,
        legacyReviewReason,
        listing: {
          retailerName: result.listing.retailerName,
          listingTitle: result.listing.listingTitle,
          listingUrl: result.listing.listingUrl,
          currentPrice: result.listing.currentPrice,
          stockStatus: result.listing.stockStatus,
          condition: result.listing.condition,
        },
        selectedMatch,
        matchCount: result.matches.length,
        topMatches: result.matches.slice(0, 5).map((match: ListingMatchCandidate) => {
          return summarizeMatchCandidate(match);
        }),
      };
    });
}

function countSavedResults(results: RetailerScrapeProcessingResult[]) {
  return results.filter((result) => {
    return result.status === "saved";
  }).length;
}

function countSkippedNoMatchResults(results: RetailerScrapeProcessingResult[]) {
  return results.filter((result) => {
    return result.status === "skipped_no_match";
  }).length;
}

function countSkippedNeedsReviewResults(
  results: RetailerScrapeProcessingResult[]
) {
  return results.filter((result) => {
    return result.status === "skipped_needs_review";
  }).length;
}

function countSkippedLegacyReviewResults(
  results: RetailerScrapeProcessingResult[]
) {
  return results.filter((result) => {
    return result.status === "skipped_legacy_review";
  }).length;
}

function countCreatedListings(results: RetailerScrapeProcessingResult[]) {
  return results.filter((result) => {
    return result.status === "saved" && result.upsert?.action === "created";
  }).length;
}

function countUpdatedListings(results: RetailerScrapeProcessingResult[]) {
  return results.filter((result) => {
    return result.status === "saved" && result.upsert?.action === "updated";
  }).length;
}

function countCreatedSnapshots(results: RetailerScrapeProcessingResult[]) {
  return results.filter((result) => {
    return (
      result.status === "saved" &&
      result.upsert?.snapshotAction === "created"
    );
  }).length;
}

function countSkippedSnapshots(results: RetailerScrapeProcessingResult[]) {
  return results.filter((result) => {
    return (
      result.status === "saved" &&
      result.upsert?.snapshotAction === "skipped_unchanged"
    );
  }).length;
}

function getSafeScrapeDelayMs(value: number | undefined) {
  if (value === undefined || !Number.isFinite(value) || value < 0) {
    return 0;
  }

  return Math.min(value, 5000);
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function delayBetweenProductScrapes(
  currentIndex: number,
  totalCount: number,
  delayMs: number
) {
  const hasMoreProducts = currentIndex < totalCount - 1;

  if (hasMoreProducts && delayMs > 0) {
    await sleep(delayMs);
  }
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

    const results: RetailerScrapeProcessingResult[] = [];

    for (const listing of scrapeResult.data) {
      const result = await processScrapedRetailerListing(listing, options);
      results.push(result);
    }

    const savedCount = countSavedResults(results);
    const skippedNoMatchCount = countSkippedNoMatchResults(results);
    const skippedNeedsReviewCount = countSkippedNeedsReviewResults(results);
    const skippedLegacyReviewCount = countSkippedLegacyReviewResults(results);
    const createdListingCount = countCreatedListings(results);
    const updatedListingCount = countUpdatedListings(results);
    const snapshotCreatedCount = countCreatedSnapshots(results);
    const snapshotSkippedCount = countSkippedSnapshots(results);
    const skippedListingReviews = buildSkippedListingReviews(results);

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
      skippedLegacyReviewCount,
      createdListingCount,
      updatedListingCount,
      snapshotCreatedCount,
      snapshotSkippedCount,
      skippedListingReviews,
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
        skippedLegacyReviewCount,
        createdListingCount,
        updatedListingCount,
        snapshotCreatedCount,
        snapshotSkippedCount,
        skippedListingReviews,
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

export async function runBowlingComProductScrapeJob(
  urls: string[],
  options: RetailerScrapeJobOptions = {}
) {
  const startedAt = new Date().toISOString();
  const scrapeDelayMs = getSafeScrapeDelayMs(options.scrapeDelayMs ?? 750);

  const scrapeRun = await startScrapeRun({
    sourceName: "bowling.com",
    sourceType: "retailer_price_scrape",
    metadata: {
      mode: "bowling_com_product_pages",
      urls,
      allowLikelyMatch: options.allowLikelyMatch ?? false,
      minConfidence: options.minConfidence ?? 35,
      scrapeDelayMs,
    },
  });

  try {
    const scrapedListings: ScrapedRetailerListing[] = [];

    for (const [index, url] of urls.entries()) {
      const listing = await scrapeBowlingComProductPage(url);
      scrapedListings.push(listing);

      await delayBetweenProductScrapes(index, urls.length, scrapeDelayMs);
    }

    const results: RetailerScrapeProcessingResult[] = [];

    for (const listing of scrapedListings) {
      const result = await processScrapedRetailerListing(listing, options);
      results.push(result);
    }

    const savedCount = countSavedResults(results);
    const skippedNoMatchCount = countSkippedNoMatchResults(results);
    const skippedNeedsReviewCount = countSkippedNeedsReviewResults(results);
    const skippedLegacyReviewCount = countSkippedLegacyReviewResults(results);
    const createdListingCount = countCreatedListings(results);
    const updatedListingCount = countUpdatedListings(results);
    const snapshotCreatedCount = countCreatedSnapshots(results);
    const snapshotSkippedCount = countSkippedSnapshots(results);
    const skippedListingReviews = buildSkippedListingReviews(results);

    const jobResult = {
      jobName: "bowling_com_product_scrape_job",
      scrapeRunId: scrapeRun.id,
      sourceName: "bowling.com",
      sourceUrl: "https://www.bowling.com/",
      startedAt,
      finishedAt: new Date().toISOString(),
      scrapeDelayMs,
      scrapedCount: scrapedListings.length,
      savedCount,
      skippedNoMatchCount,
      skippedNeedsReviewCount,
      skippedLegacyReviewCount,
      createdListingCount,
      updatedListingCount,
      snapshotCreatedCount,
      snapshotSkippedCount,
      skippedListingReviews,
      results,
    };

    await completeScrapeRun(scrapeRun.id, {
      itemsFound: scrapedListings.length,
      itemsCreated: createdListingCount + snapshotCreatedCount,
      itemsUpdated: updatedListingCount,
      itemsRemoved: 0,
      metadata: {
        mode: "bowling_com_product_pages",
        urls,
        scrapeDelayMs,
        savedCount,
        skippedNoMatchCount,
        skippedNeedsReviewCount,
        skippedLegacyReviewCount,
        createdListingCount,
        updatedListingCount,
        snapshotCreatedCount,
        snapshotSkippedCount,
        skippedListingReviews,
      },
    });

    return jobResult;
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown Bowling.com product scrape error";

    await failScrapeRun(scrapeRun.id, message, {
      mode: "bowling_com_product_pages",
      urls,
      scrapeDelayMs,
      allowLikelyMatch: options.allowLikelyMatch ?? false,
      minConfidence: options.minConfidence ?? 35,
    });

    throw error;
  }
}

export async function runBowlingComCategoryScrapeJob(
  categoryUrl: string,
  options: BowlingComCategoryScrapeJobOptions = {}
) {
  const startedAt = new Date().toISOString();

  const maxPages = options.maxPages ?? 1;
  const maxProducts = options.maxProducts ?? 10;
  const scrapeDelayMs = getSafeScrapeDelayMs(options.scrapeDelayMs ?? 750);

  const scrapeRun = await startScrapeRun({
    sourceName: "bowling.com",
    sourceType: "retailer_price_scrape",
    metadata: {
      mode: "bowling_com_category_pages",
      categoryUrl,
      maxPages,
      maxProducts,
      scrapeDelayMs,
      allowLikelyMatch: options.allowLikelyMatch ?? false,
      minConfidence: options.minConfidence ?? 35,
    },
  });

  try {
    const categoryResult = await scrapeBowlingComCategoryPages(categoryUrl, {
      maxPages,
    });

    const productCandidates = categoryResult.data.slice(0, maxProducts);
    const scrapedListings: ScrapedRetailerListing[] = [];

    for (const [index, product] of productCandidates.entries()) {
      const listing = await scrapeBowlingComProductPage(product.url);
      scrapedListings.push(listing);

      await delayBetweenProductScrapes(
        index,
        productCandidates.length,
        scrapeDelayMs
      );
    }

    const results: RetailerScrapeProcessingResult[] = [];

    for (const listing of scrapedListings) {
      const result = await processScrapedRetailerListing(listing, options);
      results.push(result);
    }

    const savedCount = countSavedResults(results);
    const skippedNoMatchCount = countSkippedNoMatchResults(results);
    const skippedNeedsReviewCount = countSkippedNeedsReviewResults(results);
    const skippedLegacyReviewCount = countSkippedLegacyReviewResults(results);
    const createdListingCount = countCreatedListings(results);
    const updatedListingCount = countUpdatedListings(results);
    const snapshotCreatedCount = countCreatedSnapshots(results);
    const snapshotSkippedCount = countSkippedSnapshots(results);
    const skippedListingReviews = buildSkippedListingReviews(results);

    const jobResult = {
      jobName: "bowling_com_category_scrape_job",
      scrapeRunId: scrapeRun.id,
      sourceName: "bowling.com",
      sourceUrl: categoryUrl,
      startedAt,
      finishedAt: new Date().toISOString(),
      scrapeDelayMs,
      categoryPageCount: categoryResult.pageCount,
      discoveredProductCount: categoryResult.productCount,
      scrapedCount: scrapedListings.length,
      savedCount,
      skippedNoMatchCount,
      skippedNeedsReviewCount,
      skippedLegacyReviewCount,
      createdListingCount,
      updatedListingCount,
      snapshotCreatedCount,
      snapshotSkippedCount,
      skippedListingReviews,
      categoryPages: categoryResult.pages,
      scrapedProductUrls: productCandidates.map((product) => product.url),
      results,
    };

    await completeScrapeRun(scrapeRun.id, {
      itemsFound: categoryResult.productCount,
      itemsCreated: createdListingCount + snapshotCreatedCount,
      itemsUpdated: updatedListingCount,
      itemsRemoved: 0,
      metadata: {
        mode: "bowling_com_category_pages",
        categoryUrl,
        maxPages,
        maxProducts,
        scrapeDelayMs,
        categoryPageCount: categoryResult.pageCount,
        discoveredProductCount: categoryResult.productCount,
        scrapedCount: scrapedListings.length,
        savedCount,
        skippedNoMatchCount,
        skippedNeedsReviewCount,
        skippedLegacyReviewCount,
        createdListingCount,
        updatedListingCount,
        snapshotCreatedCount,
        snapshotSkippedCount,
        skippedListingReviews,
      },
    });

    return jobResult;
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown Bowling.com category scrape error";

    await failScrapeRun(scrapeRun.id, message, {
      mode: "bowling_com_category_pages",
      categoryUrl,
      maxPages,
      maxProducts,
      scrapeDelayMs,
      allowLikelyMatch: options.allowLikelyMatch ?? false,
      minConfidence: options.minConfidence ?? 35,
    });

    throw error;
  }
}