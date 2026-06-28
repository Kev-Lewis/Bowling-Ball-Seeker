const globalStatus = document.getElementById("globalStatus");
const globalStatusText = document.getElementById("globalStatusText");

let activeListingDetailId = null;
let activeCatalogBallDetailId = null;
let navHighlightTimeout = null;
let lastScrapeOutput = null;
let lastCandidatePreviewOutput = null;
let dashboardSummaryRefreshTimeout = null;
let lastTrackedSources = [];
let lastManufacturerSources = [];
let lastCatalogBalls = [];
let catalogBallListingContext = null;
let isCreatingCatalogBall = false;

function setStatus(message, state = "ready") {
  if (globalStatusText) {
    globalStatusText.textContent = message;
  } else if (globalStatus) {
    globalStatus.textContent = message;
  }

  if (globalStatus) {
    globalStatus.classList.remove("is-ready", "is-loading", "is-error");
    globalStatus.classList.add(`is-${state}`);
  }
}

function setupInfoButtons() {
  document.querySelectorAll(".info-button").forEach((button) => {
    button.addEventListener("click", () => {
      const targetId = button.dataset.infoTarget;
      const target = document.getElementById(targetId);

      if (!target) {
        return;
      }

      const isHidden = target.hasAttribute("hidden");

      document.querySelectorAll(".widget-description").forEach((description) => {
        description.setAttribute("hidden", "");
      });

      document.querySelectorAll(".info-button").forEach((infoButton) => {
        infoButton.textContent = "Info";
      });

      if (isHidden) {
        target.removeAttribute("hidden");
        button.textContent = "Hide info";
      }
    });
  });
}

function setupNavJumps() {
  document.querySelectorAll(".nav-jump").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();

      const targetId = link.dataset.target;
      const target = document.getElementById(targetId);

      if (!target) {
        return;
      }

      const header = document.querySelector(".console-shell");
      const headerHeight = header ? header.getBoundingClientRect().height : 0;
      const buffer = 18;
      const targetTop =
        target.getBoundingClientRect().top + window.scrollY - headerHeight - buffer;

      window.scrollTo({
        top: Math.max(targetTop, 0),
        behavior: "smooth",
      });

      document.querySelectorAll(".widget").forEach((widget) => {
        widget.classList.remove("nav-highlight");
      });

      target.classList.add("nav-highlight");

      window.clearTimeout(navHighlightTimeout);
      navHighlightTimeout = window.setTimeout(() => {
        target.classList.remove("nav-highlight");
      }, 1500);
    });
  });
}

function setupScrapeOutputModal() {
  const modal = document.getElementById("scrapeOutputModal");
  const closeButton = document.getElementById("closeScrapeOutputModalBtn");
  const viewButton = document.getElementById("viewScrapeOutputBtn");

  if (!modal || !closeButton || !viewButton) {
    return;
  }

  viewButton.addEventListener("click", openScrapeOutputModal);
  closeButton.addEventListener("click", closeScrapeOutputModal);

  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      closeScrapeOutputModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modal.hasAttribute("hidden")) {
      closeScrapeOutputModal();
    }
  });
}

function openScrapeOutputModal() {
  const modal = document.getElementById("scrapeOutputModal");

  if (!modal) {
    return;
  }

  if (lastScrapeOutput) {
    renderJson("scrapeOutput", lastScrapeOutput);
  }

  modal.removeAttribute("hidden");
}

function closeScrapeOutputModal() {
  const modal = document.getElementById("scrapeOutputModal");

  if (!modal) {
    return;
  }

  modal.setAttribute("hidden", "");
}

function updateScrapeSummary(data) {
  const summary = document.getElementById("scrapeOutputSummary");
  const viewButton = document.getElementById("viewScrapeOutputBtn");

  if (!summary || !viewButton) {
    return;
  }

  const savedCount = data?.savedCount ?? data?.totalSavedCount ?? 0;
  const skippedCount = data?.skippedCount ?? data?.totalSkippedCount ?? 0;
  const scrapedCount = data?.scrapedCount ?? data?.totalScrapedCount ?? 0;
  const status = data?.status ?? "complete";

  summary.textContent = `Last run ${status}: ${scrapedCount} scraped, ${savedCount} saved, ${skippedCount} skipped.`;

  viewButton.removeAttribute("hidden");
}

function setupCandidatePreviewModal() {
  const modal = document.getElementById("candidatePreviewModal");
  const closeButton = document.getElementById("closeCandidatePreviewModalBtn");
  const viewButton = document.getElementById("viewCandidatePreviewBtn");

  if (!modal || !closeButton || !viewButton) {
    return;
  }

  viewButton.addEventListener("click", openCandidatePreviewModal);
  closeButton.addEventListener("click", closeCandidatePreviewModal);

  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      closeCandidatePreviewModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modal.hasAttribute("hidden")) {
      closeCandidatePreviewModal();
    }
  });
}

function openCandidatePreviewModal() {
  const modal = document.getElementById("candidatePreviewModal");

  if (!modal) {
    return;
  }

  if (lastCandidatePreviewOutput) {
    renderCandidatePreview(lastCandidatePreviewOutput);
  }

  modal.removeAttribute("hidden");
}

function closeCandidatePreviewModal() {
  const modal = document.getElementById("candidatePreviewModal");

  if (!modal) {
    return;
  }

  modal.setAttribute("hidden", "");
}

function updateCandidatePreviewSummary(data) {
  const summary = document.getElementById("candidatePreviewSummary");
  const viewButton = document.getElementById("viewCandidatePreviewBtn");

  if (!summary || !viewButton) {
    return;
  }

  const candidateCount = data?.candidateCount ?? data?.candidates?.length ?? 0;
  const listingTitle = data?.listingTitle ?? "listing";
  const warning = data?.warning ? ` ${data.warning}` : "";

  summary.textContent = `Last preview: ${candidateCount} candidates found for ${listingTitle}.${warning}`;
  viewButton.removeAttribute("hidden");
}

function setupCatalogBallModal() {
  const modal = document.getElementById("catalogBallModal");
  const closeButton = document.getElementById("closeCatalogBallModalBtn");

  if (!modal || !closeButton) {
    return;
  }

  closeButton.addEventListener("click", closeCatalogBallModal);

  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      closeCatalogBallModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modal.hasAttribute("hidden")) {
      closeCatalogBallModal();
    }
  });
}

function openCatalogBallModal() {
  const modal = document.getElementById("catalogBallModal");

  if (!modal) {
    return;
  }

  modal.removeAttribute("hidden");
}

function closeCatalogBallModal() {
  const modal = document.getElementById("catalogBallModal");

  if (!modal) {
    return;
  }

  modal.setAttribute("hidden", "");
}

function setCatalogBallModalTitle(value) {
  const title = document.getElementById("catalogBallModalTitle");

  if (title) {
    title.textContent = value;
  }
}

function setCatalogBallAssignButtonVisible(isVisible) {
  const button = document.getElementById("createAndAssignCatalogBallBtn");

  if (!button) {
    return;
  }

  if (isVisible) {
    button.removeAttribute("hidden");
  } else {
    button.setAttribute("hidden", "");
  }
}

function slugify(value) {
  return String(value ?? "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function deriveBrandAndName(listingTitle) {
  const cleaned = String(listingTitle ?? "").trim();
  const parts = cleaned.split(/\s+/);
  const brand = parts[0] || "";
  const canonicalName = parts.length > 1 ? parts.slice(1).join(" ") : cleaned;

  return {
    brand,
    canonicalName,
  };
}

function setCatalogBallValue(id, value) {
  const element = document.getElementById(id);

  if (!element) {
    return;
  }

  element.value = value ?? "";
}

function getCatalogBallWeightsText(ball) {
  const weights = ball?.availableWeights;

  if (Array.isArray(weights)) {
    return weights.join(",");
  }

  if (typeof ball?.availableWeightsJson === "string") {
    try {
      const parsed = JSON.parse(ball.availableWeightsJson);
      return Array.isArray(parsed) ? parsed.join(",") : "";
    } catch {
      return "";
    }
  }

  return "";
}

function fillCatalogBallForm(ball) {
  setCatalogBallValue("catalogBallId", ball?.id ?? "");
  setCatalogBallValue("catalogBallBrand", ball?.brand ?? "");
  setCatalogBallValue("catalogBallManufacturer", ball?.manufacturer ?? ball?.brand ?? "");
  setCatalogBallValue("catalogBallCanonicalName", ball?.canonicalName ?? "");
  setCatalogBallValue("catalogBallCoverstockType", ball?.coverstockType ?? "unknown");
  setCatalogBallValue("catalogBallCoreType", ball?.coreType ?? "unknown");
  setCatalogBallValue("catalogBallCoverstockName", ball?.coverstockName ?? "");
  setCatalogBallValue("catalogBallCoreName", ball?.coreName ?? "");
  setCatalogBallValue("catalogBallFactoryFinish", ball?.factoryFinish ?? "");
  setCatalogBallValue("catalogBallRg", ball?.rg ?? "");
  setCatalogBallValue("catalogBallDifferential", ball?.differential ?? "");
  setCatalogBallValue("catalogBallMbDifferential", ball?.mbDifferential ?? "");
  setCatalogBallValue("catalogBallWeights", getCatalogBallWeightsText(ball));
  setCatalogBallValue("catalogBallIsCurrent", String(ball?.isCurrent ?? true));
  setCatalogBallValue("catalogBallOfficialUrl", ball?.officialUrl ?? "");
  setCatalogBallValue("catalogBallImageUrl", ball?.imageUrl ?? "");
}

function clearCatalogBallForm() {
  fillCatalogBallForm({
    id: "",
    brand: "",
    manufacturer: "",
    canonicalName: "",
    coverstockType: "unknown",
    coreType: "unknown",
    coverstockName: "",
    coreName: "",
    factoryFinish: "",
    rg: "",
    differential: "",
    mbDifferential: "",
    availableWeights: [],
    isCurrent: true,
    officialUrl: "",
    imageUrl: "",
  });
}

function openNewCatalogBallModal() {
  catalogBallListingContext = null;

  clearCatalogBallForm();

  setCatalogBallModalTitle("New Catalog Ball");
  setCatalogBallAssignButtonVisible(false);

  const context = document.getElementById("catalogBallContext");
  if (context) {
    context.textContent = "Create a new canonical catalog ball.";
  }

  const output = document.getElementById("catalogBallOutput");
  if (output) {
    output.textContent = "Fill in the required fields, then save the catalog ball.";
  }

  const createButton = document.getElementById("createCatalogBallBtn");
  if (createButton) {
    createButton.textContent = "Save Catalog Ball";
  }

  openCatalogBallModal();
}

function openCreateCatalogBallFromPreview() {
  if (!lastCandidatePreviewOutput) {
    setStatus("Error", "error");
    return;
  }

  const listingTitle = lastCandidatePreviewOutput.listingTitle ?? "";
  const listingUrl =
    lastCandidatePreviewOutput.listingUrl || getInputValue("candidateListingUrl");

  const derived = deriveBrandAndName(listingTitle);
  const ballId = `${slugify(derived.brand)}-${slugify(derived.canonicalName)}`;

  catalogBallListingContext = {
    listingTitle,
    listingUrl,
  };

  fillCatalogBallForm({
    id: ballId,
    brand: derived.brand,
    manufacturer: derived.brand,
    canonicalName: derived.canonicalName,
    coverstockType: "unknown",
    coreType: "unknown",
    coverstockName: "",
    coreName: "",
    factoryFinish: "",
    rg: "",
    differential: "",
    mbDifferential: "",
    availableWeights: [12, 13, 14, 15, 16],
    isCurrent: true,
    officialUrl: listingUrl,
    imageUrl: "",
  });

  setCatalogBallModalTitle("Create Catalog Ball");
  setCatalogBallAssignButtonVisible(true);

  const context = document.getElementById("catalogBallContext");
  if (context) {
    context.textContent = `Creating catalog ball for listing: ${listingTitle}`;
  }

  const output = document.getElementById("catalogBallOutput");
  if (output) {
    output.textContent = "Review or fill in missing specs, then create the catalog ball.";
  }

  const createButton = document.getElementById("createCatalogBallBtn");
  if (createButton) {
    createButton.textContent = "Create Catalog Ball";
  }

  openCatalogBallModal();
}

function openEditCatalogBallFromEncoded(encodedBallId) {
  openEditCatalogBall(decodeURIComponent(encodedBallId));
}

async function openEditCatalogBall(ballId) {
  try {
    catalogBallListingContext = null;

    let ball = lastCatalogBalls.find((item) => item.id === ballId);

    if (!ball) {
      const detail = await apiGet(
        `/api/admin/catalog-balls/detail?id=${encodeURIComponent(ballId)}`
      );
      ball = detail.data;
    }

    if (!ball) {
      throw new Error(`Catalog ball not found: ${ballId}`);
    }

    fillCatalogBallForm(ball);

    setCatalogBallModalTitle(`Edit Catalog Ball: ${ball.id}`);
    setCatalogBallAssignButtonVisible(false);

    const context = document.getElementById("catalogBallContext");
    if (context) {
      context.textContent = `Editing ${ball.brand} ${ball.canonicalName}.`;
    }

    const output = document.getElementById("catalogBallOutput");
    if (output) {
      output.textContent = "Update fields, then save the catalog ball.";
    }

    const createButton = document.getElementById("createCatalogBallBtn");
    if (createButton) {
      createButton.textContent = "Save Catalog Ball";
    }

    openCatalogBallModal();
  } catch (error) {
    setStatus("Error", "error");

    const summary = document.getElementById("catalogBallsSummary");
    if (summary) {
      summary.textContent = `Catalog ball edit error: ${error.message}`;
    }
  }
}

function getCatalogBallPayload() {
  const canonicalName = getInputValue("catalogBallCanonicalName");
  const brand = getInputValue("catalogBallBrand");
  const manufacturer = getInputValue("catalogBallManufacturer") || brand;

  if (!canonicalName || !brand) {
    throw new Error("Brand and canonical name are required.");
  }

  return {
    id: getInputValue("catalogBallId") || `${slugify(brand)}-${slugify(canonicalName)}`,
    canonicalName,
    brand,
    manufacturer,
    coverstockName: getInputValue("catalogBallCoverstockName"),
    coverstockType: getInputValue("catalogBallCoverstockType") || "unknown",
    coreName: getInputValue("catalogBallCoreName"),
    coreType: getInputValue("catalogBallCoreType") || "unknown",
    factoryFinish: getInputValue("catalogBallFactoryFinish"),
    rg: getInputValue("catalogBallRg"),
    differential: getInputValue("catalogBallDifferential"),
    mbDifferential: getInputValue("catalogBallMbDifferential"),
    availableWeights: getInputValue("catalogBallWeights"),
    officialUrl: getInputValue("catalogBallOfficialUrl"),
    imageUrl: getInputValue("catalogBallImageUrl"),
    isCurrent: getInputValue("catalogBallIsCurrent"),
  };
}

async function createCatalogBall(assignAfterCreate = false) {
  if (isCreatingCatalogBall) {
    return;
  }

  const createButton = document.getElementById("createCatalogBallBtn");
  const createAndAssignButton = document.getElementById("createAndAssignCatalogBallBtn");

  try {
    isCreatingCatalogBall = true;

    if (createButton) {
      createButton.disabled = true;
      createButton.textContent = "Saving...";
    }

    if (createAndAssignButton) {
      createAndAssignButton.disabled = true;
      createAndAssignButton.textContent = assignAfterCreate
        ? "Creating & Assigning..."
        : "Saving...";
    }

    const payload = getCatalogBallPayload();

    if (assignAfterCreate) {
      const listingUrl =
        catalogBallListingContext?.listingUrl || getInputValue("candidateListingUrl");

      if (!listingUrl) {
        throw new Error("Listing URL is required for create and assign.");
      }

      const confirmed = window.confirm(
        `Create catalog ball "${payload.brand} ${payload.canonicalName}" and assign listing?\n\n${listingUrl}`
      );

      if (!confirmed) {
        return;
      }
    }

    const query = encodeQuery(payload);
    const savedBall = await apiGet(`/api/admin/catalog-balls/upsert?${query}`);

    let assignment = null;

    if (assignAfterCreate) {
      const listingUrl =
        catalogBallListingContext?.listingUrl || getInputValue("candidateListingUrl");

      assignment = await assignListingToBall(listingUrl, savedBall.data.id, false);
      document.getElementById("manualBallId").value = savedBall.data.id;
    }

    const output = document.getElementById("catalogBallOutput");
    if (output) {
      output.textContent = `${savedBall.action === "created" ? "Created" : "Updated"} catalog ball: ${
        savedBall.data.id
      }${assignment ? " and assigned listing." : "."}`;
    }

    renderJson("manualAssignOutput", {
      catalogBall: savedBall,
      assignment,
    });

    scheduleDashboardSummaryRefresh();

    await loadCatalogBalls();
    await loadSkippedReviews();
    await loadListings();

    if (assignAfterCreate) {
      closeCatalogBallModal();
      closeCandidatePreviewModal();
      closeScrapeOutputModal();

      catalogBallListingContext = null;
      lastCandidatePreviewOutput = null;

      const summary = document.getElementById("candidatePreviewSummary");
      if (summary) {
        summary.textContent = `Created and assigned listing to ${savedBall.data.id}.`;
      }

      const viewButton = document.getElementById("viewCandidatePreviewBtn");
      if (viewButton) {
        viewButton.setAttribute("hidden", "");
      }
    } else {
      closeCatalogBallModal();

      const summary = document.getElementById("catalogBallsSummary");
      if (summary) {
        summary.textContent = `${savedBall.action === "created" ? "Created" : "Updated"} catalog ball: ${
          savedBall.data.id
        }.`;
      }
    }

    setStatus(assignAfterCreate ? "Catalog ball assigned" : "Catalog ball saved", "ready");
  } catch (error) {
    const output = document.getElementById("catalogBallOutput");
    if (output) {
      output.textContent = `Catalog ball error: ${error.message}`;
    }

    setStatus("Error", "error");
  } finally {
    isCreatingCatalogBall = false;

    if (createButton) {
      createButton.disabled = false;
      createButton.textContent = catalogBallListingContext
        ? "Create Catalog Ball"
        : "Save Catalog Ball";
    }

    if (createAndAssignButton) {
      createAndAssignButton.disabled = false;
      createAndAssignButton.textContent = "Create & Assign Listing";
    }
  }
}

async function assignListingToBall(listingUrl, ballId, dryRun) {
  const query = encodeQuery({
    listingUrl,
    ballId,
    dryRun: String(dryRun),
    note: dryRun ? "admin catalog ball dry run" : "admin catalog ball create and assign",
  });

  return apiGet(`/api/retailers/match-review/resolve?${query}`);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function encodeQuery(params) {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") {
      continue;
    }

    query.set(key, value);
  }

  return query.toString();
}

async function apiGet(path) {
  setStatus("Loading", "loading");

  const response = await fetch(path);
  const json = await response.json();

  if (!response.ok) {
    setStatus("Error", "error");
    throw new Error(json.details || json.error || "Request failed");
  }

  setStatus("Ready", "ready");

  return json.data;
}

function renderJson(elementId, data) {
  const element = document.getElementById(elementId);

  if (!element) {
    return;
  }

  element.textContent = JSON.stringify(data, null, 2);
}

function getInputValue(id) {
  return document.getElementById(id).value.trim();
}

function setText(id, value) {
  const element = document.getElementById(id);

  if (!element) {
    return;
  }

  element.textContent = value;
}

function formatDateTime(value) {
  if (!value) {
    return "No completed run";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown time";
  }

  return date.toLocaleString();
}

async function loadDashboardSummary() {
  try {
    const data = await apiGet("/api/retailers/dashboard-summary");
    renderDashboardSummary(data);
  } catch (error) {
    setText("summaryTotalListings", "—");
    setText("summaryTotalListingsHelp", "Unable to load listings");
    setText("summaryManualMatches", "—");
    setText("summaryManualMatchesHelp", "Unable to load manual matches");
    setText("summarySkippedNoMatch", "—");
    setText("summarySkippedNoMatchHelp", "Unable to load match review");
    setText("summaryLastScrape", "Error");
    setText("summaryLastScrapeHelp", error.message);
    setStatus("Error", "error");
  }
}

function renderDashboardSummary(data) {
  const listings = data.listings ?? {};
  const matchReview = data.matchReview ?? {};
  const latestRun = data.latestRetailerScrapeRun;

  setText("summaryTotalListings", listings.total ?? 0);
  setText(
    "summaryTotalListingsHelp",
    `${listings.autoMatched ?? 0} auto • ${listings.likelyMatched ?? 0} likely`
  );

  setText("summaryManualMatches", listings.manuallyMatched ?? 0);
  setText(
    "summaryManualMatchesHelp",
    `${listings.manualReview ?? 0} manual review • ${listings.rejected ?? 0} rejected`
  );

  setText("summarySkippedNoMatch", matchReview.uniqueSkippedNoMatchCount ?? 0);
  setText(
    "summarySkippedNoMatchHelp",
    `${matchReview.uniqueSkippedNeedsReviewCount ?? 0} need review`
  );

  if (!latestRun) {
    setText("summaryLastScrape", "None");
    setText("summaryLastScrapeHelp", "No retailer scrape run found");
    return;
  }

  setText("summaryLastScrape", latestRun.status ?? "unknown");
  setText(
    "summaryLastScrapeHelp",
    `${latestRun.sourceName ?? "retailer"} • ${formatDateTime(
      latestRun.finishedAt ?? latestRun.startedAt
    )}`
  );
}

function scheduleDashboardSummaryRefresh() {
  window.clearTimeout(dashboardSummaryRefreshTimeout);

  dashboardSummaryRefreshTimeout = window.setTimeout(() => {
    loadDashboardSummary();
  }, 250);
}

async function runCategoryScrape() {
  try {
    const query = encodeQuery({
      url: getInputValue("categoryUrl"),
      maxPages: getInputValue("maxPages"),
      maxProducts: getInputValue("maxProducts"),
      scrapeDelayMs: getInputValue("scrapeDelayMs"),
      allowLikelyMatch: getInputValue("allowLikelyMatch"),
    });

    const data = await apiGet(`/api/jobs/bowling-com-category-scrape/run?${query}`);

    lastScrapeOutput = data;
    renderJson("scrapeOutput", data);
    updateScrapeSummary(data);
    openScrapeOutputModal();
    scheduleDashboardSummaryRefresh();
  } catch (error) {
    const errorOutput = { error: error.message };

    lastScrapeOutput = errorOutput;
    renderJson("scrapeOutput", errorOutput);
    updateScrapeSummary({
      status: "error",
      scrapedCount: 0,
      savedCount: 0,
      skippedCount: 0,
    });
    openScrapeOutputModal();
    setStatus("Error", "error");
  }
}

function clearTrackedSourceForm() {
  document.getElementById("trackedSourceName").value = "";
  document.getElementById("trackedSourceRetailerName").value = "bowling.com";
  document.getElementById("trackedSourceKind").value = "category";
  document.getElementById("trackedSourceUrl").value = "";
  document.getElementById("trackedSourceEnabled").value = "true";
  document.getElementById("trackedSourceAllowLikelyMatch").value = "true";
  document.getElementById("trackedSourceMaxPages").value = "1";
  document.getElementById("trackedSourceMaxProducts").value = "5";
  document.getElementById("trackedSourceScrapeDelayMs").value = "750";

  const summary = document.getElementById("trackedSourcesSummary");
  if (summary) {
    summary.textContent = "Tracked source form cleared.";
  }
}

function editTrackedSourceFromEncoded(encodedSourceId) {
  editTrackedSource(decodeURIComponent(encodedSourceId));
}

function editTrackedSource(sourceId) {
  const source = getTrackedSourceById(sourceId);

  if (!source) {
    setStatus("Error", "error");
    return;
  }

  document.getElementById("trackedSourceName").value = source.name ?? "";
  document.getElementById("trackedSourceRetailerName").value = source.retailerName ?? "bowling.com";
  document.getElementById("trackedSourceKind").value = source.sourceKind ?? "category";
  document.getElementById("trackedSourceUrl").value = source.url ?? "";
  document.getElementById("trackedSourceEnabled").value = String(source.enabled);
  document.getElementById("trackedSourceAllowLikelyMatch").value = String(source.allowLikelyMatch);
  document.getElementById("trackedSourceMaxPages").value = source.maxPages ?? 1;
  document.getElementById("trackedSourceMaxProducts").value = source.maxProducts ?? 5;
  document.getElementById("trackedSourceScrapeDelayMs").value = source.scrapeDelayMs ?? 750;

  const summary = document.getElementById("trackedSourcesSummary");
  if (summary) {
    summary.textContent = `Editing tracked source: ${source.name}.`;
  }

  setStatus("Source loaded for edit", "ready");
}

async function saveTrackedSource() {
  try {
    const name = getInputValue("trackedSourceName");
    const retailerName = getInputValue("trackedSourceRetailerName");
    const sourceKind = getInputValue("trackedSourceKind");
    const url = getInputValue("trackedSourceUrl");

    if (!name || !retailerName || !sourceKind || !url) {
      throw new Error("Source name, retailer name, source kind, and URL are required.");
    }

    const query = encodeQuery({
      name,
      retailerName,
      sourceKind,
      url,
      enabled: getInputValue("trackedSourceEnabled"),
      maxPages: getInputValue("trackedSourceMaxPages"),
      maxProducts: getInputValue("trackedSourceMaxProducts"),
      scrapeDelayMs: getInputValue("trackedSourceScrapeDelayMs"),
      allowLikelyMatch: getInputValue("trackedSourceAllowLikelyMatch"),
    });

    const data = await apiGet(`/api/tracked-retailer-sources/upsert?${query}`);

    const summary = document.getElementById("trackedSourcesSummary");
    if (summary) {
      summary.textContent = `${data.action === "created" ? "Created" : "Updated"} tracked source: ${
        data.data?.name ?? name
      }.`;
    }

    await loadTrackedSources();
    setStatus("Source saved", "ready");
  } catch (error) {
    const summary = document.getElementById("trackedSourcesSummary");
    if (summary) {
      summary.textContent = `Save source error: ${error.message}`;
    }

    setStatus("Error", "error");
  }
}

