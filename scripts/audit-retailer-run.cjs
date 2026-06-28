const fs = require("fs");

const file = process.argv[2] || "tracked-retailer-run-all.json";

if (!fs.existsSync(file)) {
  console.error(`Missing file: ${file}`);
  process.exit(1);
}

const json = JSON.parse(fs.readFileSync(file, "utf8"));
const runResults = json?.data?.results ?? [];
const rows = [];

for (const run of runResults) {
  const result = run.result ?? {};
  const sourceName = run.source?.name ?? result.sourceName ?? "unknown source";

  for (const item of result.results ?? []) {
    const listing = item.listing ?? {};
    const selected = item.selectedMatch ?? null;
    const topMatches = item.matches ?? [];

    rows.push({
      source: sourceName,
      status: item.status ?? "unknown",
      listingTitle: listing.listingTitle ?? "",
      listingUrl: listing.listingUrl ?? "",
      price: listing.currentPrice ?? null,
      stock: listing.stockStatus ?? "",
      selectedBall: selected
        ? `${selected.brand ?? ""} ${selected.canonicalName ?? ""}`.trim()
        : "",
      selectedBallId: selected?.ballId ?? "",
      selectedConfidence: selected?.confidence ?? null,
      selectedStatus: selected?.matchStatus ?? "",
      topCandidates: topMatches
        .slice(0, 5)
        .map((m) => `${m.confidence}:${m.brand} ${m.canonicalName}`)
        .join(" | "),
      reasons: topMatches
        .slice(0, 1)
        .flatMap((m) => m.reasons ?? [])
        .join(" / "),
    });
  }

  for (const item of result.skippedListingReviews ?? []) {
    const listing = item.listing ?? {};
    const candidates = item.matches ?? item.candidates ?? [];

    rows.push({
      source: sourceName,
      status: item.status ?? "skipped_review",
      listingTitle: listing.listingTitle ?? item.listingTitle ?? "",
      listingUrl: listing.listingUrl ?? item.listingUrl ?? "",
      price: listing.currentPrice ?? item.currentPrice ?? null,
      stock: listing.stockStatus ?? item.stockStatus ?? "",
      selectedBall: "",
      selectedBallId: "",
      selectedConfidence: null,
      selectedStatus: "",
      topCandidates: candidates
        .slice(0, 5)
        .map((m) => `${m.confidence}:${m.brand} ${m.canonicalName}`)
        .join(" | "),
      reasons: candidates
        .slice(0, 1)
        .flatMap((m) => m.reasons ?? [])
        .join(" / "),
    });
  }
}

const interesting = rows.filter((row) => {
  const status = String(row.status).toLowerCase();
  return (
    status.includes("review") ||
    status.includes("skip") ||
    status.includes("no_match") ||
    status.includes("no-match") ||
    row.selectedStatus === "manual_review" ||
    !row.selectedBallId
  );
});

console.log("\nSUMMARY");
console.table([
  {
    totalRows: rows.length,
    interestingRows: interesting.length,
  },
]);

console.log("\nINTERESTING LISTINGS");
console.table(
  interesting.map((row) => ({
    status: row.status,
    title: row.listingTitle,
    price: row.price,
    stock: row.stock,
    selected: row.selectedBall || "—",
    confidence: row.selectedConfidence ?? "—",
    candidates: row.topCandidates || "—",
  }))
);

fs.writeFileSync(
  "retailer-match-audit.json",
  JSON.stringify({ generatedAt: new Date().toISOString(), rows, interesting }, null, 2)
);

console.log("\nwrote retailer-match-audit.json");
