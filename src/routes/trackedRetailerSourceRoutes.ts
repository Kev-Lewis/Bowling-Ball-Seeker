import { Router } from "express";
import {
  getTrackedRetailerSources,
  runTrackedRetailerSource,
  seedDefaultTrackedRetailerSources,
  setTrackedRetailerSourceEnabled,
  upsertTrackedRetailerSource,
} from "../services/trackedRetailerSourceService";

export const trackedRetailerSourceRoutes = Router();

function getBooleanQuery(value: unknown, fallback: boolean | undefined) {
  const parsed = value?.toString().trim().toLowerCase();

  if (parsed === "true" || parsed === "1" || parsed === "yes") return true;
  if (parsed === "false" || parsed === "0" || parsed === "no") return false;

  return fallback;
}

function getNumberQuery(value: unknown, fallback: number | null = null) {
  if (value === undefined || value === null || value === "") return fallback;

  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) return fallback;

  return Math.floor(parsed);
}

function getStringQuery(value: unknown, fallback = "") {
  return value?.toString().trim() || fallback;
}

trackedRetailerSourceRoutes.get("/", async (req, res) => {
  try {
    const enabled = getBooleanQuery(req.query.enabled, undefined);

    const data = await getTrackedRetailerSources({
      enabled,
      retailerName: getStringQuery(req.query.retailerName),
      sourceKind: getStringQuery(req.query.sourceKind),
    });

    res.json({ data });
  } catch (error) {
    res.status(500).json({
      error: "Failed to load tracked retailer sources.",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

trackedRetailerSourceRoutes.get("/seed-defaults", async (_req, res) => {
  try {
    const data = await seedDefaultTrackedRetailerSources();
    res.json({ data });
  } catch (error) {
    res.status(500).json({
      error: "Failed to seed default tracked retailer sources.",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

trackedRetailerSourceRoutes.get("/upsert", async (req, res) => {
  try {
    const sourceKind = getStringQuery(req.query.sourceKind, "category");

    if (sourceKind !== "category" && sourceKind !== "product") {
      res.status(400).json({
        error: "Invalid sourceKind. Use category or product.",
      });
      return;
    }

    const data = await upsertTrackedRetailerSource({
      name: getStringQuery(req.query.name),
      retailerName: getStringQuery(req.query.retailerName, "bowling.com"),
      sourceKind,
      url: getStringQuery(req.query.url),
      enabled: getBooleanQuery(req.query.enabled, true),
      maxPages: getNumberQuery(req.query.maxPages, 1),
      maxProducts: getNumberQuery(req.query.maxProducts, 5),
      scrapeDelayMs: getNumberQuery(req.query.scrapeDelayMs, 750),
      allowLikelyMatch: getBooleanQuery(req.query.allowLikelyMatch, true),
    });

    res.json({ data });
  } catch (error) {
    res.status(500).json({
      error: "Failed to upsert tracked retailer source.",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

trackedRetailerSourceRoutes.get("/set-enabled", async (req, res) => {
  try {
    const id = getStringQuery(req.query.id);
    const enabled = getBooleanQuery(req.query.enabled, true);

    if (!id) {
      res.status(400).json({ error: "id is required." });
      return;
    }

    const data = await setTrackedRetailerSourceEnabled(id, enabled ?? true);
    res.json({ data });
  } catch (error) {
    res.status(500).json({
      error: "Failed to update tracked retailer source.",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

trackedRetailerSourceRoutes.get("/run", async (req, res) => {
  try {
    const id = getStringQuery(req.query.id);

    if (!id) {
      res.status(400).json({ error: "id is required." });
      return;
    }

    const data = await runTrackedRetailerSource(id);
    res.json({ data });
  } catch (error) {
    res.status(500).json({
      error: "Failed to run tracked retailer source.",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});
