import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.lineupEvent.deleteMany();
  await prisma.priceSnapshot.deleteMany();
  await prisma.retailerListing.deleteMany();
  await prisma.ball.deleteMany();

  await prisma.ball.createMany({
    data: [
      {
        id: "motiv-venom-shock",
        canonicalName: "Venom Shock",
        brand: "Motiv",
        manufacturer: "Motiv",
        coverstockName: "Turmoil MFS",
        coverstockType: "solid",
        coreName: "Gear APG",
        coreType: "symmetric",
        factoryFinish: "4000 Grit LSS",
        rg: 2.48,
        differential: 0.034,
        mbDifferential: 0,
        availableWeightsJson: JSON.stringify([12, 13, 14, 15, 16]),
        officialUrl:
          "https://www.motivbowling.com/products/balls/light-medium-oil/venom-shock.html",
        imageUrl: "",
        isCurrent: true,
        firstSeenAt: new Date("2026-06-01T00:00:00.000Z"),
        lastSeenAt: new Date("2026-06-26T00:00:00.000Z"),
        removedFromLineupAt: null,
      },
      {
        id: "storm-ion-max",
        canonicalName: "Ion Max",
        brand: "Storm",
        manufacturer: "Storm",
        coverstockName: "TX-16",
        coverstockType: "solid",
        coreName: "Element Max A.I.",
        coreType: "asymmetric",
        factoryFinish: "2000 Grit Abralon",
        rg: 2.47,
        differential: 0.055,
        mbDifferential: 0.014,
        availableWeightsJson: JSON.stringify([12, 13, 14, 15, 16]),
        officialUrl: "",
        imageUrl: "",
        isCurrent: true,
        firstSeenAt: new Date("2026-06-01T00:00:00.000Z"),
        lastSeenAt: new Date("2026-06-26T00:00:00.000Z"),
        removedFromLineupAt: null,
      },
      {
        id: "roto-grip-exit",
        canonicalName: "Exit",
        brand: "Roto Grip",
        manufacturer: "Storm Products",
        coverstockName: "",
        coverstockType: "pearl",
        coreName: "",
        coreType: "asymmetric",
        factoryFinish: "",
        availableWeightsJson: JSON.stringify([12, 13, 14, 15, 16]),
        officialUrl: "",
        imageUrl: "",
        isCurrent: true,
        firstSeenAt: new Date("2026-06-01T00:00:00.000Z"),
        lastSeenAt: new Date("2026-06-26T00:00:00.000Z"),
        removedFromLineupAt: null,
      },
    ],
  });

  await prisma.lineupEvent.createMany({
    data: [
      {
        id: "event-venom-shock-initial-detection",
        ballId: "motiv-venom-shock",
        eventType: "new_ball_detected",
        sourceName: "Motiv",
        sourceUrl:
          "https://www.motivbowling.com/products/balls/light-medium-oil/venom-shock.html",
        detectedAt: new Date("2026-06-26T00:00:00.000Z"),
        notes: "Seed event representing initial catalog detection.",
      },
      {
        id: "event-ion-max-initial-detection",
        ballId: "storm-ion-max",
        eventType: "new_ball_detected",
        sourceName: "Storm",
        sourceUrl: "",
        detectedAt: new Date("2026-06-26T00:00:00.000Z"),
        notes: "Seed event representing initial catalog detection.",
      },
      {
        id: "event-exit-initial-detection",
        ballId: "roto-grip-exit",
        eventType: "new_ball_detected",
        sourceName: "Roto Grip",
        sourceUrl: "",
        detectedAt: new Date("2026-06-26T00:00:00.000Z"),
        notes: "Seed event representing initial catalog detection.",
      },
    ],
  });

  await prisma.retailerListing.createMany({
    data: [
      {
        id: "listing-venom-shock-bowling-com",
        ballId: "motiv-venom-shock",
        retailerName: "bowling.com",
        retailerType: "verified_retailer",
        listingTitle: "Motiv Venom Shock Bowling Ball",
        listingUrl: "https://www.bowling.com/",
        condition: "new",
        matchConfidence: 98,
        matchStatus: "auto_matched",
        currentPrice: 149.95,
        stockStatus: "in_stock",
        lastCheckedAt: new Date("2026-06-26T00:00:00.000Z"),
      },
      {
        id: "listing-venom-shock-ebay",
        ballId: "motiv-venom-shock",
        retailerName: "eBay",
        retailerType: "marketplace",
        listingTitle: "Motiv Venom Shock 15lb New Bowling Ball",
        listingUrl: "https://www.ebay.com/",
        condition: "new",
        matchConfidence: 86,
        matchStatus: "likely_match",
        currentPrice: 139.99,
        stockStatus: "in_stock",
        lastCheckedAt: new Date("2026-06-26T00:00:00.000Z"),
      },
      {
        id: "listing-ion-max-bowling-com",
        ballId: "storm-ion-max",
        retailerName: "bowling.com",
        retailerType: "verified_retailer",
        listingTitle: "Storm Ion Max Bowling Ball",
        listingUrl: "https://www.bowling.com/",
        condition: "new",
        matchConfidence: 97,
        matchStatus: "auto_matched",
        currentPrice: 199.95,
        stockStatus: "in_stock",
        lastCheckedAt: new Date("2026-06-26T00:00:00.000Z"),
      },
    ],
  });

  await prisma.priceSnapshot.createMany({
    data: [
      {
        id: "snapshot-venom-shock-bowling-com-2026-06-26",
        retailerListingId: "listing-venom-shock-bowling-com",
        price: 149.95,
        stockStatus: "in_stock",
        checkedAt: new Date("2026-06-26T00:00:00.000Z"),
      },
      {
        id: "snapshot-venom-shock-ebay-2026-06-26",
        retailerListingId: "listing-venom-shock-ebay",
        price: 139.99,
        stockStatus: "in_stock",
        checkedAt: new Date("2026-06-26T00:00:00.000Z"),
      },
      {
        id: "snapshot-ion-max-bowling-com-2026-06-26",
        retailerListingId: "listing-ion-max-bowling-com",
        price: 199.95,
        stockStatus: "in_stock",
        checkedAt: new Date("2026-06-26T00:00:00.000Z"),
      },
    ],
  });
}

main()
  .then(async () => {
    console.log("Database seeded.");
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });