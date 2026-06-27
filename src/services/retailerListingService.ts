import crypto from "crypto";
import { prisma } from "../db/prisma";
import type {
  ListingCondition,
  MatchStatus,
  RetailerType,
} from "../types/ball";

export type StockStatus = "in_stock" | "out_of_stock" | "unknown";

export interface RetailerListingInput {
  ballId: string;
  retailerName: string;
  retailerType: RetailerType;
  listingTitle: string;
  listingUrl: string;
  condition: ListingCondition;
  matchConfidence: number;
  matchStatus: MatchStatus;
  currentPrice: number;
  stockStatus: StockStatus;
  recordUnchangedSnapshot?: boolean;
}

function buildRetailerListingId(retailerName: string, listingUrl: string) {
  const normalizedRetailerName = retailerName.trim().toLowerCase();
  const normalizedListingUrl = listingUrl.trim().toLowerCase();

  const hash = crypto
    .createHash("sha256")
    .update(`${normalizedRetailerName}::${normalizedListingUrl}`)
    .digest("hex")
    .slice(0, 16);

  return `listing-${hash}`;
}

function shouldProtectManualMatch(
  existingMatchStatus: string | null | undefined,
  incomingMatchStatus: MatchStatus
) {
  return (
    existingMatchStatus === "manually_matched" &&
    incomingMatchStatus !== "manually_matched"
  );
}

export async function upsertRetailerListingWithSnapshot(
  input: RetailerListingInput
) {
  const listingId = buildRetailerListingId(
    input.retailerName,
    input.listingUrl
  );

  const checkedAt = new Date();

  const existingListing = await prisma.retailerListing.findUnique({
    where: {
      id: listingId,
    },
  });

  const latestSnapshot = await prisma.priceSnapshot.findFirst({
    where: {
      retailerListingId: listingId,
    },
    orderBy: {
      checkedAt: "desc",
    },
  });

  const manualMatchProtected = shouldProtectManualMatch(
    existingListing?.matchStatus,
    input.matchStatus
  );

  const protectedBallId = manualMatchProtected
    ? existingListing?.ballId ?? input.ballId
    : input.ballId;

  const protectedMatchConfidence = manualMatchProtected
    ? existingListing?.matchConfidence ?? input.matchConfidence
    : input.matchConfidence;

  const protectedMatchStatus = manualMatchProtected
    ? existingListing?.matchStatus ?? input.matchStatus
    : input.matchStatus;

  const listing = await prisma.retailerListing.upsert({
    where: {
      id: listingId,
    },
    create: {
      id: listingId,
      ballId: input.ballId,
      retailerName: input.retailerName,
      retailerType: input.retailerType,
      listingTitle: input.listingTitle,
      listingUrl: input.listingUrl,
      condition: input.condition,
      matchConfidence: input.matchConfidence,
      matchStatus: input.matchStatus,
      currentPrice: input.currentPrice,
      stockStatus: input.stockStatus,
      lastCheckedAt: checkedAt,
    },
    update: {
      ballId: protectedBallId,
      retailerName: input.retailerName,
      retailerType: input.retailerType,
      listingTitle: input.listingTitle,
      listingUrl: input.listingUrl,
      condition: input.condition,
      matchConfidence: protectedMatchConfidence,
      matchStatus: protectedMatchStatus,
      currentPrice: input.currentPrice,
      stockStatus: input.stockStatus,
      lastCheckedAt: checkedAt,
    },
  });

  const priceChanged =
    !latestSnapshot || latestSnapshot.price !== input.currentPrice;

  const stockChanged =
    !latestSnapshot || latestSnapshot.stockStatus !== input.stockStatus;

  const shouldCreateSnapshot =
    !existingListing ||
    priceChanged ||
    stockChanged ||
    input.recordUnchangedSnapshot === true;

  if (!shouldCreateSnapshot) {
    return {
      action: existingListing ? "updated" : "created",
      snapshotAction: "skipped_unchanged",
      manualMatchProtected,
      listing,
      priceSnapshot: null,
    };
  }

  const priceSnapshot = await prisma.priceSnapshot.create({
    data: {
      id: crypto.randomUUID(),
      retailerListingId: listing.id,
      price: input.currentPrice,
      stockStatus: input.stockStatus,
      checkedAt,
    },
  });

  return {
    action: existingListing ? "updated" : "created",
    snapshotAction: "created",
    manualMatchProtected,
    listing,
    priceSnapshot,
  };
}

export async function getRetailerListingsForBall(ballId: string) {
  const listings = await prisma.retailerListing.findMany({
    where: {
      ballId,
    },
    orderBy: [
      {
        retailerName: "asc",
      },
      {
        currentPrice: "asc",
      },
    ],
    include: {
      priceHistory: {
        orderBy: {
          checkedAt: "desc",
        },
        take: 20,
      },
    },
  });

  return {
    ballId,
    count: listings.length,
    data: listings,
    generatedAt: new Date().toISOString(),
  };
}