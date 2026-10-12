import { describe, expect, it } from "vitest";
import { findPhysicalRoute, type FloorPlan, type RoutingZone } from "./index";

const zone = (overrides: Partial<RoutingZone> = {}): RoutingZone => ({ id: "ceiling", label: "Confirmed ceiling void", type: "ceiling_zone", containment: "ceiling_void", polyline: [{ x: 0, y: 0, z: 2.7 }, { x: 4, y: 0, z: 2.7 }], widthM: 0.1, heightM: 0.1, material: "PVC", installationMethod: "Accessible void", firePerformance: null, availableRoutingZone: "Ceiling void", crossingElement: null, crossingId: null, crossingReviewed: false, reviewStatus: "UNREVIEWED", ...overrides });
const plan = (routingZones: RoutingZone[]): FloorPlan => ({ id: "p", floorId: "f", width: 10, depth: 10, rooms: [], points: [], routes: [], cadWires: [], cadJunctions: [], routingZones, physicalRoutes: [] });

describe("physical routing", () => {
  it("uses a confirmed ceiling pathway with metric cable length", () => {
    const result = findPhysicalRoute(plan([zone()]), { x: 0, y: 0, z: 2.7 }, { x: 4, y: 0, z: 2.7 });
    expect(result.route?.segments[0].containment).toBe("ceiling_void");
    expect(result.circuitCableLengthM).toBeCloseTo(4);
    expect(result.uniqueContainmentLengthM).toBeCloseTo(4);
  });

  it("uses an explicitly modeled non-structural wall route for a socket connection", () => {
    const wall = zone({ containment: "concealed_wall", type: "wall_zone", polyline: [{ x: 0, y: 1, z: 0.3 }, { x: 4, y: 1, z: 0.3 }, { x: 4, y: 1, z: 1.1 }], crossingElement: "non_structural_partition", crossingReviewed: true, reviewStatus: "REVIEWED" });
    const result = findPhysicalRoute(plan([wall]), { x: 0, y: 1, z: 0.3 }, { x: 4, y: 1, z: 1.1 });
    expect(result.route?.segments.map(segment => segment.containment)).toEqual(["concealed_wall", "concealed_wall"]);
    expect(result.circuitCableLengthM).toBeCloseTo(4.8);
  });

  it("uses only modeled paths around an obstacle instead of crossing open space", () => {
    const around = zone({ polyline: [{ x: 0, y: 0, z: 2.7 }, { x: 0, y: 2, z: 2.7 }, { x: 4, y: 2, z: 2.7 }, { x: 4, y: 0, z: 2.7 }] });
    const result = findPhysicalRoute(plan([around]), { x: 0, y: 0, z: 2.7 }, { x: 4, y: 0, z: 2.7 });
    expect(result.circuitCableLengthM).toBeCloseTo(8);
    expect(result.route?.segments).toHaveLength(3);
  });

  it.each([
    ["unknown wall", zone({ crossingElement: "unknown" }), "UNKNOWN_ELEMENT"],
    ["load-bearing wall", zone({ crossingElement: "load_bearing_wall" }), "STRUCTURAL_CROSSING"],
    ["fire partition", zone({ crossingElement: "fire_rated_partition" }), "FIRE_PENETRATION_UNREVIEWED"],
    ["floor crossing without riser", zone({ crossingElement: "floor_slab" }), "FLOOR_CROSSING_WITHOUT_RISER"],
    ["beam", zone({ crossingElement: "beam" }), "BEAM_OR_COLUMN"],
  ] as const)("blocks %s without an approved construction path", (_label, restricted, code) => {
    const result = findPhysicalRoute(plan([restricted]), { x: 0, y: 0, z: 2.7 }, { x: 4, y: 0, z: 2.7 });
    expect(result.route).toBeNull(); expect(result.diagnostics.map(d => d.code)).toContain(code);
  });

  it("allows a reviewed floor-to-floor riser", () => {
    const riser = zone({ id: "riser", type: "riser", containment: "vertical_riser", polyline: [{ x: 2, y: 2, z: 0 }, { x: 2, y: 2, z: 3 }], crossingElement: "floor_slab", crossingReviewed: true, reviewStatus: "REVIEWED" });
    expect(findPhysicalRoute(plan([riser]), { x: 2, y: 2, z: 0 }, { x: 2, y: 2, z: 3 }).route?.segments).toHaveLength(1);
  });

  it("reports missing zones and no available route", () => {
    const result = findPhysicalRoute(plan([]), { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 });
    expect(result.diagnostics.map(d => d.code)).toEqual(["MISSING_CONTAINMENT_ZONES", "NO_VERIFIED_PHYSICAL_ROUTE_AVAILABLE"]);
  });

  it("rejects invalid elevations instead of creating a physical route", () => {
    const result = findPhysicalRoute(plan([zone({ polyline: [{ x: 0, y: 0, z: -1 }, { x: 4, y: 0, z: 2.7 }] })]), { x: 0, y: 0, z: -1 }, { x: 4, y: 0, z: 2.7 });
    expect(result.route).toBeNull(); expect(result.diagnostics.map(d => d.code)).toContain("INVALID_ELEVATION");
  });

  it("flags missing containment capacity and unreviewed shared use", () => {
    const shared = zone({ widthM: null, heightM: null });
    const base = plan([shared]);
    const first = findPhysicalRoute(base, { x: 0, y: 0, z: 2.7 }, { x: 4, y: 0, z: 2.7 }).route!;
    const result = findPhysicalRoute({ ...base, physicalRoutes: [first] }, { x: 0, y: 0, z: 2.7 }, { x: 4, y: 0, z: 2.7 });
    expect(result.diagnostics.map(d => d.code)).toContain("MISSING_CAPACITY_DATA");
    expect(result.diagnostics.map(d => d.code)).toContain("UNCONFIRMED_SHARED_CONTAINMENT");
  });
});
