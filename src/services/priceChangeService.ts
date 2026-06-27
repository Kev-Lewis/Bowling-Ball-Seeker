import { prisma } from "../db/prisma";

export type PriceChangeType =
  | "price_drop"
  | "price_increase"
  | "stock_change"
  | "price_and_stock_change";

function getSinceDate(days: number) {
  const since = new Date();
  since.setDate(since.getDate() - days);
  return since;
}

function getPriceChangeType(priceDelta: number, stockChanged: boolean): PriceChangeType {
  if (priceDelta !== 0 && stockChanged) {
    return "price_and_stock_change";
  }

  if (stockChanged) {
    return "stock_change";
  }

  if (priceDelta < 0) {
    return "price_drop";
  }

  return "price_increase";
}

function getPercentChange(previousPrice: number, latestPrice: number) {
  if (previousPrice <= 0) {
    return null;
  }

  return Number((((latestPrice - previousPrice) / previousPrice) * 100).toFixed(2));
}

function formatPrice(value: number) {
  return Number(value.toFixed(2));
}

export async function getRecentPriceChanges(
  days = 7,
  limit = 50,
  minAbsChange = 0.01
) {
  const since = getSinceDate(days);

  const listings = await prisma.retailerListing.findMany({
    include: {
      ball: true,
      priceHistory: {
        orderBy: {
          checkedAt: "desc",
        },
        take: 2,
      },
    },
  });

  const changes = listings
    .map((listing) => {
      const latestSnapshot = listing.priceHistory[0];
      const previousSnapshot = listing.priceHistory[1];

      if (!latestSnapshot || !previousSnapshot) {
        return null;
      }

      if (latestSnapshot.checkedAt < since) {
        return null;
      }

      const priceDelta = formatPrice(latestSnapshot.price - previousSnapshot.price);
      const absolutePriceDelta = Math.abs(priceDelta);
      const stockChanged =
        latestSnapshot.stockStatus !== previousSnapshot.stockStatus;

      if (absolutePriceDelta < minAbsChange && !stockChanged) {
        return null;
      }

      return {
        type: getPriceChangeType(priceDelta, stockChanged),
        ball: {
          id: listing.ball.id,
          canonicalName: listing.ball.canonicalName,
          brand: listing.ball.brand,
          manufacturer: listing.ball.manufacturer,
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
        },
        previous: {
          price: previousSnapshot.price,
          stockStatus: previousSnapshot.stockStatus,
          checkedAt: previousSnapshot.checkedAt,
        },
        latest: {
          price: latestSnapshot.price,
          stockStatus: latestSnapshot.stockStatus,
          checkedAt: latestSnapshot.checkedAt,
        },
        priceDelta,
        percentChange: getPercentChange(
          previousSnapshot.price,
          latestSnapshot.price
        ),
        stockChanged,
      };
    })
    .filter((change) => {
      return change !== null;
    })
    .sort((a, b) => {
      return (
        new Date(b.latest.checkedAt).getTime() -
        new Date(a.latest.checkedAt).getTime()
      );
    })
    .slice(0, limit);

  const priceDrops = changes.filter((change) => {
  return change.priceDelta < 0;
}).length;

const priceIncreases = changes.filter((change) => {
  return change.priceDelta > 0;
}).length;

const stockChanges = changes.filter((change) => {
  return change.stockChanged;
}).length;

return {
  windowDays: days,
  limit,
  minAbsChange,
  count: changes.length,
  priceDrops,
  priceIncreases,
  stockChanges,
  data: changes,
  generatedAt: new Date().toISOString(),
};
}