async function loadTrackedSources() {
  try {
    const query = encodeQuery({
      retailerName: getInputValue("trackedRetailerNameFilter"),
      sourceKind: getInputValue("trackedSourceKindFilter"),
      enabled: getInputValue("trackedEnabledFilter"),
    });

    const data = await apiGet(`/api/tracked-retailer-sources?${query}`);
    renderTrackedSources(data);
  } catch (error) {
    document.getElementById("trackedSourcesTable").innerHTML = `<pre>${escapeHtml(
      error.message
    )}</pre>`;
    setStatus("Error", "error");
  }
}

async function seedTrackedSources() {
  try {
    const data = await apiGet("/api/tracked-retailer-sources/seed-defaults");

    const summary = document.getElementById("trackedSourcesSummary");
    if (summary) {
      summary.textContent = `Seeded ${data.count ?? 0} default tracked sources.`;
    }

    await loadTrackedSources();
  } catch (error) {
    const summary = document.getElementById("trackedSourcesSummary");
    if (summary) {
      summary.textContent = `Seed defaults error: ${error.message}`;
    }

    setStatus("Error", "error");
  }
}

function renderTrackedSources(data) {
  lastTrackedSources = data.data ?? [];

  const summary = document.getElementById("trackedSourcesSummary");
  if (summary) {
    summary.textContent = `Showing ${data.count ?? 0} tracked sources.`;
  }

  const rows = lastTrackedSources
    .map((source) => {
      const encodedSourceId = encodeURIComponent(source.id);
      const enabledClass = source.enabled ? "enabled" : "disabled";
      const enabledText = source.enabled ? "enabled" : "disabled";
      const toggleText = source.enabled ? "Disable" : "Enable";
      const nextEnabled = source.enabled ? "false" : "true";

      return `
        <tr class="listing-row">
          <td>
            <strong>${escapeHtml(source.name)}</strong><br />
            <span class="muted">${escapeHtml(source.id)}</span>
          </td>
          <td class="cell-url">
            <a href="${escapeHtml(source.url)}" target="_blank" rel="noreferrer">
              ${escapeHtml(source.url)}
            </a>
            <br />
            <span class="muted">${escapeHtml(source.retailerName)} • ${escapeHtml(
        source.sourceKind
      )}</span>
          </td>
          <td>
            <span class="muted">
              pages ${escapeHtml(source.maxPages ?? "—")} • products ${escapeHtml(
        source.maxProducts ?? "—"
      )}
            </span>
            <br />
            <span class="muted">
              delay ${escapeHtml(source.scrapeDelayMs ?? "—")}ms • likely ${escapeHtml(
        source.allowLikelyMatch
      )}
            </span>
          </td>
          <td>
            <span class="pill ${enabledClass}">${enabledText}</span>
          </td>
          <td>
            <div class="cell-actions">
              ${source.enabled
                ? `<button onclick="runTrackedSourceFromEncoded('${encodedSourceId}')">Run</button>`
                : `<button class="secondary" disabled title="Enable this source before running it">Run</button>`
              }
              <button class="secondary" onclick="useTrackedSourceFromEncoded('${encodedSourceId}')">
                Use
              </button>
              <button class="secondary" onclick="editTrackedSourceFromEncoded('${encodedSourceId}')">
                Edit
              </button>
              <button
                class="${source.enabled ? "danger" : "secondary"}"
                onclick="setTrackedSourceEnabledFromEncoded('${encodedSourceId}', '${nextEnabled}')"
              >
                ${toggleText}
              </button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");

  document.getElementById("trackedSourcesTable").innerHTML = `
    <table class="source-table">
      <colgroup>
        <col />
        <col />
        <col />
        <col />
        <col />
      </colgroup>
      <thead>
        <tr>
          <th>Source</th>
          <th>URL</th>
          <th>Config</th>
          <th>Status</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>${rows || `<tr><td colspan="5">No tracked sources found.</td></tr>`}</tbody>
    </table>
  `;
}

function getTrackedSourceById(sourceId) {
  return lastTrackedSources.find((source) => source.id === sourceId);
}

async function runTrackedSourceFromEncoded(encodedSourceId) {
  await runTrackedSource(decodeURIComponent(encodedSourceId));
}

async function runTrackedSource(sourceId) {
  try {
    const source = getTrackedSourceById(sourceId);

    if (!source) {
      throw new Error(`Tracked source not loaded: ${sourceId}`);
    }

    if (!source.enabled) {
      throw new Error(`Tracked source is disabled: ${source.name}`);
    }

    const data = await apiGet(
      `/api/tracked-retailer-sources/run?id=${encodeURIComponent(sourceId)}`
    );

    lastScrapeOutput = data;
    renderJson("scrapeOutput", data);
    updateScrapeSummary(data.result ?? data);
    openScrapeOutputModal();

    const summary = document.getElementById("trackedSourcesSummary");
    if (summary) {
      const result = data.result ?? {};
      summary.textContent = `Ran ${source.name}: ${
        result.scrapedCount ?? 0
      } scraped, ${result.savedCount ?? 0} saved.`;
    }

    scheduleDashboardSummaryRefresh();
    loadListings();
  } catch (error) {
    const errorOutput = { error: error.message };

    lastScrapeOutput = errorOutput;
    renderJson("scrapeOutput", errorOutput);
    openScrapeOutputModal();
    setStatus("Error", "error");
  }
}


async function runAllTrackedSources() {
  try {
    const data = await apiGet("/api/tracked-retailer-sources/run-all");

    lastScrapeOutput = data;
    renderJson("scrapeOutput", data);
    openScrapeOutputModal();

    const summary = document.getElementById("trackedSourcesSummary");
    if (summary) {
      summary.textContent = `Ran enabled retailer sources: ${data.successfulCount ?? 0}/${data.sourceCount ?? 0} succeeded, ${data.failedCount ?? 0} failed.`;
    }

    scheduleDashboardSummaryRefresh();
    await loadListings();
    await loadTrackedSources();
  } catch (error) {
    const errorOutput = { error: error.message };

    lastScrapeOutput = errorOutput;
    renderJson("scrapeOutput", errorOutput);
    openScrapeOutputModal();
    setStatus("Error", "error");
  }
}


async function deleteTrackedSourceFromEncoded(encodedSourceId) {
  await deleteTrackedSource(decodeURIComponent(encodedSourceId));
}

async function deleteTrackedSource(sourceId) {
  try {
    const source = getTrackedSourceById(sourceId);

    if (!source) {
      throw new Error(`Tracked source not loaded: ${sourceId}`);
    }

    if (source.enabled) {
      throw new Error("Disable the tracked source before deleting it.");
    }

    const confirmed = window.confirm(`Delete disabled retailer source: ${source.name}?`);

    if (!confirmed) {
      return;
    }

    const data = await apiGet(
      `/api/tracked-retailer-sources/delete?id=${encodeURIComponent(sourceId)}`
    );

    const summary = document.getElementById("trackedSourcesSummary");
    if (summary) {
      summary.textContent = `Deleted tracked source: ${data.data?.name ?? source.name}.`;
    }

    await loadTrackedSources();
  } catch (error) {
    const summary = document.getElementById("trackedSourcesSummary");
    if (summary) {
      summary.textContent = `Delete source error: ${error.message}`;
    }

    setStatus("Error", "error");
  }
}

function useTrackedSourceFromEncoded(encodedSourceId) {
  useTrackedSource(decodeURIComponent(encodedSourceId));
}

function useTrackedSource(sourceId) {
  const source = getTrackedSourceById(sourceId);

  if (!source) {
    setStatus("Error", "error");
    return;
  }

  document.getElementById("categoryUrl").value = source.url;
  document.getElementById("maxPages").value = source.maxPages ?? 1;
  document.getElementById("maxProducts").value = source.maxProducts ?? 5;
  document.getElementById("scrapeDelayMs").value = source.scrapeDelayMs ?? 750;
  document.getElementById("allowLikelyMatch").value = String(source.allowLikelyMatch);

  const summary = document.getElementById("scrapeOutputSummary");
  if (summary) {
    summary.textContent = `Loaded tracked source into scraper controls: ${source.name}.`;
  }

  setStatus("Source loaded", "ready");

  const target = document.getElementById("scraper-controls");
  if (target) {
    target.classList.add("nav-highlight");
    window.setTimeout(() => target.classList.remove("nav-highlight"), 1200);
  }
}

async function setTrackedSourceEnabledFromEncoded(encodedSourceId, enabledValue) {
  await setTrackedSourceEnabled(decodeURIComponent(encodedSourceId), enabledValue === "true");
}

async function setTrackedSourceEnabled(sourceId, enabled) {
  try {
    const data = await apiGet(
      `/api/tracked-retailer-sources/set-enabled?id=${encodeURIComponent(
        sourceId
      )}&enabled=${enabled}`
    );

    const summary = document.getElementById("trackedSourcesSummary");
    if (summary) {
      summary.textContent = `${data.data?.name ?? "Tracked source"} set to ${
        enabled ? "enabled" : "disabled"
      }.`;
    }

    await loadTrackedSources();
  } catch (error) {
    const summary = document.getElementById("trackedSourcesSummary");
    if (summary) {
      summary.textContent = `Enable/disable error: ${error.message}`;
    }

    setStatus("Error", "error");
  }
}


function clearManufacturerSourceForm() {
  document.getElementById("manufacturerSourceName").value = "";
  document.getElementById("manufacturerSourceManufacturerName").value = "";
  document.getElementById("manufacturerSourceBrandName").value = "";
  document.getElementById("manufacturerSourceKind").value = "catalog";
  document.getElementById("manufacturerSourceParserKey").value = "motiv";
  document.getElementById("manufacturerSourceUrl").value = "";
  document.getElementById("manufacturerSourceEnabled").value = "true";
  document.getElementById("manufacturerSourceMaxPages").value = "1";
  document.getElementById("manufacturerSourceMaxProducts").value = "50";
  document.getElementById("manufacturerSourceScrapeDelayMs").value = "750";

  const summary = document.getElementById("manufacturerSourcesSummary");
  if (summary) {
    summary.textContent = "Manufacturer source form cleared.";
  }
}

function getManufacturerSourceById(sourceId) {
  return lastManufacturerSources.find((source) => source.id === sourceId);
}

function editManufacturerSourceFromEncoded(encodedSourceId) {
  const source = getManufacturerSourceById(decodeURIComponent(encodedSourceId));

  if (!source) {
    setStatus("Error", "error");
    return;
  }

  document.getElementById("manufacturerSourceName").value = source.name ?? "";
  document.getElementById("manufacturerSourceManufacturerName").value =
    source.manufacturerName ?? "";
  document.getElementById("manufacturerSourceBrandName").value = source.brandName ?? "";
  document.getElementById("manufacturerSourceKind").value = source.sourceKind ?? "catalog";
  document.getElementById("manufacturerSourceParserKey").value = source.parserKey ?? "generic";
  document.getElementById("manufacturerSourceUrl").value = source.url ?? "";
  document.getElementById("manufacturerSourceEnabled").value = String(source.enabled);
  document.getElementById("manufacturerSourceMaxPages").value = source.maxPages ?? 1;
  document.getElementById("manufacturerSourceMaxProducts").value = source.maxProducts ?? 50;
  document.getElementById("manufacturerSourceScrapeDelayMs").value =
    source.scrapeDelayMs ?? 750;

  const summary = document.getElementById("manufacturerSourcesSummary");
  if (summary) {
    summary.textContent = `Editing manufacturer source: ${source.name}.`;
  }

  setStatus("Manufacturer source loaded for edit", "ready");
}

async function saveManufacturerSource() {
  try {
    const name = getInputValue("manufacturerSourceName");
    const manufacturerName = getInputValue("manufacturerSourceManufacturerName");
    const sourceKind = getInputValue("manufacturerSourceKind");
    const parserKey = getInputValue("manufacturerSourceParserKey");
    const url = getInputValue("manufacturerSourceUrl");

    if (!name || !manufacturerName || !sourceKind || !parserKey || !url) {
      throw new Error("Name, manufacturer, source kind, parser key, and URL are required.");
    }

    const query = encodeQuery({
      name,
      manufacturerName,
      brandName: getInputValue("manufacturerSourceBrandName"),
      sourceKind,
      parserKey,
      url,
      enabled: getInputValue("manufacturerSourceEnabled"),
      maxPages: getInputValue("manufacturerSourceMaxPages"),
      maxProducts: getInputValue("manufacturerSourceMaxProducts"),
      scrapeDelayMs: getInputValue("manufacturerSourceScrapeDelayMs"),
    });

    const data = await apiGet(`/api/tracked-manufacturer-sources/upsert?${query}`);

    const summary = document.getElementById("manufacturerSourcesSummary");
    if (summary) {
      summary.textContent = `${data.action === "created" ? "Created" : "Updated"} manufacturer source: ${data.data?.name ?? name}.`;
    }

    await loadManufacturerSources();
    setStatus("Manufacturer source saved", "ready");
  } catch (error) {
    const summary = document.getElementById("manufacturerSourcesSummary");
    if (summary) {
      summary.textContent = `Save manufacturer source error: ${error.message}`;
    }

    setStatus("Error", "error");
  }
}

async function loadManufacturerSources() {
  try {
    const query = encodeQuery({
      manufacturerName: getInputValue("manufacturerSourceManufacturerFilter"),
      brandName: getInputValue("manufacturerSourceBrandFilter"),
      sourceKind: getInputValue("manufacturerSourceKindFilter"),
      parserKey: getInputValue("manufacturerSourceParserKeyFilter"),
      enabled: getInputValue("manufacturerSourceEnabledFilter"),
    });

    const data = await apiGet(`/api/tracked-manufacturer-sources?${query}`);
    renderManufacturerSources(data);
  } catch (error) {
    document.getElementById("manufacturerSourcesTable").innerHTML =
      `<pre>${escapeHtml(error.message)}</pre>`;
    setStatus("Error", "error");
  }
}

async function setManufacturerSourceEnabledFromEncoded(encodedSourceId, enabledValue) {
  try {
    const sourceId = decodeURIComponent(encodedSourceId);
    const enabled = enabledValue === "true";

    const data = await apiGet(
      `/api/tracked-manufacturer-sources/set-enabled?id=${encodeURIComponent(
        sourceId
      )}&enabled=${enabled}`
    );

    const summary = document.getElementById("manufacturerSourcesSummary");
    if (summary) {
      summary.textContent = `${data.data?.name ?? "Manufacturer source"} set to ${enabled ? "enabled" : "disabled"}.`;
    }

    await loadManufacturerSources();
  } catch (error) {
    const summary = document.getElementById("manufacturerSourcesSummary");
    if (summary) {
      summary.textContent = `Enable/disable manufacturer source error: ${error.message}`;
    }

    setStatus("Error", "error");
  }
}

function renderManufacturerSources(data) {
  lastManufacturerSources = data.data ?? [];

  const summary = document.getElementById("manufacturerSourcesSummary");
  if (summary) {
    summary.textContent = `Showing ${data.count ?? 0} manufacturer sources.`;
  }

  const rows = lastManufacturerSources
    .map((source) => {
      const encodedSourceId = encodeURIComponent(source.id);
      const enabledClass = source.enabled ? "enabled" : "disabled";
      const enabledText = source.enabled ? "enabled" : "disabled";
      const toggleText = source.enabled ? "Disable" : "Enable";
      const nextEnabled = source.enabled ? "false" : "true";
      const deleteButton = source.enabled
        ? ""
        : `<button class="danger" onclick="deleteTrackedSourceFromEncoded('${encodedSourceId}')">Delete</button>`;

      return `
        <tr class="listing-row">
          <td>
            <strong>${escapeHtml(source.name)}</strong><br />
            <span class="muted">${escapeHtml(source.id)}</span>
          </td>
          <td class="cell-url">
            <a href="${escapeHtml(source.url)}" target="_blank" rel="noreferrer">
              ${escapeHtml(source.url)}
            </a>
            <br />
            <span class="muted">${escapeHtml(source.manufacturerName)} • ${escapeHtml(source.brandName || "all brands")}</span>
          </td>
          <td>
            <span class="muted">${escapeHtml(source.sourceKind)} • parser ${escapeHtml(source.parserKey)}</span><br />
            <span class="muted">pages ${escapeHtml(source.maxPages ?? "—")} • products ${escapeHtml(source.maxProducts ?? "—")} • delay ${escapeHtml(source.scrapeDelayMs ?? "—")}ms</span>
          </td>
          <td>
            <span class="pill ${enabledClass}">${enabledText}</span>
          </td>
          <td>
            <div class="cell-actions">
              <button class="secondary" onclick="editManufacturerSourceFromEncoded('${encodedSourceId}')">
                Edit
              </button>
              <button
                class="${source.enabled ? "danger" : "secondary"}"
                onclick="setManufacturerSourceEnabledFromEncoded('${encodedSourceId}', '${nextEnabled}')"
              >
                ${toggleText}
              </button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");

  document.getElementById("manufacturerSourcesTable").innerHTML = `
    <table class="source-table">
      <colgroup>
        <col />
        <col />
        <col />
        <col />
        <col />
      </colgroup>
      <thead>
        <tr>
          <th>Source</th>
          <th>URL</th>
          <th>Config</th>
          <th>Status</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>${rows || `<tr><td colspan="5">No manufacturer sources found.</td></tr>`}</tbody>
    </table>
  `;
}

async function loadCatalogBalls() {
  try {
    const query = encodeQuery({
      limit: getInputValue("catalogBallLimit"),
      search: getInputValue("catalogBallSearch"),
      brand: getInputValue("catalogBallBrandFilter"),
      manufacturer: getInputValue("catalogBallManufacturerFilter"),
      isCurrent: getInputValue("catalogBallIsCurrentFilter"),
    });

    const data = await apiGet(`/api/admin/catalog-balls?${query}`);
    renderCatalogBalls(data);
  } catch (error) {
    document.getElementById("catalogBallsTable").innerHTML = `<pre>${escapeHtml(
      error.message
    )}</pre>`;
    setStatus("Error", "error");
  }
}

function renderCatalogBalls(data) {
  lastCatalogBalls = data.data ?? [];
  activeCatalogBallDetailId = null;

  const summary = document.getElementById("catalogBallsSummary");
  if (summary) {
    summary.textContent = `Showing ${data.count ?? 0} catalog balls.`;
  }

  const rows = lastCatalogBalls
    .map((ball) => {
      const encodedBallId = encodeURIComponent(ball.id);
      const currentClass = ball.isCurrent ? "enabled" : "disabled";
      const currentText = ball.isCurrent ? "current" : "inactive";
      const listingCount = ball._count?.listings ?? 0;

      return `
        <tr class="listing-row" data-catalog-ball-id="${escapeHtml(ball.id)}">
          <td>
            <strong>${escapeHtml(ball.brand)} ${escapeHtml(ball.canonicalName)}</strong><br />
            <span class="muted">${escapeHtml(ball.id)}</span>
          </td>
          <td>
            <span>${escapeHtml(ball.manufacturer)}</span><br />
            <span class="muted">${escapeHtml(ball.officialUrl || "No official URL")}</span>
          </td>
          <td>
            <span>${escapeHtml(ball.coverstockType || "unknown")} cover</span><br />
            <span class="muted">${escapeHtml(ball.coreType || "unknown")} core</span>
          </td>
          <td>
            <span class="pill ${currentClass}">${currentText}</span>
          </td>
          <td>
            <span class="pill">${escapeHtml(listingCount)}</span>
          </td>
          <td>
            <div class="cell-actions">
              <button onclick="toggleCatalogBallDetailFromEncoded('${encodedBallId}')">
                Detail
              </button>
              <button class="secondary" onclick="openEditCatalogBallFromEncoded('${encodedBallId}')">
                Edit
              </button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");

  document.getElementById("catalogBallsTable").innerHTML = `
    <table class="catalog-ball-table">
      <colgroup>
        <col />
        <col />
        <col />
        <col />
        <col />
        <col />
      </colgroup>
      <thead>
        <tr>
          <th>Ball</th>
          <th>Manufacturer</th>
          <th>Specs</th>
          <th>Current</th>
          <th>Listings</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>${rows || `<tr><td colspan="6">No catalog balls found.</td></tr>`}</tbody>
    </table>
  `;
}

function removeActiveCatalogBallDetail() {
  document.querySelectorAll(".catalog-ball-detail-row").forEach((row) => row.remove());

  activeCatalogBallDetailId = null;
}

async function toggleCatalogBallDetailFromEncoded(encodedBallId) {
  await toggleCatalogBallDetail(decodeURIComponent(encodedBallId));
}

async function toggleCatalogBallDetail(ballId) {
  try {
    if (activeCatalogBallDetailId === ballId) {
      removeActiveCatalogBallDetail();
      return;
    }

    removeActiveCatalogBallDetail();

    const sourceRow = document.querySelector(
      `tr.listing-row[data-catalog-ball-id="${CSS.escape(ballId)}"]`
    );

    if (!sourceRow) {
      throw new Error("Could not find catalog ball row.");
    }

    activeCatalogBallDetailId = ballId;

    const detailRow = document.createElement("tr");
    detailRow.className = "catalog-ball-detail-row";
    detailRow.innerHTML = `
      <td colspan="6">
        <div class="inline-detail">Loading catalog ball detail...</div>
      </td>
    `;

    sourceRow.insertAdjacentElement("afterend", detailRow);

    const data = await apiGet(
      `/api/admin/catalog-balls/detail?id=${encodeURIComponent(ballId)}`
    );

    detailRow.querySelector(".inline-detail").textContent = JSON.stringify(
      data,
      null,
      2
    );
  } catch (error) {
    setStatus("Error", "error");

    const detail = document.querySelector(".catalog-ball-detail-row .inline-detail");

    if (detail) {
      detail.textContent = JSON.stringify({ error: error.message }, null, 2);
    }
  }
}

async function loadSkippedReviews() {
  try {
    const query = encodeQuery({
      limit: getInputValue("skippedLimit"),
      status: getInputValue("skippedStatus"),
      dedupeByListing: getInputValue("dedupeByListing"),
    });

    const data = await apiGet(`/api/retailers/match-review/skipped?${query}`);
    renderSkippedReviews(data);
  } catch (error) {
    document.getElementById("skippedReviewTable").innerHTML = `<pre>${escapeHtml(
      error.message
    )}</pre>`;
    setStatus("Error", "error");
  }
}

function renderSkippedReviews(data) {
  const rows = data.data
    .map((item) => {
      const listing = item.review.listing;
      const encodedUrl = encodeURIComponent(listing.listingUrl);

      return `
        <tr class="listing-row">
          <td>
            <strong>${escapeHtml(listing.listingTitle)}</strong><br />
            <a href="${escapeHtml(listing.listingUrl)}" target="_blank" rel="noreferrer">
              Open listing
            </a>
          </td>
          <td>$${escapeHtml(listing.currentPrice)}</td>
          <td><span class="pill">${escapeHtml(listing.stockStatus)}</span></td>
          <td><span class="pill">${escapeHtml(item.review.status)}</span></td>
          <td>
            <button onclick="previewCandidatesForEncodedUrl('${encodedUrl}')">
              Preview
            </button>
          </td>
        </tr>
      `;
    })
    .join("");

  document.getElementById("skippedReviewTable").innerHTML = `
    <div class="muted listing-summary">
      Showing ${escapeHtml(data.count)} of ${escapeHtml(data.totalFound)} skipped reviews.
    </div>
    <table class="review-table">
      <colgroup>
        <col />
        <col />
        <col />
        <col />
        <col />
      </colgroup>
      <thead>
        <tr>
          <th>Listing</th>
          <th>Price</th>
          <th>Stock</th>
          <th>Status</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>${rows || `<tr><td colspan="5">No skipped reviews found.</td></tr>`}</tbody>
    </table>
  `;
}

async function previewCandidatesForEncodedUrl(encodedUrl) {
  await previewCandidatesForUrl(decodeURIComponent(encodedUrl));
}

async function previewCandidatesForUrl(listingUrl) {
  document.getElementById("candidateListingUrl").value = listingUrl;
  await previewCandidates();

  window.scrollTo({
    top: document.getElementById("candidate-preview").offsetTop - 120,
    behavior: "smooth",
  });
}

async function previewCandidates() {
  try {
    const listingUrl = getInputValue("candidateListingUrl");

    const query = encodeQuery({
      listingUrl,
      limit: 10,
      includeRejected: true,
      minConfidence: 0,
    });

    const data = await apiGet(`/api/retailers/match-review/candidates?${query}`);

    lastCandidatePreviewOutput = data;
    renderCandidatePreview(data);
    updateCandidatePreviewSummary(data);
    openCandidatePreviewModal();
  } catch (error) {
    const errorHtml = `<pre>${escapeHtml(error.message)}</pre>`;
    document.getElementById("candidateOutput").innerHTML = errorHtml;

    const summary = document.getElementById("candidatePreviewSummary");
    if (summary) {
      summary.textContent = `Candidate preview error: ${error.message}`;
    }

    const viewButton = document.getElementById("viewCandidatePreviewBtn");
    if (viewButton) {
      viewButton.removeAttribute("hidden");
    }

    openCandidatePreviewModal();
    setStatus("Error", "error");
  }
}

function renderCandidatePreview(data) {
  const candidates = data.candidates
    .map((candidate) => {
      const encodedBallId = encodeURIComponent(candidate.ballId);

      return `
        <div class="candidate">
          <div>
            <strong>${escapeHtml(candidate.canonicalName)}</strong>
            <span class="pill">${escapeHtml(candidate.ballId)}</span>
          </div>
          <div class="muted">
            ${escapeHtml(candidate.brand)} • confidence ${escapeHtml(
        candidate.confidence
      )} • ${escapeHtml(candidate.matchStatus)}
          </div>
          <div class="muted">
            ${escapeHtml((candidate.reasons || []).join(" | "))}
          </div>
          <div class="row" style="margin-top: 10px">
            <button onclick="fillManualBallIdFromEncoded('${encodedBallId}')">
              Use Ball ID
            </button>
            <button onclick="assignCandidateFromEncoded('${encodedBallId}', true)">
              Dry Run Assign
            </button>
            <button class="danger" onclick="assignCandidateFromEncoded('${encodedBallId}', false)">
              Assign Real
            </button>
          </div>
        </div>
      `;
    })
    .join("");

  document.getElementById("candidateOutput").innerHTML = `
    <div class="candidate">
      <div><strong>Listing:</strong> ${escapeHtml(data.listingTitle)}</div>
      <div class="muted">${escapeHtml(data.listingUrl || "")}</div>
      <div class="muted">${escapeHtml(data.warning || "No warning.")}</div>
      <div class="row" style="margin-top: 10px">
        <button class="secondary" onclick="openCreateCatalogBallFromPreview()">
          Create Catalog Ball
        </button>
      </div>
    </div>
    ${candidates || "<p>No candidates found.</p>"}
  `;
}

function fillManualBallIdFromEncoded(encodedBallId) {
  fillManualBallId(decodeURIComponent(encodedBallId));
}

function fillManualBallId(ballId) {
  document.getElementById("manualBallId").value = ballId;
}

async function assignCandidateFromEncoded(encodedBallId, dryRun) {
  await assignCandidate(decodeURIComponent(encodedBallId), dryRun);
}

async function assignCandidate(ballId, dryRun) {
  document.getElementById("manualBallId").value = ballId;
  await manualAssign(dryRun);
}

async function manualAssign(dryRun) {
  try {
    const listingUrl = getInputValue("candidateListingUrl");
    const ballId = getInputValue("manualBallId");

    if (!listingUrl || !ballId) {
      throw new Error("Listing URL and Ball ID are required.");
    }

    if (!dryRun) {
      const confirmed = window.confirm(
        `Real manual assignment:\n\n${listingUrl}\n\nwill be assigned to:\n\n${ballId}\n\nContinue?`
      );

      if (!confirmed) {
        return;
      }
    }

    const data = await assignListingToBall(listingUrl, ballId, dryRun);
    renderJson("manualAssignOutput", data);
    scheduleDashboardSummaryRefresh();

    if (!dryRun) {
      await loadSkippedReviews();
      await loadListings();
      closeCandidatePreviewModal();
    }

    setStatus(dryRun ? "Dry run complete" : "Manual assignment complete", "ready");
  } catch (error) {
    renderJson("manualAssignOutput", { error: error.message });
    setStatus("Error", "error");
  }
}

async function loadListings(override = {}) {
  try {
    activeListingDetailId = null;

    const query = encodeQuery({
      retailerName: override.retailerName ?? getInputValue("listingRetailerName"),
      matchStatus: override.matchStatus ?? getInputValue("listingMatchStatus"),
      search: override.search ?? getInputValue("listingSearch"),
      limit: override.limit ?? getInputValue("listingLimit"),
    });

    const data = await apiGet(`/api/retailers/listings?${query}`);
    renderListings(data);
  } catch (error) {
    document.getElementById("listingTable").innerHTML = `<pre>${escapeHtml(
      error.message
    )}</pre>`;
    setStatus("Error", "error");
  }
}

function renderListings(data) {
  const rows = data.data
    .map((listing) => {
      const encodedListingId = encodeURIComponent(listing.id);

      return `
        <tr class="listing-row" data-listing-id="${escapeHtml(listing.id)}">
          <td>
            <strong>${escapeHtml(listing.listingTitle)}</strong><br />
            <span class="muted">${escapeHtml(listing.id)}</span><br />
            <a href="${escapeHtml(listing.listingUrl)}" target="_blank" rel="noreferrer">
              Open listing
            </a>
          </td>
          <td>
            ${escapeHtml(listing.ball?.canonicalName || listing.ballId)}<br />
            <span class="muted">${escapeHtml(listing.ball?.brand || "")}</span>
          </td>
          <td>$${escapeHtml(listing.currentPrice)}</td>
          <td><span class="pill">${escapeHtml(listing.stockStatus)}</span></td>
          <td><span class="pill">${escapeHtml(listing.matchStatus)}</span></td>
          <td>
            <button
              class="detail-toggle"
              data-listing-id="${escapeHtml(listing.id)}"
              onclick="toggleListingDetailFromEncoded('${encodedListingId}')"
            >
              Detail
            </button>
          </td>
        </tr>
      `;
    })
    .join("");

  document.getElementById("listingTable").innerHTML = `
    <div class="muted listing-summary">Showing ${escapeHtml(data.count)} listings.</div>
    <table class="listing-table">
      <colgroup>
        <col />
        <col />
        <col />
        <col />
        <col />
        <col />
      </colgroup>
      <thead>
        <tr>
          <th>Listing</th>
          <th>Ball</th>
          <th>Price</th>
          <th>Stock</th>
          <th>Match</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>${rows || `<tr><td colspan="6">No listings found.</td></tr>`}</tbody>
    </table>
  `;
}

function removeActiveListingDetail() {
  document.querySelectorAll(".listing-detail-row").forEach((row) => row.remove());

  document.querySelectorAll(".detail-toggle").forEach((button) => {
    button.textContent = "Detail";
  });

  activeListingDetailId = null;
}

async function toggleListingDetailFromEncoded(encodedListingId) {
  await toggleListingDetail(decodeURIComponent(encodedListingId));
}

async function toggleListingDetail(listingId) {
  try {
    if (activeListingDetailId === listingId) {
      removeActiveListingDetail();
      return;
    }

    removeActiveListingDetail();

    const sourceRow = document.querySelector(
      `tr.listing-row[data-listing-id="${CSS.escape(listingId)}"]`
    );

    const button = document.querySelector(
      `.detail-toggle[data-listing-id="${CSS.escape(listingId)}"]`
    );

    if (!sourceRow) {
      throw new Error("Could not find listing row.");
    }

    if (button) {
      button.textContent = "Close";
    }

    activeListingDetailId = listingId;

    const detailRow = document.createElement("tr");
    detailRow.className = "listing-detail-row";
    detailRow.innerHTML = `
      <td colspan="6">
        <div class="inline-detail">Loading listing detail...</div>
      </td>
    `;

    sourceRow.insertAdjacentElement("afterend", detailRow);

    const data = await apiGet(`/api/retailers/listings/${encodeURIComponent(listingId)}`);
    detailRow.querySelector(".inline-detail").textContent = JSON.stringify(data, null, 2);
  } catch (error) {
    setStatus("Error", "error");

    const detailRow = document.querySelector(".listing-detail-row .inline-detail");

    if (detailRow) {
      detailRow.textContent = JSON.stringify({ error: error.message }, null, 2);
    }
  }
}


function setupEnterKeyRefreshes() {
  const bindings = [
    {
      inputIds: [
        "catalogBallSearch",
        "catalogBallBrandFilter",
        "catalogBallManufacturerFilter",
        "catalogBallLimit",
      ],
      buttonId: "loadCatalogBallsBtn",
    },
    {
      inputIds: [
        "listingSearch",
        "listingRetailerName",
        "listingLimit",
      ],
      buttonId: "loadListingsBtn",
    },
    {
      inputIds: [
        "trackedRetailerNameFilter",
      ],
      buttonId: "loadTrackedSourcesBtn",
    },
    {
      inputIds: [
        "candidateListingUrl",
      ],
      buttonId: "previewCandidatesBtn",
    },
  ];

  bindings.forEach((binding) => {
    const button = document.getElementById(binding.buttonId);

    if (!button) {
      return;
    }

    binding.inputIds.forEach((inputId) => {
      const input = document.getElementById(inputId);

      if (!input) {
        return;
      }

      input.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") {
          return;
        }

        event.preventDefault();
        button.click();
      });
    });
  });
}

setupEnterKeyRefreshes();
setupInfoButtons();
setupNavJumps();
setupScrapeOutputModal();
setupCandidatePreviewModal();
setupCatalogBallModal();

document
  .getElementById("runCategoryScrapeBtn")
  .addEventListener("click", runCategoryScrape);

document
  .getElementById("saveTrackedSourceBtn")
  .addEventListener("click", saveTrackedSource);

document
  .getElementById("clearTrackedSourceFormBtn")
  .addEventListener("click", clearTrackedSourceForm);

document
  .getElementById("loadTrackedSourcesBtn")
  .addEventListener("click", loadTrackedSources);

document
  .getElementById("seedTrackedSourcesBtn")
  .addEventListener("click", seedTrackedSources);

document
  .getElementById("loadCatalogBallsBtn")
  .addEventListener("click", loadCatalogBalls);

document
  .getElementById("newCatalogBallBtn")
  .addEventListener("click", openNewCatalogBallModal);

document
  .getElementById("loadSkippedBtn")
  .addEventListener("click", loadSkippedReviews);

document
  .getElementById("previewCandidatesBtn")
  .addEventListener("click", previewCandidates);

document
  .getElementById("manualDryRunBtn")
  .addEventListener("click", () => manualAssign(true));

document
  .getElementById("manualAssignBtn")
  .addEventListener("click", () => manualAssign(false));

document
  .getElementById("createCatalogBallBtn")
  .addEventListener("click", () => createCatalogBall(false));

document
  .getElementById("createAndAssignCatalogBallBtn")
  .addEventListener("click", () => createCatalogBall(true));

document
  .getElementById("loadListingsBtn")
  .addEventListener("click", () => loadListings());

document.getElementById("loadManualListingsBtn").addEventListener("click", () => {
  document.getElementById("listingMatchStatus").value = "manually_matched";
  loadListings({ matchStatus: "manually_matched" });
});

loadDashboardSummary();
loadTrackedSources();
loadCatalogBalls();
loadSkippedReviews();
loadListings();
(function setupManufacturerSourceControllerSafeV2() {
  if (window.__manufacturerSourceControllerSafeV2) {
    return;
  }

  window.__manufacturerSourceControllerSafeV2 = true;

  const requiredIds = [
    "manufacturerSourceName",
    "manufacturerSourceManufacturerName",
    "manufacturerSourceKind",
    "manufacturerSourceParserKey",
    "manufacturerSourceUrl",
  ];

  let manufacturerSourcesCache = [];

  function el(id) {
    return document.getElementById(id);
  }

  function val(id) {
    return el(id)?.value?.trim() ?? "";
  }

  function setVal(id, value) {
    const element = el(id);
    if (element) element.value = value ?? "";
  }

  function q(params) {
    const query = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        query.set(key, value);
      }
    });

    return query.toString();
  }

  async function request(path) {
    if (typeof setStatus === "function") setStatus("Loading", "loading");

    const response = await fetch(path);
    const json = await response.json();

    if (!response.ok) {
      if (typeof setStatus === "function") setStatus("Error", "error");
      throw new Error(json.details || json.error || "Request failed");
    }

    if (typeof setStatus === "function") setStatus("Ready", "ready");
    return json.data;
  }

  function escapeLocal(value) {
    if (typeof escapeHtml === "function") return escapeHtml(value);

    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function summary(message) {
    const box = el("manufacturerSourcesSummary");
    if (box) box.textContent = message;
  }

  function clearTint(id) {
    const input = el(id);
    if (input && input.value.trim()) {
      input.classList.remove("required-empty");
    }
  }

  function markRequired() {
    let valid = true;

    requiredIds.forEach((id) => {
      const input = el(id);
      if (!input) return;

      const missing = !input.value.trim();
      input.classList.toggle("required-empty", missing);

      if (missing) valid = false;
    });

    return valid;
  }

  window.clearManufacturerSourceForm = function () {
    setVal("manufacturerSourceName", "");
    setVal("manufacturerSourceManufacturerName", "");
    setVal("manufacturerSourceBrandName", "");
    setVal("manufacturerSourceKind", "catalog");
    setVal("manufacturerSourceParserKey", "motiv");
    setVal("manufacturerSourceUrl", "");
    setVal("manufacturerSourceEnabled", "true");
    setVal("manufacturerSourceMaxPages", "1");
    setVal("manufacturerSourceMaxProducts", "50");
    setVal("manufacturerSourceScrapeDelayMs", "750");

    requiredIds.forEach((id) => el(id)?.classList.remove("required-empty"));
    summary("Manufacturer source form cleared.");
  };

  window.saveManufacturerSource = async function () {
    try {
      if (!markRequired()) {
        summary("Fill in the required fields marked with *.");
        if (typeof setStatus === "function") setStatus("Missing required fields", "error");
        return;
      }

      const query = q({
        name: val("manufacturerSourceName"),
        manufacturerName: val("manufacturerSourceManufacturerName"),
        brandName: val("manufacturerSourceBrandName"),
        sourceKind: val("manufacturerSourceKind"),
        parserKey: val("manufacturerSourceParserKey"),
        url: val("manufacturerSourceUrl"),
        enabled: val("manufacturerSourceEnabled"),
        maxPages: val("manufacturerSourceMaxPages"),
        maxProducts: val("manufacturerSourceMaxProducts"),
        scrapeDelayMs: val("manufacturerSourceScrapeDelayMs"),
      });

      const data = await request(`/api/tracked-manufacturer-sources/upsert?${query}`);

      summary(`${data.action === "created" ? "Created" : "Updated"} manufacturer source: ${data.data?.name ?? val("manufacturerSourceName")}.`);

      await window.loadManufacturerSources();
    } catch (error) {
      summary(`Save manufacturer source error: ${error.message}`);
      if (typeof setStatus === "function") setStatus("Error", "error");
    }
  };

  window.loadManufacturerSources = async function () {
    try {
      const query = q({
        manufacturerName: val("manufacturerSourceManufacturerFilter"),
        brandName: val("manufacturerSourceBrandFilter"),
        sourceKind: val("manufacturerSourceKindFilter"),
        parserKey: val("manufacturerSourceParserKeyFilter"),
        enabled: val("manufacturerSourceEnabledFilter"),
      });

      const data = await request(`/api/tracked-manufacturer-sources?${query}`);
      window.renderManufacturerSources(data);
    } catch (error) {
      const table = el("manufacturerSourcesTable");
      if (table) table.innerHTML = `<pre>${escapeLocal(error.message)}</pre>`;

      summary(`Load manufacturer sources error: ${error.message}`);
      if (typeof setStatus === "function") setStatus("Error", "error");
    }
  };

  window.editManufacturerSourceFromEncoded = function (encodedSourceId) {
    const sourceId = decodeURIComponent(encodedSourceId);
    const source = manufacturerSourcesCache.find((item) => item.id === sourceId);

    if (!source) {
      summary(`Could not find manufacturer source: ${sourceId}`);
      return;
    }

    setVal("manufacturerSourceName", source.name ?? "");
    setVal("manufacturerSourceManufacturerName", source.manufacturerName ?? "");
    setVal("manufacturerSourceBrandName", source.brandName ?? "");
    setVal("manufacturerSourceKind", source.sourceKind ?? "catalog");
    setVal("manufacturerSourceParserKey", source.parserKey ?? "generic");
    setVal("manufacturerSourceUrl", source.url ?? "");
    setVal("manufacturerSourceEnabled", String(source.enabled));
    setVal("manufacturerSourceMaxPages", source.maxPages ?? 1);
    setVal("manufacturerSourceMaxProducts", source.maxProducts ?? 50);
    setVal("manufacturerSourceScrapeDelayMs", source.scrapeDelayMs ?? 750);

    requiredIds.forEach(clearTint);
    summary(`Editing manufacturer source: ${source.name}.`);
  };

  window.setManufacturerSourceEnabledFromEncoded = async function (encodedSourceId, enabledValue) {
    try {
      const sourceId = decodeURIComponent(encodedSourceId);
      const enabled = enabledValue === "true";

      const data = await request(
        `/api/tracked-manufacturer-sources/set-enabled?id=${encodeURIComponent(sourceId)}&enabled=${enabled}`
      );

      summary(`${data.data?.name ?? "Manufacturer source"} set to ${enabled ? "enabled" : "disabled"}.`);
      await window.loadManufacturerSources();
    } catch (error) {
      summary(`Enable/disable manufacturer source error: ${error.message}`);
      if (typeof setStatus === "function") setStatus("Error", "error");
    }
  };

  window.renderManufacturerSources = function (data) {
    manufacturerSourcesCache = data.data ?? [];
    summary(`Showing ${data.count ?? 0} manufacturer sources.`);

    const rows = manufacturerSourcesCache
      .map((source) => {
        const encodedSourceId = encodeURIComponent(source.id);
        const enabledClass = source.enabled ? "enabled" : "disabled";
        const enabledText = source.enabled ? "enabled" : "disabled";
        const toggleText = source.enabled ? "Disable" : "Enable";
        const nextEnabled = source.enabled ? "false" : "true";

        return `
          <tr class="listing-row">
            <td>
              <strong>${escapeLocal(source.name)}</strong><br />
              <span class="muted">${escapeLocal(source.id)}</span>
            </td>
            <td class="cell-url">
              <a href="${escapeLocal(source.url)}" target="_blank" rel="noreferrer">${escapeLocal(source.url)}</a>
              <br />
              <span class="muted">${escapeLocal(source.manufacturerName)} • ${escapeLocal(source.brandName || "all brands")}</span>
            </td>
            <td>
              <span class="muted">${escapeLocal(source.sourceKind)} • parser ${escapeLocal(source.parserKey)}</span><br />
              <span class="muted">pages ${escapeLocal(source.maxPages ?? "—")} • products ${escapeLocal(source.maxProducts ?? "—")} • delay ${escapeLocal(source.scrapeDelayMs ?? "—")}ms</span>
            </td>
            <td><span class="pill ${enabledClass}">${enabledText}</span></td>
            <td>
              <div class="cell-actions">
                <button class="secondary" onclick="editManufacturerSourceFromEncoded('${encodedSourceId}')">Edit</button>
                <button class="${source.enabled ? "danger" : "secondary"}" onclick="setManufacturerSourceEnabledFromEncoded('${encodedSourceId}', '${nextEnabled}')">${toggleText}</button>
              </div>
            </td>
          </tr>
        `;
      })
      .join("");

    const table = el("manufacturerSourcesTable");
    if (table) {
      table.innerHTML = `
        <table class="source-table">
          <colgroup><col /><col /><col /><col /><col /></colgroup>
          <thead>
            <tr>
              <th>Source</th>
              <th>URL</th>
              <th>Config</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>${rows || `<tr><td colspan="5">No manufacturer sources found.</td></tr>`}</tbody>
        </table>
      `;
    }
  };

  function bindButton(id, handler) {
    const button = el(id);
    if (!button || button.dataset.safeBoundV2 === "true") return;

    button.dataset.safeBoundV2 = "true";
    button.addEventListener("click", (event) => {
      event.preventDefault();
      handler();
    });
  }

  bindButton("saveManufacturerSourceBtn", window.saveManufacturerSource);
  bindButton("clearManufacturerSourceFormBtn", window.clearManufacturerSourceForm);
  bindButton("loadManufacturerSourcesBtn", window.loadManufacturerSources);

  requiredIds.forEach((id) => {
    const input = el(id);
    if (!input || input.dataset.requiredTintBoundV2 === "true") return;

    input.dataset.requiredTintBoundV2 = "true";
    input.addEventListener("input", () => clearTint(id));
    input.addEventListener("change", () => clearTint(id));
  });
})();

(function setupManufacturerSourceRunButtonV1() {
  if (window.__manufacturerSourceRunButtonV1) return;
  window.__manufacturerSourceRunButtonV1 = true;

  function el(id) {
    return document.getElementById(id);
  }

  function escapeLocal(value) {
    if (typeof escapeHtml === "function") return escapeHtml(value);

    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function setManufacturerSummary(message) {
    const summary = el("manufacturerSourcesSummary");
    if (summary) summary.textContent = message;
  }

  async function runManufacturerSource(sourceId) {
    try {
      if (typeof setStatus === "function") setStatus("Running manufacturer source", "loading");

      setManufacturerSummary("Running manufacturer source sync...");

      const response = await fetch(
        `/api/tracked-manufacturer-sources/run?id=${encodeURIComponent(sourceId)}`
      );

      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.details || json.error || "Run failed");
      }

      const result = json.data?.result;
      const discovered = result?.discoveredCount ?? result?.itemsFound ?? 0;
      const parsed = result?.parsedCount ?? 0;
      const created = result?.itemsCreated ?? 0;
      const updated = result?.itemsUpdated ?? 0;
      const removed = result?.itemsRemoved ?? 0;
      const failed = result?.failureCount ?? 0;

      setManufacturerSummary(
        `Manufacturer sync finished. Discovered ${discovered}, parsed ${parsed}, created ${created}, updated ${updated}, removed ${removed}, failures ${failed}.`
      );

      if (typeof loadCatalogBalls === "function") {
        await loadCatalogBalls();
      }

      if (typeof setStatus === "function") setStatus("Manufacturer sync complete", "ready");
    } catch (error) {
      setManufacturerSummary(`Manufacturer sync error: ${error.message}`);
      if (typeof setStatus === "function") setStatus("Error", "error");
    }
  }

  window.runManufacturerSourceFromEncoded = function (encodedSourceId) {
    runManufacturerSource(decodeURIComponent(encodedSourceId));
  };

  const originalRender = window.renderManufacturerSources;

  window.renderManufacturerSources = function (data) {
    originalRender(data);

    const table = el("manufacturerSourcesTable");
    if (!table) return;

    table.querySelectorAll("tbody tr").forEach((row) => {
      const editButton = row.querySelector("button.secondary");
      if (!editButton) return;

      const onclick = editButton.getAttribute("onclick") || "";
      const match = onclick.match(/editManufacturerSourceFromEncoded\('([^']+)'\)/);
      if (!match) return;

      const encodedSourceId = match[1];

      if (row.querySelector(".run-manufacturer-source-btn")) return;

      const actions = row.querySelector(".cell-actions");
      if (!actions) return;

      const runButton = document.createElement("button");
      runButton.className = "secondary run-manufacturer-source-btn";
      runButton.textContent = "Run";
      runButton.addEventListener("click", (event) => {
        event.preventDefault();
        window.runManufacturerSourceFromEncoded(encodedSourceId);
      });

      actions.insertBefore(runButton, actions.firstChild);
    });
  };
})();

(function setupRunAllManufacturerSourcesV1() {
  if (window.__runAllManufacturerSourcesV1) return;
  window.__runAllManufacturerSourcesV1 = true;

  function el(id) {
    return document.getElementById(id);
  }

  function setManufacturerSummary(message) {
    const summary = el("manufacturerSourcesSummary");
    if (summary) summary.textContent = message;
  }

  window.runAllManufacturerSources = async function () {
    try {
      if (typeof setStatus === "function") {
        setStatus("Running all manufacturer sources", "loading");
      }

      setManufacturerSummary("Running all enabled manufacturer sources...");

      const response = await fetch("/api/tracked-manufacturer-sources/run-all");
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.details || json.error || "Run all failed");
      }

      const data = json.data;
      const totals = data.results.reduce(
        (acc, item) => {
          const result = item.result ?? {};

          acc.discovered += result.discoveredCount ?? result.itemsFound ?? 0;
          acc.parsed += result.parsedCount ?? 0;
          acc.created += result.itemsCreated ?? 0;
          acc.updated += result.itemsUpdated ?? 0;
          acc.removed += result.itemsRemoved ?? 0;
          acc.failures += result.failureCount ?? 0;

          return acc;
        },
        {
          discovered: 0,
          parsed: 0,
          created: 0,
          updated: 0,
          removed: 0,
          failures: 0,
        }
      );

      setManufacturerSummary(
        `Run all complete. Sources ${data.sourceCount}, successful ${data.successfulCount}, failed ${data.failedCount}. Discovered ${totals.discovered}, parsed ${totals.parsed}, created ${totals.created}, updated ${totals.updated}, removed ${totals.removed}, parse failures ${totals.failures}.`
      );

      if (typeof loadCatalogBalls === "function") {
        await loadCatalogBalls();
      }

      if (typeof setStatus === "function") {
        setStatus("Run all manufacturer sources complete", "ready");
      }
    } catch (error) {
      setManufacturerSummary(`Run all manufacturer sources error: ${error.message}`);

      if (typeof setStatus === "function") {
        setStatus("Error", "error");
      }
    }
  };

  const button = el("runAllManufacturerSourcesBtn");

  if (button && button.dataset.runAllBound !== "true") {
    button.dataset.runAllBound = "true";
    button.addEventListener("click", (event) => {
      event.preventDefault();
      window.runAllManufacturerSources();
    });
  }
})();

(function setupDeleteManufacturerSourceV1() {
  if (window.__deleteManufacturerSourceV1) return;
  window.__deleteManufacturerSourceV1 = true;

  function el(id) {
    return document.getElementById(id);
  }

  function setManufacturerSummary(message) {
    const summary = el("manufacturerSourcesSummary");
    if (summary) summary.textContent = message;
  }

  window.deleteManufacturerSourceFromEncoded = async function (encodedSourceId) {
    const sourceId = decodeURIComponent(encodedSourceId);

    if (!confirm("Delete this disabled manufacturer source?")) {
      return;
    }

    try {
      if (typeof setStatus === "function") {
        setStatus("Deleting manufacturer source", "loading");
      }

      const response = await fetch(
        `/api/tracked-manufacturer-sources/delete?id=${encodeURIComponent(sourceId)}`
      );

      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.details || json.error || "Delete failed");
      }

      setManufacturerSummary(
        `Deleted manufacturer source: ${json.data?.deleted?.name ?? sourceId}.`
      );

      if (typeof window.loadManufacturerSources === "function") {
        await window.loadManufacturerSources();
      }

      if (typeof setStatus === "function") {
        setStatus("Manufacturer source deleted", "ready");
      }
    } catch (error) {
      setManufacturerSummary(`Delete manufacturer source error: ${error.message}`);

      if (typeof setStatus === "function") {
        setStatus("Error", "error");
      }
    }
  };

  const originalRender = window.renderManufacturerSources;

  window.renderManufacturerSources = function (data) {
    originalRender(data);

    const table = el("manufacturerSourcesTable");
    if (!table) return;

    table.querySelectorAll("tbody tr").forEach((row) => {
      const statusText = row.textContent.toLowerCase();

      if (!statusText.includes("disabled")) {
        return;
      }

      if (row.querySelector(".delete-manufacturer-source-btn")) {
        return;
      }

      const editButton = row.querySelector("button[onclick*='editManufacturerSourceFromEncoded']");
      const actions = row.querySelector(".cell-actions");

      if (!editButton || !actions) {
        return;
      }

      const onclick = editButton.getAttribute("onclick") || "";
      const match = onclick.match(/editManufacturerSourceFromEncoded\('([^']+)'\)/);

      if (!match) {
        return;
      }

      const deleteButton = document.createElement("button");
      deleteButton.className = "danger delete-manufacturer-source-btn";
      deleteButton.textContent = "Delete";
      deleteButton.addEventListener("click", (event) => {
        event.preventDefault();
        window.deleteManufacturerSourceFromEncoded(match[1]);
      });

      actions.appendChild(deleteButton);
    });
  };
})();

/* Loading + elapsed-time monitor for long admin API calls */
(function setupAdminLoadingElapsedTableV1() {
  if (window.__adminLoadingElapsedTableV1) return;
  window.__adminLoadingElapsedTableV1 = true;

  const trackedUrlPatterns = [
    /\/api\/tracked-manufacturer-sources\/run(?:\?|$)/,
    /\/api\/tracked-manufacturer-sources\/run-all(?:\?|$)/,
    /\/api\/tracked-retailer-sources\/run(?:\?|$)/,
    /\/api\/tracked-retailer-sources\/run-all(?:\?|$)/,
    /\/api\/jobs\/.*\/run(?:\?|$)/,
    /\/api\/retailers\/bowling-com\/parse-/,
    /\/api\/retailers\/cleanup-duplicates/,
  ];

  const state = {
    nextId: 1,
    rows: new Map(),
    timer: null,
    originalFetch: window.fetch.bind(window),
  };

  function ensureStyles() {
    if (document.getElementById("adminLoadingElapsedStylesV1")) return;

    const style = document.createElement("style");
    style.id = "adminLoadingElapsedStylesV1";
    style.textContent = `
      .loading-elapsed-panel {
        position: fixed;
        right: 18px;
        bottom: 18px;
        z-index: 9999;
        width: min(720px, calc(100vw - 36px));
        max-height: 45vh;
        overflow: auto;
        background: rgba(10, 16, 22, 0.96);
        border: 1px solid rgba(74, 222, 128, 0.35);
        box-shadow: 0 18px 40px rgba(0, 0, 0, 0.45);
        border-radius: 14px;
        color: #e5e7eb;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
        font-size: 12px;
      }

      .loading-elapsed-panel.hidden {
        display: none;
      }

      .loading-elapsed-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 10px 12px;
        border-bottom: 1px solid rgba(148, 163, 184, 0.25);
      }

      .loading-elapsed-title {
        color: #86efac;
        font-weight: 700;
        letter-spacing: 0.02em;
      }

      .loading-elapsed-close {
        border: 1px solid rgba(148, 163, 184, 0.35);
        background: rgba(15, 23, 42, 0.75);
        color: #e5e7eb;
        border-radius: 8px;
        padding: 4px 8px;
        cursor: pointer;
      }

      .loading-elapsed-table {
        width: 100%;
        border-collapse: collapse;
      }

      .loading-elapsed-table th,
      .loading-elapsed-table td {
        padding: 8px 10px;
        border-bottom: 1px solid rgba(148, 163, 184, 0.15);
        vertical-align: top;
        text-align: left;
      }

      .loading-elapsed-table th {
        color: #93c5fd;
        font-weight: 700;
        white-space: nowrap;
      }

      .loading-status-running {
        color: #fde68a;
      }

      .loading-status-success {
        color: #86efac;
      }

      .loading-status-error {
        color: #fca5a5;
      }

      .loading-elapsed-detail {
        color: #cbd5e1;
        max-width: 360px;
        word-break: break-word;
      }
    `;

    document.head.appendChild(style);
  }

  function ensurePanel() {
    ensureStyles();

    let panel = document.getElementById("adminLoadingElapsedPanelV1");
    if (panel) return panel;

    panel = document.createElement("div");
    panel.id = "adminLoadingElapsedPanelV1";
    panel.className = "loading-elapsed-panel hidden";
    panel.innerHTML = `
      <div class="loading-elapsed-header">
        <div class="loading-elapsed-title">loading / elapsed</div>
        <button type="button" class="loading-elapsed-close" id="adminLoadingElapsedCloseV1">close</button>
      </div>
      <table class="loading-elapsed-table">
        <thead>
          <tr>
            <th>task</th>
            <th>status</th>
            <th>elapsed</th>
            <th>details</th>
          </tr>
        </thead>
        <tbody id="adminLoadingElapsedBodyV1"></tbody>
      </table>
    `;

    document.body.appendChild(panel);

    const closeBtn = document.getElementById("adminLoadingElapsedCloseV1");
    closeBtn?.addEventListener("click", () => {
      panel.classList.add("hidden");
    });

    return panel;
  }

  function getUrl(input) {
    if (typeof input === "string") return input;
    if (input instanceof URL) return input.toString();
    if (input && typeof input.url === "string") return input.url;
    return "";
  }

  function shouldTrack(url) {
    return trackedUrlPatterns.some((pattern) => pattern.test(url));
  }

  function labelForUrl(url) {
    try {
      const parsed = new URL(url, window.location.origin);
      const path = parsed.pathname;

      if (path.includes("/tracked-manufacturer-sources/run-all")) {
        return "manufacturer run-all";
      }

      if (path.includes("/tracked-manufacturer-sources/run")) {
        return "manufacturer source run";
      }

      if (path.includes("/tracked-retailer-sources/run-all")) {
        return "retailer run-all";
      }

      if (path.includes("/tracked-retailer-sources/run")) {
        return "retailer source run";
      }

      if (path.includes("/jobs/")) {
        return path.replace("/api/jobs/", "job: ");
      }

      if (path.includes("/bowling-com/parse-category")) {
        return "bowling.com category parse";
      }

      if (path.includes("/bowling-com/parse-product")) {
        return "bowling.com product parse";
      }

      return path.replace(/^\/api\//, "");
    } catch {
      return url;
    }
  }

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

  function render() {
    const panel = ensurePanel();
    const body = document.getElementById("adminLoadingElapsedBodyV1");
    if (!body) return;

    const rows = Array.from(state.rows.values()).sort((a, b) => b.startedAt - a.startedAt);

    body.innerHTML = rows
      .map((row) => {
        const elapsed = row.finishedAt
          ? row.finishedAt - row.startedAt
          : Date.now() - row.startedAt;

        const statusClass =
          row.status === "success"
            ? "loading-status-success"
            : row.status === "error"
              ? "loading-status-error"
              : "loading-status-running";

        return `
          <tr>
            <td>${escapeHtml(row.label)}</td>
            <td class="${statusClass}">${escapeHtml(row.status)}</td>
            <td>${formatElapsed(elapsed)}</td>
            <td class="loading-elapsed-detail">${escapeHtml(row.detail ?? "")}</td>
          </tr>
        `;
      })
      .join("");

    if (rows.length > 0) {
      panel.classList.remove("hidden");
    }
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function startTimer() {
    if (state.timer) return;

    state.timer = window.setInterval(() => {
      const hasRunning = Array.from(state.rows.values()).some((row) => !row.finishedAt);
      render();

      if (!hasRunning) {
        window.clearInterval(state.timer);
        state.timer = null;
      }
    }, 500);
  }

  function addRow(url) {
    const id = state.nextId++;
    state.rows.set(id, {
      id,
      label: labelForUrl(url),
      status: "running",
      detail: "waiting for response...",
      startedAt: Date.now(),
      finishedAt: null,
    });

    render();
    startTimer();
    return id;
  }

  function updateRow(id, patch) {
    const row = state.rows.get(id);
    if (!row) return;
    state.rows.set(id, { ...row, ...patch });
    render();
  }

  window.fetch = async function adminLoadingFetch(input, init) {
    const url = getUrl(input);
    const track = shouldTrack(url);
    const rowId = track ? addRow(url) : null;

    try {
      const response = await state.originalFetch(input, init);

      if (track && rowId != null) {
        const finishedAt = Date.now();

        if (!response.ok) {
          updateRow(rowId, {
            status: "error",
            detail: `HTTP ${response.status}`,
            finishedAt,
          });
        } else {
          response
            .clone()
            .json()
            .then((json) => {
              updateRow(rowId, {
                status: "success",
                detail: summarizeJson(json),
                finishedAt,
              });
            })
            .catch(() => {
              updateRow(rowId, {
                status: "success",
                detail: `HTTP ${response.status}`,
                finishedAt,
              });
            });
        }
      }

      return response;
    } catch (error) {
      if (track && rowId != null) {
        updateRow(rowId, {
          status: "error",
          detail: error instanceof Error ? error.message : "request failed",
          finishedAt: Date.now(),
        });
      }

      throw error;
    }
  };
})();


(function setupTrackedRetailerRunAllButtonV1() {
  function bind() {
    const btn = document.getElementById("runAllTrackedSourcesBtn");

    if (!btn || btn.dataset.boundRunAll === "true") {
      return;
    }

    btn.dataset.boundRunAll = "true";
    btn.addEventListener("click", runAllTrackedSources);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bind);
  } else {
    bind();
  }
})();

/* Add Delete buttons for disabled tracked retailer sources */
(function setupTrackedRetailerDeleteButtonV1() {
  if (window.__trackedRetailerDeleteButtonV1) return;
  window.__trackedRetailerDeleteButtonV1 = true;

  const originalRenderTrackedSources = window.renderTrackedSources || renderTrackedSources;

  window.renderTrackedSources = function patchedRenderTrackedSources(data) {
    originalRenderTrackedSources(data);

    const rows = document.querySelectorAll("#trackedSourcesTable tbody tr");

    rows.forEach((row) => {
      const idText = row.querySelector(".muted")?.textContent?.trim();

      if (!idText || row.querySelector(".delete-retailer-source-btn")) {
        return;
      }

      const statusText = row.querySelector(".pill")?.textContent?.trim().toLowerCase();

      if (statusText !== "disabled") {
        return;
      }

      const actions = row.querySelector(".cell-actions");

      if (!actions) {
        return;
      }

      const button = document.createElement("button");
      button.className = "danger delete-retailer-source-btn";
      button.textContent = "Delete";
      button.addEventListener("click", () => {
        deleteTrackedSource(idText);
      });

      actions.appendChild(button);
    });
  };
})();

/* Popup editor for tracked retailer sources */
(function setupTrackedRetailerSourceEditModalV1() {
  if (window.__trackedRetailerSourceEditModalV1) return;
  window.__trackedRetailerSourceEditModalV1 = true;

  function ensureModalStyles() {
    if (document.getElementById("trackedRetailerEditModalStylesV1")) return;

    const style = document.createElement("style");
    style.id = "trackedRetailerEditModalStylesV1";
    style.textContent = `
      .tracked-source-edit-backdrop {
        position: fixed;
        inset: 0;
        z-index: 10000;
        background: rgba(15, 23, 42, 0.55);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
      }

      .tracked-source-edit-backdrop.hidden {
        display: none;
      }

      .tracked-source-edit-modal {
        width: min(860px, 100%);
        max-height: 90vh;
        overflow: auto;
        background: #ffffff;
        color: #172033;
        border: 1px solid #cbd5e1;
        border-radius: 18px;
        box-shadow: 0 24px 60px rgba(15, 23, 42, 0.35);
      }

      .tracked-source-edit-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        padding: 18px 22px;
        border-bottom: 1px solid #e2e8f0;
      }

      .tracked-source-edit-head h3 {
        margin: 0;
        font-size: 18px;
      }

      .tracked-source-edit-body {
        padding: 20px 22px;
      }

      .tracked-source-edit-actions {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
        padding: 16px 22px 22px;
      }

      .tracked-source-edit-note {
        margin-bottom: 14px;
        color: #475569;
        font-size: 13px;
      }
    `;

    document.head.appendChild(style);
  }

  function ensureModal() {
    ensureModalStyles();

    let modal = document.getElementById("trackedRetailerEditModalV1");
    if (modal) return modal;

    modal = document.createElement("div");
    modal.id = "trackedRetailerEditModalV1";
    modal.className = "tracked-source-edit-backdrop hidden";
    modal.innerHTML = `
      <div class="tracked-source-edit-modal" role="dialog" aria-modal="true">
        <div class="tracked-source-edit-head">
          <h3>Edit Retailer Source</h3>
          <button type="button" class="secondary" id="trackedRetailerEditCloseBtnV1">Close</button>
        </div>

        <div class="tracked-source-edit-body">
          <div class="tracked-source-edit-note" id="trackedRetailerEditNoteV1">
            Edit this saved retailer source without changing the add-source form.
          </div>

          <input id="trackedRetailerEditOriginalIdV1" type="hidden" />

          <div class="grid grid-3">
            <div>
              <label for="trackedRetailerEditNameV1">Source Name</label>
              <input id="trackedRetailerEditNameV1" />
            </div>
            <div>
              <label for="trackedRetailerEditRetailerNameV1">Retailer Name</label>
              <input id="trackedRetailerEditRetailerNameV1" />
            </div>
            <div>
              <label for="trackedRetailerEditKindV1">Source Kind</label>
              <select id="trackedRetailerEditKindV1">
                <option value="category">category</option>
                <option value="product">product</option>
              </select>
            </div>
            <div>
              <label for="trackedRetailerEditEnabledV1">Enabled</label>
              <select id="trackedRetailerEditEnabledV1">
                <option value="true">true</option>
                <option value="false">false</option>
              </select>
            </div>
            <div>
              <label for="trackedRetailerEditAllowLikelyV1">Allow Likely Match</label>
              <select id="trackedRetailerEditAllowLikelyV1">
                <option value="true">true</option>
                <option value="false">false</option>
              </select>
            </div>
            <div>
              <label for="trackedRetailerEditDelayV1">Scrape Delay Ms</label>
              <input id="trackedRetailerEditDelayV1" type="number" min="0" />
            </div>
            <div>
              <label for="trackedRetailerEditMaxPagesV1">Max Pages</label>
              <input id="trackedRetailerEditMaxPagesV1" type="number" min="0" />
            </div>
            <div>
              <label for="trackedRetailerEditMaxProductsV1">Max Products</label>
              <input id="trackedRetailerEditMaxProductsV1" type="number" min="0" />
            </div>
            <div>
              <label for="trackedRetailerEditUrlV1">URL</label>
              <input id="trackedRetailerEditUrlV1" />
            </div>
          </div>
        </div>

        <div class="tracked-source-edit-actions">
          <button type="button" class="secondary" id="trackedRetailerEditCancelBtnV1">Cancel</button>
          <button type="button" id="trackedRetailerEditSaveBtnV1">Save Changes</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    document.getElementById("trackedRetailerEditCloseBtnV1")?.addEventListener("click", closeTrackedRetailerEditModal);
    document.getElementById("trackedRetailerEditCancelBtnV1")?.addEventListener("click", closeTrackedRetailerEditModal);
    document.getElementById("trackedRetailerEditSaveBtnV1")?.addEventListener("click", saveTrackedRetailerEditModal);

    modal.addEventListener("click", (event) => {
      if (event.target === modal) {
        closeTrackedRetailerEditModal();
      }
    });

    return modal;
  }

  function getModalValue(id) {
    return document.getElementById(id)?.value?.trim() ?? "";
  }

  function setModalValue(id, value) {
    const input = document.getElementById(id);
    if (input) input.value = value ?? "";
  }

  function closeTrackedRetailerEditModal() {
    ensureModal().classList.add("hidden");
  }

  async function saveTrackedRetailerEditModal() {
    try {
      const name = getModalValue("trackedRetailerEditNameV1");
      const retailerName = getModalValue("trackedRetailerEditRetailerNameV1");
      const sourceKind = getModalValue("trackedRetailerEditKindV1");
      const url = getModalValue("trackedRetailerEditUrlV1");

      if (!name || !retailerName || !sourceKind || !url) {
        throw new Error("Source name, retailer name, source kind, and URL are required.");
      }

      const query = encodeQuery({
        name,
        retailerName,
        sourceKind,
        url,
        enabled: getModalValue("trackedRetailerEditEnabledV1"),
        maxPages: getModalValue("trackedRetailerEditMaxPagesV1"),
        maxProducts: getModalValue("trackedRetailerEditMaxProductsV1"),
        scrapeDelayMs: getModalValue("trackedRetailerEditDelayV1"),
        allowLikelyMatch: getModalValue("trackedRetailerEditAllowLikelyV1"),
      });

      const data = await apiGet(`/api/tracked-retailer-sources/upsert?${query}`);

      const summary = document.getElementById("trackedSourcesSummary");
      if (summary) {
        summary.textContent = `Updated tracked source: ${data.data?.name ?? name}.`;
      }

      closeTrackedRetailerEditModal();
      await loadTrackedSources();
      setStatus("Source saved", "ready");
    } catch (error) {
      const note = document.getElementById("trackedRetailerEditNoteV1");
      if (note) {
        note.textContent = `Edit error: ${error.message}`;
      }

      setStatus("Error", "error");
    }
  }

  function openTrackedRetailerEditModal(sourceId) {
    const source = getTrackedSourceById(sourceId);

    if (!source) {
      setStatus("Error", "error");
      return;
    }

    ensureModal();

    setModalValue("trackedRetailerEditOriginalIdV1", source.id);
    setModalValue("trackedRetailerEditNameV1", source.name ?? "");
    setModalValue("trackedRetailerEditRetailerNameV1", source.retailerName ?? "bowling.com");
    setModalValue("trackedRetailerEditKindV1", source.sourceKind ?? "category");
    setModalValue("trackedRetailerEditEnabledV1", String(source.enabled));
    setModalValue("trackedRetailerEditAllowLikelyV1", String(source.allowLikelyMatch));
    setModalValue("trackedRetailerEditDelayV1", source.scrapeDelayMs ?? 750);
    setModalValue("trackedRetailerEditMaxPagesV1", source.maxPages ?? 1);
    setModalValue("trackedRetailerEditMaxProductsV1", source.maxProducts ?? 5);
    setModalValue("trackedRetailerEditUrlV1", source.url ?? "");

    const note = document.getElementById("trackedRetailerEditNoteV1");
    if (note) {
      note.textContent = `Editing: ${source.name}`;
    }

    ensureModal().classList.remove("hidden");
  }

  window.editTrackedSource = openTrackedRetailerEditModal;
  window.editTrackedSourceFromEncoded = function editTrackedSourceFromEncodedModal(encodedSourceId) {
    openTrackedRetailerEditModal(decodeURIComponent(encodedSourceId));
  };
})();

