import { Router } from "express";
import { runDailyManufacturerSync } from "../jobs/manufacturerSyncJob";
import { getLocalSchedulerStatus } from "../scheduler/localScheduler";

export const jobRoutes = Router();

jobRoutes.get("/daily-manufacturer-sync/run", async (_req, res) => {
  try {
    const result = await runDailyManufacturerSync();

    return res.json({
      data: result,
    });
  } catch (error) {
    console.error(error);

    const message =
      error instanceof Error
        ? error.message
        : "Unknown daily manufacturer sync error";

    return res.status(500).json({
      error: "Failed to run daily manufacturer sync",
      details: message,
    });
  }
});

jobRoutes.get("/scheduler/status", (_req, res) => {
  return res.json({
    data: getLocalSchedulerStatus(),
  });
});