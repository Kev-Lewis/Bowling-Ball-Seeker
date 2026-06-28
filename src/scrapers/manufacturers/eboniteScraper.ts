import {
  scrapeShopifyFamilyManufacturerCatalog,
  type ShopifyFamilyCatalogOptions,
} from "./shopifyFamilyScraper";

const EBONITE_CONFIG = {
  host: "ebonite.com",
  defaultSourceUrl: "https://ebonite.com/collections/balls",
  defaultBrandName: "Ebonite",
};

export type EboniteCatalogOptions = ShopifyFamilyCatalogOptions;

export async function scrapeEboniteManufacturerCatalog(
  options: EboniteCatalogOptions = {}
) {
  return scrapeShopifyFamilyManufacturerCatalog(EBONITE_CONFIG, options);
}
