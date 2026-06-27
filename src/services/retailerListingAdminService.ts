import type { Prisma } from "@prisma/client";
import { prisma } from "../db/prisma";
import type { MatchStatus } from "../types/ball";

export interface RetailerListingAdminListOptions {
  limit?: number;
  ballId?: string;
  brand?: string;
  manufacturer?: string;
  retailerName?: string;
  matchStatus?: MatchStatus;
  stockStatus?: string;
  verifiedOnly?: boolean;
  search?: string;
}

export type SkippedMatchReviewStatus =
  | "skipped_no_match"
  | "skipped_needs_review";

export interface RetailerListingSkippedReviewOptions {
  limit?: number;
  status?: SkippedMatchReviewStatus;
  dedupeByListing?: boolean;
}

interface SkippedReviewItem {
  scrapeRun: {
    id: string;
    sourceName: string;
    sourceType: string;
    status: string;
    startedAt: Date;
    finishedAt: Date | null;
  };
  review: {
    status: SkippedMatchReviewStatus;
    listing: {
      retailerName: string;
      listingTitle: string;
      listingUrl: string;
      currentPrice: number | null;
      stockStatus: string;
      condition: string;
    };
    selectedMatch?: unknown;
    matchCount?: number;
    topMatches?: unknown[];
    matches?: unknown[];
  };
}

function getSafeLimit(value: number | undefined) {
  if (!Number.isFinite(value) || value === undefined || value <= 0) {
    return 50;
  }

  return Math.min(value, 200);
}

