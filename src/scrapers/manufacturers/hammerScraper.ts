import {
  scrapeShopifyFamilyManufacturerCatalog,
  type ShopifyFamilyCatalogOptions,
} from "./shopifyFamilyScraper";

const HAMMER_CONFIG = {
  host: "hammerbowling.com",
  defaultSourceUrl: "https://hammerbowling.com/collections/balls",
  defaultBrandName: "Hammer",
};

export type HammerCatalogOptions = ShopifyFamilyCatalogOptions;

export async function scrapeHammerManufacturerCatalog(
  options: HammerCatalogOptions = {}
) {
  return scrapeShopifyFamilyManufacturerCatalog(HAMMER_CONFIG, options);
}
