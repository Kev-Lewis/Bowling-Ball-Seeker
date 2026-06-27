import type { Prisma } from "@prisma/client";
import { prisma } from "../db/prisma";
import type { MatchStatus } from "../types/ball";

export interface RetailerListingAdminListOptions {
  limit?: number;
  ballId?: string;
  brand?: string;
  manufacturer?: string;
  retailerName?: string;
  matchStatus?: MatchStatus;
  stockStatus?: string;
  verifiedOnly?: boolean;
  search?: string;
}

function getSafeLimit(value: number | undefined) {
  if (!Number.isFinite(value) || value === undefined || value <= 0) {
    return 50;
  }

  return Math.min(value, 200);
}

async function getMatchingBallIds(options: RetailerListingAdminListOptions) {
  if (!options.brand && !options.manufacturer) {
    return null;
  }

  const where: Prisma.BallWhereInput = {};

  if (options.brand) {
    where.brand = options.brand;
  }

  if (options.manufacturer) {
    where.manufacturer = options.manufacturer;
  }

  const balls = await prisma.ball.findMany({
    where,
    select: {
      id: true,
    },
  });

  return balls.map((ball) => ball.id);
}

async function attachBallsToListings<T extends { ballId: string }>(
  listings: T[]
) {
  const ballIds = [...new Set(listings.map((listing) => listing.ballId))];

  const balls = await prisma.ball.findMany({
    where: {
      id: {
        in: ballIds,
      },
    },
  });

  const ballsById = new Map(
    balls.map((ball) => {
      return [ball.id, ball];
    })
  );

  return listings.map((listing) => {
    return {
      ...listing,
      ball: ballsById.get(listing.ballId) ?? null,
    };
  });
}

export async function getRetailerListingAdminList(
  options: RetailerListingAdminListOptions = {}
) {
  const limit = getSafeLimit(options.limit);
  const where: Prisma.RetailerListingWhereInput = {};

  if (options.ballId) {
    where.ballId = options.ballId;
  }

  if (options.retailerName) {
    where.retailerName = options.retailerName;
  }

  if (options.matchStatus) {
    where.matchStatus = options.matchStatus;
  }

  if (options.stockStatus) {
    where.stockStatus = options.stockStatus;
  }

  if (options.verifiedOnly === true) {
    where.retailerType = "verified_retailer";
  }

  if (options.search) {
    where.listingTitle = {
      contains: options.search,
    };
  }

  const matchingBallIds = await getMatchingBallIds(options);

  if (matchingBallIds && matchingBallIds.length === 0) {
    return {
      count: 0,
      filters: {
        limit,
        ballId: options.ballId ?? null,
        brand: options.brand ?? null,
        manufacturer: options.manufacturer ?? null,
        retailerName: options.retailerName ?? null,
        matchStatus: options.matchStatus ?? null,
        stockStatus: options.stockStatus ?? null,
        verifiedOnly: options.verifiedOnly ?? null,
        search: options.search ?? null,
      },
      data: [],
      generatedAt: new Date().toISOString(),
    };
  }

  if (matchingBallIds) {
    where.ballId = {
      in: matchingBallIds,
    };
  }

  const listings = await prisma.retailerListing.findMany({
    where,
    orderBy: [
      {
        updatedAt: "desc",
      },
      {
        currentPrice: "asc",
      },
    ],
    take: limit,
    include: {
      priceHistory: {
        orderBy: {
          checkedAt: "desc",
        },
        take: 5,
      },
    },
  });

  const data = await attachBallsToListings(listings);

  return {
    count: data.length,
    filters: {
      limit,
      ballId: options.ballId ?? null,
      brand: options.brand ?? null,
      manufacturer: options.manufacturer ?? null,
      retailerName: options.retailerName ?? null,
      matchStatus: options.matchStatus ?? null,
      stockStatus: options.stockStatus ?? null,
      verifiedOnly: options.verifiedOnly ?? null,
      search: options.search ?? null,
    },
    data,
    generatedAt: new Date().toISOString(),
  };
}

export async function getRetailerListingAdminDetail(listingId: string) {
  const listing = await prisma.retailerListing.findUnique({
    where: {
      id: listingId,
    },
    include: {
      priceHistory: {
        orderBy: {
          checkedAt: "desc",
        },
        take: 50,
      },
    },
  });

  if (!listing) {
    return null;
  }

  const [data] = await attachBallsToListings([listing]);

  return {
    data,
    generatedAt: new Date().toISOString(),
  };
}