import { describe, it, expect } from "vitest";

// Pure functions extracted from app.js for testing
function positionsEqual(a, b) {
  return a.x === b.x && a.y === b.y;
}

function isOpposite(direction, next) {
  return direction.x + next.x === 0 && direction.y + next.y === 0;
}

function formatTime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r}, ${g}, ${b}`;
}

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

describe("positionsEqual", () => {
  it("returns true for matching coordinates", () => {
    expect(positionsEqual({ x: 3, y: 5 }, { x: 3, y: 5 })).toBe(true);
  });
  it("returns false when x differs", () => {
    expect(positionsEqual({ x: 3, y: 5 }, { x: 4, y: 5 })).toBe(false);
  });
  it("returns false when y differs", () => {
    expect(positionsEqual({ x: 3, y: 5 }, { x: 3, y: 6 })).toBe(false);
  });
  it("handles zero coordinates", () => {
    expect(positionsEqual({ x: 0, y: 0 }, { x: 0, y: 0 })).toBe(true);
  });
  it("handles negative coordinates", () => {
    expect(positionsEqual({ x: -1, y: -2 }, { x: -1, y: -2 })).toBe(true);
  });
});

describe("isOpposite", () => {
  it("detects left/right as opposite", () => {
    expect(isOpposite({ x: 1, y: 0 }, { x: -1, y: 0 })).toBe(true);
  });
  it("detects up/down as opposite", () => {
    expect(isOpposite({ x: 0, y: 1 }, { x: 0, y: -1 })).toBe(true);
  });
  it("returns false for perpendicular directions", () => {
    expect(isOpposite({ x: 1, y: 0 }, { x: 0, y: 1 })).toBe(false);
  });
  it("returns false for same direction", () => {
    expect(isOpposite({ x: 1, y: 0 }, { x: 1, y: 0 })).toBe(false);
  });
});

describe("formatTime", () => {
  it("formats zero milliseconds", () => {
    expect(formatTime(0)).toBe("0:00");
  });
  it("formats seconds with padding", () => {
    expect(formatTime(5000)).toBe("0:05");
  });
  it("formats minutes and seconds", () => {
    expect(formatTime(65000)).toBe("1:05");
  });
  it("formats exact minutes", () => {
    expect(formatTime(120000)).toBe("2:00");
  });
  it("handles large values", () => {
    expect(formatTime(600000)).toBe("10:00");
  });
});

describe("hexToRgb", () => {
  it("converts red", () => {
    expect(hexToRgb("#ff0000")).toBe("255, 0, 0");
  });
  it("converts green", () => {
    expect(hexToRgb("#00ff00")).toBe("0, 255, 0");
  });
  it("converts a mixed color", () => {
    expect(hexToRgb("#ff7a63")).toBe("255, 122, 99");
  });
  it("converts the neon cyan theme color", () => {
    expect(hexToRgb("#3de7ff")).toBe("61, 231, 255");
  });
});

describe("randomBetween", () => {
  it("returns values within range", () => {
    for (let i = 0; i < 100; i++) {
      const result = randomBetween(5, 10);
      expect(result).toBeGreaterThanOrEqual(5);
      expect(result).toBeLessThanOrEqual(10);
    }
  });
  it("returns integer values", () => {
    for (let i = 0; i < 50; i++) {
      const result = randomBetween(0, 100);
      expect(Number.isInteger(result)).toBe(true);
    }
  });
  it("handles min equal to max", () => {
    expect(randomBetween(7, 7)).toBe(7);
  });
});
