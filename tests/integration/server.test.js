import { describe, it, expect } from "vitest";
import { z } from "zod";

// Re-create the validation schemas from server.js
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

describe("ScoreSchema validation", () => {
  it("accepts valid score submission", () => {
    const result = ScoreSchema.safeParse({ username: "player1", score: 100 });
    expect(result.success).toBe(true);
    expect(result.data.username).toBe("player1");
    expect(result.data.score).toBe(100);
  });

  it("rejects negative scores", () => {
    const result = ScoreSchema.safeParse({ username: "player1", score: -10 });
    expect(result.success).toBe(false);
  });

  it("rejects scores over 1 million", () => {
    const result = ScoreSchema.safeParse({ username: "player1", score: 1_000_001 });
    expect(result.success).toBe(false);
  });

  it("accepts score of exactly 1 million", () => {
    const result = ScoreSchema.safeParse({ username: "player1", score: 1_000_000 });
    expect(result.success).toBe(true);
  });

  it("accepts score of zero", () => {
    const result = ScoreSchema.safeParse({ username: "player1", score: 0 });
    expect(result.success).toBe(true);
  });

  it("rejects empty username", () => {
    const result = ScoreSchema.safeParse({ username: "", score: 50 });
    expect(result.success).toBe(false);
  });

  it("rejects whitespace-only username", () => {
    const result = ScoreSchema.safeParse({ username: "   ", score: 50 });
    expect(result.success).toBe(false);
  });

  it("coerces string scores to numbers", () => {
    const result = ScoreSchema.safeParse({ username: "p1", score: "42" });
    expect(result.success).toBe(true);
    expect(result.data.score).toBe(42);
  });

  it("rejects float scores", () => {
    const result = ScoreSchema.safeParse({ username: "p1", score: 42.5 });
    expect(result.success).toBe(false);
  });

  it("rejects non-numeric score strings", () => {
    const result = ScoreSchema.safeParse({ username: "p1", score: "abc" });
    expect(result.success).toBe(false);
  });

  it("trims username whitespace", () => {
    const result = ScoreSchema.safeParse({ username: "  player  ", score: 10 });
    expect(result.success).toBe(true);
    expect(result.data.username).toBe("player");
  });

  it("rejects username with control characters", () => {
    const result = ScoreSchema.safeParse({ username: "player\x00", score: 10 });
    expect(result.success).toBe(false);
  });

  it("rejects missing fields", () => {
    expect(ScoreSchema.safeParse({}).success).toBe(false);
    expect(ScoreSchema.safeParse({ username: "p1" }).success).toBe(false);
    expect(ScoreSchema.safeParse({ score: 10 }).success).toBe(false);
  });
});

describe("UsernameSchema validation", () => {
  it("accepts valid usernames", () => {
    expect(UsernameSchema.safeParse("Player1").success).toBe(true);
    expect(UsernameSchema.safeParse("A").success).toBe(true);
    expect(UsernameSchema.safeParse("a".repeat(24)).success).toBe(true);
  });

  it("rejects invalid usernames", () => {
    expect(UsernameSchema.safeParse("").success).toBe(false);
    expect(UsernameSchema.safeParse("a".repeat(25)).success).toBe(false);
    expect(UsernameSchema.safeParse("test\x00").success).toBe(false);
  });

  it("collapses whitespace", () => {
    const result = UsernameSchema.safeParse("  hello   world  ");
    expect(result.success).toBe(true);
    expect(result.data).toBe("hello world");
  });
});
