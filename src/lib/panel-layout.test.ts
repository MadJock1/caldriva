import { describe, expect, it } from "vitest";
import { panelLayout } from "./panel-layout";

const roof: [number, number][] = [
  [38.7223, -9.1393],
  [38.7223, -9.1391],
  [38.7224, -9.1391],
  [38.7224, -9.1393],
];

const settings = { width: 1, length: 1.6, setback: 0.2, gap: 0.1, orientation: "portrait" as const };

describe("metric solar panel placement", () => {
  it("places panels inside a confirmed compact roof polygon", () => {
    const layout = panelLayout(roof, settings, 180);
    expect(layout.panels.length).toBeGreaterThan(0);
    expect(layout.rejected.obstacle).toBe(0);
    expect(layout.warning).toContain("Metric local-plane");
  });

  it("rejects panel candidates that intersect a stored obstacle", () => {
    const withoutObstacle = panelLayout(roof, settings, 180);
    const obstacle: [number, number][] = [
      [38.722335, -9.13924],
      [38.722335, -9.13917],
      [38.722375, -9.13917],
      [38.722375, -9.13924],
    ];
    const withObstacle = panelLayout(roof, settings, 180, [obstacle]);
    expect(withObstacle.panels.length).toBeLessThan(withoutObstacle.panels.length);
    expect(withObstacle.rejected.obstacle).toBeGreaterThan(0);
  });

  it("rejects invalid obstacle geometry before placement", () => {
    const crossed: [number, number][] = [
      [38.72232, -9.13926],
      [38.72238, -9.13916],
      [38.72232, -9.13916],
      [38.72238, -9.13926],
    ];
    expect(() => panelLayout(roof, settings, 180, [crossed])).toThrow(/cross/);
  });
});
