import { prisma } from "../db/prisma";

export interface DealSearchOptions {
  limit?: number;
  brand?: string;
  retailerType?: string;
  minMatchConfidence?: number;
  verifiedOnly?: boolean;
  inStockOnly?: boolean;
}

function formatDealListing(listing: any) {
  return {
    ball: {
      id: listing.ball.id,
      canonicalName: listing.ball.canonicalName,
      brand: listing.ball.brand,
      manufacturer: listing.ball.manufacturer,
      coverstockType: listing.ball.coverstockType,
      coreType: listing.ball.coreType,
      isCurrent: listing.ball.isCurrent,
    },
    listing: {
      id: listing.id,
      retailerName: listing.retailerName,
      retailerType: listing.retailerType,
      listingTitle: listing.listingTitle,
      listingUrl: listing.listingUrl,
      condition: listing.condition,
      matchConfidence: listing.matchConfidence,
      matchStatus: listing.matchStatus,
      currentPrice: listing.currentPrice,
      stockStatus: listing.stockStatus,
      lastCheckedAt: listing.lastCheckedAt,
    },
  };
}

export async function getCurrentDeals(options: DealSearchOptions = {}) {
  const limit = options.limit ?? 25;
  const minMatchConfidence = options.minMatchConfidence ?? 0;
  const inStockOnly = options.inStockOnly ?? true;
  const verifiedOnly = options.verifiedOnly ?? false;

  const listings = await prisma.retailerListing.findMany({
    where: {
      ...(inStockOnly
        ? {
            stockStatus: "in_stock",
          }
        : {}),
      ...(verifiedOnly
        ? {
            retailerType: "verified_retailer",
          }
        : {}),
      ...(options.retailerType
        ? {
            retailerType: options.retailerType,
          }
        : {}),
      matchConfidence: {
        gte: minMatchConfidence,
      },
      ball: {
        isCurrent: true,
        ...(options.brand
          ? {
              brand: {
                contains: options.brand,
              },
            }
          : {}),
      },
    },
    include: {
      ball: true,
    },
    orderBy: [
      {
        currentPrice: "asc",
      },
      {
        lastCheckedAt: "desc",
      },
    ],
    take: limit,
  });

  return {
    filters: {
      limit,
      brand: options.brand,
      retailerType: options.retailerType,
      minMatchConfidence,
      verifiedOnly,
      inStockOnly,
    },
    count: listings.length,
    data: listings.map(formatDealListing),
    generatedAt: new Date().toISOString(),
  };
}