/* Popup editor for tracked manufacturer sources */
(function setupTrackedManufacturerSourceEditModalV1() {
  if (window.__trackedManufacturerSourceEditModalV1) return;
  window.__trackedManufacturerSourceEditModalV1 = true;

  function ensureModalStyles() {
    if (document.getElementById("trackedManufacturerEditModalStylesV1")) return;

    const style = document.createElement("style");
    style.id = "trackedManufacturerEditModalStylesV1";
    style.textContent = `
      .manufacturer-source-edit-backdrop {
        position: fixed;
        inset: 0;
        z-index: 10000;
        background: rgba(15, 23, 42, 0.55);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
      }

      .manufacturer-source-edit-backdrop.hidden {
        display: none;
      }

      .manufacturer-source-edit-modal {
        width: min(920px, 100%);
        max-height: 90vh;
        overflow: auto;
        background: #ffffff;
        color: #172033;
        border: 1px solid #cbd5e1;
        border-radius: 18px;
        box-shadow: 0 24px 60px rgba(15, 23, 42, 0.35);
      }

      .manufacturer-source-edit-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        padding: 18px 22px;
        border-bottom: 1px solid #e2e8f0;
      }

      .manufacturer-source-edit-head h3 {
        margin: 0;
        font-size: 18px;
      }

      .manufacturer-source-edit-body {
        padding: 20px 22px;
      }

      .manufacturer-source-edit-actions {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
        padding: 16px 22px 22px;
      }

      .manufacturer-source-edit-note {
        margin-bottom: 14px;
        color: #475569;
        font-size: 13px;
      }
    `;

    document.head.appendChild(style);
  }

  function ensureModal() {
    ensureModalStyles();

    let modal = document.getElementById("trackedManufacturerEditModalV1");
    if (modal) return modal;

    modal = document.createElement("div");
    modal.id = "trackedManufacturerEditModalV1";
    modal.className = "manufacturer-source-edit-backdrop hidden";
    modal.innerHTML = `
      <div class="manufacturer-source-edit-modal" role="dialog" aria-modal="true">
        <div class="manufacturer-source-edit-head">
          <h3>Edit Manufacturer Source</h3>
          <button type="button" class="secondary" id="trackedManufacturerEditCloseBtnV1">Close</button>
        </div>

        <div class="manufacturer-source-edit-body">
          <div class="manufacturer-source-edit-note" id="trackedManufacturerEditNoteV1">
            Edit this saved manufacturer source without changing the add-source form.
          </div>

          <input id="trackedManufacturerEditOriginalIdV1" type="hidden" />

          <div class="grid grid-3">
            <div>
              <label for="trackedManufacturerEditNameV1">Source Name</label>
              <input id="trackedManufacturerEditNameV1" />
            </div>
            <div>
              <label for="trackedManufacturerEditManufacturerNameV1">Manufacturer Name</label>
              <input id="trackedManufacturerEditManufacturerNameV1" />
            </div>
            <div>
              <label for="trackedManufacturerEditBrandNameV1">Brand Name</label>
              <input id="trackedManufacturerEditBrandNameV1" />
            </div>
            <div>
              <label for="trackedManufacturerEditKindV1">Source Kind</label>
              <select id="trackedManufacturerEditKindV1">
                <option value="catalog">catalog</option>
                <option value="lineup">lineup</option>
                <option value="product">product</option>
              </select>
            </div>
            <div>
              <label for="trackedManufacturerEditParserKeyV1">Parser Key</label>
              <select id="trackedManufacturerEditParserKeyV1">
                <option value="motiv">motiv</option>
                <option value="storm">storm</option>
                <option value="roto-grip">roto-grip</option>
                <option value="900-global">900-global</option>
                <option value="brunswick">brunswick</option>
                <option value="radical">radical</option>
                <option value="dv8">dv8</option>
                <option value="hammer">hammer</option>
                <option value="ebonite">ebonite</option>
                <option value="track">track</option>
                <option value="generic">generic</option>
              </select>
            </div>
            <div>
              <label for="trackedManufacturerEditEnabledV1">Enabled</label>
              <select id="trackedManufacturerEditEnabledV1">
                <option value="true">true</option>
                <option value="false">false</option>
              </select>
            </div>
            <div>
              <label for="trackedManufacturerEditMaxPagesV1">Max Pages</label>
              <input id="trackedManufacturerEditMaxPagesV1" type="number" min="0" />
            </div>
            <div>
              <label for="trackedManufacturerEditMaxProductsV1">Max Products</label>
              <input id="trackedManufacturerEditMaxProductsV1" type="number" min="0" />
            </div>
            <div>
              <label for="trackedManufacturerEditDelayV1">Scrape Delay Ms</label>
              <input id="trackedManufacturerEditDelayV1" type="number" min="0" />
            </div>
            <div style="grid-column: 1 / -1">
              <label for="trackedManufacturerEditUrlV1">Official Source URL</label>
              <input id="trackedManufacturerEditUrlV1" />
            </div>
          </div>
        </div>

        <div class="manufacturer-source-edit-actions">
          <button type="button" class="secondary" id="trackedManufacturerEditCancelBtnV1">Cancel</button>
          <button type="button" id="trackedManufacturerEditSaveBtnV1">Save Changes</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    document.getElementById("trackedManufacturerEditCloseBtnV1")?.addEventListener("click", closeTrackedManufacturerEditModal);
    document.getElementById("trackedManufacturerEditCancelBtnV1")?.addEventListener("click", closeTrackedManufacturerEditModal);
    document.getElementById("trackedManufacturerEditSaveBtnV1")?.addEventListener("click", saveTrackedManufacturerEditModal);

    modal.addEventListener("click", (event) => {
      if (event.target === modal) {
        closeTrackedManufacturerEditModal();
      }
    });

    return modal;
  }

  function getModalValue(id) {
    return document.getElementById(id)?.value?.trim() ?? "";
  }

  function setModalValue(id, value) {
    const input = document.getElementById(id);
    if (input) input.value = value ?? "";
  }

  function closeTrackedManufacturerEditModal() {
    ensureModal().classList.add("hidden");
  }

  async function saveTrackedManufacturerEditModal() {
    try {
      const name = getModalValue("trackedManufacturerEditNameV1");
      const manufacturerName = getModalValue("trackedManufacturerEditManufacturerNameV1");
      const brandName = getModalValue("trackedManufacturerEditBrandNameV1");
      const sourceKind = getModalValue("trackedManufacturerEditKindV1");
      const parserKey = getModalValue("trackedManufacturerEditParserKeyV1");
      const url = getModalValue("trackedManufacturerEditUrlV1");

      if (!name || !manufacturerName || !sourceKind || !parserKey || !url) {
        throw new Error("Source name, manufacturer name, source kind, parser key, and URL are required.");
      }

      const query = encodeQuery({
        name,
        manufacturerName,
        brandName,
        sourceKind,
        parserKey,
        url,
        enabled: getModalValue("trackedManufacturerEditEnabledV1"),
        maxPages: getModalValue("trackedManufacturerEditMaxPagesV1"),
        maxProducts: getModalValue("trackedManufacturerEditMaxProductsV1"),
        scrapeDelayMs: getModalValue("trackedManufacturerEditDelayV1"),
      });

      const data = await apiGet(`/api/tracked-manufacturer-sources/upsert?${query}`);

      const summary = document.getElementById("manufacturerSourcesSummary");
      if (summary) {
        summary.textContent = `Updated manufacturer source: ${data.data?.name ?? name}.`;
      }

      closeTrackedManufacturerEditModal();
      await loadManufacturerSources();
      setStatus("Manufacturer source saved", "ready");
    } catch (error) {
      const note = document.getElementById("trackedManufacturerEditNoteV1");
      if (note) {
        note.textContent = `Edit error: ${error.message}`;
      }

      setStatus("Error", "error");
    }
  }

  function openTrackedManufacturerEditModal(sourceId) {
    const source = getManufacturerSourceById(sourceId);

    if (!source) {
      setStatus("Error", "error");
      return;
    }

    ensureModal();

    setModalValue("trackedManufacturerEditOriginalIdV1", source.id);
    setModalValue("trackedManufacturerEditNameV1", source.name ?? "");
    setModalValue("trackedManufacturerEditManufacturerNameV1", source.manufacturerName ?? "");
    setModalValue("trackedManufacturerEditBrandNameV1", source.brandName ?? "");
    setModalValue("trackedManufacturerEditKindV1", source.sourceKind ?? "catalog");
    setModalValue("trackedManufacturerEditParserKeyV1", source.parserKey ?? "motiv");
    setModalValue("trackedManufacturerEditEnabledV1", String(source.enabled));
    setModalValue("trackedManufacturerEditMaxPagesV1", source.maxPages ?? 1);
    setModalValue("trackedManufacturerEditMaxProductsV1", source.maxProducts ?? 50);
    setModalValue("trackedManufacturerEditDelayV1", source.scrapeDelayMs ?? 750);
    setModalValue("trackedManufacturerEditUrlV1", source.url ?? "");

    const note = document.getElementById("trackedManufacturerEditNoteV1");
    if (note) {
      note.textContent = `Editing: ${source.name}`;
    }

    ensureModal().classList.remove("hidden");
  }

  window.editManufacturerSource = openTrackedManufacturerEditModal;
  window.editManufacturerSourceFromEncoded = function editManufacturerSourceFromEncodedModal(encodedSourceId) {
    openTrackedManufacturerEditModal(decodeURIComponent(encodedSourceId));
  };
})();

/* Popup editor for tracked manufacturer sources */
(function setupTrackedManufacturerSourceEditModalV1() {
  if (window.__trackedManufacturerSourceEditModalV1) return;
  window.__trackedManufacturerSourceEditModalV1 = true;

  function ensureModalStyles() {
    if (document.getElementById("trackedManufacturerEditModalStylesV1")) return;

    const style = document.createElement("style");
    style.id = "trackedManufacturerEditModalStylesV1";
    style.textContent = `
      .manufacturer-source-edit-backdrop {
        position: fixed;
        inset: 0;
        z-index: 10000;
        background: rgba(15, 23, 42, 0.55);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
      }

      .manufacturer-source-edit-backdrop.hidden {
        display: none;
      }

      .manufacturer-source-edit-modal {
        width: min(920px, 100%);
        max-height: 90vh;
        overflow: auto;
        background: #ffffff;
        color: #172033;
        border: 1px solid #cbd5e1;
        border-radius: 18px;
        box-shadow: 0 24px 60px rgba(15, 23, 42, 0.35);
      }

      .manufacturer-source-edit-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        padding: 18px 22px;
        border-bottom: 1px solid #e2e8f0;
      }

      .manufacturer-source-edit-head h3 {
        margin: 0;
        font-size: 18px;
      }

      .manufacturer-source-edit-body {
        padding: 20px 22px;
      }

      .manufacturer-source-edit-actions {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
        padding: 16px 22px 22px;
      }

      .manufacturer-source-edit-note {
        margin-bottom: 14px;
        color: #475569;
        font-size: 13px;
      }
    `;

    document.head.appendChild(style);
  }

  function ensureModal() {
    ensureModalStyles();

    let modal = document.getElementById("trackedManufacturerEditModalV1");
    if (modal) return modal;

    modal = document.createElement("div");
    modal.id = "trackedManufacturerEditModalV1";
    modal.className = "manufacturer-source-edit-backdrop hidden";
    modal.innerHTML = `
      <div class="manufacturer-source-edit-modal" role="dialog" aria-modal="true">
        <div class="manufacturer-source-edit-head">
          <h3>Edit Manufacturer Source</h3>
          <button type="button" class="secondary" id="trackedManufacturerEditCloseBtnV1">Close</button>
        </div>

        <div class="manufacturer-source-edit-body">
          <div class="manufacturer-source-edit-note" id="trackedManufacturerEditNoteV1">
            Edit this saved manufacturer source without changing the add-source form.
          </div>

          <input id="trackedManufacturerEditOriginalIdV1" type="hidden" />

          <div class="grid grid-3">
            <div>
              <label for="trackedManufacturerEditNameV1">Source Name</label>
              <input id="trackedManufacturerEditNameV1" />
            </div>
            <div>
              <label for="trackedManufacturerEditManufacturerNameV1">Manufacturer Name</label>
              <input id="trackedManufacturerEditManufacturerNameV1" />
            </div>
            <div>
              <label for="trackedManufacturerEditBrandNameV1">Brand Name</label>
              <input id="trackedManufacturerEditBrandNameV1" />
            </div>
            <div>
              <label for="trackedManufacturerEditKindV1">Source Kind</label>
              <select id="trackedManufacturerEditKindV1">
                <option value="catalog">catalog</option>
                <option value="lineup">lineup</option>
                <option value="product">product</option>
              </select>
            </div>
            <div>
              <label for="trackedManufacturerEditParserKeyV1">Parser Key</label>
              <select id="trackedManufacturerEditParserKeyV1">
                <option value="motiv">motiv</option>
                <option value="storm">storm</option>
                <option value="roto-grip">roto-grip</option>
                <option value="900-global">900-global</option>
                <option value="brunswick">brunswick</option>
                <option value="radical">radical</option>
                <option value="dv8">dv8</option>
                <option value="hammer">hammer</option>
                <option value="ebonite">ebonite</option>
                <option value="track">track</option>
                <option value="generic">generic</option>
              </select>
            </div>
            <div>
              <label for="trackedManufacturerEditEnabledV1">Enabled</label>
              <select id="trackedManufacturerEditEnabledV1">
                <option value="true">true</option>
                <option value="false">false</option>
              </select>
            </div>
            <div>
              <label for="trackedManufacturerEditMaxPagesV1">Max Pages</label>
              <input id="trackedManufacturerEditMaxPagesV1" type="number" min="0" />
            </div>
            <div>
              <label for="trackedManufacturerEditMaxProductsV1">Max Products</label>
              <input id="trackedManufacturerEditMaxProductsV1" type="number" min="0" />
            </div>
            <div>
              <label for="trackedManufacturerEditDelayV1">Scrape Delay Ms</label>
              <input id="trackedManufacturerEditDelayV1" type="number" min="0" />
            </div>
            <div style="grid-column: 1 / -1">
              <label for="trackedManufacturerEditUrlV1">Official Source URL</label>
              <input id="trackedManufacturerEditUrlV1" />
            </div>
          </div>
        </div>

        <div class="manufacturer-source-edit-actions">
          <button type="button" class="secondary" id="trackedManufacturerEditCancelBtnV1">Cancel</button>
          <button type="button" id="trackedManufacturerEditSaveBtnV1">Save Changes</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    document.getElementById("trackedManufacturerEditCloseBtnV1")?.addEventListener("click", closeTrackedManufacturerEditModal);
    document.getElementById("trackedManufacturerEditCancelBtnV1")?.addEventListener("click", closeTrackedManufacturerEditModal);
    document.getElementById("trackedManufacturerEditSaveBtnV1")?.addEventListener("click", saveTrackedManufacturerEditModal);

    modal.addEventListener("click", (event) => {
      if (event.target === modal) {
        closeTrackedManufacturerEditModal();
      }
    });

    return modal;
  }

  function getModalValue(id) {
    return document.getElementById(id)?.value?.trim() ?? "";
  }

  function setModalValue(id, value) {
    const input = document.getElementById(id);
    if (input) input.value = value ?? "";
  }

  function closeTrackedManufacturerEditModal() {
    ensureModal().classList.add("hidden");
  }

  async function saveTrackedManufacturerEditModal() {
    try {
      const name = getModalValue("trackedManufacturerEditNameV1");
      const manufacturerName = getModalValue("trackedManufacturerEditManufacturerNameV1");
      const brandName = getModalValue("trackedManufacturerEditBrandNameV1");
      const sourceKind = getModalValue("trackedManufacturerEditKindV1");
      const parserKey = getModalValue("trackedManufacturerEditParserKeyV1");
      const url = getModalValue("trackedManufacturerEditUrlV1");

      if (!name || !manufacturerName || !sourceKind || !parserKey || !url) {
        throw new Error("Source name, manufacturer name, source kind, parser key, and URL are required.");
      }

      const query = encodeQuery({
        name,
        manufacturerName,
        brandName,
        sourceKind,
        parserKey,
        url,
        enabled: getModalValue("trackedManufacturerEditEnabledV1"),
        maxPages: getModalValue("trackedManufacturerEditMaxPagesV1"),
        maxProducts: getModalValue("trackedManufacturerEditMaxProductsV1"),
        scrapeDelayMs: getModalValue("trackedManufacturerEditDelayV1"),
      });

      const data = await apiGet(`/api/tracked-manufacturer-sources/upsert?${query}`);

      const summary = document.getElementById("manufacturerSourcesSummary");
      if (summary) {
        summary.textContent = `Updated manufacturer source: ${data.data?.name ?? name}.`;
      }

      closeTrackedManufacturerEditModal();
      await loadManufacturerSources();
      setStatus("Manufacturer source saved", "ready");
    } catch (error) {
      const note = document.getElementById("trackedManufacturerEditNoteV1");
      if (note) {
        note.textContent = `Edit error: ${error.message}`;
      }

      setStatus("Error", "error");
    }
  }

  function openTrackedManufacturerEditModal(sourceId) {
    const source = getManufacturerSourceById(sourceId);

    if (!source) {
      setStatus("Error", "error");
      return;
    }

    ensureModal();

    setModalValue("trackedManufacturerEditOriginalIdV1", source.id);
    setModalValue("trackedManufacturerEditNameV1", source.name ?? "");
    setModalValue("trackedManufacturerEditManufacturerNameV1", source.manufacturerName ?? "");
    setModalValue("trackedManufacturerEditBrandNameV1", source.brandName ?? "");
    setModalValue("trackedManufacturerEditKindV1", source.sourceKind ?? "catalog");
    setModalValue("trackedManufacturerEditParserKeyV1", source.parserKey ?? "motiv");
    setModalValue("trackedManufacturerEditEnabledV1", String(source.enabled));
    setModalValue("trackedManufacturerEditMaxPagesV1", source.maxPages ?? 1);
    setModalValue("trackedManufacturerEditMaxProductsV1", source.maxProducts ?? 50);
    setModalValue("trackedManufacturerEditDelayV1", source.scrapeDelayMs ?? 750);
    setModalValue("trackedManufacturerEditUrlV1", source.url ?? "");

    const note = document.getElementById("trackedManufacturerEditNoteV1");
    if (note) {
      note.textContent = `Editing: ${source.name}`;
    }

    ensureModal().classList.remove("hidden");
  }

  window.editManufacturerSource = openTrackedManufacturerEditModal;
  window.editManufacturerSourceFromEncoded = function editManufacturerSourceFromEncodedModal(encodedSourceId) {
    openTrackedManufacturerEditModal(decodeURIComponent(encodedSourceId));
  };
})();

