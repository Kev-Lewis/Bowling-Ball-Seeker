import {
  scrapeBrunswickFamilyManufacturerCatalog,
  type BrunswickFamilyCatalogOptions,
} from "./brunswickFamilyScraper";

const RADICAL_CONFIG = {
  host: "radicalbowling.com",
  defaultSourceUrl: "https://radicalbowling.com/products/balls/current",
  defaultBrandName: "Radical",
};

export type RadicalCatalogOptions = BrunswickFamilyCatalogOptions;

export async function scrapeRadicalManufacturerCatalog(
  options: RadicalCatalogOptions = {}
) {
  return scrapeBrunswickFamilyManufacturerCatalog(RADICAL_CONFIG, options);
}
