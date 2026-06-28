import {
  scrapeBrunswickFamilyManufacturerCatalog,
  type BrunswickFamilyCatalogOptions,
} from "./brunswickFamilyScraper";

const BRUNSWICK_CONFIG = {
  host: "brunswickbowling.com",
  defaultSourceUrl: "https://brunswickbowling.com/products/balls/current",
  defaultBrandName: "Brunswick",
};

export type BrunswickCatalogOptions = BrunswickFamilyCatalogOptions;

export async function scrapeBrunswickManufacturerCatalog(
  options: BrunswickCatalogOptions = {}
) {
  return scrapeBrunswickFamilyManufacturerCatalog(BRUNSWICK_CONFIG, options);
}
