import { Router } from "express";
import { upsertCatalogBallFromAdmin } from "../services/catalogBallAdminService";

export const catalogBallAdminRoutes = Router();

function getStringQuery(value: unknown, fallback = "") {
  return value?.toString().trim() || fallback;
}

function getBooleanQuery(value: unknown, fallback: boolean) {
  const parsed = value?.toString().trim().toLowerCase();

  if (parsed === "true" || parsed === "1" || parsed === "yes") return true;
  if (parsed === "false" || parsed === "0" || parsed === "no") return false;

  return fallback;
}

function getNumberQuery(value: unknown) {
  if (value === undefined || value === null || value === "") return null;

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) return null;

  return parsed;
}

function getWeightsQuery(value: unknown) {
  const raw = value?.toString().trim();

  if (!raw) return [];

  return raw
    .split(",")
    .map((part) => Number(part.trim()))
    .filter((weight) => Number.isFinite(weight) && weight > 0);
}

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
