import { describe, expect, it } from "vitest";
import { exampleProjects } from "../engineering/verification/examples";
import { generateDistribution } from "./circuits";
import { buildDesignIssues, diagramTargetId, issueTargetsForBoard, linkedIssueStats } from "./design-issues";

describe("diagram-linked issues", () => {
  it("collects issues from both the design review and the standards screening", () => {
    const issues = buildDesignIssues(exampleProjects().A);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues.some(i => i.source === "design")).toBe(true);
    expect(issues.some(i => i.source === "compliance")).toBe(true);
    // Sorted most severe first.
    const levels = issues.map(i => i.level);
    const order = { blocked: 0, warn: 1, manual: 2, pass: 3 } as const;
    for (let i = 1; i < levels.length; i += 1) expect(order[levels[i]]).toBeGreaterThanOrEqual(order[levels[i - 1]]);
  });

  it("only links targets that exist on the generated distribution diagram", () => {
    const building = exampleProjects().B;
    const distribution = generateDistribution(building);
    const boardIds = new Set(distribution.boards.map(b => b.id));
    const circuitIds = new Set(distribution.boards.flatMap(b => b.circuits.map(c => c.id)));
    const issues = buildDesignIssues(building, distribution);
    for (const issue of issues) {
      for (const target of issue.targets) {
        if (target.boardId) expect(boardIds.has(target.boardId)).toBe(true);
        if (target.circuitId) expect(circuitIds.has(target.circuitId)).toBe(true);
      }
    }
  });

  it("links the phase-balance finding to the main board only on a three-phase supply", () => {
    const building = exampleProjects().A;
    building.service = { ...building.service, phases: 3, supplyType: "three" };
    const three = buildDesignIssues(building).find(i => i.id === "design:phase")!;
    expect(three.targets[0]).toMatchObject({ kind: "board", boardId: "MDB" });
    building.service = { ...building.service, phases: 1, supplyType: "single" };
    const single = buildDesignIssues(building).find(i => i.id === "design:phase")!;
    expect(single.targets).toHaveLength(0);
  });

  it("links uncovered floor-plan points to their floor", () => {
    const building = exampleProjects().A;
    building.plans = [{
      id: "plan-G", floorId: building.floors[0].id, width: 10, depth: 8,
      rooms: [{ id: "pr1", roomId: null, apartmentId: null, label: "Unlinked room", type: "living", rect: { x: 0, y: 0, w: 4, h: 4 } }],
      points: [{ id: "p1", kind: "lighting", x: 1, y: 1, elevationM: null, symbolId: null, deviceReference: "", description: "", rotationDeg: 0, scale: 1, manufacturer: "", productReference: "", datasheetUrl: "", productVerificationStatus: "UNVERIFIED", roomId: "pr1", note: "" }],
      routes: [], cadWires: [], cadJunctions: [], routingZones: [], physicalRoutes: [],
    }];
    const issue = buildDesignIssues(building).find(i => i.id === "design:point_coverage")!;
    expect(issue.level).toBe("warn");
    expect(issue.targets[0]).toMatchObject({ kind: "floor", floorId: building.floors[0].id });
    expect(diagramTargetId(issue.targets[0])).toBe(`floor-${building.floors[0].id}`);
  });

  it("derives stable stats and per-board lookups", () => {
    const building = exampleProjects().A;
    building.service = { ...building.service, phases: 3, supplyType: "three" };
    const issues = buildDesignIssues(building);
    const stats = linkedIssueStats(issues);
    expect(stats.total).toBe(issues.length);
    expect(stats.linked + stats.projectScope).toBe(issues.length);
    const mainIssues = issueTargetsForBoard(issues, "MDB");
    expect(mainIssues.length).toBeGreaterThan(0);
    expect(mainIssues.every(i => i.targets.some(t => t.boardId === "MDB"))).toBe(true);
  });
});