/* Force manufacturer source Edit buttons to use popup modal */
(function forceManufacturerEditPopupBindingV1() {
  if (window.__forceManufacturerEditPopupBindingV1) return;
  window.__forceManufacturerEditPopupBindingV1 = true;

  function getManufacturerSourceIdFromEditButton(button) {
    const onclick = button.getAttribute("onclick") ?? "";
    const encodedMatch = onclick.match(/editManufacturerSourceFromEncoded\('([^']+)'\)/);

    if (encodedMatch?.[1]) {
      return decodeURIComponent(encodedMatch[1]);
    }

    const row = button.closest("tr");
    const mutedTexts = Array.from(row?.querySelectorAll(".muted") ?? [])
      .map((node) => node.textContent?.trim())
      .filter(Boolean);

    const idText = mutedTexts.find((text) =>
      text.startsWith("manufacturer-source-")
    );

    return idText ?? "";
  }

  function isManufacturerEditButton(button) {
    if (!(button instanceof HTMLButtonElement)) return false;

    const onclick = button.getAttribute("onclick") ?? "";
    const text = button.textContent?.trim().toLowerCase();

    return (
      text === "edit" &&
      (
        onclick.includes("editManufacturerSource") ||
        button.closest("#manufacturerSourcesTable")
      )
    );
  }

  document.addEventListener(
    "click",
    (event) => {
      const button = event.target?.closest?.("button");

      if (!isManufacturerEditButton(button)) {
        return;
      }

      const sourceId = getManufacturerSourceIdFromEditButton(button);

      if (!sourceId) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      if (typeof window.editManufacturerSource === "function") {
        window.editManufacturerSource(sourceId);
      } else if (typeof editManufacturerSource === "function") {
        editManufacturerSource(sourceId);
      }
    },
    true
  );
})();

