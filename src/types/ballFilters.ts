export type CatalogStatusFilter =
  | "new"
  | "current"
  | "discontinued"
  | "archived";

export interface BallSearchFilters {
  search?: string;
  brand?: string;
  manufacturer?: string;
  coverstockType?: string;
  coreType?: string;
  isCurrent?: boolean;
  catalogStatus?: CatalogStatusFilter;
}