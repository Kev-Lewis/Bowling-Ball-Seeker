import { Router } from "express";
import {
  getAllLineupEvents,
  getLineupEventsByType,
  getLineupEventsForBall,
} from "../services/lineupEventService";

export const eventRoutes = Router();

eventRoutes.get("/lineup", async (req, res) => {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 50;
    const eventType = req.query.type?.toString();

    const events = eventType
      ? await getLineupEventsByType(eventType, limit)
      : await getAllLineupEvents(limit);

    return res.json({
      count: events.length,
      data: events,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "Failed to fetch lineup events",
    });
  }
});

eventRoutes.get("/lineup/balls/:ballId", async (req, res) => {
  try {
    const events = await getLineupEventsForBall(req.params.ballId);

    return res.json({
      count: events.length,
      data: events,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "Failed to fetch ball lineup events",
    });
  }
});