import type { ListingCondition, RetailerType } from "./ball";

export interface ScrapedRetailerListing {
  retailerName: string;
  retailerType: RetailerType;
  listingTitle: string;
  listingUrl: string;
  currentPrice: number;
  stockStatus: "in_stock" | "out_of_stock" | "unknown";
  condition: ListingCondition;
}

export interface RetailerScrapeResult {
  sourceName: string;
  sourceUrl: string;
  checkedAt: string;
  count: number;
  data: ScrapedRetailerListing[];
}