import { seedBalls } from "../data/seedBalls";
import { seedRetailerListings } from "../data/seedRetailerListings";

export function getAllBalls() {
  return seedBalls;
}

export function getCurrentBalls() {
  return seedBalls.filter((ball) => ball.isCurrent);
}

export function getBallById(id: string) {
  return seedBalls.find((ball) => ball.id === id);
}

export function searchBalls(query: string) {
  const normalizedQuery = query.toLowerCase().trim();

  return seedBalls.filter((ball) => {
    return (
      ball.canonicalName.toLowerCase().includes(normalizedQuery) ||
      ball.brand.toLowerCase().includes(normalizedQuery) ||
      ball.manufacturer.toLowerCase().includes(normalizedQuery)
    );
  });
}

export function getListingsForBall(ballId: string) {
  return seedRetailerListings.filter((listing) => listing.ballId === ballId);
}

export function getBestVerifiedPrice(ballId: string) {
  const listings = seedRetailerListings.filter((listing) => {
    return (
      listing.ballId === ballId &&
      listing.condition === "new" &&
      listing.stockStatus === "in_stock" &&
      listing.retailerType === "verified_retailer" &&
      listing.matchConfidence >= 95
    );
  });

  if (listings.length === 0) {
    return null;
  }

  return listings.reduce((lowest, current) => {
    return current.currentPrice < lowest.currentPrice ? current : lowest;
  });
}