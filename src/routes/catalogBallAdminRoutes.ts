import { Router } from "express";
import {
  getCatalogBallAdminDetail,
  getCatalogBallsForAdmin,
  upsertCatalogBallFromAdmin,
} from "../services/catalogBallAdminService";

export const catalogBallAdminRoutes = Router();

function getStringQuery(value: unknown, fallback = "") {
  return value?.toString().trim() || fallback;
}

function getOptionalStringQuery(value: unknown) {
  const parsed = value?.toString().trim();
  return parsed || undefined;
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

function getLimitQuery(value: unknown, fallback = 50) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.min(parsed, 200);
}

function getWeightsQuery(value: unknown) {
  const raw = value?.toString().trim();

  if (!raw) return [];

  return raw
    .split(",")
    .map((part) => Number(part.trim()))
    .filter((weight) => Number.isFinite(weight) && weight > 0);
}

catalogBallAdminRoutes.get("/", async (req, res) => {
  try {
    const data = await getCatalogBallsForAdmin({
      limit: getLimitQuery(req.query.limit, 50),
      search: getOptionalStringQuery(req.query.search),
      brand: getOptionalStringQuery(req.query.brand),
      manufacturer: getOptionalStringQuery(req.query.manufacturer),
      isCurrent: getOptionalBooleanQuery(req.query.isCurrent),
    });

    res.json({ data });
  } catch (error) {
    res.status(500).json({
      error: "Failed to load catalog balls.",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

catalogBallAdminRoutes.get("/detail", async (req, res) => {
  try {
    const id = getStringQuery(req.query.id);

    if (!id) {
      return res.status(400).json({
        error: "Missing required query parameter: id",
      });
    }

    const data = await getCatalogBallAdminDetail(id);

    if (!data) {
      return res.status(404).json({
        error: "Catalog ball not found.",
      });
    }

    return res.json({ data });
  } catch (error) {
    return res.status(500).json({
      error: "Failed to load catalog ball detail.",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

catalogBallAdminRoutes.get("/upsert", async (req, res) => {
  try {
    const data = await upsertCatalogBallFromAdmin({
      id: getStringQuery(req.query.id),
      canonicalName: getStringQuery(req.query.canonicalName),
      brand: getStringQuery(req.query.brand),
      manufacturer: getStringQuery(req.query.manufacturer),
      coverstockName: getStringQuery(req.query.coverstockName),
      coverstockType: getStringQuery(req.query.coverstockType, "unknown"),
      coreName: getStringQuery(req.query.coreName),
      coreType: getStringQuery(req.query.coreType, "unknown"),
      factoryFinish: getStringQuery(req.query.factoryFinish),
      rg: getNumberQuery(req.query.rg),
      differential: getNumberQuery(req.query.differential),
      mbDifferential: getNumberQuery(req.query.mbDifferential),
      availableWeights: getWeightsQuery(req.query.availableWeights),
      officialUrl: getStringQuery(req.query.officialUrl),
      imageUrl: getStringQuery(req.query.imageUrl),
      isCurrent: getBooleanQuery(req.query.isCurrent, true),
    });

    res.json({ data });
  } catch (error) {
    res.status(500).json({
      error: "Failed to upsert catalog ball.",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});
