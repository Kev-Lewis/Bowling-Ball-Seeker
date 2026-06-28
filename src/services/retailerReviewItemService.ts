import { createHash } from "node:crypto";
import { prisma } from "../db/prisma";
import { upsertRetailerListingWithSnapshot } from "./retailerListingService";

type RetailerListingInputForReview = Parameters<
  typeof upsertRetailerListingWithSnapshot
>[0];

function asRetailerType(
  value: string | null | undefined
): RetailerListingInputForReview["retailerType"] {
  return (value ?? "verified_retailer") as RetailerListingInputForReview["retailerType"];
}

function asListingCondition(
  value: string | null | undefined
): RetailerListingInputForReview["condition"] {
  return (value ?? "new") as RetailerListingInputForReview["condition"];
}

function asStockStatus(
  value: string | null | undefined
): RetailerListingInputForReview["stockStatus"] {
  return (value ?? "unknown") as RetailerListingInputForReview["stockStatus"];
}

function buildReviewItemId(retailerName: string, listingUrl: string) {
  const hash = createHash("sha1")
    .update(`${retailerName}|${listingUrl}`)
    .digest("hex")
    .slice(0, 16);

  return `retailer-review-${hash}`;
}

export async function upsertRetailerReviewItems(reviews: any[]) {
  const now = new Date();
  let upsertedCount = 0;

  for (const review of reviews) {
    const listing = review.listing;

    if (!listing?.listingUrl || !listing?.retailerName) {
      continue;
    }

    const selectedMatch = review.selectedMatch ?? null;
    const id = buildReviewItemId(listing.retailerName, listing.listingUrl);

    await prisma.retailerReviewItem.upsert({
      where: {
        listingUrl: listing.listingUrl,
      },
      create: {
        id,
        retailerName: listing.retailerName,
        retailerType: listing.retailerType ?? null,
        listingTitle: listing.listingTitle,
        listingUrl: listing.listingUrl,
        condition: listing.condition ?? null,
        scrapeStatus: review.status,
        reviewStatus: "pending",
        reviewReason: review.legacyReviewReason ?? null,
        currentPrice: listing.currentPrice ?? null,
        stockStatus: listing.stockStatus ?? null,
        selectedBallId: selectedMatch?.ballId ?? null,
        selectedBallName: selectedMatch?.canonicalName ?? null,
        selectedBrand: selectedMatch?.brand ?? null,
        selectedCatalogState: selectedMatch?.catalogState ?? null,
        selectedConfidence: selectedMatch?.confidence ?? null,
        selectedMatchStatus: selectedMatch?.matchStatus ?? null,
        topMatchesJson: JSON.stringify(review.topMatches ?? []),
        firstSeenAt: now,
        lastSeenAt: now,
      },
      update: {
        scrapeStatus: review.status,
        reviewReason: review.legacyReviewReason ?? null,
        currentPrice: listing.currentPrice ?? null,
        stockStatus: listing.stockStatus ?? null,
        condition: listing.condition ?? null,
        selectedBallId: selectedMatch?.ballId ?? null,
        selectedBallName: selectedMatch?.canonicalName ?? null,
        selectedBrand: selectedMatch?.brand ?? null,
        selectedCatalogState: selectedMatch?.catalogState ?? null,
        selectedConfidence: selectedMatch?.confidence ?? null,
        selectedMatchStatus: selectedMatch?.matchStatus ?? null,
        topMatchesJson: JSON.stringify(review.topMatches ?? []),
        lastSeenAt: now,
      },
    });

    upsertedCount += 1;
  }

  return {
    upsertedCount,
  };
}

export async function listRetailerReviewItems(options: {
  reviewStatus?: string;
  reviewReason?: string;
  q?: string;
  limit?: number;
} = {}) {
  const limit = Math.min(Math.max(options.limit ?? 100, 1), 500);
  const whereParts: any[] = [];

  if (options.reviewStatus && options.reviewStatus !== "any") {
    whereParts.push({ reviewStatus: options.reviewStatus });
  }

  if (options.reviewReason && options.reviewReason !== "any") {
    whereParts.push({ reviewReason: options.reviewReason });
  }

  if (options.q) {
    whereParts.push({
      OR: [
        { listingTitle: { contains: options.q } },
        { listingUrl: { contains: options.q } },
        { selectedBallName: { contains: options.q } },
        { selectedBrand: { contains: options.q } },
      ],
    });
  }

  const where = whereParts.length > 0 ? { AND: whereParts } : {};

  const items = await prisma.retailerReviewItem.findMany({
    where,
    orderBy: [{ reviewStatus: "asc" }, { lastSeenAt: "desc" }],
    take: limit,
  });

  const countsByStatus = await prisma.retailerReviewItem.groupBy({
    by: ["reviewStatus"],
    _count: { id: true },
    orderBy: { reviewStatus: "asc" },
  });

  const countsByReason = await prisma.retailerReviewItem.groupBy({
    by: ["reviewReason"],
    _count: { id: true },
    orderBy: { reviewReason: "asc" },
  });

  return {
    count: items.length,
    countsByStatus,
    countsByReason,
    items,
  };
}

