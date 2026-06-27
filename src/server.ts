import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { ballRoutes } from "./routes/ballRoutes";
import { priceRoutes } from "./routes/priceRoutes";
import { statsRoutes } from "./routes/statsRoutes";
import { eventRoutes } from "./routes/eventRoutes";
import { catalogSyncRoutes } from "./routes/catalogSyncRoutes";
import { scrapeRunRoutes } from "./routes/scrapeRunRoutes";
import { scraperRoutes } from "./routes/scraperRoutes";
import { catalogRoutes } from "./routes/catalogRoutes";
import { jobRoutes } from "./routes/jobRoutes";
import { startLocalScheduler } from "./scheduler/localScheduler";
import { retailerRoutes } from "./routes/retailerRoutes";
import { priceChangeRoutes } from "./routes/priceChangeRoutes";
import { alertRoutes } from "./routes/alertRoutes";
import { dealRoutes } from "./routes/dealRoutes";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.use("/admin", express.static(path.join(process.cwd(), "public", "admin")));

const PORT = process.env.PORT || 3000;

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "Bowling Ball Seeker API",
    version: "0.1.0",
  });
});

app.use("/api/balls", ballRoutes);
app.use("/api/prices", priceRoutes);
app.use("/api/stats", statsRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/catalog-sync", catalogSyncRoutes);
app.use("/api/scrape-runs", scrapeRunRoutes);
app.use("/api/scrapers", scraperRoutes);
app.use("/api/catalog", catalogRoutes);
app.use("/api/jobs", jobRoutes);
app.use("/api/retailers", retailerRoutes);
app.use("/api/price-changes", priceChangeRoutes);
app.use("/api/alerts", alertRoutes);
app.use("/api/deals", dealRoutes);

app.listen(PORT, () => {
  console.log(`Bowling Ball Seeker API running on http://localhost:${PORT}`);
});

app.listen(PORT, () => {
  console.log(`Bowling Ball Seeker API running on http://localhost:${PORT}`);
  startLocalScheduler();
});