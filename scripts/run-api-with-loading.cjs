const fs = require("fs");

const [,, labelArg, urlArg, outputPathArg] = process.argv;

if (!labelArg || !urlArg) {
  console.error('Usage: node scripts/run-api-with-loading.cjs "<label>" "<url>" [output.json]');
  process.exit(1);
}

const label = labelArg;
const url = urlArg;
const outputPath = outputPathArg || "api-run-output.json";
const startedAt = Date.now();

let status = "loading";
let details = "waiting for response...";

function formatElapsed(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function summarizeJson(json) {
  const data = json?.data ?? json;
  const result = data?.result ?? data;

  if (data?.sourceCount != null) {
    return `sources ${data.successfulCount ?? 0}/${data.sourceCount}, failed ${data.failedCount ?? 0}`;
  }

  if (result?.discoveredCount != null || result?.parsedCount != null) {
    return `discovered ${result.discoveredCount ?? "?"}, parsed ${result.parsedCount ?? "?"}, failures ${result.failureCount ?? 0}`;
  }

  if (result?.scrapedCount != null || result?.savedCount != null) {
    return `scraped ${result.scrapedCount ?? "?"}, saved ${result.savedCount ?? "?"}, review ${result.skippedNeedsReviewCount ?? 0}`;
  }

  if (data?.count != null) {
    return `count ${data.count}`;
  }

  return "complete";
}

let lastRenderLineCount = 0;

function truncate(value, width) {
  const text = String(value ?? "");
  if (text.length <= width) return text;
  return text.slice(0, Math.max(0, width - 1)) + "…";
}

function pad(value, width) {
  return truncate(value, width).padEnd(width, " ");
}

function buildTable() {
  const row = {
    task: label,
    status,
    elapsed: formatElapsed(Date.now() - startedAt),
    details,
  };

  const widths = {
    task: 32,
    status: 10,
    elapsed: 8,
    details: 46,
  };

  const border =
    "+" +
    "-".repeat(widths.task + 2) +
    "+" +
    "-".repeat(widths.status + 2) +
    "+" +
    "-".repeat(widths.elapsed + 2) +
    "+" +
    "-".repeat(widths.details + 2) +
    "+";

  return [
    "loading / elapsed",
    border,
    `| ${pad("task", widths.task)} | ${pad("status", widths.status)} | ${pad("elapsed", widths.elapsed)} | ${pad("details", widths.details)} |`,
    border,
    `| ${pad(row.task, widths.task)} | ${pad(row.status, widths.status)} | ${pad(row.elapsed, widths.elapsed)} | ${pad(row.details, widths.details)} |`,
    border,
  ];
}

function render() {
  const lines = buildTable();

  if (process.stdout.isTTY && lastRenderLineCount > 0) {
    process.stdout.write(`\x1b[${lastRenderLineCount}A`);
    process.stdout.write("\x1b[J");
  }

  process.stdout.write(lines.join("\n") + "\n");
  lastRenderLineCount = lines.length;
}

const timer = setInterval(render, 500);
render();

async function main() {
  try {
    const res = await fetch(url);
    const text = await res.text();

    fs.writeFileSync(outputPath, text);

    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      // Leave json null.
    }

    if (!res.ok) {
      status = "error";
      details = `HTTP ${res.status}`;
      render();
      console.error(text);
      process.exitCode = 1;
      return;
    }

    status = "success";
    details = json ? summarizeJson(json) : `HTTP ${res.status}`;
    render();

    console.log(`\nsaved response: ${outputPath}`);

    if (json?.data?.result) {
      const x = json.data.result;
      console.log(JSON.stringify({
        status: x.status,
        discovered: x.discoveredCount,
        parsed: x.parsedCount,
        failures: x.failureCount,
        scraped: x.scrapedCount,
        saved: x.savedCount,
        noMatch: x.skippedNoMatchCount,
        needsReview: x.skippedNeedsReviewCount,
        created: x.createdListingCount ?? x.itemsCreated,
        updated: x.updatedListingCount ?? x.itemsUpdated,
        removed: x.itemsRemoved,
        snapshotsCreated: x.snapshotCreatedCount,
        snapshotsSkipped: x.snapshotSkippedCount,
      }, null, 2));
    } else if (json?.data?.sourceCount != null) {
      console.log(JSON.stringify({
        sourceCount: json.data.sourceCount,
        successfulCount: json.data.successfulCount,
        failedCount: json.data.failedCount,
      }, null, 2));
    }
  } catch (error) {
    status = "error";
    details = error instanceof Error ? error.message : "request failed";
    render();
    process.exitCode = 1;
  } finally {
    clearInterval(timer);
  }
}

main();
