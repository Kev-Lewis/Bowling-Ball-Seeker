import { Router } from "express";
import { mockMotivCatalogs } from "../data/mockManufacturerCatalogs";
import { syncManufacturerCatalog } from "../services/catalogSyncService";

export const catalogSyncRoutes = Router();

catalogSyncRoutes.post("/manufacturer", async (req, res) => {
  try {
    const sourceName = req.body.sourceName?.toString();
    const balls = req.body.balls;

    if (!sourceName || !Array.isArray(balls)) {
      return res.status(400).json({
        error: "Request body must include sourceName and balls array",
      });
    }

    const result = await syncManufacturerCatalog(sourceName, balls);

    return res.json({
      data: result,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "Failed to sync manufacturer catalog",
    });
  }
});

catalogSyncRoutes.post("/mock/motiv", async (req, res) => {
  try {
    const scenario = req.query.scenario?.toString() ?? "baseline";
    const catalog = mockMotivCatalogs[scenario];

    if (!catalog) {
      return res.status(400).json({
        error: `Unknown mock scenario: ${scenario}`,
        availableScenarios: Object.keys(mockMotivCatalogs),
      });
    }

    const result = await syncManufacturerCatalog("Motiv", catalog);

    return res.json({
      scenario,
      data: result,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "Failed to run mock catalog sync",
    });
  }
});