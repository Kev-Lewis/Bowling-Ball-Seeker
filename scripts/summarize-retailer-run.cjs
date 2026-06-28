const fs = require("fs");

const file = process.argv[2] || "tracked-retailer-run-all.json";

if (!fs.existsSync(file)) {
  console.error(`Missing file: ${file}`);
  process.exit(1);
}

const r = JSON.parse(fs.readFileSync(file, "utf8"));
const results = r.data?.results ?? [];

for (const sourceResult of results) {
  const x = sourceResult.result ?? {};
  const reviews = x.skippedListingReviews ?? [];

  console.log("\nSOURCE");
  console.log(sourceResult.source?.name ?? x.sourceName ?? "unknown");

  console.log("\nSUMMARY");
  console.table([
    {
      discovered: x.discoveredProductCount,
      scraped: x.scrapedCount,
      saved: x.savedCount,
      noMatch: x.skippedNoMatchCount,
      needsReview: x.skippedNeedsReviewCount,
      legacyReview: x.skippedLegacyReviewCount,
      created: x.createdListingCount,
      updated: x.updatedListingCount,
      snapshotsCreated: x.snapshotCreatedCount,
      snapshotsSkipped: x.snapshotSkippedCount,
    },
  ]);

  const reasonCounts = reviews.reduce((acc, row) => {
    const key = row.legacyReviewReason ?? row.status ?? "unknown";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  console.log("\nREASON COUNTS");
  console.table(
    Object.entries(reasonCounts).map(([reason, count]) => ({
      reason,
      count,
    }))
  );

  console.log("\nLEGACY / REVIEW ROWS");
  console.table(
    reviews.map((row) => ({
      status: row.status,
      reason: row.legacyReviewReason ?? "—",
      title: row.listing?.listingTitle,
      price: row.listing?.currentPrice,
      stock: row.listing?.stockStatus,
      selected: row.selectedMatch
        ? `${row.selectedMatch.brand} ${row.selectedMatch.canonicalName}`
        : "—",
      catalogState: row.selectedMatch?.catalogState ?? "—",
      confidence: row.selectedMatch?.confidence ?? "—",
    }))
  );
}
