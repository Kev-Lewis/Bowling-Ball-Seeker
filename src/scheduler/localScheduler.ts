import { runDailySystemJob } from "../jobs/dailyJob";

interface SchedulerState {
  enabled: boolean;
  started: boolean;
  running: boolean;
  intervalHours: number;
  lastStartedAt: string | null;
  lastFinishedAt: string | null;
  lastStatus: "success" | "failed" | "skipped" | null;
  lastError: string | null;
  nextRunAt: string | null;
}

const DEFAULT_INTERVAL_HOURS = 24;

let schedulerInterval: NodeJS.Timeout | null = null;

const schedulerState: SchedulerState = {
  enabled: false,
  started: false,
  running: false,
  intervalHours: DEFAULT_INTERVAL_HOURS,
  lastStartedAt: null,
  lastFinishedAt: null,
  lastStatus: null,
  lastError: null,
  nextRunAt: null,
};

function parseBooleanEnv(value: string | undefined) {
  return value?.toLowerCase() === "true";
}

function parseIntervalHours(value: string | undefined) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_INTERVAL_HOURS;
  }

  return parsed;
}

function addHours(date: Date, hours: number) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

async function runScheduledDailyJob() {
  if (schedulerState.running) {
    schedulerState.lastStatus = "skipped";
    schedulerState.lastError = "Previous daily job is still running.";
    return;
  }

  schedulerState.running = true;
  schedulerState.lastStartedAt = new Date().toISOString();
  schedulerState.lastError = null;

  try {
    const result = await runDailySystemJob({
      runManufacturerSync: true,
  runRetailerScrape: true,
  runBowlingComProductScrape: true,
  runBowlingComCategoryScrape: true,
  runPriceAlerts: true,
  retailerScrapeOptions: {
    allowLikelyMatch: true,
    minConfidence: 35,
  },
      priceAlertOptions: {
        days: 7,
        limit: 20,
        minPriceDrop: 5,
        minPercentDrop: 0,
        includeStockChanges: true,
        inStockOnly: true,
        destinationType: "discord",
        destinationId: "local-scheduler",
      },
    });

    schedulerState.lastStatus =
      result.status === "success" ? "success" : "failed";

    schedulerState.lastFinishedAt = new Date().toISOString();
  } catch (error) {
    schedulerState.lastStatus = "failed";
    schedulerState.lastFinishedAt = new Date().toISOString();
    schedulerState.lastError =
      error instanceof Error ? error.message : "Unknown scheduler error";
  } finally {
    schedulerState.running = false;
    schedulerState.nextRunAt = addHours(
      new Date(),
      schedulerState.intervalHours
    ).toISOString();
  }
}

export function startLocalScheduler() {
  const enabled = parseBooleanEnv(process.env.ENABLE_LOCAL_SCHEDULER);
  const runOnStart = parseBooleanEnv(process.env.RUN_SYNC_ON_START);
  const intervalHours = parseIntervalHours(
    process.env.MANUFACTURER_SYNC_INTERVAL_HOURS
  );

  schedulerState.enabled = enabled;
  schedulerState.intervalHours = intervalHours;

  if (!enabled) {
    console.log("Local scheduler disabled.");
    return;
  }

  if (schedulerState.started) {
    console.log("Local scheduler already started.");
    return;
  }

  schedulerState.started = true;
  schedulerState.nextRunAt = addHours(new Date(), intervalHours).toISOString();

  const intervalMs = intervalHours * 60 * 60 * 1000;

  schedulerInterval = setInterval(() => {
    void runScheduledDailyJob();
  }, intervalMs);

  console.log(
    `Local scheduler enabled. Daily job interval: ${intervalHours} hour(s).`
  );

  if (runOnStart) {
    console.log("RUN_SYNC_ON_START enabled. Starting daily job shortly.");

    setTimeout(() => {
      void runScheduledDailyJob();
    }, 3000);
  }
}

export function stopLocalScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
  }

  schedulerState.started = false;
  schedulerState.nextRunAt = null;
}

export function getLocalSchedulerStatus() {
  return {
    ...schedulerState,
    generatedAt: new Date().toISOString(),
  };
}