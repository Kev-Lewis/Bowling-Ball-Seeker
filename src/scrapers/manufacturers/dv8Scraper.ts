import {
  scrapeBrunswickFamilyManufacturerCatalog,
  type BrunswickFamilyCatalogOptions,
} from "./brunswickFamilyScraper";

const DV8_CONFIG = {
  host: "dv8bowling.com",
  defaultSourceUrl: "https://dv8bowling.com/products/balls/current",
  defaultBrandName: "DV8",
};

export type DV8CatalogOptions = BrunswickFamilyCatalogOptions;

export async function scrapeDV8ManufacturerCatalog(
  options: DV8CatalogOptions = {}
) {
  return scrapeBrunswickFamilyManufacturerCatalog(DV8_CONFIG, options);
}
