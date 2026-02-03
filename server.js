import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const app = express();
app.use(express.json());

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin =
  supabaseUrl && serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false },
      })
    : null;

if (!supabaseAdmin) {
  console.warn("Supabase admin client not configured. Set env vars to enable writes.");
}

const rateLimitStore = new Map();
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60_000;

function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0].trim();
  }
  return req.ip || "unknown";
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
    z.number().int().min(0).max(1_000_000)
  ),
});

app.post("/api/score", async (req, res) => {
  if (!supabaseAdmin) {
    return res.status(500).json({ error: "Server not configured." });
  }
  const ip = getClientIp(req);
  if (isRateLimited(ip)) {
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
    return res.status(500).json({ error: "Unable to record score." });
  }
  return res.status(200).json({ ok: true });
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use(express.static(__dirname));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server listening on ${port}`);
});