export async function setRetailerReviewItemStatus(
  id: string,
  reviewStatus: string
) {
  return prisma.retailerReviewItem.update({
    where: { id },
    data: { reviewStatus },
  });
}


export async function searchCatalogBallsForReviewAssignment(options: {
  q?: string;
  limit?: number;
} = {}) {
  const limit = Math.min(Math.max(options.limit ?? 25, 1), 100);
  const q = options.q?.trim() ?? "";

  const where = q
    ? {
        OR: [
          { canonicalName: { contains: q } },
          { brand: { contains: q } },
          { manufacturer: { contains: q } },
          { coverstockName: { contains: q } },
          { coreName: { contains: q } },
        ],
      }
    : {};

  const items = await prisma.ball.findMany({
    where,
    orderBy: [
      { isCurrent: "desc" },
      { brand: "asc" },
      { canonicalName: "asc" },
    ],
    take: limit,
    select: {
      id: true,
      canonicalName: true,
      brand: true,
      manufacturer: true,
      coverstockName: true,
      coverstockType: true,
      coreName: true,
      coreType: true,
      isCurrent: true,
    },
  });

  return {
    count: items.length,
    items,
  };
}

export async function assignRetailerReviewItemToExistingBall(
  reviewItemId: string,
  ballId: string
) {
  const reviewItem = await prisma.retailerReviewItem.findUnique({
    where: { id: reviewItemId },
  });

  if (!reviewItem) {
    throw new Error(`Review item not found: ${reviewItemId}`);
  }

  const ball = await prisma.ball.findUnique({
    where: { id: ballId },
  });

  if (!ball) {
    throw new Error(`Ball not found: ${ballId}`);
  }

  if (reviewItem.currentPrice === null) {
    throw new Error(
      `Cannot assign review item without a current price: ${reviewItem.id}`
    );
  }

  const upsert = await upsertRetailerListingWithSnapshot({
    ballId: ball.id,
    retailerName: reviewItem.retailerName,
    retailerType: asRetailerType(reviewItem.retailerType),
    listingTitle: reviewItem.listingTitle,
    listingUrl: reviewItem.listingUrl,
    condition: asListingCondition(reviewItem.condition),
    matchConfidence: 100,
    matchStatus: "manually_matched",
    currentPrice: reviewItem.currentPrice,
    stockStatus: asStockStatus(reviewItem.stockStatus),
  });

  const updatedReviewItem = await prisma.retailerReviewItem.update({
    where: { id: reviewItem.id },
    data: {
      reviewStatus: "assigned_existing",
      selectedBallId: ball.id,
      selectedBallName: ball.canonicalName,
      selectedBrand: ball.brand,
      selectedCatalogState: ball.isCurrent ? "current" : "legacy",
      selectedConfidence: 100,
      selectedMatchStatus: "manually_matched",
    },
  });

  return {
    reviewItem: updatedReviewItem,
    ball: {
      id: ball.id,
      canonicalName: ball.canonicalName,
      brand: ball.brand,
      manufacturer: ball.manufacturer,
      isCurrent: ball.isCurrent,
    },
    upsert,
  };
}

