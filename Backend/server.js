
import "dotenv/config";
import express from "express";
import cors from "cors";
import chatRoute from "./routes/chat.js";

const app = express();
const PORT = process.env.PORT || 5000;

app.disable("x-powered-by");
app.set("trust proxy", 1);

const allowedOrigins = new Set([
  "https://nidhi-ai-blue.vercel.app",
  "http://localhost:5173",
  "http://localhost:3000",
]);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) {
        return callback(null, true);
      }

      const error = new Error("CORS blocked origin");
      error.status = 403;
      callback(error);
    },
    credentials: true,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json({ limit: "12mb" }));
app.use(express.urlencoded({ extended: true, limit: "12mb" }));

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    name: "Nidhi AI",
    message: "Your AI companion is online ❤️",
    model: process.env.MODEL || "gemma4:e2b",
    capabilities: ["text-chat", "image-analysis"],
    status: "online",
    timestamp: new Date().toISOString(),
  });
});

app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    status: "healthy",
    uptime: Math.round(process.uptime()),
  });
});

app.use("/api/chat", chatRoute);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

app.use((err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  if (err.message === "CORS blocked origin") {
    return res.status(403).json({
      success: false,
      message: "This origin is not allowed.",
    });
  }

  if (err.type === "entity.too.large") {
    return res.status(413).json({
      success: false,
      message: "Request is too large. Please use a smaller image.",
    });
  }

  console.error("[Nidhi AI Error]", err.message);

  res.status(err.status || 500).json({
    success: false,
    message:
      err.status && err.status < 500
        ? err.message
        : "Something went wrong. Please try again.",
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Nidhi AI backend running on port ${PORT}`);
  console.log(`Model: ${process.env.MODEL || "gemma4:e2b"}`);
});
