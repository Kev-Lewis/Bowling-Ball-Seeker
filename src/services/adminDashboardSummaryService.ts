import { prisma } from "../db/prisma";

function parseMetadata(metadataJson: string | null) {
  if (!metadataJson) return {};

  try {
    const parsed = JSON.parse(metadataJson);

    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }

    return {};
  } catch {
    return {};
  }
}

function getSkippedListingReviews(metadata: Record<string, unknown>) {
  const reviews = metadata.skippedListingReviews;
  return Array.isArray(reviews) ? reviews : [];
}

function getReviewStatus(review: unknown) {
  if (
    review &&
    typeof review === "object" &&
    "status" in review &&
    typeof review.status === "string"
  ) {
    return review.status;
  }

  return null;
}

function getReviewListingUrl(review: unknown) {
  if (!review || typeof review !== "object" || !("listing" in review)) {
    return null;
  }

  const listing = review.listing;

  if (
    listing &&
    typeof listing === "object" &&
    "listingUrl" in listing &&
    typeof listing.listingUrl === "string"
  ) {
    return listing.listingUrl;
  }

  return null;
}

async function getUniqueSkippedReviewCounts() {
  const runs = await prisma.scrapeRun.findMany({
    where: {
      sourceType: "retailer_price_scrape",
    },
    orderBy: {
      startedAt: "desc",
    },
    take: 50,
  });

  const skippedNoMatchUrls = new Set<string>();
  const skippedNeedsReviewUrls = new Set<string>();

  for (const run of runs) {
    const metadata = parseMetadata(run.metadataJson);
    const reviews = getSkippedListingReviews(metadata);

    for (const review of reviews) {
      const status = getReviewStatus(review);
      const listingUrl = getReviewListingUrl(review);

      if (!listingUrl) continue;

      if (status === "skipped_no_match") {
        skippedNoMatchUrls.add(listingUrl);
      }

      if (status === "skipped_needs_review") {
        skippedNeedsReviewUrls.add(listingUrl);
      }
    }
  }

  return {
    skippedNoMatch: skippedNoMatchUrls.size,
    skippedNeedsReview: skippedNeedsReviewUrls.size,
  };
}

export async function getAdminDashboardSummary() {
  const [
    totalListings,
    autoMatchedListings,
    likelyMatchedListings,
    manualReviewListings,
    manuallyMatchedListings,
    rejectedListings,
    uniqueSkippedCounts,
    latestRetailerScrapeRun,
  ] = await Promise.all([
    prisma.retailerListing.count(),
    prisma.retailerListing.count({ where: { matchStatus: "auto_matched" } }),
    prisma.retailerListing.count({ where: { matchStatus: "likely_match" } }),
    prisma.retailerListing.count({ where: { matchStatus: "manual_review" } }),
    prisma.retailerListing.count({ where: { matchStatus: "manually_matched" } }),
    prisma.retailerListing.count({ where: { matchStatus: "rejected" } }),
    getUniqueSkippedReviewCounts(),
    prisma.scrapeRun.findFirst({
      where: {
        sourceType: "retailer_price_scrape",
      },
      orderBy: {
        startedAt: "desc",
      },
    }),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    listings: {
      total: totalListings,
      autoMatched: autoMatchedListings,
      likelyMatched: likelyMatchedListings,
      manualReview: manualReviewListings,
      manuallyMatched: manuallyMatchedListings,
      rejected: rejectedListings,
    },
    matchReview: {
      uniqueSkippedNoMatchCount: uniqueSkippedCounts.skippedNoMatch,
      uniqueSkippedNeedsReviewCount: uniqueSkippedCounts.skippedNeedsReview,
    },
    latestRetailerScrapeRun: latestRetailerScrapeRun
      ? {
          id: latestRetailerScrapeRun.id,
          sourceName: latestRetailerScrapeRun.sourceName,
          sourceType: latestRetailerScrapeRun.sourceType,
          status: latestRetailerScrapeRun.status,
          startedAt: latestRetailerScrapeRun.startedAt,
          finishedAt: latestRetailerScrapeRun.finishedAt,
          itemsFound: latestRetailerScrapeRun.itemsFound,
          itemsCreated: latestRetailerScrapeRun.itemsCreated,
          itemsUpdated: latestRetailerScrapeRun.itemsUpdated,
          errorMessage: latestRetailerScrapeRun.errorMessage,
        }
      : null,
  };
}
