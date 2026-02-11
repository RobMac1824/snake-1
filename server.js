import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { z } from "zod";
import cors from "cors";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.set("trust proxy", process.env.TRUST_PROXY === "true" ? 1 : false);
app.disable("x-powered-by");

app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});

// --- Logging ---
function log(level, message, data = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    data,
  };
  console[level === "error" ? "error" : "log"](JSON.stringify(entry));
}

// --- CORS ---
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
  : false;

app.use(
  cors({
    origin: allowedOrigins,
    methods: ["GET", "POST"],
  }),
);

app.use(express.json({ limit: "10kb" }));

// --- Supabase ---
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin =
  supabaseUrl && serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false },
      })
    : null;

if (!supabaseAdmin) {
  log("warn", "Supabase admin client not configured. Set env vars to enable writes.");
}

// --- Rate Limiting ---
const rateLimitStore = new Map();
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60_000;

// Periodic cleanup to prevent memory leak
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore) {
    if (now - entry.start > RATE_WINDOW_MS) {
      rateLimitStore.delete(key);
    }
  }
}, RATE_WINDOW_MS);

function getClientIp(req) {
  return req.ip || req.socket.remoteAddress || "unknown";
}

function isRateLimited(key) {
  const now = Date.now();
  const current = rateLimitStore.get(key);
  if (!current || now - current.start > RATE_WINDOW_MS) {
    rateLimitStore.set(key, { start: now, count: 1 });
    return false;
  }
  current.count += 1;
  if (current.count > RATE_LIMIT) {
    return true;
  }
  return false;
}

// --- Validation ---
const UsernameSchema = z
  .string()
  .transform((value) => value.replace(/\s+/g, " ").trim())
  .refine((value) => value.length >= 1 && value.length <= 24, {
    message: "Username must be 1-24 characters.",
  })
  .refine((value) => !/[\u0000-\u001F\u007F]/.test(value), {
    message: "Username contains invalid characters.",
  });

const ScoreSchema = z.object({
  username: UsernameSchema,
  score: z.preprocess(
    (value) => (typeof value === "string" ? Number(value) : value),
    z.number().int().min(0).max(1_000_000),
  ),
});

// --- API Routes ---
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.post("/api/score", async (req, res) => {
  try {
    if (!supabaseAdmin) {
      return res.status(500).json({ error: "Server not configured." });
    }
    const ip = getClientIp(req);
    if (isRateLimited(ip)) {
      log("warn", "Rate limited", { ip });
      return res.status(429).json({ error: "Too many requests. Try again soon." });
    }
    const result = ScoreSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: "Invalid input." });
    }
    const { username, score } = result.data;
    const { error } = await supabaseAdmin.rpc("upsert_high_score", {
      p_username: username,
      p_score: score,
    });
    if (error) {
      log("error", "Score submission failed", { error: error.message });
      return res.status(500).json({ error: "Unable to record score." });
    }
    log("info", "Score submitted", { username, score });
    return res.status(200).json({ ok: true });
  } catch (err) {
    log("error", "Unexpected score submission error", { error: err.message });
    return res.status(500).json({ error: "Internal server error." });
  }
});

app.all("/api/*", (_req, res) => {
  res.status(404).json({ error: "Not found." });
});

// --- Static Files (ONLY from public/) ---
const publicDir = path.join(__dirname, "public");
app.use(express.static(publicDir));

app.get("*", (_req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  log("error", "Unhandled error", { error: err.message });
  res.status(500).json({ error: "Internal server error." });
});

// --- Server Start ---
const port = process.env.PORT || 3000;
let server;

if (process.env.NODE_ENV !== "test") {
  server = app.listen(port, () => {
    log("info", "Server listening", { port });
  });
}

function shutdown() {
  log("info", "Shutting down gracefully");
  clearInterval(cleanupInterval);
  if (server) {
    server.close(() => process.exit(0));
  } else {
    process.exit(0);
  }
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

export default app;
