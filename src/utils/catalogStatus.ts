const RECENT_CATALOG_WINDOW_DAYS = 14;

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function getDaysRemaining(expiresAt: Date, now: Date) {
  const msRemaining = expiresAt.getTime() - now.getTime();
  return Math.max(0, Math.ceil(msRemaining / (1000 * 60 * 60 * 24)));
}

export type CatalogDisplayStatus =
  | "new"
  | "current"
  | "discontinued"
  | "archived";

export interface CatalogStatusResult {
  catalogStatus: CatalogDisplayStatus;
  catalogStatusLabel: "New" | "Current" | "Discontinued" | "Archived";
  catalogStatusExpiresAt: string | null;
  catalogStatusDaysRemaining: number | null;
}

export function getCatalogStatus(ball: {
  isCurrent: boolean;
  firstSeenAt: Date | string;
  removedFromLineupAt?: Date | string | null;
}): CatalogStatusResult {
  const now = new Date();

  const firstSeenAt = new Date(ball.firstSeenAt);
  const newExpiresAt = addDays(firstSeenAt, RECENT_CATALOG_WINDOW_DAYS);

  if (ball.isCurrent && now <= newExpiresAt) {
    return {
      catalogStatus: "new",
      catalogStatusLabel: "New",
      catalogStatusExpiresAt: newExpiresAt.toISOString(),
      catalogStatusDaysRemaining: getDaysRemaining(newExpiresAt, now),
    };
  }

  if (!ball.isCurrent && ball.removedFromLineupAt) {
    const removedFromLineupAt = new Date(ball.removedFromLineupAt);
    const discontinuedExpiresAt = addDays(
      removedFromLineupAt,
      RECENT_CATALOG_WINDOW_DAYS
    );

    if (now <= discontinuedExpiresAt) {
      return {
        catalogStatus: "discontinued",
        catalogStatusLabel: "Discontinued",
        catalogStatusExpiresAt: discontinuedExpiresAt.toISOString(),
        catalogStatusDaysRemaining: getDaysRemaining(discontinuedExpiresAt, now),
      };
    }

    return {
      catalogStatus: "archived",
      catalogStatusLabel: "Archived",
      catalogStatusExpiresAt: null,
      catalogStatusDaysRemaining: null,
    };
  }

  return {
    catalogStatus: "current",
    catalogStatusLabel: "Current",
    catalogStatusExpiresAt: null,
    catalogStatusDaysRemaining: null,
  };
}