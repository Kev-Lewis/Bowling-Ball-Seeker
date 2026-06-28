import {
  scrapeShopifyFamilyManufacturerCatalog,
  type ShopifyFamilyCatalogOptions,
} from "./shopifyFamilyScraper";

const TRACK_CONFIG = {
  host: "trackbowling.com",
  defaultSourceUrl: "https://trackbowling.com/collections/balls",
  defaultBrandName: "Track",
};

export type TrackCatalogOptions = ShopifyFamilyCatalogOptions;

export async function scrapeTrackManufacturerCatalog(
  options: TrackCatalogOptions = {}
) {
  return scrapeShopifyFamilyManufacturerCatalog(TRACK_CONFIG, options);
}
