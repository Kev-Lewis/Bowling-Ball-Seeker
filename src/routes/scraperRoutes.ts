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
import { runMotivManufacturerSync } from "../jobs/manufacturerSyncJob";


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
  try {
    const result = await runMotivManufacturerSync();

    if (result.status === "failed") {
      return res.status(502).json({
        error: "MOTIV catalog sync failed",
        scrapeRunId: result.scrapeRunId,
        data: result,
      });
    }

    return res.json({
      scrapeRunId: result.scrapeRunId,
      data: result,
    });
  } catch (error) {
    console.error(error);

    const message =
      error instanceof Error ? error.message : "Unknown live MOTIV sync error";

    return res.status(500).json({
      error: "Failed to run live MOTIV catalog sync",
      details: message,
    });
  }
});