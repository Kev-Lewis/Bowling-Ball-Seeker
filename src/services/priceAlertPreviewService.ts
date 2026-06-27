import { getRecentPriceChanges } from "./priceChangeService";

export type PriceAlertType =
  | "price_drop"
  | "back_in_stock"
  | "price_drop_and_back_in_stock";

export interface PriceAlertPreviewOptions {
  days?: number;
  limit?: number;
  minPriceDrop?: number;
  minPercentDrop?: number;
  includeStockChanges?: boolean;
  inStockOnly?: boolean;
}

interface RecentPriceChange {
  type: string;
  ball: {
    id: string;
    canonicalName: string;
    brand: string;
    manufacturer: string;
  };
  listing: {
    id: string;
    retailerName: string;
    retailerType: string;
    listingTitle: string;
    listingUrl: string;
    condition: string;
    matchConfidence: number;
    matchStatus: string;
  };
  previous: {
    price: number;
    stockStatus: string;
    checkedAt: Date | string;
  };
  latest: {
    price: number;
    stockStatus: string;
    checkedAt: Date | string;
  };
  priceDelta: number;
  percentChange: number | null;
  stockChanged: boolean;
}

function formatCurrency(value: number) {
  return `$${value.toFixed(2)}`;
}

function formatPercent(value: number | null) {
  if (value === null) {
    return "N/A";
  }

  return `${value.toFixed(2)}%`;
}

function getAlertType(change: RecentPriceChange): PriceAlertType | null {
  const isPriceDrop = change.priceDelta < 0;
  const isBackInStock =
    change.previous.stockStatus !== "in_stock" &&
    change.latest.stockStatus === "in_stock";

  if (isPriceDrop && isBackInStock) {
    return "price_drop_and_back_in_stock";
  }

  if (isPriceDrop) {
    return "price_drop";
  }

  if (isBackInStock) {
    return "back_in_stock";
  }

  return null;
}

function buildAlertMessage(alertType: PriceAlertType, change: RecentPriceChange) {
  const ballName = `${change.ball.brand} ${change.ball.canonicalName}`;
  const retailerName = change.listing.retailerName;
  const previousPrice = formatCurrency(change.previous.price);
  const latestPrice = formatCurrency(change.latest.price);
  const absoluteDrop = formatCurrency(Math.abs(change.priceDelta));
  const percentChange = formatPercent(change.percentChange);

  if (alertType === "price_drop_and_back_in_stock") {
    return `${ballName} dropped ${absoluteDrop} (${percentChange}) from ${previousPrice} to ${latestPrice} at ${retailerName} and is back in stock.`;
  }

  if (alertType === "price_drop") {
    return `${ballName} dropped ${absoluteDrop} (${percentChange}) from ${previousPrice} to ${latestPrice} at ${retailerName}.`;
  }

  return `${ballName} is back in stock at ${retailerName} for ${latestPrice}.`;
}

export async function getPriceAlertPreview(options: PriceAlertPreviewOptions = {}) {
  const days = options.days ?? 7;
  const limit = options.limit ?? 20;
  const minPriceDrop = options.minPriceDrop ?? 5;
  const minPercentDrop = options.minPercentDrop ?? 0;
  const includeStockChanges = options.includeStockChanges ?? true;
  const inStockOnly = options.inStockOnly ?? true;

  const recentChanges = await getRecentPriceChanges(days, 200, 0.01);

  const alerts = (recentChanges.data as RecentPriceChange[])
    .map((change) => {
      const alertType = getAlertType(change);

      if (!alertType) {
        return null;
      }

      if (inStockOnly && change.latest.stockStatus !== "in_stock") {
        return null;
      }

      const isPriceDrop = change.priceDelta < 0;
      const absoluteDrop = Math.abs(change.priceDelta);
      const absolutePercentDrop = Math.abs(change.percentChange ?? 0);
      const isBackInStock = alertType.includes("back_in_stock");

      const meetsPriceDropThreshold =
        isPriceDrop &&
        absoluteDrop >= minPriceDrop &&
        absolutePercentDrop >= minPercentDrop;

      const meetsStockChangeRule = includeStockChanges && isBackInStock;

      if (!meetsPriceDropThreshold && !meetsStockChangeRule) {
        return null;
      }

      return {
        alertType,
        message: buildAlertMessage(alertType, change),
        ball: change.ball,
        listing: change.listing,
        previous: change.previous,
        latest: change.latest,
        priceDelta: change.priceDelta,
        absolutePriceDrop: isPriceDrop ? absoluteDrop : 0,
        percentChange: change.percentChange,
        stockChanged: change.stockChanged,
      };
    })
    .filter((alert) => {
      return alert !== null;
    })
    .slice(0, limit);

  return {
    windowDays: days,
    limit,
    filters: {
      minPriceDrop,
      minPercentDrop,
      includeStockChanges,
      inStockOnly,
    },
    count: alerts.length,
    data: alerts,
    generatedAt: new Date().toISOString(),
  };
}