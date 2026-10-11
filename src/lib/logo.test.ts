import { describe, expect, it } from "vitest";
import { logoMark, logoMarkViewBox } from "./logo";

describe("logoMark geometry", () => {
  it("carries the approved single-path emblem", () => {
    expect(logoMark.path.startsWith("M 365.4 119.4")).toBe(true);
    expect(logoMark.path.endsWith("z")).toBe(true);
    expect(logoMark.path.length).toBeGreaterThan(1000);
  });

  it("keeps its artwork inside the reference canvas", () => {
    const [x0, y0, x1, y1] = logoMark.bounds;
    const [, , width, height] = logoMark.viewBox;
    expect(x0).toBeGreaterThan(0);
    expect(y0).toBeGreaterThan(0);
    expect(x1).toBeLessThan(width);
    expect(y1).toBeLessThan(height);
    expect(x1).toBeGreaterThan(x0);
    expect(y1).toBeGreaterThan(y0);
  });

  it("crops to a finite, portrait tight viewBox around the artwork", () => {
    const values = logoMarkViewBox.split(" ").map(Number);
    expect(values).toHaveLength(4);
    for (const value of values) expect(Number.isFinite(value)).toBe(true);
    const [x0, y0, width, height] = values;
    expect(width).toBeGreaterThan(0);
    expect(height).toBeGreaterThan(width);
    const [bx0, by0, bx1, by1] = logoMark.bounds;
    expect(x0).toBeLessThan(bx0);
    expect(y0).toBeLessThan(by0);
    expect(x0 + width).toBeGreaterThan(bx1);
    expect(y0 + height).toBeGreaterThan(by1);
  });
});