/* V2 manufacturer source edit popup: overrides old inline edit behavior */
(function setupManufacturerSourceEditPopupV2() {
  if (window.__manufacturerSourceEditPopupV2) return;
  window.__manufacturerSourceEditPopupV2 = true;

  function ensureStyles() {
    if (document.getElementById("manufacturerSourceEditPopupStylesV2")) return;

    const style = document.createElement("style");
    style.id = "manufacturerSourceEditPopupStylesV2";
    style.textContent = `
      .manufacturer-edit-v2-backdrop {
        position: fixed;
        inset: 0;
        z-index: 11000;
        background: rgba(15, 23, 42, 0.58);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
      }

      .manufacturer-edit-v2-backdrop.hidden {
        display: none;
      }

      .manufacturer-edit-v2-modal {
        width: min(920px, 100%);
        max-height: 90vh;
        overflow: auto;
        background: #ffffff;
        color: #172033;
        border: 1px solid #cbd5e1;
        border-radius: 18px;
        box-shadow: 0 24px 60px rgba(15, 23, 42, 0.35);
      }

      .manufacturer-edit-v2-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        padding: 18px 22px;
        border-bottom: 1px solid #e2e8f0;
      }

      .manufacturer-edit-v2-head h3 {
        margin: 0;
        font-size: 18px;
      }

      .manufacturer-edit-v2-body {
        padding: 20px 22px;
      }

      .manufacturer-edit-v2-actions {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
        padding: 16px 22px 22px;
      }

      .manufacturer-edit-v2-note {
        margin-bottom: 14px;
        color: #475569;
        font-size: 13px;
      }
    `;

    document.head.appendChild(style);
  }

  function ensureModal() {
    ensureStyles();

    let modal = document.getElementById("manufacturerSourceEditPopupV2");
    if (modal) return modal;

    modal = document.createElement("div");
    modal.id = "manufacturerSourceEditPopupV2";
    modal.className = "manufacturer-edit-v2-backdrop hidden";
    modal.innerHTML = `
      <div class="manufacturer-edit-v2-modal" role="dialog" aria-modal="true">
        <div class="manufacturer-edit-v2-head">
          <h3>Edit Manufacturer Source</h3>
          <button type="button" class="secondary" id="manufacturerEditV2CloseBtn">Close</button>
        </div>

        <div class="manufacturer-edit-v2-body">
          <div class="manufacturer-edit-v2-note" id="manufacturerEditV2Note">
            Edit this saved manufacturer source without changing the add-source form.
          </div>

          <input id="manufacturerEditV2OriginalId" type="hidden" />

          <div class="grid grid-3">
            <div>
              <label for="manufacturerEditV2Name">Source Name</label>
              <input id="manufacturerEditV2Name" />
            </div>
            <div>
              <label for="manufacturerEditV2ManufacturerName">Manufacturer Name</label>
              <input id="manufacturerEditV2ManufacturerName" />
            </div>
            <div>
              <label for="manufacturerEditV2BrandName">Brand Name</label>
              <input id="manufacturerEditV2BrandName" />
            </div>
            <div>
              <label for="manufacturerEditV2Kind">Source Kind</label>
              <select id="manufacturerEditV2Kind">
                <option value="catalog">catalog</option>
                <option value="lineup">lineup</option>
                <option value="product">product</option>
              </select>
            </div>
            <div>
              <label for="manufacturerEditV2ParserKey">Parser Key</label>
              <select id="manufacturerEditV2ParserKey">
                <option value="motiv">motiv</option>
                <option value="storm">storm</option>
                <option value="roto-grip">roto-grip</option>
                <option value="900-global">900-global</option>
                <option value="brunswick">brunswick</option>
                <option value="radical">radical</option>
                <option value="dv8">dv8</option>
                <option value="hammer">hammer</option>
                <option value="ebonite">ebonite</option>
                <option value="track">track</option>
                <option value="generic">generic</option>
              </select>
            </div>
            <div>
              <label for="manufacturerEditV2Enabled">Enabled</label>
              <select id="manufacturerEditV2Enabled">
                <option value="true">true</option>
                <option value="false">false</option>
              </select>
            </div>
            <div>
              <label for="manufacturerEditV2MaxPages">Max Pages</label>
              <input id="manufacturerEditV2MaxPages" type="number" min="0" />
            </div>
            <div>
              <label for="manufacturerEditV2MaxProducts">Max Products</label>
              <input id="manufacturerEditV2MaxProducts" type="number" min="0" />
            </div>
            <div>
              <label for="manufacturerEditV2Delay">Scrape Delay Ms</label>
              <input id="manufacturerEditV2Delay" type="number" min="0" />
            </div>
            <div style="grid-column: 1 / -1">
              <label for="manufacturerEditV2Url">Official Source URL</label>
              <input id="manufacturerEditV2Url" />
            </div>
          </div>
        </div>

        <div class="manufacturer-edit-v2-actions">
          <button type="button" class="secondary" id="manufacturerEditV2CancelBtn">Cancel</button>
          <button type="button" id="manufacturerEditV2SaveBtn">Save Changes</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    document.getElementById("manufacturerEditV2CloseBtn")?.addEventListener("click", closeModal);
    document.getElementById("manufacturerEditV2CancelBtn")?.addEventListener("click", closeModal);
    document.getElementById("manufacturerEditV2SaveBtn")?.addEventListener("click", saveModal);

    modal.addEventListener("click", (event) => {
      if (event.target === modal) closeModal();
    });

    return modal;
  }

  function getValue(id) {
    return document.getElementById(id)?.value?.trim() ?? "";
  }

  function setValue(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = value ?? "";
  }

  function closeModal() {
    ensureModal().classList.add("hidden");
  }

  async function findSource(sourceId) {
    let source = null;

    try {
      if (typeof getManufacturerSourceById === "function") {
        source = getManufacturerSourceById(sourceId);
      }
    } catch {
      source = null;
    }

    if (source) return source;

    const data = await apiGet("/api/tracked-manufacturer-sources");
    const sources = data.data ?? [];

    try {
      if (Array.isArray(lastManufacturerSources)) {
        lastManufacturerSources = sources;
      }
    } catch {
      // Ignore if the state variable is not writable in this scope.
    }

    return sources.find((item) => item.id === sourceId) ?? null;
  }

  async function openModal(sourceId) {
    try {
      const source = await findSource(sourceId);

      if (!source) {
        throw new Error(`Manufacturer source not found: ${sourceId}`);
      }

      ensureModal();

      setValue("manufacturerEditV2OriginalId", source.id);
      setValue("manufacturerEditV2Name", source.name ?? "");
      setValue("manufacturerEditV2ManufacturerName", source.manufacturerName ?? "");
      setValue("manufacturerEditV2BrandName", source.brandName ?? "");
      setValue("manufacturerEditV2Kind", source.sourceKind ?? "catalog");
      setValue("manufacturerEditV2ParserKey", source.parserKey ?? "motiv");
      setValue("manufacturerEditV2Enabled", String(source.enabled));
      setValue("manufacturerEditV2MaxPages", source.maxPages ?? 1);
      setValue("manufacturerEditV2MaxProducts", source.maxProducts ?? 50);
      setValue("manufacturerEditV2Delay", source.scrapeDelayMs ?? 750);
      setValue("manufacturerEditV2Url", source.url ?? "");

      const note = document.getElementById("manufacturerEditV2Note");
      if (note) {
        note.textContent = `Editing: ${source.name}`;
      }

      ensureModal().classList.remove("hidden");
    } catch (error) {
      const summary = document.getElementById("manufacturerSourcesSummary");
      if (summary) {
        summary.textContent = `Edit source error: ${error.message}`;
      }

      setStatus("Error", "error");
    }
  }

  async function saveModal() {
    try {
      const name = getValue("manufacturerEditV2Name");
      const manufacturerName = getValue("manufacturerEditV2ManufacturerName");
      const brandName = getValue("manufacturerEditV2BrandName");
      const sourceKind = getValue("manufacturerEditV2Kind");
      const parserKey = getValue("manufacturerEditV2ParserKey");
      const url = getValue("manufacturerEditV2Url");

      if (!name || !manufacturerName || !sourceKind || !parserKey || !url) {
        throw new Error("Source name, manufacturer name, source kind, parser key, and URL are required.");
      }

      const query = encodeQuery({
        name,
        manufacturerName,
        brandName,
        sourceKind,
        parserKey,
        url,
        enabled: getValue("manufacturerEditV2Enabled"),
        maxPages: getValue("manufacturerEditV2MaxPages"),
        maxProducts: getValue("manufacturerEditV2MaxProducts"),
        scrapeDelayMs: getValue("manufacturerEditV2Delay"),
      });

      const data = await apiGet(`/api/tracked-manufacturer-sources/upsert?${query}`);

      const summary = document.getElementById("manufacturerSourcesSummary");
      if (summary) {
        summary.textContent = `Updated manufacturer source: ${data.data?.name ?? name}.`;
      }

      closeModal();
      await loadManufacturerSources();
      setStatus("Manufacturer source saved", "ready");
    } catch (error) {
      const note = document.getElementById("manufacturerEditV2Note");
      if (note) {
        note.textContent = `Edit error: ${error.message}`;
      }

      setStatus("Error", "error");
    }
  }

  function getSourceIdFromButton(button) {
    const onclick = button.getAttribute("onclick") ?? "";
    const match = onclick.match(/editManufacturerSourceFromEncoded\('([^']+)'\)/);

    if (match?.[1]) {
      return decodeURIComponent(match[1]);
    }

    const row = button.closest("tr");
    return Array.from(row?.querySelectorAll(".muted") ?? [])
      .map((node) => node.textContent?.trim())
      .find((text) => text?.startsWith("manufacturer-source-")) ?? "";
  }

  document.addEventListener(
    "click",
    (event) => {
      const button = event.target?.closest?.("button");

      if (!(button instanceof HTMLButtonElement)) return;
      if (!button.closest("#manufacturerSourcesTable")) return;
      if (button.textContent?.trim().toLowerCase() !== "edit") return;

      const sourceId = getSourceIdFromButton(button);

      if (!sourceId) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      openModal(sourceId);
    },
    true
  );

  window.editManufacturerSource = openModal;
  window.editManufacturerSourceFromEncoded = function editManufacturerSourceFromEncodedV2(encodedSourceId) {
    openModal(decodeURIComponent(encodedSourceId));
  };
})();

/* Retailer scrape output summary table */
(function setupRetailerScrapeOutputSummaryV1() {
  if (window.__retailerScrapeOutputSummaryV1) return;
  window.__retailerScrapeOutputSummaryV1 = true;

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function getRetailerResults(payload) {
    const results = payload?.data?.results ?? payload?.results ?? [];

    return results
      .map((item) => {
        const result = item.result ?? item;
        const source = item.source?.name ?? result.sourceName ?? "Unknown source";

        if (
          result.savedCount === undefined &&
          result.skippedLegacyReviewCount === undefined &&
          result.skippedListingReviews === undefined
        ) {
          return null;
        }

        return { source, result };
      })
      .filter(Boolean);
  }

  function removeExistingSummary() {
    document.getElementById("retailerScrapeSummaryV1")?.remove();
  }

  function buildReasonCounts(reviews) {
    return reviews.reduce((acc, row) => {
      const reason = row.legacyReviewReason ?? row.status ?? "unknown";
      acc[reason] = (acc[reason] ?? 0) + 1;
      return acc;
    }, {});
  }

  function renderRetailerScrapeSummary(payload) {
    removeExistingSummary();

    const scrapeOutput = document.getElementById("scrapeOutput");
    if (!scrapeOutput) return;

    const sources = getRetailerResults(payload);
    if (sources.length === 0) return;

    const wrapper = document.createElement("div");
    wrapper.id = "retailerScrapeSummaryV1";
    wrapper.style.marginTop = "16px";

    const sourceBlocks = sources
      .map(({ source, result }) => {
        const reviews = result.skippedListingReviews ?? [];
        const reasonCounts = buildReasonCounts(reviews);

        const reasonRows =
          Object.entries(reasonCounts).length > 0
            ? Object.entries(reasonCounts)
                .map(([reason, count]) => {
                  return `
                    <tr>
                      <td>${escapeHtml(reason)}</td>
                      <td>${escapeHtml(count)}</td>
                    </tr>
                  `;
                })
                .join("")
            : `
              <tr>
                <td colspan="2" class="muted">No review rows.</td>
              </tr>
            `;

        const reviewRows =
          reviews.length > 0
            ? reviews
                .map((row) => {
                  const selected = row.selectedMatch
                    ? `${row.selectedMatch.brand} ${row.selectedMatch.canonicalName}`
                    : "—";

                  return `
                    <tr>
                      <td>${escapeHtml(row.status)}</td>
                      <td>${escapeHtml(row.legacyReviewReason ?? "—")}</td>
                      <td>${escapeHtml(row.listing?.listingTitle ?? "—")}</td>
                      <td>${escapeHtml(row.listing?.currentPrice ?? "—")}</td>
                      <td>${escapeHtml(row.listing?.stockStatus ?? "—")}</td>
                      <td>${escapeHtml(selected)}</td>
                      <td>${escapeHtml(row.selectedMatch?.catalogState ?? "—")}</td>
                      <td>${escapeHtml(row.selectedMatch?.confidence ?? "—")}</td>
                    </tr>
                  `;
                })
                .join("")
            : `
              <tr>
                <td colspan="8" class="muted">No legacy or review rows.</td>
              </tr>
            `;

        return `
          <div class="card" style="margin-top: 14px;">
            <h3>Retailer Scrape Summary</h3>
            <p class="muted">${escapeHtml(source)}</p>

            <table>
              <thead>
                <tr>
                  <th>Discovered</th>
                  <th>Scraped</th>
                  <th>Saved</th>
                  <th>No Match</th>
                  <th>Needs Review</th>
                  <th>Legacy Review</th>
                  <th>Created</th>
                  <th>Updated</th>
                  <th>Snapshots Created</th>
                  <th>Snapshots Skipped</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>${escapeHtml(result.discoveredProductCount ?? "—")}</td>
                  <td>${escapeHtml(result.scrapedCount ?? "—")}</td>
                  <td>${escapeHtml(result.savedCount ?? "—")}</td>
                  <td>${escapeHtml(result.skippedNoMatchCount ?? 0)}</td>
                  <td>${escapeHtml(result.skippedNeedsReviewCount ?? 0)}</td>
                  <td>${escapeHtml(result.skippedLegacyReviewCount ?? 0)}</td>
                  <td>${escapeHtml(result.createdListingCount ?? "—")}</td>
                  <td>${escapeHtml(result.updatedListingCount ?? "—")}</td>
                  <td>${escapeHtml(result.snapshotCreatedCount ?? "—")}</td>
                  <td>${escapeHtml(result.snapshotSkippedCount ?? "—")}</td>
                </tr>
              </tbody>
            </table>

            <h4 style="margin-top: 16px;">Review Reason Counts</h4>
            <table>
              <thead>
                <tr>
                  <th>Reason</th>
                  <th>Count</th>
                </tr>
              </thead>
              <tbody>
                ${reasonRows}
              </tbody>
            </table>

            <h4 style="margin-top: 16px;">Legacy / Review Rows</h4>
            <table>
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Reason</th>
                  <th>Listing</th>
                  <th>Price</th>
                  <th>Stock</th>
                  <th>Selected Candidate</th>
                  <th>Catalog State</th>
                  <th>Confidence</th>
                </tr>
              </thead>
              <tbody>
                ${reviewRows}
              </tbody>
            </table>
          </div>
        `;
      })
      .join("");

    wrapper.innerHTML = sourceBlocks;
    scrapeOutput.insertAdjacentElement("beforebegin", wrapper);
  }

  if (typeof renderJson === "function") {
    const originalRenderJson = renderJson;

    renderJson = function renderJsonWithRetailerSummary(elementId, data) {
      originalRenderJson(elementId, data);

      if (elementId === "scrapeOutput") {
        renderRetailerScrapeSummary(data);
      }
    };
  }
})();

/* Retailer scrape output summary table V2: supports single-source and run-all payloads */
(function setupRetailerScrapeOutputSummaryV2() {
  if (window.__retailerScrapeOutputSummaryV2) return;
  window.__retailerScrapeOutputSummaryV2 = true;

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function getRetailerResults(payload) {
    if (payload?.source && payload?.result) {
      return [
        {
          source: payload.source?.name ?? payload.result?.sourceName ?? "Unknown source",
          result: payload.result,
        },
      ];
    }

    if (payload?.data?.source && payload?.data?.result) {
      return [
        {
          source:
            payload.data.source?.name ??
            payload.data.result?.sourceName ??
            "Unknown source",
          result: payload.data.result,
        },
      ];
    }

    const results = payload?.data?.results ?? payload?.results ?? [];

    return results
      .map((item) => {
        const result = item.result ?? item;
        const source = item.source?.name ?? result.sourceName ?? "Unknown source";

        if (
          result.savedCount === undefined &&
          result.skippedLegacyReviewCount === undefined &&
          result.skippedListingReviews === undefined
        ) {
          return null;
        }

        return { source, result };
      })
      .filter(Boolean);
  }

  function buildReasonCounts(reviews) {
    return reviews.reduce((acc, row) => {
      const reason = row.legacyReviewReason ?? row.status ?? "unknown";
      acc[reason] = (acc[reason] ?? 0) + 1;
      return acc;
    }, {});
  }

  function removeExistingSummaries() {
    document.getElementById("retailerScrapeSummaryV1")?.remove();
    document.getElementById("retailerScrapeSummaryV2")?.remove();
  }

  function renderRetailerScrapeSummary(payload) {
    removeExistingSummaries();

    const scrapeOutput = document.getElementById("scrapeOutput");
    if (!scrapeOutput) return;

    const sources = getRetailerResults(payload);
    if (sources.length === 0) return;

    const wrapper = document.createElement("div");
    wrapper.id = "retailerScrapeSummaryV2";
    wrapper.style.marginTop = "16px";

    wrapper.innerHTML = sources
      .map(({ source, result }) => {
        const reviews = result.skippedListingReviews ?? [];
        const reasonCounts = buildReasonCounts(reviews);

        const reasonRows =
          Object.entries(reasonCounts).length > 0
            ? Object.entries(reasonCounts)
                .map(([reason, count]) => {
                  return `
                    <tr>
                      <td>${escapeHtml(reason)}</td>
                      <td>${escapeHtml(count)}</td>
                    </tr>
                  `;
                })
                .join("")
            : `<tr><td colspan="2" class="muted">No review rows.</td></tr>`;

        const reviewRows =
          reviews.length > 0
            ? reviews
                .map((row) => {
                  const selected = row.selectedMatch
                    ? `${row.selectedMatch.brand} ${row.selectedMatch.canonicalName}`
                    : "—";

                  return `
                    <tr>
                      <td>${escapeHtml(row.status)}</td>
                      <td>${escapeHtml(row.legacyReviewReason ?? "—")}</td>
                      <td>${escapeHtml(row.listing?.listingTitle ?? "—")}</td>
                      <td>${escapeHtml(row.listing?.currentPrice ?? "—")}</td>
                      <td>${escapeHtml(row.listing?.stockStatus ?? "—")}</td>
                      <td>${escapeHtml(selected)}</td>
                      <td>${escapeHtml(row.selectedMatch?.catalogState ?? "—")}</td>
                      <td>${escapeHtml(row.selectedMatch?.confidence ?? "—")}</td>
                    </tr>
                  `;
                })
                .join("")
            : `<tr><td colspan="8" class="muted">No legacy or review rows.</td></tr>`;

        return `
          <div class="card" style="margin-top: 14px;">
            <h3>Retailer Scrape Summary</h3>
            <p class="muted">${escapeHtml(source)}</p>

            <table>
              <thead>
                <tr>
                  <th>Discovered</th>
                  <th>Scraped</th>
                  <th>Saved</th>
                  <th>No Match</th>
                  <th>Needs Review</th>
                  <th>Legacy Review</th>
                  <th>Created</th>
                  <th>Updated</th>
                  <th>Snapshots Created</th>
                  <th>Snapshots Skipped</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>${escapeHtml(result.discoveredProductCount ?? "—")}</td>
                  <td>${escapeHtml(result.scrapedCount ?? "—")}</td>
                  <td>${escapeHtml(result.savedCount ?? "—")}</td>
                  <td>${escapeHtml(result.skippedNoMatchCount ?? 0)}</td>
                  <td>${escapeHtml(result.skippedNeedsReviewCount ?? 0)}</td>
                  <td>${escapeHtml(result.skippedLegacyReviewCount ?? 0)}</td>
                  <td>${escapeHtml(result.createdListingCount ?? "—")}</td>
                  <td>${escapeHtml(result.updatedListingCount ?? "—")}</td>
                  <td>${escapeHtml(result.snapshotCreatedCount ?? "—")}</td>
                  <td>${escapeHtml(result.snapshotSkippedCount ?? "—")}</td>
                </tr>
              </tbody>
            </table>

            <h4 style="margin-top: 16px;">Review Reason Counts</h4>
            <table>
              <thead>
                <tr>
                  <th>Reason</th>
                  <th>Count</th>
                </tr>
              </thead>
              <tbody>${reasonRows}</tbody>
            </table>

            <h4 style="margin-top: 16px;">Legacy / Review Rows</h4>
            <table>
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Reason</th>
                  <th>Listing</th>
                  <th>Price</th>
                  <th>Stock</th>
                  <th>Selected Candidate</th>
                  <th>Catalog State</th>
                  <th>Confidence</th>
                </tr>
              </thead>
              <tbody>${reviewRows}</tbody>
            </table>
          </div>
        `;
      })
      .join("");

    scrapeOutput.insertAdjacentElement("beforebegin", wrapper);
  }

  if (typeof renderJson === "function") {
    const originalRenderJson = renderJson;

    renderJson = function renderJsonWithRetailerSummaryV2(elementId, data) {
      originalRenderJson(elementId, data);

      if (elementId === "scrapeOutput") {
        renderRetailerScrapeSummary(data);
      }
    };
  }
})();

/* Retailer scrape output summary table V3: render after modal opens */
(function setupRetailerScrapeOutputSummaryV3() {
  if (window.__retailerScrapeOutputSummaryV3) return;
  window.__retailerScrapeOutputSummaryV3 = true;

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function getPayload() {
    try {
      return window.lastScrapeOutput ?? lastScrapeOutput ?? null;
    } catch {
      return window.lastScrapeOutput ?? null;
    }
  }

  function getRetailerResults(payload) {
    if (!payload) return [];

    if (payload.source && payload.result) {
      return [
        {
          source: payload.source?.name ?? payload.result?.sourceName ?? "Unknown source",
          result: payload.result,
        },
      ];
    }

    if (payload.data?.source && payload.data?.result) {
      return [
        {
          source:
            payload.data.source?.name ??
            payload.data.result?.sourceName ??
            "Unknown source",
          result: payload.data.result,
        },
      ];
    }

    const results = payload.data?.results ?? payload.results ?? [];

    return results
      .map((item) => {
        const result = item.result ?? item;
        const source = item.source?.name ?? result.sourceName ?? "Unknown source";

        if (
          result.savedCount === undefined &&
          result.skippedLegacyReviewCount === undefined &&
          result.skippedListingReviews === undefined
        ) {
          return null;
        }

        return { source, result };
      })
      .filter(Boolean);
  }

  function buildReasonCounts(reviews) {
    return reviews.reduce((acc, row) => {
      const reason = row.legacyReviewReason ?? row.status ?? "unknown";
      acc[reason] = (acc[reason] ?? 0) + 1;
      return acc;
    }, {});
  }

  function removeOldSummaries() {
    document.getElementById("retailerScrapeSummaryV1")?.remove();
    document.getElementById("retailerScrapeSummaryV2")?.remove();
    document.getElementById("retailerScrapeSummaryV3")?.remove();
  }

  function renderSummary() {
    const payload = getPayload();
    const sources = getRetailerResults(payload);

    removeOldSummaries();

    if (sources.length === 0) return;

    const scrapeOutput = document.getElementById("scrapeOutput");
    if (!scrapeOutput) return;

    const wrapper = document.createElement("div");
    wrapper.id = "retailerScrapeSummaryV3";
    wrapper.style.marginTop = "16px";

    wrapper.innerHTML = sources
      .map(({ source, result }) => {
        const reviews = result.skippedListingReviews ?? [];
        const reasonCounts = buildReasonCounts(reviews);

        const reasonRows =
          Object.entries(reasonCounts).length > 0
            ? Object.entries(reasonCounts)
                .map(([reason, count]) => {
                  return `
                    <tr>
                      <td>${escapeHtml(reason)}</td>
                      <td>${escapeHtml(count)}</td>
                    </tr>
                  `;
                })
                .join("")
            : `<tr><td colspan="2" class="muted">No review rows.</td></tr>`;

        const reviewRows =
          reviews.length > 0
            ? reviews
                .map((row) => {
                  const selected = row.selectedMatch
                    ? `${row.selectedMatch.brand} ${row.selectedMatch.canonicalName}`
                    : "—";

                  return `
                    <tr>
                      <td>${escapeHtml(row.status)}</td>
                      <td>${escapeHtml(row.legacyReviewReason ?? "—")}</td>
                      <td>${escapeHtml(row.listing?.listingTitle ?? "—")}</td>
                      <td>${escapeHtml(row.listing?.currentPrice ?? "—")}</td>
                      <td>${escapeHtml(row.listing?.stockStatus ?? "—")}</td>
                      <td>${escapeHtml(selected)}</td>
                      <td>${escapeHtml(row.selectedMatch?.catalogState ?? "—")}</td>
                      <td>${escapeHtml(row.selectedMatch?.confidence ?? "—")}</td>
                    </tr>
                  `;
                })
                .join("")
            : `<tr><td colspan="8" class="muted">No legacy or review rows.</td></tr>`;

        return `
          <section class="card" style="margin-top: 14px;">
            <h3>Retailer Scrape Summary</h3>
            <p class="muted">${escapeHtml(source)}</p>

            <table>
              <thead>
                <tr>
                  <th>Discovered</th>
                  <th>Scraped</th>
                  <th>Saved</th>
                  <th>No Match</th>
                  <th>Needs Review</th>
                  <th>Legacy Review</th>
                  <th>Created</th>
                  <th>Updated</th>
                  <th>Snapshots Created</th>
                  <th>Snapshots Skipped</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>${escapeHtml(result.discoveredProductCount ?? "—")}</td>
                  <td>${escapeHtml(result.scrapedCount ?? "—")}</td>
                  <td>${escapeHtml(result.savedCount ?? "—")}</td>
                  <td>${escapeHtml(result.skippedNoMatchCount ?? 0)}</td>
                  <td>${escapeHtml(result.skippedNeedsReviewCount ?? 0)}</td>
                  <td>${escapeHtml(result.skippedLegacyReviewCount ?? 0)}</td>
                  <td>${escapeHtml(result.createdListingCount ?? "—")}</td>
                  <td>${escapeHtml(result.updatedListingCount ?? "—")}</td>
                  <td>${escapeHtml(result.snapshotCreatedCount ?? "—")}</td>
                  <td>${escapeHtml(result.snapshotSkippedCount ?? "—")}</td>
                </tr>
              </tbody>
            </table>

            <h4 style="margin-top: 16px;">Review Reason Counts</h4>
            <table>
              <thead>
                <tr>
                  <th>Reason</th>
                  <th>Count</th>
                </tr>
              </thead>
              <tbody>${reasonRows}</tbody>
            </table>

            <h4 style="margin-top: 16px;">Legacy / Review Rows</h4>
            <table>
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Reason</th>
                  <th>Listing</th>
                  <th>Price</th>
                  <th>Stock</th>
                  <th>Selected Candidate</th>
                  <th>Catalog State</th>
                  <th>Confidence</th>
                </tr>
              </thead>
              <tbody>${reviewRows}</tbody>
            </table>
          </section>
        `;
      })
      .join("");

    scrapeOutput.insertAdjacentElement("beforebegin", wrapper);
  }

  window.renderRetailerScrapeSummaryV3 = renderSummary;

  if (typeof openScrapeOutputModal === "function") {
    const originalOpenScrapeOutputModal = openScrapeOutputModal;

    openScrapeOutputModal = function openScrapeOutputModalWithRetailerSummaryV3() {
      originalOpenScrapeOutputModal();
      setTimeout(renderSummary, 0);
      setTimeout(renderSummary, 100);
    };
  }

  if (typeof renderJson === "function") {
    const originalRenderJson = renderJson;

    renderJson = function renderJsonWithRetailerSummaryV3(elementId, data) {
      originalRenderJson(elementId, data);

      if (elementId === "scrapeOutput") {
        try {
          window.lastScrapeOutput = data;
        } catch {
          // ignore
        }

        setTimeout(renderSummary, 0);
      }
    };
  }
})();

/* Retailer scrape output summary V4: card layout for readable legacy rows */
(function setupRetailerScrapeOutputSummaryV4() {
  if (window.__retailerScrapeOutputSummaryV4) return;
  window.__retailerScrapeOutputSummaryV4 = true;

  function ensureStyles() {
    if (document.getElementById("retailerScrapeSummaryV4Styles")) return;

    const style = document.createElement("style");
    style.id = "retailerScrapeSummaryV4Styles";
    style.textContent = `
      #retailerScrapeSummaryV4 {
        margin-top: 16px;
      }

      #retailerScrapeSummaryV4 .retailer-summary-card {
        margin-top: 14px;
        padding: 16px;
        border: 1px solid #d6e0ef;
        border-radius: 16px;
        background: #ffffff;
      }

      #retailerScrapeSummaryV4 .retailer-summary-title {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 12px;
      }

      #retailerScrapeSummaryV4 .retailer-summary-title h3 {
        margin: 0;
      }

      #retailerScrapeSummaryV4 .retailer-metric-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
        gap: 10px;
        margin: 12px 0 16px;
      }

      #retailerScrapeSummaryV4 .retailer-metric {
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        padding: 10px 12px;
        background: #f8fafc;
      }

      #retailerScrapeSummaryV4 .retailer-metric-label {
        color: #64748b;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: .05em;
        text-transform: uppercase;
      }

      #retailerScrapeSummaryV4 .retailer-metric-value {
        margin-top: 4px;
        font-size: 20px;
        font-weight: 800;
      }

      #retailerScrapeSummaryV4 .retailer-reason-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
        gap: 10px;
        margin: 10px 0 18px;
      }

      #retailerScrapeSummaryV4 .retailer-reason-pill {
        border: 1px solid #e2e8f0;
        border-radius: 999px;
        padding: 8px 12px;
        background: #f8fafc;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        font-size: 13px;
      }

      #retailerScrapeSummaryV4 .retailer-review-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 12px;
      }

      #retailerScrapeSummaryV4 .retailer-review-card {
        border: 1px solid #dbe7f5;
        border-radius: 14px;
        padding: 12px;
        background: #fbfdff;
      }

      #retailerScrapeSummaryV4 .retailer-review-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 10px;
        margin-bottom: 8px;
      }

      #retailerScrapeSummaryV4 .retailer-review-title {
        font-weight: 800;
        line-height: 1.3;
      }

      #retailerScrapeSummaryV4 .retailer-review-price {
        font-weight: 800;
        white-space: nowrap;
      }

      #retailerScrapeSummaryV4 .retailer-review-meta {
        display: grid;
        grid-template-columns: 95px 1fr;
        gap: 6px 10px;
        font-size: 13px;
      }

      #retailerScrapeSummaryV4 .retailer-review-meta .label {
        color: #64748b;
        font-weight: 700;
      }

      #retailerScrapeSummaryV4 .retailer-status-chip {
        display: inline-flex;
        width: fit-content;
        border-radius: 999px;
        padding: 3px 8px;
        background: #eef2ff;
        color: #334155;
        font-size: 12px;
        font-weight: 700;
      }

      #retailerScrapeSummaryV4 .retailer-reason-text {
        overflow-wrap: anywhere;
      }

      #retailerScrapeSummaryV4 .retailer-output-json-note {
        margin-top: 12px;
        color: #64748b;
        font-size: 12px;
      }
    `;

    document.head.appendChild(style);
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function getPayload() {
    try {
      return window.lastScrapeOutput ?? lastScrapeOutput ?? null;
    } catch {
      return window.lastScrapeOutput ?? null;
    }
  }

  function getRetailerResults(payload) {
    if (!payload) return [];

    if (payload.source && payload.result) {
      return [{
        source: payload.source?.name ?? payload.result?.sourceName ?? "Unknown source",
        result: payload.result,
      }];
    }

    if (payload.data?.source && payload.data?.result) {
      return [{
        source: payload.data.source?.name ?? payload.data.result?.sourceName ?? "Unknown source",
        result: payload.data.result,
      }];
    }

    const results = payload.data?.results ?? payload.results ?? [];

    return results
      .map((item) => {
        const result = item.result ?? item;
        const source = item.source?.name ?? result.sourceName ?? "Unknown source";

        if (
          result.savedCount === undefined &&
          result.skippedLegacyReviewCount === undefined &&
          result.skippedListingReviews === undefined
        ) {
          return null;
        }

        return { source, result };
      })
      .filter(Boolean);
  }

  function buildReasonCounts(reviews) {
    return reviews.reduce((acc, row) => {
      const reason = row.legacyReviewReason ?? row.status ?? "unknown";
      acc[reason] = (acc[reason] ?? 0) + 1;
      return acc;
    }, {});
  }

  function metric(label, value) {
    return `
      <div class="retailer-metric">
        <div class="retailer-metric-label">${escapeHtml(label)}</div>
        <div class="retailer-metric-value">${escapeHtml(value ?? "—")}</div>
      </div>
    `;
  }

  function removeOldSummaries() {
    document.getElementById("retailerScrapeSummaryV1")?.remove();
    document.getElementById("retailerScrapeSummaryV2")?.remove();
    document.getElementById("retailerScrapeSummaryV3")?.remove();
    document.getElementById("retailerScrapeSummaryV4")?.remove();
  }

  function renderSummary() {
    ensureStyles();

    const payload = getPayload();
    const sources = getRetailerResults(payload);

    removeOldSummaries();

    if (sources.length === 0) return;

    const scrapeOutput = document.getElementById("scrapeOutput");
    if (!scrapeOutput) return;

    const wrapper = document.createElement("div");
    wrapper.id = "retailerScrapeSummaryV4";

    wrapper.innerHTML = sources
      .map(({ source, result }) => {
        const reviews = result.skippedListingReviews ?? [];
        const reasonCounts = buildReasonCounts(reviews);

        const reasonPills =
          Object.entries(reasonCounts).length > 0
            ? Object.entries(reasonCounts)
                .map(([reason, count]) => `
                  <div class="retailer-reason-pill">
                    <span>${escapeHtml(reason)}</span>
                    <strong>${escapeHtml(count)}</strong>
                  </div>
                `)
                .join("")
            : `<p class="muted">No review rows.</p>`;

        const reviewCards =
          reviews.length > 0
            ? reviews
                .map((row) => {
                  const selected = row.selectedMatch
                    ? `${row.selectedMatch.brand} ${row.selectedMatch.canonicalName}`
                    : "—";

                  return `
                    <article class="retailer-review-card">
                      <div class="retailer-review-head">
                        <div class="retailer-review-title">${escapeHtml(row.listing?.listingTitle ?? "—")}</div>
                        <div class="retailer-review-price">$${escapeHtml(row.listing?.currentPrice ?? "—")}</div>
                      </div>

                      <div class="retailer-review-meta">
                        <div class="label">Status</div>
                        <div><span class="retailer-status-chip">${escapeHtml(row.status)}</span></div>

                        <div class="label">Reason</div>
                        <div class="retailer-reason-text">${escapeHtml(row.legacyReviewReason ?? "—")}</div>

                        <div class="label">Stock</div>
                        <div>${escapeHtml(row.listing?.stockStatus ?? "—")}</div>

                        <div class="label">Candidate</div>
                        <div>${escapeHtml(selected)}</div>

                        <div class="label">Catalog</div>
                        <div>${escapeHtml(row.selectedMatch?.catalogState ?? "—")}</div>

                        <div class="label">Confidence</div>
                        <div>${escapeHtml(row.selectedMatch?.confidence ?? "—")}</div>
                      </div>
                    </article>
                  `;
                })
                .join("")
            : `<p class="muted">No legacy or review rows.</p>`;

        return `
          <section class="retailer-summary-card">
            <div class="retailer-summary-title">
              <h3>Retailer Scrape Summary</h3>
              <span class="muted">${escapeHtml(source)}</span>
            </div>

            <div class="retailer-metric-grid">
              ${metric("Discovered", result.discoveredProductCount)}
              ${metric("Scraped", result.scrapedCount)}
              ${metric("Saved", result.savedCount)}
              ${metric("No Match", result.skippedNoMatchCount ?? 0)}
              ${metric("Needs Review", result.skippedNeedsReviewCount ?? 0)}
              ${metric("Legacy Review", result.skippedLegacyReviewCount ?? 0)}
              ${metric("Created", result.createdListingCount)}
              ${metric("Updated", result.updatedListingCount)}
              ${metric("Snapshots Created", result.snapshotCreatedCount)}
              ${metric("Snapshots Skipped", result.snapshotSkippedCount)}
            </div>

            <h4>Review Reason Counts</h4>
            <div class="retailer-reason-grid">
              ${reasonPills}
            </div>

            <h4>Legacy / Review Rows</h4>
            <div class="retailer-review-grid">
              ${reviewCards}
            </div>

            <div class="retailer-output-json-note">
              Raw JSON is still shown below for debugging/export.
            </div>
          </section>
        `;
      })
      .join("");

    scrapeOutput.insertAdjacentElement("beforebegin", wrapper);
  }

  window.renderRetailerScrapeSummaryV4 = renderSummary;
  window.renderRetailerScrapeSummaryV3 = renderSummary;

  if (typeof openScrapeOutputModal === "function") {
    const originalOpenScrapeOutputModal = openScrapeOutputModal;

    openScrapeOutputModal = function openScrapeOutputModalWithRetailerSummaryV4() {
      originalOpenScrapeOutputModal();
      setTimeout(renderSummary, 0);
      setTimeout(renderSummary, 150);
      setTimeout(renderSummary, 300);
    };
  }

  if (typeof renderJson === "function") {
    const originalRenderJson = renderJson;

    renderJson = function renderJsonWithRetailerSummaryV4(elementId, data) {
      originalRenderJson(elementId, data);

      if (elementId === "scrapeOutput") {
        try {
          window.lastScrapeOutput = data;
        } catch {
          // ignore
        }

        setTimeout(renderSummary, 0);
        setTimeout(renderSummary, 150);
      }
    };
  }
})();

/* Persistent retailer legacy review queue */
(function setupRetailerReviewQueueV1() {
  if (window.__retailerReviewQueueV1) return;
  window.__retailerReviewQueueV1 = true;

  let lastRetailerReviewItems = [];

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function ensureStyles() {
    if (document.getElementById("retailerReviewQueueStylesV1")) return;

    const style = document.createElement("style");
    style.id = "retailerReviewQueueStylesV1";
    style.textContent = `
      #retailerReviewQueueV1 {
        margin-top: 18px;
      }

      #retailerReviewQueueV1 .review-queue-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(285px, 1fr));
        gap: 12px;
        margin-top: 14px;
      }

      #retailerReviewQueueV1 .review-queue-card {
        border: 1px solid #dbe7f5;
        border-radius: 14px;
        padding: 14px;
        background: #fbfdff;
      }

      #retailerReviewQueueV1 .review-queue-head {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 10px;
      }

      #retailerReviewQueueV1 .review-queue-title {
        font-weight: 800;
        line-height: 1.3;
      }

      #retailerReviewQueueV1 .review-queue-price {
        font-weight: 800;
        white-space: nowrap;
      }

      #retailerReviewQueueV1 .review-queue-meta {
        display: grid;
        grid-template-columns: 95px 1fr;
        gap: 6px 10px;
        font-size: 13px;
      }

      #retailerReviewQueueV1 .review-queue-meta .label {
        color: #64748b;
        font-weight: 700;
      }

      #retailerReviewQueueV1 .review-queue-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 12px;
      }

      #retailerReviewQueueV1 .review-queue-reason {
        overflow-wrap: anywhere;
      }

      #retailerReviewQueueV1 .review-queue-filter-row {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 10px;
        align-items: end;
      }

      #retailerReviewQueueV1 .review-queue-counts {
        margin-top: 10px;
        color: #64748b;
        font-size: 13px;
      }
    `;

    document.head.appendChild(style);
  }

  function findMount() {
    return (
      document.getElementById("matchReview") ||
      document.getElementById("match-review") ||
      document.querySelector('[data-tab="matchReview"]') ||
      document.querySelector('[data-section="matchReview"]') ||
      document.querySelector("main") ||
      document.body
    );
  }

  function ensurePanel() {
    ensureStyles();

    let panel = document.getElementById("retailerReviewQueueV1");
    if (panel) return panel;

    panel = document.createElement("section");
    panel.id = "retailerReviewQueueV1";
    panel.className = "card";
    panel.innerHTML = `
      <h2>Retailer Legacy Review Queue</h2>
      <p class="muted">
        Persistent queue for retailer-only, legacy, spare, colorway, and weak family-match listings.
      </p>

      <div class="review-queue-filter-row">
        <div>
          <label for="retailerReviewQueueStatusV1">Review Status</label>
          <select id="retailerReviewQueueStatusV1">
            <option value="pending">pending</option>
            <option value="reviewed">reviewed</option>
            <option value="ignored">ignored</option>
            <option value="retailer_only">retailer_only</option>
            <option value="any">any</option>
          </select>
        </div>

        <div>
          <label for="retailerReviewQueueReasonV1">Reason</label>
          <select id="retailerReviewQueueReasonV1">
            <option value="any">any</option>
            <option value="current_family_spare_or_colorway_variant">current_family_spare_or_colorway_variant</option>
            <option value="retailer_only_legacy_or_discontinued">retailer_only_legacy_or_discontinued</option>
            <option value="weak_current_family_variant">weak_current_family_variant</option>
          </select>
        </div>

        <div>
          <label for="retailerReviewQueueSearchV1">Search</label>
          <input id="retailerReviewQueueSearchV1" placeholder="Motiv Liberty, Venom, etc." />
        </div>

        <div>
          <button type="button" id="retailerReviewQueueLoadBtnV1">Load Queue</button>
        </div>
      </div>

      <div class="review-queue-counts" id="retailerReviewQueueCountsV1"></div>
      <div class="review-queue-grid" id="retailerReviewQueueRowsV1"></div>
    `;

    findMount().appendChild(panel);

    document
      .getElementById("retailerReviewQueueLoadBtnV1")
      ?.addEventListener("click", loadRetailerReviewQueue);

    return panel;
  }

  function getFilterValue(id) {
    return document.getElementById(id)?.value?.trim() ?? "";
  }

  async function setRetailerReviewStatus(id, reviewStatus) {
    await apiGet(
      `/api/retailer-review-items/set-status?id=${encodeURIComponent(
        id
      )}&reviewStatus=${encodeURIComponent(reviewStatus)}`
    );

    await loadRetailerReviewQueue();
  }

  function renderRetailerReviewQueue(data) {
    const counts = document.getElementById("retailerReviewQueueCountsV1");
    const rows = document.getElementById("retailerReviewQueueRowsV1");

    if (!rows) return;

    const items = data.items ?? [];
    lastRetailerReviewItems = items;

    if (counts) {
      const statusText = (data.countsByStatus ?? [])
        .map((row) => `${row.reviewStatus}: ${row._count?.id ?? 0}`)
        .join(" • ");

      const reasonText = (data.countsByReason ?? [])
        .map((row) => `${row.reviewReason}: ${row._count?.id ?? 0}`)
        .join(" • ");

      counts.textContent = `Showing ${data.count ?? items.length} item(s). Status: ${statusText || "none"}. Reasons: ${reasonText || "none"}.`;
    }

    if (items.length === 0) {
      rows.innerHTML = `<p class="muted">No review items found.</p>`;
      return;
    }

    rows.innerHTML = items
      .map((item) => {
        const selected = item.selectedBallName
          ? `${item.selectedBrand ?? ""} ${item.selectedBallName}`.trim()
          : "—";

        return `
          <article class="review-queue-card">
            <div class="review-queue-head">
              <div class="review-queue-title">${escapeHtml(item.listingTitle)}</div>
              <div class="review-queue-price">$${escapeHtml(item.currentPrice ?? "—")}</div>
            </div>

            <div class="review-queue-meta">
              <div class="label">Status</div>
              <div>${escapeHtml(item.reviewStatus)}</div>

              <div class="label">Reason</div>
              <div class="review-queue-reason">${escapeHtml(item.reviewReason ?? "—")}</div>

              <div class="label">Scrape</div>
              <div>${escapeHtml(item.scrapeStatus)}</div>

              <div class="label">Stock</div>
              <div>${escapeHtml(item.stockStatus ?? "—")}</div>

              <div class="label">Candidate</div>
              <div>${escapeHtml(selected)}</div>

              <div class="label">Catalog</div>
              <div>${escapeHtml(item.selectedCatalogState ?? "—")}</div>

              <div class="label">Confidence</div>
              <div>${escapeHtml(item.selectedConfidence ?? "—")}</div>

              <div class="label">Seen</div>
              <div>${escapeHtml(item.lastSeenAt ?? "—")}</div>
            </div>

            <div class="review-queue-actions">
              <button type="button" onclick="openRetailerAssignExistingModalV1('${escapeHtml(item.id)}', '${escapeHtml(item.listingTitle)}')">Assign Existing Ball</button>
              <button type="button" class="secondary" onclick="setRetailerReviewStatusV1('${escapeHtml(item.id)}', 'reviewed')">Mark Reviewed Only</button>
              <button type="button" class="secondary" onclick="setRetailerReviewStatusV1('${escapeHtml(item.id)}', 'retailer_only')">Retailer Only</button>
              <button type="button" class="secondary" onclick="setRetailerReviewStatusV1('${escapeHtml(item.id)}', 'ignored')">Ignore</button>
              <a class="button secondary" href="${escapeHtml(item.listingUrl)}" target="_blank" rel="noreferrer">Open Listing</a>
            </div>
          </article>
        `;
      })
      .join("");
  }

  window.renderRetailerReviewQueueV1 = renderRetailerReviewQueue;

  async function loadRetailerReviewQueue() {
    ensurePanel();

    const reviewStatus = getFilterValue("retailerReviewQueueStatusV1") || "pending";
    const reviewReason = getFilterValue("retailerReviewQueueReasonV1") || "any";
    const q = getFilterValue("retailerReviewQueueSearchV1");

    const query = encodeQuery({
      reviewStatus,
      reviewReason,
      q,
      limit: 100,
    });

    const response = await apiGet(`/api/retailer-review-items?${query}`);
    renderRetailerReviewQueue(response.data ?? {});
  }

  window.loadRetailerReviewQueueV1 = loadRetailerReviewQueue;
  window.setRetailerReviewStatusV1 = setRetailerReviewStatus;

  document.addEventListener("DOMContentLoaded", () => {
    ensurePanel();
  });

  setTimeout(() => {
    ensurePanel();
  }, 500);
})();

/* Retailer legacy review queue V2: robust response handling + layout containment */
(function setupRetailerReviewQueueV2() {
  if (window.__retailerReviewQueueV2) return;
  window.__retailerReviewQueueV2 = true;

  function ensureStyles() {
    if (document.getElementById("retailerReviewQueueStylesV2")) return;

    const style = document.createElement("style");
    style.id = "retailerReviewQueueStylesV2";
    style.textContent = `
      #retailerReviewQueueV1 {
        max-width: 100%;
        overflow: hidden;
        box-sizing: border-box;
      }

      #retailerReviewQueueV1 * {
        box-sizing: border-box;
      }

      #retailerReviewQueueV1 .review-queue-filter-row {
        grid-template-columns: minmax(150px, 1fr) minmax(220px, 1fr) minmax(220px, 1fr) auto;
        max-width: 100%;
      }

      #retailerReviewQueueV1 .review-queue-grid {
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        max-width: 100%;
        overflow: hidden;
      }

      #retailerReviewQueueV1 .review-queue-card {
        min-width: 0;
        overflow: hidden;
      }

      #retailerReviewQueueV1 .review-queue-title,
      #retailerReviewQueueV1 .review-queue-reason,
      #retailerReviewQueueV1 .review-queue-meta div {
        overflow-wrap: anywhere;
        word-break: break-word;
      }

      #retailerReviewQueueV1 .review-queue-actions a,
      #retailerReviewQueueV1 .review-queue-actions button {
        max-width: 100%;
        white-space: normal;
      }

      #retailerReviewQueueV1 .review-queue-error {
        margin-top: 12px;
        padding: 10px 12px;
        border: 1px solid #fecaca;
        border-radius: 12px;
        background: #fef2f2;
        color: #991b1b;
        font-size: 13px;
      }

      @media (max-width: 780px) {
        #retailerReviewQueueV1 .review-queue-filter-row {
          grid-template-columns: 1fr;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function normalizeQueueResponse(response) {
    return response?.data?.items
      ? response.data
      : response?.items
        ? response
        : {
            count: 0,
            countsByStatus: [],
            countsByReason: [],
            items: [],
          };
  }

  function getFilterValue(id, fallback) {
    const value = document.getElementById(id)?.value?.trim();
    return value || fallback;
  }

  async function loadRetailerReviewQueueV2() {
    ensureStyles();

    const counts = document.getElementById("retailerReviewQueueCountsV1");
    const rows = document.getElementById("retailerReviewQueueRowsV1");

    if (counts) counts.textContent = "Loading retailer review queue...";
    if (rows) rows.innerHTML = "";

    try {
      const reviewStatus = getFilterValue("retailerReviewQueueStatusV1", "pending");
      const reviewReason = getFilterValue("retailerReviewQueueReasonV1", "any");
      const q = getFilterValue("retailerReviewQueueSearchV1", "");

      const query = encodeQuery({
        reviewStatus,
        reviewReason,
        q,
        limit: 100,
      });

      const response = await apiGet(`/api/retailer-review-items?${query}`);
      const data = normalizeQueueResponse(response);

      if (typeof renderRetailerReviewQueue === "function") {
        renderRetailerReviewQueue(data);
        return;
      }

      if (typeof window.renderRetailerReviewQueueV1 === "function") {
        window.renderRetailerReviewQueueV1(data);
        return;
      }

      if (counts) {
        counts.textContent = `Loaded ${data.count ?? data.items?.length ?? 0} item(s).`;
      }
    } catch (error) {
      if (counts) counts.textContent = "Queue load failed.";

      if (rows) {
        rows.innerHTML = `
          <div class="review-queue-error">
            ${String(error?.message ?? error)}
          </div>
        `;
      }
    }
  }

  function setPendingDefault() {
    const status = document.getElementById("retailerReviewQueueStatusV1");
    if (status && status.value === "any") {
      status.value = "pending";
    }
  }

  const oldLoad = window.loadRetailerReviewQueueV1;
  window.loadRetailerReviewQueueV1 = async function loadRetailerReviewQueueV2Public() {
    setPendingDefault();
    await loadRetailerReviewQueueV2();
  };

  document.addEventListener(
    "click",
    (event) => {
      const button = event.target?.closest?.("#retailerReviewQueueLoadBtnV1");

      if (!button) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      setPendingDefault();
      loadRetailerReviewQueueV2();
    },
    true
  );

  setTimeout(() => {
    ensureStyles();
    setPendingDefault();

    const panel = document.getElementById("retailerReviewQueueV1");
    if (panel && oldLoad) {
      loadRetailerReviewQueueV2();
    }
  }, 750);
})();

