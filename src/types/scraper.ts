export interface DiscoveredProductLink {
  sourceName: string;
  name: string;
  url: string;
}

export interface ProductDiscoveryResult {
  sourceName: string;
  sourceUrl: string;
  checkedAt: string;
  count: number;
  data: DiscoveredProductLink[];
}