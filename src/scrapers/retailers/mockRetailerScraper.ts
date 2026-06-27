import type { RetailerScrapeResult } from "../../types/retailerScraper";

export async function scrapeMockRetailerListings(): Promise<RetailerScrapeResult> {
  return {
    sourceName: "Mock Retailer",
    sourceUrl: "mock://retailer/current-listings",
    checkedAt: new Date().toISOString(),
    count: 3,
    data: [
      {
        retailerName: "Mock Retailer",
        retailerType: "verified_retailer",
        listingTitle: "MOTIV Apex Jackal Bowling Ball 15lb",
        listingUrl: "https://example.com/mock-retailer/motiv-apex-jackal",
        currentPrice: 214.99,
        stockStatus: "in_stock",
        condition: "new",
      },
      {
        retailerName: "Mock Retailer",
        retailerType: "verified_retailer",
        listingTitle: "Motiv Venom Shock Bowling Ball 15 lb",
        listingUrl: "https://example.com/mock-retailer/motiv-venom-shock",
        currentPrice: 144.99,
        stockStatus: "in_stock",
        condition: "new",
      },
      {
        retailerName: "Mock Retailer",
        retailerType: "verified_retailer",
        listingTitle: "Evoke Hysteria Pearl Reactive Bowling Ball",
        listingUrl: "https://example.com/mock-retailer/evoke-hysteria",
        currentPrice: 224.99,
        stockStatus: "in_stock",
        condition: "new",
      },
    ],
  };
}