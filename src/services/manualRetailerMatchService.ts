import { scrapeBowlingComProductPage } from "../scrapers/retailers/bowlingComScraper";
import { prisma } from "../db/prisma";
import { upsertRetailerListingWithSnapshot } from "./retailerListingService";
import type { ScrapedRetailerListing } from "../types/retailerScraper";

export interface ResolveRetailerListingMatchInput {
  ballId: string;
  listingUrl: string;
  matchConfidence?: number;
  note?: string;
  dryRun?: boolean;
}

function isBowlingComUrl(url: string) {
  try {
    const parsedUrl = new URL(url);

    return (
      parsedUrl.hostname === "bowling.com" ||
      parsedUrl.hostname === "www.bowling.com"
    );
  } catch {
    return false;
  }
}

async function scrapeListingForManualMatch(
  listingUrl: string
): Promise<ScrapedRetailerListing> {
  if (isBowlingComUrl(listingUrl)) {
    return scrapeBowlingComProductPage(listingUrl);
  }

  throw new Error(
    "Manual resolver currently supports Bowling.com listing URLs only."
  );
}

export async function resolveRetailerListingMatch(
  input: ResolveRetailerListingMatchInput
) {
  const ball = await prisma.ball.findUnique({
    where: {
      id: input.ballId,
    },
  });

  if (!ball) {
    throw new Error(`Ball not found: ${input.ballId}`);
  }

  const listing = await scrapeListingForManualMatch(input.listingUrl);

  const matchConfidence = input.matchConfidence ?? 100;
  const dryRun = input.dryRun ?? false;

  const plannedWrite = {
    ballId: ball.id,
    retailerName: listing.retailerName,
    retailerType: listing.retailerType,
    listingTitle: listing.listingTitle,
    listingUrl: listing.listingUrl,
    condition: listing.condition,
    matchConfidence,
    matchStatus: "manual_review" as const,
    currentPrice: listing.currentPrice,
    stockStatus: listing.stockStatus,
  };

  if (dryRun) {
    return {
      resolvedAt: new Date().toISOString(),
      dryRun: true,
      note: input.note ?? null,
      selectedBall: {
        id: ball.id,
        canonicalName: ball.canonicalName,
        brand: ball.brand,
        manufacturer: ball.manufacturer,
        isCurrent: ball.isCurrent,
      },
      scrapedListing: listing,
      plannedWrite,
      upsert: null,
    };
  }

  const upsert = await upsertRetailerListingWithSnapshot(plannedWrite);

  return {
    resolvedAt: new Date().toISOString(),
    dryRun: false,
    note: input.note ?? null,
    selectedBall: {
      id: ball.id,
      canonicalName: ball.canonicalName,
      brand: ball.brand,
      manufacturer: ball.manufacturer,
      isCurrent: ball.isCurrent,
    },
    scrapedListing: listing,
    plannedWrite,
    upsert,
  };
}