function isSkippedReviewStatus(value: unknown): value is SkippedMatchReviewStatus {
  return value === "skipped_no_match" || value === "skipped_needs_review";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseMetadataJson(metadataJson: string | null | undefined) {
  if (!metadataJson) {
    return null;
  }

  try {
    return JSON.parse(metadataJson);
  } catch {
    return null;
  }
}

function normalizeListingFromReview(value: unknown) {
  if (!isRecord(value)) {
    return null;
  }

  const listingTitle = value.listingTitle?.toString().trim();
  const listingUrl = value.listingUrl?.toString().trim();

  if (!listingTitle || !listingUrl) {
    return null;
  }

  return {
    retailerName: value.retailerName?.toString().trim() || "unknown",
    listingTitle,
    listingUrl,
    currentPrice:
      typeof value.currentPrice === "number" && Number.isFinite(value.currentPrice)
        ? value.currentPrice
        : null,
    stockStatus: value.stockStatus?.toString().trim() || "unknown",
    condition: value.condition?.toString().trim() || "unknown",
  };
}

function normalizeSkippedReview(
  value: unknown,
  scrapeRun: SkippedReviewItem["scrapeRun"]
): SkippedReviewItem | null {
  if (!isRecord(value)) {
    return null;
  }

  if (!isSkippedReviewStatus(value.status)) {
    return null;
  }

  const listing = normalizeListingFromReview(value.listing);

  if (!listing) {
    return null;
  }

  const topMatches = Array.isArray(value.topMatches)
    ? value.topMatches
    : Array.isArray(value.matches)
      ? value.matches
      : [];

  return {
    scrapeRun,
    review: {
      status: value.status,
      listing,
      selectedMatch: value.selectedMatch,
      matchCount:
        typeof value.matchCount === "number" && Number.isFinite(value.matchCount)
          ? value.matchCount
          : topMatches.length,
      topMatches,
      matches: Array.isArray(value.matches) ? value.matches : topMatches,
    },
  };
}

function collectSkippedReviewsFromMetadata(
  value: unknown,
  scrapeRun: SkippedReviewItem["scrapeRun"],
  output: SkippedReviewItem[],
  seenWithinRun: Set<string>
) {
  const normalized = normalizeSkippedReview(value, scrapeRun);

  if (normalized) {
    const key = `${normalized.scrapeRun.id}:${normalized.review.status}:${normalized.review.listing.listingUrl}`;

    if (!seenWithinRun.has(key)) {
      seenWithinRun.add(key);
      output.push(normalized);
    }
  }

  if (Array.isArray(value)) {
    value.forEach((item) => {
      collectSkippedReviewsFromMetadata(item, scrapeRun, output, seenWithinRun);
    });

    return;
  }

  if (isRecord(value)) {
    Object.values(value).forEach((childValue) => {
      collectSkippedReviewsFromMetadata(
        childValue,
        scrapeRun,
        output,
        seenWithinRun
      );
    });
  }
}

function normalizeListingUrlForCompare(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  try {
    const url = new URL(value.trim());
    url.hash = "";
    url.search = "";

    return url.toString().replace(/\/$/, "").toLowerCase();
  } catch {
    return value.trim().replace(/\/$/, "").toLowerCase();
  }
}

async function filterOutResolvedSkippedReviews(items: SkippedReviewItem[]) {
  const listingUrls = [
    ...new Set(
      items
        .map((item) => item.review.listing.listingUrl)
        .filter((url): url is string => Boolean(url))
    ),
  ];

  if (listingUrls.length === 0) {
    return items;
  }

  const existingListings = await prisma.retailerListing.findMany({
    select: {
      listingUrl: true,
      ballId: true,
      matchStatus: true,
      listingTitle: true,
    },
  });

  const resolvedListingUrls = new Set(
    existingListings.map((listing) =>
      normalizeListingUrlForCompare(listing.listingUrl)
    )
  );

  return items.filter((item) => {
    const skippedUrl = normalizeListingUrlForCompare(
      item.review.listing.listingUrl
    );

    return !resolvedListingUrls.has(skippedUrl);
  });
}

function dedupeSkippedReviewsByListing(items: SkippedReviewItem[]) {
  const seenListingUrls = new Set<string>();
  const deduped: SkippedReviewItem[] = [];

  for (const item of items) {
    const listingUrl = item.review.listing.listingUrl;

    if (seenListingUrls.has(listingUrl)) {
      continue;
    }

    seenListingUrls.add(listingUrl);
    deduped.push(item);
  }

  return deduped;
}

async function getMatchingBallIds(options: RetailerListingAdminListOptions) {
  if (!options.brand && !options.manufacturer) {
    return null;
  }

  const where: Prisma.BallWhereInput = {};

  if (options.brand) {
    where.brand = options.brand;
  }

  if (options.manufacturer) {
    where.manufacturer = options.manufacturer;
  }

  const balls = await prisma.ball.findMany({
    where,
    select: {
      id: true,
    },
  });

  return balls.map((ball) => ball.id);
}

async function attachBallsToListings<T extends { ballId: string }>(
  listings: T[]
) {
  const ballIds = [...new Set(listings.map((listing) => listing.ballId))];

  if (ballIds.length === 0) {
    return listings.map((listing) => {
      return {
        ...listing,
        ball: null,
      };
    });
  }

  const balls = await prisma.ball.findMany({
    where: {
      id: {
        in: ballIds,
      },
    },
  });

  const ballsById = new Map(
    balls.map((ball) => {
      return [ball.id, ball];
    })
  );

  return listings.map((listing) => {
    return {
      ...listing,
      ball: ballsById.get(listing.ballId) ?? null,
    };
  });
}

export async function getRetailerListingAdminList(
  options: RetailerListingAdminListOptions = {}
) {
  const limit = getSafeLimit(options.limit);
  const where: Prisma.RetailerListingWhereInput = {};

  if (options.ballId) {
    where.ballId = options.ballId;
  }

  if (options.retailerName) {
    where.retailerName = options.retailerName;
  }

  if (options.matchStatus) {
    where.matchStatus = options.matchStatus;
  }

  if (options.stockStatus) {
    where.stockStatus = options.stockStatus;
  }

  if (options.verifiedOnly === true) {
    where.retailerType = "verified_retailer";
  }

  if (options.search) {
    where.listingTitle = {
      contains: options.search,
    };
  }

  const matchingBallIds = await getMatchingBallIds(options);

  if (matchingBallIds && matchingBallIds.length === 0) {
    return {
      count: 0,
      filters: {
        limit,
        ballId: options.ballId ?? null,
        brand: options.brand ?? null,
        manufacturer: options.manufacturer ?? null,
        retailerName: options.retailerName ?? null,
        matchStatus: options.matchStatus ?? null,
        stockStatus: options.stockStatus ?? null,
        verifiedOnly: options.verifiedOnly ?? null,
        search: options.search ?? null,
      },
      data: [],
      generatedAt: new Date().toISOString(),
    };
  }

  if (matchingBallIds) {
    where.ballId = {
      in: matchingBallIds,
    };
  }

  const listings = await prisma.retailerListing.findMany({
    where,
    orderBy: [
      {
        updatedAt: "desc",
      },
      {
        currentPrice: "asc",
      },
    ],
    take: limit,
    include: {
      priceHistory: {
        orderBy: {
          checkedAt: "desc",
        },
        take: 5,
      },
    },
  });

  const data = await attachBallsToListings(listings);

  return {
    count: data.length,
    filters: {
      limit,
      ballId: options.ballId ?? null,
      brand: options.brand ?? null,
      manufacturer: options.manufacturer ?? null,
      retailerName: options.retailerName ?? null,
      matchStatus: options.matchStatus ?? null,
      stockStatus: options.stockStatus ?? null,
      verifiedOnly: options.verifiedOnly ?? null,
      search: options.search ?? null,
    },
    data,
    generatedAt: new Date().toISOString(),
  };
}

export async function getRetailerListingAdminDetail(listingId: string) {
  const listing = await prisma.retailerListing.findUnique({
    where: {
      id: listingId,
    },
    include: {
      priceHistory: {
        orderBy: {
          checkedAt: "desc",
        },
        take: 50,
      },
    },
  });

  if (!listing) {
    return null;
  }

  const [data] = await attachBallsToListings([listing]);

  return {
    data,
    generatedAt: new Date().toISOString(),
  };
}

export async function getRetailerListingSkippedReviews(
  options: RetailerListingSkippedReviewOptions = {}
) {
  const limit = getSafeLimit(options.limit);
  const dedupeByListing = options.dedupeByListing ?? true;

  const scrapeRuns = await prisma.scrapeRun.findMany({
    where: {
      sourceType: "retailer_price_scrape",
    },
    orderBy: [
      {
        startedAt: "desc",
      },
    ],
    take: 75,
  });

  const skippedReviews: SkippedReviewItem[] = [];

  for (const scrapeRun of scrapeRuns) {
    const metadata = parseMetadataJson(scrapeRun.metadataJson);
    const seenWithinRun = new Set<string>();

    const scrapeRunSummary = {
      id: scrapeRun.id,
      sourceName: scrapeRun.sourceName,
      sourceType: scrapeRun.sourceType,
      status: scrapeRun.status,
      startedAt: scrapeRun.startedAt,
      finishedAt: scrapeRun.finishedAt,
    };

    collectSkippedReviewsFromMetadata(
      metadata,
      scrapeRunSummary,
      skippedReviews,
      seenWithinRun
    );
  }

  const statusFilteredReviews = options.status
    ? skippedReviews.filter((item) => item.review.status === options.status)
    : skippedReviews;

  const unresolvedReviews = await filterOutResolvedSkippedReviews(
    statusFilteredReviews
  );

  const finalReviews = dedupeByListing
    ? dedupeSkippedReviewsByListing(unresolvedReviews)
    : unresolvedReviews;

  const data = finalReviews.slice(0, limit);

  return {
    count: data.length,
    totalFound: finalReviews.length,
    filters: {
      limit,
      status: options.status ?? null,
      dedupeByListing,
      resolvedListingsHidden: true,
    },
    data,
    generatedAt: new Date().toISOString(),
  };
}

export const getSkippedRetailerListingReviews =
  getRetailerListingSkippedReviews;

export const getSkippedMatchReviews = getRetailerListingSkippedReviews;

export const getRetailerSkippedMatchReviews =
  getRetailerListingSkippedReviews;