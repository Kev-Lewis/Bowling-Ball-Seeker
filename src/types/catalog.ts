import type { CoreType, CoverstockType } from "./ball";

export interface ManufacturerBallInput {
  id?: string;
  canonicalName: string;
  brand: string;
  manufacturer: string;
  coverstockName?: string | null;
  coverstockType: CoverstockType;
  coreName?: string | null;
  coreType: CoreType;
  factoryFinish?: string | null;
  rg?: number | null;
  differential?: number | null;
  mbDifferential?: number | null;
  availableWeights?: number[];
  officialUrl?: string | null;
  imageUrl?: string | null;
}

export interface CatalogSyncResult {
  sourceName: string;
  checkedAt: string;
  receivedCount: number;
  created: string[];
  updated: string[];
  unchanged: string[];
  relisted: string[];
  removed: string[];
  specChanged: string[];
}