const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.retailerReviewItem.findMany({
    where: {
      reviewStatus: "pending",
    },
    orderBy: [{ reviewReason: "asc" }, { listingTitle: "asc" }],
  });

  console.log({ pending: rows.length });

  console.table(
    rows.map((row) => ({
      title: row.listingTitle,
      reason: row.reviewReason,
      price: row.currentPrice,
      stock: row.stockStatus,
      candidate: row.selectedBallName ?? "—",
      confidence: row.selectedConfidence ?? "—",
    }))
  );
}

main().catch(console.error).finally(() => prisma.$disconnect());
