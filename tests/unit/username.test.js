import { describe, it, expect } from "vitest";

// Extracted from app.js normalizeUsername logic
function normalizeUsername(value) {
  if (!value) return "";
  const collapsed = value.replace(/\s+/g, " ").trim();
  if (collapsed.length < 1 || collapsed.length > 24) return "";
  if (/[\u0000-\u001F\u007F]/.test(collapsed)) return "";
  return collapsed;
}

describe("normalizeUsername", () => {
  it("trims and collapses whitespace", () => {
    expect(normalizeUsername("  hello   world  ")).toBe("hello world");
  });
  it("returns empty string for null", () => {
    expect(normalizeUsername(null)).toBe("");
  });
  it("returns empty string for undefined", () => {
    expect(normalizeUsername(undefined)).toBe("");
  });
  it("returns empty string for empty input", () => {
    expect(normalizeUsername("")).toBe("");
  });
  it("rejects strings over 24 characters", () => {
    expect(normalizeUsername("a".repeat(25))).toBe("");
  });
  it("accepts exactly 24 characters", () => {
    expect(normalizeUsername("a".repeat(24))).toBe("a".repeat(24));
  });
  it("accepts single character", () => {
    expect(normalizeUsername("A")).toBe("A");
  });
  it("rejects control characters", () => {
    expect(normalizeUsername("hello\x00world")).toBe("");
    expect(normalizeUsername("test\x1F")).toBe("");
    expect(normalizeUsername("del\x7F")).toBe("");
  });
  it("preserves special characters", () => {
    expect(normalizeUsername("Player #1!")).toBe("Player #1!");
  });
  it("preserves unicode", () => {
    expect(normalizeUsername("Spieler")).toBe("Spieler");
  });
});
