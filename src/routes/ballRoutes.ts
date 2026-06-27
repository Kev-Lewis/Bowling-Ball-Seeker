import { Router } from "express";
import {
  getAllBalls,
  getBallById,
  getBestVerifiedPrice,
  getCurrentBalls,
  searchBalls,
} from "../services/ballService";

export const ballRoutes = Router();

ballRoutes.get("/", (req, res) => {
  const search = req.query.search?.toString();

  const balls = search ? searchBalls(search) : getAllBalls();

  res.json({
    count: balls.length,
    data: balls,
  });
});

ballRoutes.get("/current", (_req, res) => {
  const balls = getCurrentBalls();

  res.json({
    count: balls.length,
    data: balls,
  });
});

ballRoutes.get("/:id", (req, res) => {
  const ball = getBallById(req.params.id);

  if (!ball) {
    return res.status(404).json({
      error: "Ball not found",
    });
  }

  const bestVerifiedPrice = getBestVerifiedPrice(ball.id);

  return res.json({
    data: {
      ...ball,
      bestVerifiedPrice,
    },
  });
});