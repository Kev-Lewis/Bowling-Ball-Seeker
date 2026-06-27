import { prisma } from "../db/prisma";

function formatListingPrice(listing: any) {
  if (!listing) {
    return null;
  }

  return {
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
  };
}

function formatSnapshot(snapshot: any) {
  if (!snapshot) {
    return null;
  }

  return {
    price: snapshot.price,
    stockStatus: snapshot.stockStatus,
    checkedAt: snapshot.checkedAt,
    retailerName: snapshot.listing.retailerName,
    retailerType: snapshot.listing.retailerType,
    listingTitle: snapshot.listing.listingTitle,
    listingUrl: snapshot.listing.listingUrl,
    condition: snapshot.listing.condition,
    matchConfidence: snapshot.listing.matchConfidence,
    matchStatus: snapshot.listing.matchStatus,
  };
}

export async function getPriceStatsForBall(ballId: string) {
  const ball = await prisma.ball.findUnique({
    where: {
      id: ballId,
    },
  });

  if (!ball) {
    return null;
  }

  const currentListings = await prisma.retailerListing.findMany({
    where: {
      ballId,
      condition: "new",
      stockStatus: "in_stock",
      matchStatus: {
        not: "rejected",
      },
      matchConfidence: {
        gte: 80,
      },
    },
    orderBy: {
      currentPrice: "asc",
    },
  });

  const verifiedRetailerListings = currentListings.filter(
    (listing) =>
      listing.retailerType === "verified_retailer" &&
      listing.matchConfidence >= 95
  );

  const marketplaceListings = currentListings.filter(
    (listing) =>
      listing.retailerType === "marketplace" &&
      listing.matchConfidence >= 80
  );

  const lowestSeenSnapshot = await prisma.priceSnapshot.findFirst({
    where: {
      listing: {
        ballId,
        condition: "new",
        matchStatus: {
          not: "rejected",
        },
        matchConfidence: {
          gte: 80,
        },
      },
      stockStatus: "in_stock",
    },
    include: {
      listing: true,
    },
    orderBy: {
      price: "asc",
    },
  });

  const highestSeenSnapshot = await prisma.priceSnapshot.findFirst({
    where: {
      listing: {
        ballId,
        condition: "new",
        matchStatus: {
          not: "rejected",
        },
        matchConfidence: {
          gte: 80,
        },
      },
      stockStatus: "in_stock",
    },
    include: {
      listing: true,
    },
    orderBy: {
      price: "desc",
    },
  });

  const lowestCurrentListing = currentListings[0] ?? null;
  const highestCurrentListing =
    currentListings.length > 0
      ? currentListings[currentListings.length - 1]
      : null;

  return {
    ball: {
      id: ball.id,
      canonicalName: ball.canonicalName,
      brand: ball.brand,
      manufacturer: ball.manufacturer,
    },
    current: {
      bestVerifiedRetailerPrice: formatListingPrice(
        verifiedRetailerListings[0] ?? null
      ),
      bestMarketplacePrice: formatListingPrice(marketplaceListings[0] ?? null),
      lowestCurrentPrice: formatListingPrice(lowestCurrentListing),
      highestCurrentPrice: formatListingPrice(highestCurrentListing),
      currentPriceRange:
        lowestCurrentListing && highestCurrentListing
          ? {
              low: lowestCurrentListing.currentPrice,
              high: highestCurrentListing.currentPrice,
            }
          : null,
    },
    history: {
      lowestSeen: formatSnapshot(lowestSeenSnapshot),
      highestSeen: formatSnapshot(highestSeenSnapshot),
    },
  };
}