/* Retailer legacy review queue V3: fit inside admin container */
(function setupRetailerReviewQueueLayoutV3() {
  if (window.__retailerReviewQueueLayoutV3) return;
  window.__retailerReviewQueueLayoutV3 = true;

  const style = document.createElement("style");
  style.id = "retailerReviewQueueLayoutV3";
  style.textContent = `
    #retailerReviewQueueV1 {
      width: 100%;
      max-width: 100%;
      margin-left: 0;
      margin-right: 0;
      padding: 18px;
      overflow: hidden;
    }

    #retailerReviewQueueV1 .review-queue-filter-row {
      display: grid;
      grid-template-columns: minmax(150px, 220px) minmax(220px, 1fr) minmax(220px, 1.25fr) auto;
      gap: 10px;
      align-items: end;
      width: 100%;
      max-width: 100%;
    }

    #retailerReviewQueueV1 .review-queue-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
      width: 100%;
      max-width: 100%;
      overflow: hidden;
    }

    #retailerReviewQueueV1 .review-queue-card {
      min-width: 0;
      width: 100%;
      max-width: 100%;
      padding: 14px;
      overflow: hidden;
    }

    #retailerReviewQueueV1 .review-queue-head {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: start;
      gap: 10px;
    }

    #retailerReviewQueueV1 .review-queue-title {
      min-width: 0;
      overflow-wrap: anywhere;
      word-break: normal;
    }

    #retailerReviewQueueV1 .review-queue-price {
      white-space: nowrap;
    }

    #retailerReviewQueueV1 .review-queue-meta {
      grid-template-columns: 86px minmax(0, 1fr);
      min-width: 0;
    }

    #retailerReviewQueueV1 .review-queue-meta div {
      min-width: 0;
      overflow-wrap: anywhere;
    }

    #retailerReviewQueueV1 .review-queue-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    #retailerReviewQueueV1 .review-queue-actions button,
    #retailerReviewQueueV1 .review-queue-actions a {
      flex: 0 1 auto;
      max-width: 100%;
    }

    @media (max-width: 1180px) {
      #retailerReviewQueueV1 .review-queue-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }

    @media (max-width: 780px) {
      #retailerReviewQueueV1 {
        padding: 14px;
      }

      #retailerReviewQueueV1 .review-queue-filter-row {
        grid-template-columns: 1fr;
      }

      #retailerReviewQueueV1 .review-queue-grid {
        grid-template-columns: 1fr;
      }

      #retailerReviewQueueV1 .review-queue-head {
        grid-template-columns: 1fr;
      }
    }
  `;

  document.head.appendChild(style);
})();

