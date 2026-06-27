import { prisma } from "../db/prisma";

export interface RecentSkippedMatchReviewOptions {
  limit?: number;
  sourceName?: string;
  status?: "skipped_no_match" | "skipped_needs_review";
  dedupeByListing?: boolean;
}

function parseMetadata(metadataJson: string | null) {
  if (!metadataJson) {
    return {};
  }

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
    !listing ||
    typeof listing !== "object" ||
    !("listingUrl" in listing) ||
    typeof listing.listingUrl !== "string"
  ) {
    return null;
  }

  return listing.listingUrl.trim().toLowerCase();
}

export async function getRecentSkippedMatchReviews(
  options: RecentSkippedMatchReviewOptions = {}
) {
  const limit = options.limit ?? 50;
  const safeLimit = Number.isFinite(limit) && limit > 0 ? limit : 50;
  const dedupeByListing = options.dedupeByListing ?? false;

  const runs = await prisma.scrapeRun.findMany({
    where: {
      sourceType: "retailer_price_scrape",
      ...(options.sourceName
        ? {
            sourceName: options.sourceName,
          }
        : {}),
    },
    orderBy: {
      startedAt: "desc",
    },
    take: 50,
  });

  const reviews = [];
  const seenListingUrls = new Set<string>();

  for (const run of runs) {
    const metadata = parseMetadata(run.metadataJson);
    const skippedListingReviews = getSkippedListingReviews(metadata);

    for (const review of skippedListingReviews) {
      const reviewStatus = getReviewStatus(review);

      if (options.status && reviewStatus !== options.status) {
        continue;
      }

      const listingUrl = getReviewListingUrl(review);

      if (dedupeByListing && listingUrl) {
        if (seenListingUrls.has(listingUrl)) {
          continue;
        }

        seenListingUrls.add(listingUrl);
      }

      reviews.push({
        scrapeRun: {
          id: run.id,
          sourceName: run.sourceName,
          sourceType: run.sourceType,
          status: run.status,
          startedAt: run.startedAt,
          finishedAt: run.finishedAt,
          itemsFound: run.itemsFound,
          itemsCreated: run.itemsCreated,
          itemsUpdated: run.itemsUpdated,
          errorMessage: run.errorMessage,
        },
        review,
      });
    }
  }

  const data = reviews.slice(0, safeLimit);

  return {
    count: data.length,
    totalFound: reviews.length,
    filters: {
      limit: safeLimit,
      sourceName: options.sourceName ?? null,
      status: options.status ?? null,
      dedupeByListing,
    },
    data,
    generatedAt: new Date().toISOString(),
  };
}