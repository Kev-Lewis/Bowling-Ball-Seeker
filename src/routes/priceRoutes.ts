import { Router } from "express";
import { getBallById, getListingsForBall } from "../services/ballService";

export const priceRoutes = Router();

priceRoutes.get("/:ballId", (req, res) => {
  const ball = getBallById(req.params.ballId);

  if (!ball) {
    return res.status(404).json({
      error: "Ball not found",
    });
  }

  const listings = getListingsForBall(ball.id);

  const prices = listings.map((listing) => ({
    retailerName: listing.retailerName,
    retailerType: listing.retailerType,
    listingTitle: listing.listingTitle,
    condition: listing.condition,
    matchConfidence: listing.matchConfidence,
    matchStatus: listing.matchStatus,
    currentPrice: listing.currentPrice,
    stockStatus: listing.stockStatus,
    lastCheckedAt: listing.lastCheckedAt,
    listingUrl: listing.listingUrl,
  }));

  return res.json({
    ball: {
      id: ball.id,
      canonicalName: ball.canonicalName,
      brand: ball.brand,
    },
    count: prices.length,
    data: prices,
  });
});