import { Router } from "express";
import { mockMotivCatalogs } from "../data/mockManufacturerCatalogs";
import { syncManufacturerCatalog } from "../services/catalogSyncService";
import {
  completeScrapeRun,
  failScrapeRun,
  startScrapeRun,
} from "../services/scrapeRunService";

export const catalogSyncRoutes = Router();

catalogSyncRoutes.post("/manufacturer", async (req, res) => {
  const sourceName = req.body.sourceName?.toString();
  const balls = req.body.balls;

  if (!sourceName || !Array.isArray(balls)) {
    return res.status(400).json({
      error: "Request body must include sourceName and balls array",
    });
  }

  const scrapeRun = await startScrapeRun({
    sourceName,
    sourceType: "manufacturer_catalog",
    metadata: {
      mode: "manual_api",
    },
  });

  try {
    const result = await syncManufacturerCatalog(sourceName, balls);

    await completeScrapeRun(scrapeRun.id, {
      itemsFound: result.receivedCount,
      itemsCreated: result.created.length,
      itemsUpdated: result.updated.length + result.relisted.length,
      itemsRemoved: result.removed.length,
      metadata: {
        mode: "manual_api",
        result,
      },
    });

    return res.json({
      scrapeRunId: scrapeRun.id,
      data: result,
    });
  } catch (error) {
    console.error(error);

    const message =
      error instanceof Error ? error.message : "Unknown catalog sync error";

    await failScrapeRun(scrapeRun.id, message, {
      mode: "manual_api",
    });

    return res.status(500).json({
      error: "Failed to sync manufacturer catalog",
      scrapeRunId: scrapeRun.id,
    });
  }
});

catalogSyncRoutes.post("/mock/motiv", async (req, res) => {
  const scenario = req.query.scenario?.toString() ?? "baseline";
  const catalog = mockMotivCatalogs[scenario];

  if (!catalog) {
    return res.status(400).json({
      error: `Unknown mock scenario: ${scenario}`,
      availableScenarios: Object.keys(mockMotivCatalogs),
    });
  }

  const scrapeRun = await startScrapeRun({
    sourceName: "Motiv",
    sourceType: "manufacturer_catalog",
    metadata: {
      mode: "mock",
      scenario,
    },
  });

  try {
    const result = await syncManufacturerCatalog("Motiv", catalog);

    await completeScrapeRun(scrapeRun.id, {
      itemsFound: result.receivedCount,
      itemsCreated: result.created.length,
      itemsUpdated: result.updated.length + result.relisted.length,
      itemsRemoved: result.removed.length,
      metadata: {
        mode: "mock",
        scenario,
        result,
      },
    });

    return res.json({
      scenario,
      scrapeRunId: scrapeRun.id,
      data: result,
    });
  } catch (error) {
    console.error(error);

    const message =
      error instanceof Error ? error.message : "Unknown catalog sync error";

    await failScrapeRun(scrapeRun.id, message, {
      mode: "mock",
      scenario,
    });

    return res.status(500).json({
      error: "Failed to run mock catalog sync",
      scrapeRunId: scrapeRun.id,
    });
  }
});