import { Router } from "express";
import { getCatalogSummary } from "../services/catalogSummaryService";

export const catalogRoutes = Router();

catalogRoutes.get("/summary", async (_req, res) => {
  try {
    const summary = await getCatalogSummary();

    return res.json({
      data: summary,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "Failed to fetch catalog summary",
    });
  }
});