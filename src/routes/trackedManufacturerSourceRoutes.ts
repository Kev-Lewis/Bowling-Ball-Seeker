import { Router } from "express";
import { prisma } from "../db/prisma";
import { runTrackedManufacturerSourceSync } from "../jobs/manufacturerSyncJob";
import {
  getTrackedManufacturerSources,
  setTrackedManufacturerSourceEnabled,
  upsertTrackedManufacturerSource,
} from "../services/trackedManufacturerSourceService";

export const trackedManufacturerSourceRoutes = Router();

function getStringQuery(value: unknown) {
  const parsed = value?.toString().trim();
  return parsed || undefined;
}

function getRequiredStringQuery(value: unknown, fieldName: string) {
  const parsed = getStringQuery(value);

  if (!parsed) {
    throw new Error(`${fieldName} is required.`);
  }

  return parsed;
}

function getBooleanQuery(value: unknown, fallback: boolean) {
  const parsed = value?.toString().trim().toLowerCase();

  if (parsed === "true" || parsed === "1" || parsed === "yes") return true;
  if (parsed === "false" || parsed === "0" || parsed === "no") return false;

  return fallback;
}

function getOptionalBooleanQuery(value: unknown) {
  const parsed = value?.toString().trim().toLowerCase();

  if (parsed === "true" || parsed === "1" || parsed === "yes") return true;
  if (parsed === "false" || parsed === "0" || parsed === "no") return false;

  return undefined;
}

function getNumberQuery(value: unknown) {
  if (value === undefined || value === null || value === "") return null;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

trackedManufacturerSourceRoutes.get("/", async (req, res) => {
  try {
    const data = await getTrackedManufacturerSources({
      manufacturerName: getStringQuery(req.query.manufacturerName),
      brandName: getStringQuery(req.query.brandName),
      sourceKind: getStringQuery(req.query.sourceKind),
      parserKey: getStringQuery(req.query.parserKey),
      enabled: getOptionalBooleanQuery(req.query.enabled),
    });

    res.json({ data });
  } catch (error) {
    res.status(500).json({
      error: "Failed to load tracked manufacturer sources.",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

trackedManufacturerSourceRoutes.get("/upsert", async (req, res) => {
  try {
    const data = await upsertTrackedManufacturerSource({
      name: getRequiredStringQuery(req.query.name, "name"),
      manufacturerName: getRequiredStringQuery(
        req.query.manufacturerName,
        "manufacturerName"
      ),
      brandName: getStringQuery(req.query.brandName),
      sourceKind: getRequiredStringQuery(req.query.sourceKind, "sourceKind"),
      parserKey: getRequiredStringQuery(req.query.parserKey, "parserKey"),
      url: getRequiredStringQuery(req.query.url, "url"),
      enabled: getBooleanQuery(req.query.enabled, true),
      maxPages: getNumberQuery(req.query.maxPages),
      maxProducts: getNumberQuery(req.query.maxProducts),
      scrapeDelayMs: getNumberQuery(req.query.scrapeDelayMs),
    });

    res.json({ data });
  } catch (error) {
    res.status(500).json({
      error: "Failed to upsert tracked manufacturer source.",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

trackedManufacturerSourceRoutes.get("/set-enabled", async (req, res) => {
  try {
    const id = getRequiredStringQuery(req.query.id, "id");
    const enabled = getBooleanQuery(req.query.enabled, true);

    const data = await setTrackedManufacturerSourceEnabled(id, enabled);

    res.json({ data });
  } catch (error) {
    res.status(500).json({
      error: "Failed to update tracked manufacturer source.",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});


trackedManufacturerSourceRoutes.get("/run", async (req, res) => {
  try {
    const id = getRequiredStringQuery(req.query.id, "id");

    const source = await prisma.trackedManufacturerSource.findUnique({
      where: { id },
    });

    if (!source) {
      res.status(404).json({
        error: "Tracked manufacturer source not found.",
      });
      return;
    }

    if (!source.enabled) {
      res.status(400).json({
        error: "Tracked manufacturer source is disabled.",
      });
      return;
    }

    const result = await runTrackedManufacturerSourceSync(source);

    res.json({
      data: {
        source,
        result,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to run tracked manufacturer source.",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

trackedManufacturerSourceRoutes.get("/run-all", async (_req, res) => {
  try {
    const sources = await prisma.trackedManufacturerSource.findMany({
      where: {
        enabled: true,
      },
      orderBy: [
        {
          manufacturerName: "asc",
        },
        {
          brandName: "asc",
        },
        {
          name: "asc",
        },
      ],
    });

    const results = [];

    for (const source of sources) {
      const result = await runTrackedManufacturerSourceSync(source);

      results.push({
        source,
        result,
      });
    }

    const successfulCount = results.filter((item) => {
      return item.result.status === "success";
    }).length;

    const failedCount = results.filter((item) => {
      return item.result.status === "failed";
    }).length;

    res.json({
      data: {
        sourceCount: sources.length,
        successfulCount,
        failedCount,
        results,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to run enabled tracked manufacturer sources.",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

trackedManufacturerSourceRoutes.get("/delete", async (req, res) => {
  try {
    const id = getRequiredStringQuery(req.query.id, "id");

    const source = await prisma.trackedManufacturerSource.findUnique({
      where: { id },
    });

    if (!source) {
      res.status(404).json({
        error: "Tracked manufacturer source not found.",
      });
      return;
    }

    if (source.enabled) {
      res.status(400).json({
        error: "Disable the manufacturer source before deleting it.",
      });
      return;
    }

    const deleted = await prisma.trackedManufacturerSource.delete({
      where: { id },
    });

    res.json({
      data: {
        deleted,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to delete tracked manufacturer source.",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});
