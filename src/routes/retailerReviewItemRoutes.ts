import { Router } from "express";
import {
  listRetailerReviewItems,
  setRetailerReviewItemStatus,
} from "../services/retailerReviewItemService";

export const retailerReviewItemRoutes = Router();

function parseLimit(value: unknown) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return 100;
  }

  return Math.min(Math.max(Math.trunc(parsed), 1), 500);
}

retailerReviewItemRoutes.get("/", async (req, res, next) => {
  try {
    const data = await listRetailerReviewItems({
      reviewStatus:
        typeof req.query.reviewStatus === "string"
          ? req.query.reviewStatus
          : "pending",
      reviewReason:
        typeof req.query.reviewReason === "string"
          ? req.query.reviewReason
          : "any",
      q: typeof req.query.q === "string" ? req.query.q : "",
      limit: parseLimit(req.query.limit),
    });

    res.json({ data });
  } catch (error) {
    next(error);
  }
});

retailerReviewItemRoutes.get("/set-status", async (req, res, next) => {
  try {
    const id = typeof req.query.id === "string" ? req.query.id : "";
    const reviewStatus =
      typeof req.query.reviewStatus === "string"
        ? req.query.reviewStatus
        : "";

    if (!id || !reviewStatus) {
      res.status(400).json({
        error: "id and reviewStatus are required.",
      });
      return;
    }

    const data = await setRetailerReviewItemStatus(id, reviewStatus);

    res.json({ data });
  } catch (error) {
    next(error);
  }
});
