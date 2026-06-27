import { createHash, randomUUID } from "crypto";
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
  checkedAt?: Date;
  recordUnchangedSnapshot?: boolean;
}

function normalizeUrl(url: string) {
  return url.trim();
}

function buildRetailerListingId(retailerName: string, listingUrl: string) {
  const normalizedKey = `${retailerName.toLowerCase().trim()}::${normalizeUrl(
    listingUrl
  ).toLowerCase()}`;

  const hash = createHash("sha256").update(normalizedKey).digest("hex").slice(0, 16);

  return `listing-${hash}`;
}

export async function upsertRetailerListingWithSnapshot(
  input: RetailerListingInput
) {
  const checkedAt = input.checkedAt ?? new Date();
  const listingId = buildRetailerListingId(input.retailerName, input.listingUrl);

  const ball = await prisma.ball.findUnique({
    where: {
      id: input.ballId,
    },
  });

  if (!ball) {
    throw new Error(`No ball found with id: ${input.ballId}`);
  }

  const result = await prisma.$transaction(async (tx) => {
    const existingListing = await tx.retailerListing.findUnique({
      where: {
        id: listingId,
      },
    });

    const latestSnapshot = existingListing
      ? await tx.priceSnapshot.findFirst({
          where: {
            retailerListingId: listingId,
          },
          orderBy: {
            checkedAt: "desc",
          },
        })
      : null;

    const listing = existingListing
      ? await tx.retailerListing.update({
          where: {
            id: listingId,
          },
          data: {
            ballId: input.ballId,
            retailerName: input.retailerName,
            retailerType: input.retailerType,
            listingTitle: input.listingTitle,
            listingUrl: normalizeUrl(input.listingUrl),
            condition: input.condition,
            matchConfidence: input.matchConfidence,
            matchStatus: input.matchStatus,
            currentPrice: input.currentPrice,
            stockStatus: input.stockStatus,
            lastCheckedAt: checkedAt,
          },
        })
      : await tx.retailerListing.create({
          data: {
            id: listingId,
            ballId: input.ballId,
            retailerName: input.retailerName,
            retailerType: input.retailerType,
            listingTitle: input.listingTitle,
            listingUrl: normalizeUrl(input.listingUrl),
            condition: input.condition,
            matchConfidence: input.matchConfidence,
            matchStatus: input.matchStatus,
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
        listing,
        priceSnapshot: null,
      };
    }

    const priceSnapshot = await tx.priceSnapshot.create({
      data: {
        id: randomUUID(),
        retailerListingId: listing.id,
        price: input.currentPrice,
        stockStatus: input.stockStatus,
        checkedAt,
      },
    });

    return {
      action: existingListing ? "updated" : "created",
      snapshotAction: "created",
      listing,
      priceSnapshot,
    };
  });

  return result;
}

export async function getRetailerListingsForBall(ballId: string) {
  const listings = await prisma.retailerListing.findMany({
    where: {
      ballId,
    },
    include: {
      priceHistory: {
        orderBy: {
          checkedAt: "desc",
        },
        take: 10,
      },
    },
    orderBy: [
      {
        retailerType: "asc",
      },
      {
        currentPrice: "asc",
      },
    ],
  });

  return {
    ballId,
    count: listings.length,
    data: listings,
    generatedAt: new Date().toISOString(),
  };
}