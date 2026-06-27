import { Router } from "express";
import {
  getAllBalls,
  getBallById,
  getBestVerifiedPrice,
  getCurrentBalls,
  searchBalls,
} from "../services/ballService";

export const ballRoutes = Router();

ballRoutes.get("/", async (req, res) => {
  try {
    const search = req.query.search?.toString();
    const balls = search ? await searchBalls(search) : await getAllBalls();

    return res.json({
      count: balls.length,
      data: balls,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Failed to fetch balls",
    });
  }
});

ballRoutes.get("/current", async (_req, res) => {
  try {
    const balls = await getCurrentBalls();

    return res.json({
      count: balls.length,
      data: balls,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Failed to fetch current balls",
    });
  }
});

ballRoutes.get("/:id", async (req, res) => {
  try {
    const ball = await getBallById(req.params.id);

    if (!ball) {
      return res.status(404).json({
        error: "Ball not found",
      });
    }

    const bestVerifiedPrice = await getBestVerifiedPrice(ball.id);

    return res.json({
      data: {
        ...ball,
        bestVerifiedPrice,
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Failed to fetch ball",
    });
  }
});