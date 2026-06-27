const globalStatus = document.getElementById("globalStatus");
const globalStatusText = document.getElementById("globalStatusText");

let activeListingDetailId = null;
let activeCatalogBallDetailId = null;
let navHighlightTimeout = null;
let lastScrapeOutput = null;
let lastCandidatePreviewOutput = null;
let dashboardSummaryRefreshTimeout = null;
let lastTrackedSources = [];
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
              <button onclick="runTrackedSourceFromEncoded('${encodedSourceId}')">Run</button>
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