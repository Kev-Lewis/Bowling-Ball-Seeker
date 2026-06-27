import { prisma } from "../db/prisma";

function isValidPrice(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value);
}

function formatListingSummary(listing: any) {
  if (!listing) {
    return null;
  }

  return {
    id: listing.id,
    ballId: listing.ballId,
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

function formatSnapshotSummary(snapshot: any) {
  if (!snapshot) {
    return null;
  }

  return {
    id: snapshot.id,
    price: snapshot.price,
    stockStatus: snapshot.stockStatus,
    checkedAt: snapshot.checkedAt,
    listing: formatListingSummary(snapshot.listing),
  };
}

function getLowestListing(listings: any[]) {
  return (
    listings
      .filter((listing) => isValidPrice(listing.currentPrice))
      .sort((a, b) => a.currentPrice - b.currentPrice)[0] ?? null
  );
}

function getHighestListing(listings: any[]) {
  return (
    listings
      .filter((listing) => isValidPrice(listing.currentPrice))
      .sort((a, b) => b.currentPrice - a.currentPrice)[0] ?? null
  );
}

function getLatestCheckedAt(listings: any[]) {
  const sorted = listings
    .filter((listing) => listing.lastCheckedAt)
    .sort((a, b) => {
      return (
        new Date(b.lastCheckedAt).getTime() -
        new Date(a.lastCheckedAt).getTime()
      );
    });

  return sorted[0]?.lastCheckedAt ?? null;
}

export async function getBallPriceSummary(ballId: string) {
  const ball = await prisma.ball.findUnique({
    where: {
      id: ballId,
    },
  });

  if (!ball) {
    throw new Error(`No ball found with id: ${ballId}`);
  }

  const listings = await prisma.retailerListing.findMany({
    where: {
      ballId,
    },
    orderBy: [
      {
        retailerType: "asc",
      },
      {
        currentPrice: "asc",
      },
    ],
  });

  const [
    lowestEverSnapshot,
    highestEverSnapshot,
    priceHistoryCount,
  ] = await Promise.all([
    prisma.priceSnapshot.findFirst({
      where: {
        listing: {
          ballId,
        },
      },
      include: {
        listing: true,
      },
      orderBy: {
        price: "asc",
      },
    }),
    prisma.priceSnapshot.findFirst({
      where: {
        listing: {
          ballId,
        },
      },
      include: {
        listing: true,
      },
      orderBy: {
        price: "desc",
      },
    }),
    prisma.priceSnapshot.count({
      where: {
        listing: {
          ballId,
        },
      },
    }),
  ]);

  const inStockListings = listings.filter((listing) => {
    return listing.stockStatus === "in_stock";
  });

  const outOfStockListings = listings.filter((listing) => {
    return listing.stockStatus === "out_of_stock";
  });

  const unknownStockListings = listings.filter((listing) => {
    return listing.stockStatus === "unknown";
  });

  const verifiedRetailerListings = listings.filter((listing) => {
    return listing.retailerType === "verified_retailer";
  });

  const marketplaceListings = listings.filter((listing) => {
    return listing.retailerType === "marketplace";
  });

  const verifiedRetailerInStockListings = verifiedRetailerListings.filter(
    (listing) => {
      return listing.stockStatus === "in_stock";
    }
  );

  const marketplaceInStockListings = marketplaceListings.filter((listing) => {
    return listing.stockStatus === "in_stock";
  });

  const currentLowestAnyStock = getLowestListing(listings);
  const currentHighestAnyStock = getHighestListing(listings);
  const currentLowestInStock = getLowestListing(inStockListings);
  const currentHighestInStock = getHighestListing(inStockListings);

  const verifiedRetailerLowestInStock = getLowestListing(
    verifiedRetailerInStockListings
  );

  const marketplaceLowestInStock = getLowestListing(marketplaceInStockListings);

  return {
    ball: {
      id: ball.id,
      canonicalName: ball.canonicalName,
      brand: ball.brand,
      manufacturer: ball.manufacturer,
      coverstockType: ball.coverstockType,
      coreType: ball.coreType,
      isCurrent: ball.isCurrent,
    },
    listingCount: listings.length,
    priceHistoryCount,
    stockCounts: {
      inStock: inStockListings.length,
      outOfStock: outOfStockListings.length,
      unknown: unknownStockListings.length,
    },
    current: {
      lowestAnyStock: formatListingSummary(currentLowestAnyStock),
      highestAnyStock: formatListingSummary(currentHighestAnyStock),
      lowestInStock: formatListingSummary(currentLowestInStock),
      highestInStock: formatListingSummary(currentHighestInStock),
      verifiedRetailerLowestInStock: formatListingSummary(
        verifiedRetailerLowestInStock
      ),
      marketplaceLowestInStock: formatListingSummary(marketplaceLowestInStock),
    },
    historical: {
      lowestEverSeen: formatSnapshotSummary(lowestEverSnapshot),
      highestEverSeen: formatSnapshotSummary(highestEverSnapshot),
    },
    lastCheckedAt: getLatestCheckedAt(listings),
    generatedAt: new Date().toISOString(),
  };
}