import { Router } from "express";
import {
  listRetailerReviewItems,
  setRetailerReviewItemStatus,
  searchCatalogBallsForReviewAssignment,
  assignRetailerReviewItemToExistingBall,
  createSeparateBallFromRetailerReviewItem,
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


retailerReviewItemRoutes.get("/catalog-ball-search", async (req, res, next) => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q : "";
    const limit = parseLimit(req.query.limit);

    const data = await searchCatalogBallsForReviewAssignment({
      q,
      limit,
    });

    res.json({ data });
  } catch (error) {
    next(error);
  }
});

retailerReviewItemRoutes.get("/assign-existing", async (req, res, next) => {
  try {
    const reviewItemId =
      typeof req.query.reviewItemId === "string"
        ? req.query.reviewItemId
        : "";

    const ballId =
      typeof req.query.ballId === "string" ? req.query.ballId : "";

    if (!reviewItemId || !ballId) {
      res.status(400).json({
        error: "reviewItemId and ballId are required.",
      });
      return;
    }

    const data = await assignRetailerReviewItemToExistingBall(
      reviewItemId,
      ballId
    );

    res.json({ data });
  } catch (error) {
    next(error);
  }
});


retailerReviewItemRoutes.get("/create-separate-ball", async (req, res, next) => {
  try {
    const reviewItemId =
      typeof req.query.reviewItemId === "string"
        ? req.query.reviewItemId
        : "";

    if (!reviewItemId) {
      res.status(400).json({
        error: "reviewItemId is required.",
      });
      return;
    }

    const data = await createSeparateBallFromRetailerReviewItem({
      reviewItemId,
      canonicalName:
        typeof req.query.canonicalName === "string"
          ? req.query.canonicalName
          : undefined,
      brand:
        typeof req.query.brand === "string" ? req.query.brand : undefined,
      manufacturer:
        typeof req.query.manufacturer === "string"
          ? req.query.manufacturer
          : undefined,
      coverstockName:
        typeof req.query.coverstockName === "string"
          ? req.query.coverstockName
          : undefined,
      coverstockType:
        typeof req.query.coverstockType === "string"
          ? req.query.coverstockType
          : undefined,
      coreName:
        typeof req.query.coreName === "string"
          ? req.query.coreName
          : undefined,
      coreType:
        typeof req.query.coreType === "string"
          ? req.query.coreType
          : undefined,
      factoryFinish:
        typeof req.query.factoryFinish === "string"
          ? req.query.factoryFinish
          : undefined,
      isCurrent: req.query.isCurrent === "true",
    });

    res.json({ data });
  } catch (error) {
    next(error);
  }
});
