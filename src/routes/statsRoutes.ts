import { Router } from "express";
import { getPriceStatsForBall } from "../services/priceStatsService";

export const statsRoutes = Router();

statsRoutes.get("/balls/:ballId/prices", async (req, res) => {
  try {
    const stats = await getPriceStatsForBall(req.params.ballId);

    if (!stats) {
      return res.status(404).json({
        error: "Ball not found",
      });
    }

    return res.json({
      data: stats,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "Failed to fetch price stats",
    });
  }
});