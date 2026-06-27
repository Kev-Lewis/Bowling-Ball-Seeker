import express from "express";
import cors from "cors";
import dotenv from "dotenv";

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

app.get("/api/balls", (_req, res) => {
  res.json({
    message: "Ball catalog endpoint coming soon.",
    data: [],
  });
});

app.get("/api/prices", (_req, res) => {
  res.json({
    message: "Price tracking endpoint coming soon.",
    data: [],
  });
});

app.listen(PORT, () => {
  console.log(`Bowling Ball Seeker API running on http://localhost:${PORT}`);
});