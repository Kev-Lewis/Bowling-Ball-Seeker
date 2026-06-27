import crypto from "crypto";
import { prisma } from "../db/prisma";

export interface DuplicateRetailerListingCleanupOptions {
  dryRun?: boolean;
  retailerName?: string;
  limit?: number;
}

function buildCanonicalRetailerListingId(
  retailerName: string,
  listingUrl: string
) {
  const normalizedRetailerName = retailerName.trim().toLowerCase();
  const normalizedListingUrl = listingUrl.trim().toLowerCase();

  const hash = crypto
    .createHash("sha256")
    .update(`${normalizedRetailerName}::${normalizedListingUrl}`)
    .digest("hex")
    .slice(0, 16);

  return `listing-${hash}`;
}

export async function cleanupDuplicateRetailerListings(
  options: DuplicateRetailerListingCleanupOptions = {}
) {
  const dryRun = options.dryRun ?? true;
  const limit = options.limit ?? 50;
  const safeLimit = Number.isFinite(limit) && limit > 0 ? limit : 50;

  const listings = await prisma.retailerListing.findMany({
    where: {
      ...(options.retailerName
        ? {
            retailerName: options.retailerName,
          }
        : {}),
    },
    orderBy: [
      {
        retailerName: "asc",
      },
      {
        listingUrl: "asc",
      },
      {
        updatedAt: "desc",
      },
    ],
  });

  const listingsById = new Map(
    listings.map((listing) => {
      return [listing.id, listing];
    })
  );

  const duplicateCandidates = [];

  for (const listing of listings) {
    const canonicalId = buildCanonicalRetailerListingId(
      listing.retailerName,
      listing.listingUrl
    );

    if (listing.id === canonicalId) {
      continue;
    }

    const canonicalListing = listingsById.get(canonicalId);

    if (!canonicalListing) {
      continue;
    }

    const priceSnapshotCount = await prisma.priceSnapshot.count({
      where: {
        retailerListingId: listing.id,
      },
    });

    duplicateCandidates.push({
      duplicateListing: listing,
      canonicalListing,
      canonicalId,
      priceSnapshotCount,
    });
  }

  const selectedDuplicates = duplicateCandidates.slice(0, safeLimit);

  if (!dryRun) {
    for (const item of selectedDuplicates) {
      await prisma.$transaction([
        prisma.priceSnapshot.deleteMany({
          where: {
            retailerListingId: item.duplicateListing.id,
          },
        }),
        prisma.retailerListing.delete({
          where: {
            id: item.duplicateListing.id,
          },
        }),
      ]);
    }
  }

  return {
    dryRun,
    scannedListingCount: listings.length,
    duplicateCandidateCount: duplicateCandidates.length,
    affectedCount: selectedDuplicates.length,
    filters: {
      retailerName: options.retailerName ?? null,
      limit: safeLimit,
    },
    data: selectedDuplicates.map((item) => {
      return {
        duplicateListing: {
          id: item.duplicateListing.id,
          ballId: item.duplicateListing.ballId,
          retailerName: item.duplicateListing.retailerName,
          listingTitle: item.duplicateListing.listingTitle,
          listingUrl: item.duplicateListing.listingUrl,
          matchStatus: item.duplicateListing.matchStatus,
          currentPrice: item.duplicateListing.currentPrice,
          stockStatus: item.duplicateListing.stockStatus,
          createdAt: item.duplicateListing.createdAt,
          updatedAt: item.duplicateListing.updatedAt,
        },
        canonicalListing: {
          id: item.canonicalListing.id,
          ballId: item.canonicalListing.ballId,
          retailerName: item.canonicalListing.retailerName,
          listingTitle: item.canonicalListing.listingTitle,
          listingUrl: item.canonicalListing.listingUrl,
          matchStatus: item.canonicalListing.matchStatus,
          currentPrice: item.canonicalListing.currentPrice,
          stockStatus: item.canonicalListing.stockStatus,
          createdAt: item.canonicalListing.createdAt,
          updatedAt: item.canonicalListing.updatedAt,
        },
        canonicalId: item.canonicalId,
        priceSnapshotCount: item.priceSnapshotCount,
        action: dryRun ? "would_delete_duplicate" : "deleted_duplicate",
      };
    }),
    generatedAt: new Date().toISOString(),
  };
}