export type CoverstockType =
  | "solid"
  | "pearl"
  | "hybrid"
  | "urethane"
  | "plastic"
  | "unknown";

export type CoreType = "symmetric" | "asymmetric" | "pancake" | "unknown";

export interface BowlingBall {
  id: string;
  canonicalName: string;
  brand: string;
  manufacturer: string;
  coverstockName?: string;
  coverstockType: CoverstockType;
  coreName?: string;
  coreType: CoreType;
  factoryFinish?: string;
  rg?: number;
  differential?: number;
  mbDifferential?: number;
  availableWeights?: number[];
  officialUrl?: string;
  imageUrl?: string;
  isCurrent: boolean;
  firstSeenAt: string;
  lastSeenAt: string;
  removedFromLineupAt?: string | null;
}

export type RetailerType = "verified_retailer" | "marketplace";

export type ListingCondition =
  | "new"
  | "used"
  | "drilled"
  | "unknown";

export type MatchStatus =
  | "auto_matched"
  | "likely_match"
  | "manual_review"
  | "manually_matched"
  | "manually_matched"
  | "rejected";

export interface RetailerListing {
  id: string;
  ballId: string;
  retailerName: string;
  retailerType: RetailerType;
  listingTitle: string;
  listingUrl: string;
  condition: ListingCondition;
  matchConfidence: number;
  matchStatus: MatchStatus;
  currentPrice: number;
  stockStatus: "in_stock" | "out_of_stock" | "unknown";
  lastCheckedAt: string;
}

export interface PriceSnapshot {
  id: string;
  retailerListingId: string;
  price: number;
  stockStatus: "in_stock" | "out_of_stock" | "unknown";
  checkedAt: string;
}