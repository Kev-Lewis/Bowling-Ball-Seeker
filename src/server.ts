import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { ballRoutes } from "./routes/ballRoutes";
import { priceRoutes } from "./routes/priceRoutes";
import { statsRoutes } from "./routes/statsRoutes";
import { eventRoutes } from "./routes/eventRoutes";
import { catalogSyncRoutes } from "./routes/catalogSyncRoutes";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

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

app.listen(PORT, () => {
  console.log(`Bowling Ball Seeker API running on http://localhost:${PORT}`);
});