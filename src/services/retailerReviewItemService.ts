import { createHash } from "node:crypto";
import { prisma } from "../db/prisma";

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