/* Retailer review assignment modal */
(function setupRetailerReviewAssignExistingV1() {
  if (window.__retailerReviewAssignExistingV1) return;
  window.__retailerReviewAssignExistingV1 = true;

  let activeReviewItemId = "";
  let activeReviewItemTitle = "";

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function ensureStyles() {
    if (document.getElementById("retailerAssignExistingStylesV1")) return;

    const style = document.createElement("style");
    style.id = "retailerAssignExistingStylesV1";
    style.textContent = `
      .retailer-assign-backdrop {
        position: fixed;
        inset: 0;
        z-index: 12000;
        background: rgba(15, 23, 42, 0.58);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
      }

      .retailer-assign-backdrop.hidden {
        display: none;
      }

      .retailer-assign-modal {
        width: min(900px, 100%);
        max-height: 90vh;
        overflow: auto;
        background: #ffffff;
        color: #172033;
        border: 1px solid #cbd5e1;
        border-radius: 18px;
        box-shadow: 0 24px 60px rgba(15, 23, 42, 0.35);
      }

      .retailer-assign-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        padding: 18px 22px;
        border-bottom: 1px solid #e2e8f0;
      }

      .retailer-assign-head h3 {
        margin: 0;
      }

      .retailer-assign-body {
        padding: 20px 22px;
      }

      .retailer-assign-search-row {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 10px;
        align-items: end;
      }

      .retailer-assign-results {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
        gap: 12px;
        margin-top: 16px;
      }

      .retailer-assign-ball-card {
        border: 1px solid #dbe7f5;
        border-radius: 14px;
        padding: 12px;
        background: #fbfdff;
      }

      .retailer-assign-ball-title {
        font-weight: 800;
        margin-bottom: 6px;
      }

      .retailer-assign-ball-meta {
        color: #475569;
        font-size: 13px;
        line-height: 1.5;
      }

      .retailer-assign-ball-actions {
        margin-top: 10px;
      }

      .retailer-assign-note {
        margin-bottom: 12px;
        color: #64748b;
        font-size: 13px;
      }

      @media (max-width: 720px) {
        .retailer-assign-search-row {
          grid-template-columns: 1fr;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function ensureModal() {
    ensureStyles();

    let modal = document.getElementById("retailerAssignExistingModalV1");
    if (modal) return modal;

    modal = document.createElement("div");
    modal.id = "retailerAssignExistingModalV1";
    modal.className = "retailer-assign-backdrop hidden";
    modal.innerHTML = `
      <div class="retailer-assign-modal" role="dialog" aria-modal="true">
        <div class="retailer-assign-head">
          <h3>Assign Review Item to Existing Ball</h3>
          <button type="button" class="secondary" id="retailerAssignCloseBtnV1">Close</button>
        </div>

        <div class="retailer-assign-body">
          <div class="retailer-assign-note" id="retailerAssignNoteV1"></div>

          <div class="retailer-assign-search-row">
            <div>
              <label for="retailerAssignSearchInputV1">Search Catalog Balls</label>
              <input id="retailerAssignSearchInputV1" placeholder="Venom Shock, Jackal, Aspire..." />
            </div>
            <button type="button" id="retailerAssignSearchBtnV1">Search</button>
          </div>

          <div class="retailer-assign-results" id="retailerAssignResultsV1"></div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    document
      .getElementById("retailerAssignCloseBtnV1")
      ?.addEventListener("click", closeAssignModal);

    document
      .getElementById("retailerAssignSearchBtnV1")
      ?.addEventListener("click", searchAssignBalls);

    document
      .getElementById("retailerAssignSearchInputV1")
      ?.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          searchAssignBalls();
        }
      });

    modal.addEventListener("click", (event) => {
      if (event.target === modal) {
        closeAssignModal();
      }
    });

    return modal;
  }

  function closeAssignModal() {
    ensureModal().classList.add("hidden");
  }

  function guessSearchFromTitle(title) {
    return String(title ?? "")
      .replace(/^motiv\s+/i, "")
      .replace(/\b(green|teal|black|navy|yellow|purple|orange|lime|red|grey|gray|aqua|crimson|gold|blue|solid|pearl|spare|pixel)\b/gi, " ")
      .replace(/[/-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  async function openAssignModal(reviewItemId, listingTitle) {
    activeReviewItemId = reviewItemId;
    activeReviewItemTitle = listingTitle;

    ensureModal();

    const note = document.getElementById("retailerAssignNoteV1");
    const input = document.getElementById("retailerAssignSearchInputV1");
    const results = document.getElementById("retailerAssignResultsV1");

    if (note) {
      note.textContent = `Assigning: ${listingTitle}`;
    }

    if (input) {
      input.value = guessSearchFromTitle(listingTitle);
    }

    if (results) {
      results.innerHTML = `<p class="muted">Search for the catalog ball to assign this listing to.</p>`;
    }

    ensureModal().classList.remove("hidden");
    await searchAssignBalls();
  }

  async function searchAssignBalls() {
    const input = document.getElementById("retailerAssignSearchInputV1");
    const results = document.getElementById("retailerAssignResultsV1");

    if (!results) return;

    const q = input?.value?.trim() ?? "";

    results.innerHTML = `<p class="muted">Searching...</p>`;

    try {
      const query = encodeQuery({
        q,
        limit: 25,
      });

      const response = await apiGet(`/api/retailer-review-items/catalog-ball-search?${query}`);
      const items = response.data?.items ?? [];

      if (items.length === 0) {
        results.innerHTML = `<p class="muted">No catalog balls found.</p>`;
        return;
      }

      results.innerHTML = items
        .map((ball) => {
          return `
            <article class="retailer-assign-ball-card">
              <div class="retailer-assign-ball-title">
                ${escapeHtml(ball.brand)} ${escapeHtml(ball.canonicalName)}
              </div>

              <div class="retailer-assign-ball-meta">
                <div><strong>Catalog:</strong> ${ball.isCurrent ? "current" : "legacy"}</div>
                <div><strong>Cover:</strong> ${escapeHtml(ball.coverstockName ?? "—")} / ${escapeHtml(ball.coverstockType ?? "—")}</div>
                <div><strong>Core:</strong> ${escapeHtml(ball.coreName ?? "—")} / ${escapeHtml(ball.coreType ?? "—")}</div>
                <div><strong>ID:</strong> ${escapeHtml(ball.id)}</div>
              </div>

              <div class="retailer-assign-ball-actions">
                <button type="button" onclick="assignRetailerReviewItemToBallV1('${escapeHtml(activeReviewItemId)}', '${escapeHtml(ball.id)}')">
                  Assign This Ball
                </button>
              </div>
            </article>
          `;
        })
        .join("");
    } catch (error) {
      results.innerHTML = `<div class="review-queue-error">${escapeHtml(error.message)}</div>`;
    }
  }

  async function assignRetailerReviewItemToBall(reviewItemId, ballId) {
    const confirmed = window.confirm(
      `Assign "${activeReviewItemTitle}" to catalog ball "${ballId}"?`
    );

    if (!confirmed) return;

    const query = encodeQuery({
      reviewItemId,
      ballId,
    });

    await apiGet(`/api/retailer-review-items/assign-existing?${query}`);

    closeAssignModal();

    if (typeof window.loadRetailerReviewQueueV1 === "function") {
      await window.loadRetailerReviewQueueV1();
    }

    if (typeof loadListings === "function") {
      await loadListings();
    }
  }

  function injectAssignButtons() {
    document.querySelectorAll("#retailerReviewQueueV1 .review-queue-card").forEach((card) => {
      if (card.querySelector(".assign-existing-ball-btn")) return;

      const reviewedButton = Array.from(card.querySelectorAll("button")).find((button) =>
        button.getAttribute("onclick")?.includes("setRetailerReviewStatusV1")
      );

      const onclick = reviewedButton?.getAttribute("onclick") ?? "";
      const idMatch = onclick.match(new RegExp("setRetailerReviewStatusV1\\\\('([^']+)'"));

      if (!idMatch?.[1]) return;

      const reviewItemId = idMatch[1];
      const title = card.querySelector(".review-queue-title")?.textContent?.trim() ?? "";

      const actions = card.querySelector(".review-queue-actions");
      if (!actions) return;

      const button = document.createElement("button");
      button.type = "button";
      button.className = "secondary assign-existing-ball-btn";
      button.textContent = "Assign Existing";
      button.addEventListener("click", () => {
        openAssignModal(reviewItemId, title);
      });

      actions.prepend(button);
    });
  }

  window.openRetailerAssignExistingModalV1 = openAssignModal;
  window.assignRetailerReviewItemToBallV1 = assignRetailerReviewItemToBall;

  const oldLoad = window.loadRetailerReviewQueueV1;
  window.loadRetailerReviewQueueV1 = async function loadRetailerReviewQueueWithAssignV1() {
    if (oldLoad) {
      await oldLoad();
    }

    setTimeout(injectAssignButtons, 0);
    setTimeout(injectAssignButtons, 150);
  };

  document.addEventListener("click", () => {
    setTimeout(injectAssignButtons, 0);
  });

  setInterval(injectAssignButtons, 1000);
})();

/* Review queue wording/assignment clarity */
(function setupRetailerReviewQueueActionClarityV1() {
  if (window.__retailerReviewQueueActionClarityV1) return;
  window.__retailerReviewQueueActionClarityV1 = true;

  function applyActionLabels() {
    document.querySelectorAll("#retailerReviewQueueV1 .review-queue-card").forEach((card) => {
      const buttons = Array.from(card.querySelectorAll("button"));

      buttons.forEach((button) => {
        const onclick = button.getAttribute("onclick") ?? "";

        if (
          onclick.includes("setRetailerReviewStatusV1") &&
          onclick.includes("'reviewed'") &&
          button.textContent?.trim() === "Reviewed"
        ) {
          button.textContent = "Mark Reviewed";
          button.title = "Marks the review item as reviewed only. This does not create a retailer listing.";
        }
      });

      const assignButton = card.querySelector(".assign-existing-ball-btn");
      if (assignButton) {
        assignButton.textContent = "Assign Existing Ball";
        assignButton.title = "Creates/updates a retailer listing by assigning this review item to an existing catalog ball.";
      }
    });
  }

  document.addEventListener("click", () => {
    setTimeout(applyActionLabels, 0);
    setTimeout(applyActionLabels, 150);
  });

  setInterval(applyActionLabels, 1000);
})();

/* Fix assign-existing modal search response + safer review queue response handling */
(function setupRetailerAssignAndQueueFixV2() {
  if (window.__retailerAssignAndQueueFixV2) return;
  window.__retailerAssignAndQueueFixV2 = true;

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function normalizeApiData(response) {
    return response?.data ?? response ?? {};
  }

  function normalizeItemsResponse(response) {
    const data = normalizeApiData(response);
    return Array.isArray(data.items) ? data.items : [];
  }

  async function fixedSearchAssignBalls() {
    const input = document.getElementById("retailerAssignSearchInputV1");
    const results = document.getElementById("retailerAssignResultsV1");

    if (!results) return;

    const q = input?.value?.trim() ?? "";

    results.innerHTML = `<p class="muted">Searching catalog balls...</p>`;

    try {
      const query = encodeQuery({
        q,
        limit: 25,
      });

      const response = await apiGet(`/api/retailer-review-items/catalog-ball-search?${query}`);
      const items = normalizeItemsResponse(response);

      if (items.length === 0) {
        results.innerHTML = `
          <p class="muted">
            No catalog balls found for "${escapeHtml(q)}".
          </p>
          <p class="muted">
            Try a shorter family search like <strong>Jackal</strong>, <strong>Venom</strong>, <strong>Primal</strong>, or leave the field blank.
          </p>
        `;
        return;
      }

      results.innerHTML = items
        .map((ball) => {
          return `
            <article class="retailer-assign-ball-card">
              <div class="retailer-assign-ball-title">
                ${escapeHtml(ball.brand)} ${escapeHtml(ball.canonicalName)}
              </div>

              <div class="retailer-assign-ball-meta">
                <div><strong>Catalog:</strong> ${ball.isCurrent ? "current" : "legacy"}</div>
                <div><strong>Cover:</strong> ${escapeHtml(ball.coverstockName ?? "—")} / ${escapeHtml(ball.coverstockType ?? "—")}</div>
                <div><strong>Core:</strong> ${escapeHtml(ball.coreName ?? "—")} / ${escapeHtml(ball.coreType ?? "—")}</div>
                <div><strong>ID:</strong> ${escapeHtml(ball.id)}</div>
              </div>

              <div class="retailer-assign-ball-actions">
                <button type="button" onclick="assignRetailerReviewItemToBallV1('${escapeHtml(window.__activeReviewItemIdV2 ?? "")}', '${escapeHtml(ball.id)}')">
                  Assign This Ball
                </button>
              </div>
            </article>
          `;
        })
        .join("");
    } catch (error) {
      results.innerHTML = `
        <div class="review-queue-error">
          Assign search failed: ${escapeHtml(error?.message ?? error)}
        </div>
      `;
    }
  }

  async function fixedOpenAssignModal(reviewItemId, listingTitle) {
    window.__activeReviewItemIdV2 = reviewItemId;
    window.__activeReviewItemTitleV2 = listingTitle;

    if (typeof openRetailerAssignExistingModalV1 === "function") {
      await openRetailerAssignExistingModalV1(reviewItemId, listingTitle);
    }

    const input = document.getElementById("retailerAssignSearchInputV1");
    const note = document.getElementById("retailerAssignNoteV1");

    if (note) {
      note.textContent = `Assigning: ${listingTitle}`;
    }

    if (input) {
      const guessed = String(listingTitle ?? "")
        .replace(/^motiv\s+/i, "")
        .replace(/\b(green|teal|black|navy|yellow|purple|orange|lime|red|grey|gray|aqua|crimson|gold|blue|solid|pearl|spare|pixel)\b/gi, " ")
        .replace(/[/-]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

      input.value = guessed || listingTitle || "";
    }

    await fixedSearchAssignBalls();
  }

  async function fixedAssignRetailerReviewItemToBall(reviewItemId, ballId) {
    const title = window.__activeReviewItemTitleV2 ?? "this review item";

    const confirmed = window.confirm(
      `Assign "${title}" to catalog ball "${ballId}" and create/update a retailer listing?`
    );

    if (!confirmed) return;

    const query = encodeQuery({
      reviewItemId,
      ballId,
    });

    await apiGet(`/api/retailer-review-items/assign-existing?${query}`);

    document.getElementById("retailerAssignExistingModalV1")?.classList.add("hidden");

    if (typeof window.loadRetailerReviewQueueV1 === "function") {
      await window.loadRetailerReviewQueueV1();
    }

    if (typeof loadListings === "function") {
      await loadListings();
    }
  }

  window.fixedSearchAssignBallsV2 = fixedSearchAssignBalls;
  window.openRetailerAssignExistingModalV1 = fixedOpenAssignModal;
  window.assignRetailerReviewItemToBallV1 = fixedAssignRetailerReviewItemToBall;

  document.addEventListener(
    "click",
    (event) => {
      const searchBtn = event.target?.closest?.("#retailerAssignSearchBtnV1");

      if (searchBtn) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        fixedSearchAssignBalls();
      }
    },
    true
  );

  document.addEventListener(
    "keydown",
    (event) => {
      if (
        event.target?.id === "retailerAssignSearchInputV1" &&
        event.key === "Enter"
      ) {
        event.preventDefault();
        fixedSearchAssignBalls();
      }
    },
    true
  );

  document.addEventListener(
    "click",
    (event) => {
      const assignButton = event.target?.closest?.(".assign-existing-ball-btn");

      if (!assignButton) return;

      const card = assignButton.closest(".review-queue-card");
      const reviewedButton = Array.from(card?.querySelectorAll("button") ?? []).find((button) =>
        button.getAttribute("onclick")?.includes("setRetailerReviewStatusV1")
      );

      const onclick = reviewedButton?.getAttribute("onclick") ?? "";
      const idMatch = onclick.match(/setRetailerReviewStatusV1\('([^']+)'/);
      const reviewItemId = idMatch?.[1] ?? "";
      const title = card?.querySelector(".review-queue-title")?.textContent?.trim() ?? "";

      if (!reviewItemId) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      fixedOpenAssignModal(reviewItemId, title);
    },
    true
  );
})();

/* Assign Existing Ball V3: standalone non-recursive modal */
(function setupRetailerAssignExistingStandaloneV3() {
  if (window.__retailerAssignExistingStandaloneV3) return;
  window.__retailerAssignExistingStandaloneV3 = true;

  let activeReviewItemId = "";
  let activeReviewItemTitle = "";

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function ensureStyles() {
    if (document.getElementById("retailerAssignExistingStylesV3")) return;

    const style = document.createElement("style");
    style.id = "retailerAssignExistingStylesV3";
    style.textContent = `
      .retailer-assign-v3-backdrop {
        position: fixed;
        inset: 0;
        z-index: 14000;
        background: rgba(15, 23, 42, 0.58);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
      }

      .retailer-assign-v3-backdrop.hidden {
        display: none;
      }

      .retailer-assign-v3-modal {
        width: min(920px, 100%);
        max-height: 90vh;
        overflow: auto;
        background: #ffffff;
        color: #172033;
        border: 1px solid #cbd5e1;
        border-radius: 18px;
        box-shadow: 0 24px 60px rgba(15, 23, 42, 0.35);
      }

      .retailer-assign-v3-head {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 16px;
        padding: 18px 22px;
        border-bottom: 1px solid #e2e8f0;
      }

      .retailer-assign-v3-body {
        padding: 20px 22px;
      }

      .retailer-assign-v3-search {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 10px;
        align-items: end;
      }

      .retailer-assign-v3-results {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
        gap: 12px;
        margin-top: 16px;
      }

      .retailer-assign-v3-card {
        border: 1px solid #dbe7f5;
        border-radius: 14px;
        padding: 12px;
        background: #fbfdff;
      }

      .retailer-assign-v3-title {
        font-weight: 800;
        margin-bottom: 6px;
      }

      .retailer-assign-v3-meta {
        color: #475569;
        font-size: 13px;
        line-height: 1.5;
        overflow-wrap: anywhere;
      }

      .retailer-assign-v3-actions {
        margin-top: 10px;
      }

      @media (max-width: 720px) {
        .retailer-assign-v3-search {
          grid-template-columns: 1fr;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function ensureModal() {
    ensureStyles();

    let modal = document.getElementById("retailerAssignExistingModalV3");
    if (modal) return modal;

    modal = document.createElement("div");
    modal.id = "retailerAssignExistingModalV3";
    modal.className = "retailer-assign-v3-backdrop hidden";
    modal.innerHTML = `
      <div class="retailer-assign-v3-modal" role="dialog" aria-modal="true">
        <div class="retailer-assign-v3-head">
          <h3>Assign Review Item to Existing Ball</h3>
          <button type="button" class="secondary" id="retailerAssignCloseBtnV3">Close</button>
        </div>

        <div class="retailer-assign-v3-body">
          <p class="muted" id="retailerAssignNoteV3"></p>

          <div class="retailer-assign-v3-search">
            <div>
              <label for="retailerAssignSearchInputV3">Search Catalog Balls</label>
              <input id="retailerAssignSearchInputV3" placeholder="Jackal, Venom, Aspire..." />
            </div>
            <button type="button" id="retailerAssignSearchBtnV3">Search</button>
          </div>

          <div class="retailer-assign-v3-results" id="retailerAssignResultsV3"></div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    document.getElementById("retailerAssignCloseBtnV3")?.addEventListener("click", closeAssignModalV3);
    document.getElementById("retailerAssignSearchBtnV3")?.addEventListener("click", searchAssignBallsV3);

    document.getElementById("retailerAssignSearchInputV3")?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        searchAssignBallsV3();
      }
    });

    modal.addEventListener("click", (event) => {
      if (event.target === modal) {
        closeAssignModalV3();
      }
    });

    return modal;
  }

  function closeAssignModalV3() {
    ensureModal().classList.add("hidden");
  }

  function guessSearchFromTitle(title) {
    return String(title ?? "")
      .replace(/^motiv\s+/i, "")
      .replace(/\b(green|teal|black|navy|yellow|purple|orange|lime|red|grey|gray|aqua|crimson|gold|blue|solid|pearl|spare|pixel)\b/gi, " ")
      .replace(/[/-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  async function openAssignModalV3(reviewItemId, listingTitle) {
    activeReviewItemId = reviewItemId;
    activeReviewItemTitle = listingTitle;

    const modal = ensureModal();
    const note = document.getElementById("retailerAssignNoteV3");
    const input = document.getElementById("retailerAssignSearchInputV3");
    const results = document.getElementById("retailerAssignResultsV3");

    if (note) note.textContent = `Assigning: ${listingTitle}`;
    if (input) input.value = guessSearchFromTitle(listingTitle) || listingTitle || "";
    if (results) results.innerHTML = `<p class="muted">Searching catalog balls...</p>`;

    modal.classList.remove("hidden");
    await searchAssignBallsV3();
  }

  async function searchAssignBallsV3() {
    const input = document.getElementById("retailerAssignSearchInputV3");
    const results = document.getElementById("retailerAssignResultsV3");
    if (!results) return;

    const q = input?.value?.trim() ?? "";
    results.innerHTML = `<p class="muted">Searching catalog balls...</p>`;

    try {
      const query = encodeQuery({ q, limit: 25 });
      const response = await apiGet(`/api/retailer-review-items/catalog-ball-search?${query}`);
      const data = response?.data ?? response ?? {};
      const items = Array.isArray(data.items) ? data.items : [];

      if (items.length === 0) {
        results.innerHTML = `
          <p class="muted">No catalog balls found for "${escapeHtml(q)}".</p>
          <p class="muted">Try a shorter search like Jackal, Venom, Primal, Aspire, or leave it blank.</p>
        `;
        return;
      }

      results.innerHTML = items.map((ball) => `
        <article class="retailer-assign-v3-card">
          <div class="retailer-assign-v3-title">${escapeHtml(ball.brand)} ${escapeHtml(ball.canonicalName)}</div>
          <div class="retailer-assign-v3-meta">
            <div><strong>Catalog:</strong> ${ball.isCurrent ? "current" : "legacy"}</div>
            <div><strong>Cover:</strong> ${escapeHtml(ball.coverstockName ?? "—")} / ${escapeHtml(ball.coverstockType ?? "—")}</div>
            <div><strong>Core:</strong> ${escapeHtml(ball.coreName ?? "—")} / ${escapeHtml(ball.coreType ?? "—")}</div>
            <div><strong>ID:</strong> ${escapeHtml(ball.id)}</div>
          </div>
          <div class="retailer-assign-v3-actions">
            <button type="button" onclick="assignRetailerReviewItemToBallV1('${escapeHtml(activeReviewItemId)}', '${escapeHtml(ball.id)}')">
              Assign This Ball
            </button>
          </div>
        </article>
      `).join("");
    } catch (error) {
      results.innerHTML = `<div class="review-queue-error">Search failed: ${escapeHtml(error?.message ?? error)}</div>`;
    }
  }

  async function assignRetailerReviewItemToBallV3(reviewItemId, ballId) {
    const confirmed = window.confirm(
      `Assign "${activeReviewItemTitle}" to "${ballId}" and create/update a retailer listing?`
    );

    if (!confirmed) return;

    const query = encodeQuery({ reviewItemId, ballId });
    await apiGet(`/api/retailer-review-items/assign-existing?${query}`);

    closeAssignModalV3();

    if (typeof window.loadRetailerReviewQueueV1 === "function") {
      await window.loadRetailerReviewQueueV1();
    }

    if (typeof loadListings === "function") {
      await loadListings();
    }
  }

  window.openRetailerAssignExistingModalV1 = openAssignModalV3;
  window.assignRetailerReviewItemToBallV1 = assignRetailerReviewItemToBallV3;
  window.searchAssignBallsV3 = searchAssignBallsV3;
})();

/* Clarify Assign Existing wording: same exact SKU only */
(function clarifyAssignExistingSameSkuV1() {
  if (window.__clarifyAssignExistingSameSkuV1) return;
  window.__clarifyAssignExistingSameSkuV1 = true;

  function applyLabels() {
    document.querySelectorAll("#retailerReviewQueueV1 .assign-existing-ball-btn").forEach((button) => {
      button.textContent = "Assign Same Existing Ball";
      button.title = "Use only when this retailer listing is the exact same SKU/ball as an existing catalog ball.";
    });

    document.querySelectorAll("#retailerReviewQueueV1 button").forEach((button) => {
      if (button.textContent?.trim() === "Assign Existing Ball") {
        button.textContent = "Assign Same Existing Ball";
        button.title = "Use only when this retailer listing is the exact same SKU/ball as an existing catalog ball.";
      }
    });
  }

  document.addEventListener("click", () => {
    setTimeout(applyLabels, 0);
    setTimeout(applyLabels, 150);
  });

  setInterval(applyLabels, 1000);
})();

/* Create Separate Ball from retailer review item */
(function setupCreateSeparateBallFromReviewV1() {
  if (window.__createSeparateBallFromReviewV1) return;
  window.__createSeparateBallFromReviewV1 = true;

  let activeReviewItemId = "";
  let activeListingTitle = "";

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function ensureStyles() {
    if (document.getElementById("createSeparateBallStylesV1")) return;

    const style = document.createElement("style");
    style.id = "createSeparateBallStylesV1";
    style.textContent = `
      .create-separate-ball-backdrop {
        position: fixed;
        inset: 0;
        z-index: 15000;
        background: rgba(15, 23, 42, 0.58);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
      }

      .create-separate-ball-backdrop.hidden {
        display: none;
      }

      .create-separate-ball-modal {
        width: min(920px, 100%);
        max-height: 90vh;
        overflow: auto;
        background: #ffffff;
        color: #172033;
        border: 1px solid #cbd5e1;
        border-radius: 18px;
        box-shadow: 0 24px 60px rgba(15, 23, 42, 0.35);
      }

      .create-separate-ball-head {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 16px;
        padding: 18px 22px;
        border-bottom: 1px solid #e2e8f0;
      }

      .create-separate-ball-body {
        padding: 20px 22px;
      }

      .create-separate-ball-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 12px;
      }

      .create-separate-ball-wide {
        grid-column: 1 / -1;
      }

      .create-separate-ball-actions {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
        padding: 16px 22px 22px;
      }

      .create-separate-ball-note {
        color: #64748b;
        font-size: 13px;
        margin-bottom: 14px;
      }

      @media (max-width: 780px) {
        .create-separate-ball-grid {
          grid-template-columns: 1fr;
        }

        .create-separate-ball-wide {
          grid-column: auto;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function ensureModal() {
    ensureStyles();

    let modal = document.getElementById("createSeparateBallModalV1");
    if (modal) return modal;

    modal = document.createElement("div");
    modal.id = "createSeparateBallModalV1";
    modal.className = "create-separate-ball-backdrop hidden";
    modal.innerHTML = `
      <div class="create-separate-ball-modal" role="dialog" aria-modal="true">
        <div class="create-separate-ball-head">
          <h3>Create Separate Ball</h3>
          <button type="button" class="secondary" id="createSeparateBallCloseBtnV1">Close</button>
        </div>

        <div class="create-separate-ball-body">
          <div class="create-separate-ball-note" id="createSeparateBallNoteV1"></div>

          <div class="create-separate-ball-grid">
            <div>
              <label for="createSeparateBallCanonicalNameV1">Canonical Name</label>
              <input id="createSeparateBallCanonicalNameV1" />
            </div>

            <div>
              <label for="createSeparateBallBrandV1">Brand</label>
              <input id="createSeparateBallBrandV1" />
            </div>

            <div>
              <label for="createSeparateBallManufacturerV1">Manufacturer</label>
              <input id="createSeparateBallManufacturerV1" />
            </div>

            <div>
              <label for="createSeparateBallCoverstockNameV1">Coverstock Name</label>
              <input id="createSeparateBallCoverstockNameV1" />
            </div>

            <div>
              <label for="createSeparateBallCoverstockTypeV1">Coverstock Type</label>
              <select id="createSeparateBallCoverstockTypeV1">
                <option value="plastic">plastic</option>
                <option value="solid">solid</option>
                <option value="pearl">pearl</option>
                <option value="hybrid">hybrid</option>
                <option value="urethane">urethane</option>
                <option value="unknown">unknown</option>
              </select>
            </div>

            <div>
              <label for="createSeparateBallFactoryFinishV1">Factory Finish</label>
              <input id="createSeparateBallFactoryFinishV1" />
            </div>

            <div>
              <label for="createSeparateBallCoreNameV1">Core Name</label>
              <input id="createSeparateBallCoreNameV1" />
            </div>

            <div>
              <label for="createSeparateBallCoreTypeV1">Core Type</label>
              <select id="createSeparateBallCoreTypeV1">
                <option value="symmetric">symmetric</option>
                <option value="asymmetric">asymmetric</option>
                <option value="pancake">pancake</option>
                <option value="unknown">unknown</option>
              </select>
            </div>

            <div>
              <label for="createSeparateBallIsCurrentV1">Current Catalog?</label>
              <select id="createSeparateBallIsCurrentV1">
                <option value="false">false / legacy</option>
                <option value="true">true / current</option>
              </select>
            </div>

            <div class="create-separate-ball-wide">
              <p class="muted">
                Use this when the retailer listing is a separate SKU/ball, such as a custom spare ball, logo ball, older colorway, or discontinued retailer inventory.
              </p>
            </div>
          </div>
        </div>

        <div class="create-separate-ball-actions">
          <button type="button" class="secondary" id="createSeparateBallCancelBtnV1">Cancel</button>
          <button type="button" id="createSeparateBallSubmitBtnV1">Create Ball + Listing</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    document.getElementById("createSeparateBallCloseBtnV1")?.addEventListener("click", closeModal);
    document.getElementById("createSeparateBallCancelBtnV1")?.addEventListener("click", closeModal);
    document.getElementById("createSeparateBallSubmitBtnV1")?.addEventListener("click", submitCreateSeparateBall);

    modal.addEventListener("click", (event) => {
      if (event.target === modal) {
        closeModal();
      }
    });

    return modal;
  }

  function setValue(id, value) {
    const input = document.getElementById(id);
    if (input) input.value = value ?? "";
  }

  function getValue(id) {
    return document.getElementById(id)?.value?.trim() ?? "";
  }

  function cleanCanonicalName(listingTitle) {
    return String(listingTitle ?? "")
      .replace(/^motiv\s+/i, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function inferDefaults(listingTitle) {
    const lower = String(listingTitle ?? "").toLowerCase();

    const spareLike = /\b(spare|pixel|liberty|stadium|crest|velocity)\b/.test(lower);

    if (spareLike) {
      return {
        coverstockName: "Polyester",
        coverstockType: "plastic",
        coreName: "Pancake",
        coreType: "symmetric",
        factoryFinish: "Polished",
      };
    }

    if (/\bpearl\b/.test(lower)) {
      return {
        coverstockName: "Unknown Pearl Reactive",
        coverstockType: "pearl",
        coreName: "",
        coreType: "unknown",
        factoryFinish: "",
      };
    }

    if (/\bsolid\b/.test(lower)) {
      return {
        coverstockName: "Unknown Solid Reactive",
        coverstockType: "solid",
        coreName: "",
        coreType: "unknown",
        factoryFinish: "",
      };
    }

    if (/\bhybrid\b/.test(lower)) {
      return {
        coverstockName: "Unknown Hybrid Reactive",
        coverstockType: "hybrid",
        coreName: "",
        coreType: "unknown",
        factoryFinish: "",
      };
    }

    return {
      coverstockName: "",
      coverstockType: "unknown",
      coreName: "",
      coreType: "unknown",
      factoryFinish: "",
    };
  }

  function closeModal() {
    ensureModal().classList.add("hidden");
  }

  function openCreateSeparateBallModal(reviewItemId, listingTitle) {
    activeReviewItemId = reviewItemId;
    activeListingTitle = listingTitle;

    const modal = ensureModal();
    const defaults = inferDefaults(listingTitle);

    document.getElementById("createSeparateBallNoteV1").textContent =
      `Creating separate ball from: ${listingTitle}`;

    setValue("createSeparateBallCanonicalNameV1", cleanCanonicalName(listingTitle));
    setValue("createSeparateBallBrandV1", "Motiv");
    setValue("createSeparateBallManufacturerV1", "Motiv");
    setValue("createSeparateBallCoverstockNameV1", defaults.coverstockName);
    setValue("createSeparateBallCoverstockTypeV1", defaults.coverstockType);
    setValue("createSeparateBallFactoryFinishV1", defaults.factoryFinish);
    setValue("createSeparateBallCoreNameV1", defaults.coreName);
    setValue("createSeparateBallCoreTypeV1", defaults.coreType);
    setValue("createSeparateBallIsCurrentV1", "false");

    modal.classList.remove("hidden");
  }

  async function submitCreateSeparateBall() {
    const canonicalName = getValue("createSeparateBallCanonicalNameV1");
    const brand = getValue("createSeparateBallBrandV1");
    const manufacturer = getValue("createSeparateBallManufacturerV1");

    if (!activeReviewItemId || !canonicalName || !brand || !manufacturer) {
      window.alert("Review item, canonical name, brand, and manufacturer are required.");
      return;
    }

    const confirmed = window.confirm(
      `Create separate ball "${brand} ${canonicalName}" from "${activeListingTitle}" and create/update its retailer listing?`
    );

    if (!confirmed) return;

    const query = encodeQuery({
      reviewItemId: activeReviewItemId,
      canonicalName,
      brand,
      manufacturer,
      coverstockName: getValue("createSeparateBallCoverstockNameV1"),
      coverstockType: getValue("createSeparateBallCoverstockTypeV1"),
      coreName: getValue("createSeparateBallCoreNameV1"),
      coreType: getValue("createSeparateBallCoreTypeV1"),
      factoryFinish: getValue("createSeparateBallFactoryFinishV1"),
      isCurrent: getValue("createSeparateBallIsCurrentV1"),
    });

    await apiGet(`/api/retailer-review-items/create-separate-ball?${query}`);

    closeModal();

    if (typeof window.loadRetailerReviewQueueV1 === "function") {
      await window.loadRetailerReviewQueueV1();
    }

    if (typeof loadListings === "function") {
      await loadListings();
    }

    if (typeof loadCatalogBalls === "function") {
      await loadCatalogBalls();
    }
  }

  function getReviewItemIdFromCard(card) {
    const buttons = Array.from(card.querySelectorAll("button"));
    const onclick = buttons
      .map((button) => button.getAttribute("onclick") ?? "")
      .find((value) =>
        value.includes("setRetailerReviewStatusV1") ||
        value.includes("openRetailerAssignExistingModalV1")
      );

    const match = onclick?.match(
      new RegExp("(?:setRetailerReviewStatusV1|openRetailerAssignExistingModalV1)\\\\('([^']+)'")
    );

    return match?.[1] ?? "";
  }

  function injectButtons() {
    document.querySelectorAll("#retailerReviewQueueV1 .review-queue-card").forEach((card) => {
      if (card.querySelector(".create-separate-ball-btn")) return;

      const reviewItemId = getReviewItemIdFromCard(card);
      const title = card.querySelector(".review-queue-title")?.textContent?.trim() ?? "";
      const actions = card.querySelector(".review-queue-actions");

      if (!reviewItemId || !title || !actions) return;

      const button = document.createElement("button");
      button.type = "button";
      button.className = "create-separate-ball-btn";
      button.textContent = "Create Separate Ball";
      button.title = "Creates a new legacy/manual ball record and attaches this retailer listing to it.";
      button.addEventListener("click", () => {
        openCreateSeparateBallModal(reviewItemId, title);
      });

      actions.prepend(button);
    });
  }

  window.openCreateSeparateBallModalV1 = openCreateSeparateBallModal;

  document.addEventListener("click", () => {
    setTimeout(injectButtons, 0);
    setTimeout(injectButtons, 150);
  });

  setInterval(injectButtons, 1000);
})();

/* Create Separate Ball button injector V2: robust id extraction */
(function forceCreateSeparateBallButtonsV2() {
  if (window.__forceCreateSeparateBallButtonsV2) return;
  window.__forceCreateSeparateBallButtonsV2 = true;

  function extractFirstQuotedArg(onclickText) {
    const text = String(onclickText ?? "");
    const marker = "('";
    const start = text.indexOf(marker);

    if (start === -1) return "";

    const argStart = start + marker.length;
    const argEnd = text.indexOf("'", argStart);

    if (argEnd === -1) return "";

    return text.slice(argStart, argEnd);
  }

  function getReviewItemIdFromCardV2(card) {
    const buttons = Array.from(card.querySelectorAll("button"));

    for (const button of buttons) {
      const onclick = button.getAttribute("onclick") ?? "";

      if (
        onclick.includes("openRetailerAssignExistingModalV1") ||
        onclick.includes("setRetailerReviewStatusV1")
      ) {
        const id = extractFirstQuotedArg(onclick);

        if (id) return id;
      }
    }

    return "";
  }

  function injectCreateButtonsV2() {
    if (typeof window.openCreateSeparateBallModalV1 !== "function") {
      return;
    }

    document.querySelectorAll("#retailerReviewQueueV1 .review-queue-card").forEach((card) => {
      if (card.querySelector(".create-separate-ball-btn")) return;

      const reviewItemId = getReviewItemIdFromCardV2(card);
      const title =
        card.querySelector(".review-queue-title")?.textContent?.trim() ?? "";
      const actions = card.querySelector(".review-queue-actions");

      if (!reviewItemId || !title || !actions) return;

      const button = document.createElement("button");
      button.type = "button";
      button.className = "create-separate-ball-btn";
      button.textContent = "Create Separate Ball";
      button.title =
        "Creates a new legacy/manual ball record and attaches this retailer listing to it.";

      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();

        window.openCreateSeparateBallModalV1(reviewItemId, title);
      });

      actions.prepend(button);
    });
  }

  window.injectCreateSeparateBallButtonsV2 = injectCreateButtonsV2;

  document.addEventListener("click", () => {
    setTimeout(injectCreateButtonsV2, 0);
    setTimeout(injectCreateButtonsV2, 150);
    setTimeout(injectCreateButtonsV2, 400);
  });

  setInterval(injectCreateButtonsV2, 750);
})();