function slugifyBallPart(value: string) {
  return value
    .toLowerCase()
    .replace(/[™®©]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function buildManualBallId(brand: string, canonicalName: string) {
  const slug = slugifyBallPart(`${brand}-${canonicalName}`);

  return slug || buildReviewItemId(brand, canonicalName);
}

function inferSeparateBallDefaults(listingTitle: string) {
  const title = listingTitle.toLowerCase();

  const isSpareLike =
    /\b(spare|pixel|liberty|stadium|crest|velocity)\b/.test(title);

  if (isSpareLike) {
    return {
      coverstockName: "Polyester",
      coverstockType: "plastic",
      coreName: "Pancake",
      coreType: "symmetric",
      factoryFinish: "Polished",
    };
  }

  if (/\bpearl\b/.test(title)) {
    return {
      coverstockName: "Unknown Pearl Reactive",
      coverstockType: "pearl",
      coreName: null,
      coreType: "unknown",
      factoryFinish: null,
    };
  }

  if (/\bsolid\b/.test(title)) {
    return {
      coverstockName: "Unknown Solid Reactive",
      coverstockType: "solid",
      coreName: null,
      coreType: "unknown",
      factoryFinish: null,
    };
  }

  if (/\bhybrid\b/.test(title)) {
    return {
      coverstockName: "Unknown Hybrid Reactive",
      coverstockType: "hybrid",
      coreName: null,
      coreType: "unknown",
      factoryFinish: null,
    };
  }

  return {
    coverstockName: null,
    coverstockType: "unknown",
    coreName: null,
    coreType: "unknown",
    factoryFinish: null,
  };
}

function cleanListingTitleToCanonicalName(listingTitle: string, brand: string) {
  return listingTitle
    .replace(new RegExp(`^${brand}\\s+`, "i"), "")
    .replace(/\s+/g, " ")
    .trim();
}

export async function createSeparateBallFromRetailerReviewItem(options: {
  reviewItemId: string;
  canonicalName?: string;
  brand?: string;
  manufacturer?: string;
  coverstockName?: string;
  coverstockType?: string;
  coreName?: string;
  coreType?: string;
  factoryFinish?: string;
  isCurrent?: boolean;
}) {
  const reviewItem = await prisma.retailerReviewItem.findUnique({
    where: { id: options.reviewItemId },
  });

  if (!reviewItem) {
    throw new Error(`Review item not found: ${options.reviewItemId}`);
  }

  if (reviewItem.currentPrice === null) {
    throw new Error(
      `Cannot create separate ball without a current price: ${reviewItem.id}`
    );
  }

  const inferredBrand =
    options.brand?.trim() ||
    reviewItem.selectedBrand?.trim() ||
    reviewItem.listingTitle.split(/\s+/)[0] ||
    "Unknown";

  const inferredManufacturer =
    options.manufacturer?.trim() || inferredBrand;

  const canonicalName =
    options.canonicalName?.trim() ||
    cleanListingTitleToCanonicalName(reviewItem.listingTitle, inferredBrand);

  const defaults = inferSeparateBallDefaults(reviewItem.listingTitle);
  const now = new Date();
  const ballId = buildManualBallId(inferredBrand, canonicalName);

  const ball = await prisma.ball.upsert({
    where: { id: ballId },
    create: {
      id: ballId,
      canonicalName,
      brand: inferredBrand,
      manufacturer: inferredManufacturer,
      coverstockName:
        options.coverstockName?.trim() || defaults.coverstockName,
      coverstockType:
        options.coverstockType?.trim() || defaults.coverstockType,
      coreName: options.coreName?.trim() || defaults.coreName,
      coreType: options.coreType?.trim() || defaults.coreType,
      factoryFinish:
        options.factoryFinish?.trim() || defaults.factoryFinish,
      rg: null,
      differential: null,
      mbDifferential: null,
      availableWeightsJson: null,
      officialUrl: null,
      imageUrl: null,
      isCurrent: options.isCurrent ?? false,
      firstSeenAt: reviewItem.firstSeenAt ?? now,
      lastSeenAt: now,
      removedFromLineupAt: options.isCurrent === true ? null : now,
    },
    update: {
      canonicalName,
      brand: inferredBrand,
      manufacturer: inferredManufacturer,
      coverstockName:
        options.coverstockName?.trim() || defaults.coverstockName,
      coverstockType:
        options.coverstockType?.trim() || defaults.coverstockType,
      coreName: options.coreName?.trim() || defaults.coreName,
      coreType: options.coreType?.trim() || defaults.coreType,
      factoryFinish:
        options.factoryFinish?.trim() || defaults.factoryFinish,
      isCurrent: options.isCurrent ?? false,
      lastSeenAt: now,
      removedFromLineupAt: options.isCurrent === true ? null : now,
    },
  });

  const upsert = await upsertRetailerListingWithSnapshot({
    ballId: ball.id,
    retailerName: reviewItem.retailerName,
    retailerType: asRetailerType(reviewItem.retailerType),
    listingTitle: reviewItem.listingTitle,
    listingUrl: reviewItem.listingUrl,
    condition: asListingCondition(reviewItem.condition),
    matchConfidence: 100,
    matchStatus: "manually_matched",
    currentPrice: reviewItem.currentPrice,
    stockStatus: asStockStatus(reviewItem.stockStatus),
  });

  const updatedReviewItem = await prisma.retailerReviewItem.update({
    where: { id: reviewItem.id },
    data: {
      reviewStatus: "created_separate_ball",
      selectedBallId: ball.id,
      selectedBallName: ball.canonicalName,
      selectedBrand: ball.brand,
      selectedCatalogState: ball.isCurrent ? "current" : "legacy",
      selectedConfidence: 100,
      selectedMatchStatus: "manually_matched",
    },
  });

  return {
    reviewItem: updatedReviewItem,
    ball,
    upsert,
  };
}
