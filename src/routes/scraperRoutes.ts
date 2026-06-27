import { Router } from "express";
import {
  discoverMotivBallProducts,
  inspectMotivBallPage,
  parseMotivBallPage,
  scrapeMotivManufacturerCatalog,
} from "../scrapers/manufacturers/motivScraper";
import {
  completeScrapeRun,
  failScrapeRun,
  startScrapeRun,
} from "../services/scrapeRunService";
import { syncManufacturerCatalog } from "../services/catalogSyncService";


export const scraperRoutes = Router();

scraperRoutes.get("/manufacturers/motiv/discover", async (_req, res) => {
  const scrapeRun = await startScrapeRun({
    sourceName: "Motiv",
    sourceType: "manufacturer_product_discovery",
    metadata: {
      mode: "live",
      purpose: "discover_product_links",
    },
  });

  try {
    const result = await discoverMotivBallProducts();

    await completeScrapeRun(scrapeRun.id, {
      itemsFound: result.count,
      metadata: {
        mode: "live",
        purpose: "discover_product_links",
        sourceUrl: result.sourceUrl,
      },
    });

    return res.json({
      scrapeRunId: scrapeRun.id,
      data: result,
    });
  } catch (error) {
    console.error(error);

    const message =
      error instanceof Error ? error.message : "Unknown scraper error";

    await failScrapeRun(scrapeRun.id, message, {
      mode: "live",
      purpose: "discover_product_links",
    });

    return res.status(500).json({
      error: "Failed to discover MOTIV product links",
      scrapeRunId: scrapeRun.id,
      details: message,
    });
  }
});

scraperRoutes.get("/manufacturers/motiv/inspect", async (req, res) => {
  const url = req.query.url?.toString();

  if (!url) {
    return res.status(400).json({
      error: "Missing required query parameter: url",
    });
  }

  const scrapeRun = await startScrapeRun({
    sourceName: "Motiv",
    sourceType: "manufacturer_product_inspection",
    metadata: {
      mode: "live",
      url,
    },
  });

  try {
    const result = await inspectMotivBallPage(url);

    await completeScrapeRun(scrapeRun.id, {
      itemsFound: result.textBlocks.length,
      metadata: {
        mode: "live",
        url,
        headingCount: result.headings.length,
        tableRowCount: result.tableRows.length,
        imageCandidateCount: result.imageCandidates.length,
      },
    });

    return res.json({
      scrapeRunId: scrapeRun.id,
      data: result,
    });
  } catch (error) {
    console.error(error);

    const message =
      error instanceof Error ? error.message : "Unknown inspection error";

    await failScrapeRun(scrapeRun.id, message, {
      mode: "live",
      url,
    });

    return res.status(500).json({
      error: "Failed to inspect MOTIV ball page",
      scrapeRunId: scrapeRun.id,
      details: message,
    });
  }
});

scraperRoutes.get("/manufacturers/motiv/parse", async (req, res) => {
  const url = req.query.url?.toString();

  if (!url) {
    return res.status(400).json({
      error: "Missing required query parameter: url",
    });
  }

  const scrapeRun = await startScrapeRun({
    sourceName: "Motiv",
    sourceType: "manufacturer_product_detail",
    metadata: {
      mode: "live",
      url,
    },
  });

  try {
    const result = await parseMotivBallPage(url);

    await completeScrapeRun(scrapeRun.id, {
      itemsFound: 1,
      metadata: {
        mode: "live",
        url,
        canonicalName: result.canonicalName,
      },
    });

    return res.json({
      scrapeRunId: scrapeRun.id,
      data: result,
    });
  } catch (error) {
    console.error(error);

    const message =
      error instanceof Error ? error.message : "Unknown parse error";

    await failScrapeRun(scrapeRun.id, message, {
      mode: "live",
      url,
    });

    return res.status(500).json({
      error: "Failed to parse MOTIV ball page",
      scrapeRunId: scrapeRun.id,
      details: message,
    });
  }
});

scraperRoutes.post("/manufacturers/motiv/sync", async (_req, res) => {
  const scrapeRun = await startScrapeRun({
    sourceName: "Motiv",
    sourceType: "manufacturer_catalog_live_sync",
    metadata: {
      mode: "live",
      purpose: "discover_parse_and_sync_current_catalog",
    },
  });

  try {
    const catalogResult = await scrapeMotivManufacturerCatalog();

    if (catalogResult.parseFailures.length > 0) {
      await failScrapeRun(scrapeRun.id, "One or more MOTIV ball pages failed to parse.", {
        mode: "live",
        sourceUrl: catalogResult.sourceUrl,
        discoveredCount: catalogResult.discoveredCount,
        parsedCount: catalogResult.parsedCount,
        failureCount: catalogResult.failureCount,
        parseFailures: catalogResult.parseFailures,
      });

      return res.status(502).json({
        error: "MOTIV catalog sync stopped because one or more pages failed to parse.",
        scrapeRunId: scrapeRun.id,
        data: {
          discoveredCount: catalogResult.discoveredCount,
          parsedCount: catalogResult.parsedCount,
          failureCount: catalogResult.failureCount,
          parseFailures: catalogResult.parseFailures,
        },
      });
    }

    const syncResult = await syncManufacturerCatalog(
      "Motiv",
      catalogResult.parsedBalls
    );

    await completeScrapeRun(scrapeRun.id, {
      itemsFound: catalogResult.discoveredCount,
      itemsCreated: syncResult.created.length,
      itemsUpdated: syncResult.updated.length + syncResult.relisted.length,
      itemsRemoved: syncResult.removed.length,
      metadata: {
        mode: "live",
        sourceUrl: catalogResult.sourceUrl,
        discoveredCount: catalogResult.discoveredCount,
        parsedCount: catalogResult.parsedCount,
        syncResult,
      },
    });

    return res.json({
      scrapeRunId: scrapeRun.id,
      data: {
        catalog: {
          sourceName: catalogResult.sourceName,
          sourceUrl: catalogResult.sourceUrl,
          discoveredCount: catalogResult.discoveredCount,
          parsedCount: catalogResult.parsedCount,
          failureCount: catalogResult.failureCount,
        },
        sync: syncResult,
      },
    });
  } catch (error) {
    console.error(error);

    const message =
      error instanceof Error ? error.message : "Unknown live MOTIV sync error";

    await failScrapeRun(scrapeRun.id, message, {
      mode: "live",
      purpose: "discover_parse_and_sync_current_catalog",
    });

    return res.status(500).json({
      error: "Failed to run live MOTIV catalog sync",
      scrapeRunId: scrapeRun.id,
      details: message,
    });
  }
});