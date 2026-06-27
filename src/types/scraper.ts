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

export interface PageTableRow {
  cells: string[];
}

export interface PageImageCandidate {
  src: string;
  alt: string;
}

export interface PageInspectionResult {
  sourceName: string;
  url: string;
  checkedAt: string;
  title: string | null;
  headings: string[];
  textBlocks: string[];
  tableRows: PageTableRow[];
  imageCandidates: PageImageCandidate[];
}