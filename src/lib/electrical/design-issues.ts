import { generateDistribution, type DistributionModel } from "./circuits";
import { designReview, type CheckCategory as DesignCategory, type Check as DesignCheck, type CheckStatus } from "./review";
import { voltageDropReport } from "./routes";
import { uncoveredPoints } from "./schedule";
import { evaluateCompliance } from "../engineering/compliance/evaluate";
import type { ElectricalBuilding } from "./model";

// Phase 5: link design and compliance findings to the distribution-diagram elements
// they concern, so an engineer can trace each issue back to a board or circuit shown
// on the single-line diagram. Only findings with a defensible element mapping are
// linked; everything else is reported as project scope rather than guessed onto a board.

export type DiagramTargetKind = "board" | "circuit" | "floor";

export type DiagramTarget = {
  kind: DiagramTargetKind;
  id: string;
  label: string;
  boardId?: string;
  circuitId?: string;
  floorId?: string;
};

export type IssueLevel = CheckStatus;

export type LinkedIssue = {
  id: string;
  source: "design" | "compliance";
  category: string;
  level: IssueLevel;
  title: string;
  detail: string;
  targets: DiagramTarget[];
};

const LEVEL_ORDER: Record<IssueLevel, number> = { blocked: 0, warn: 1, manual: 2, pass: 3 };

const CATEGORY_LABELS: Record<DesignCategory, string> = {
  missing_data: "Missing data",
  geometry: "Geometry",
  loading: "Electrical loading",
  circuits: "Circuit completeness",
  phase: "Phase allocation",
  protection: "Protection coordination",
  earthing: "Earthing information",
  voltage_drop: "Voltage-drop verification",
  safety_zone: "Safety zones",
  regulatory: "Regulatory review",
};

export function diagramTargetId(target: DiagramTarget) {
  if (target.kind === "circuit") return `circuit-${target.circuitId ?? target.id}`;
  if (target.kind === "floor") return `floor-${target.floorId ?? target.id}`;
  return `board-${target.boardId ?? target.id}`;
}

export function boardTarget(boardId: string, label: string): DiagramTarget {
  return { kind: "board", id: boardId, label, boardId };
}

export function circuitTarget(boardId: string, boardName: string, circuitId: string, code: string): DiagramTarget {
  return { kind: "circuit", id: circuitId, label: `${code} @ ${boardName}`, boardId, circuitId };
}

function dedupeTargets(targets: DiagramTarget[]): DiagramTarget[] {
  const seen = new Set<string>();
  return targets.filter(target => {
    const key = `${target.kind}:${target.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function designTargets(check: DesignCheck, building: ElectricalBuilding, distribution: DistributionModel): DiagramTarget[] {
  const boardName = (id: string) => distribution.boards.find(b => b.id === id)?.name ?? id;
  const main = distribution.boards.find(b => b.kind === "main");
  switch (check.id) {
    case "loading_info":
      return main ? [boardTarget(main.id, main.name)] : [];
    case "phase": {
      if (building.service.phases === 1 || !main) return [];
      return [boardTarget(main.id, main.name)];
    }
    case "voltage_drop": {
      const drop = voltageDropReport(building, distribution);
      const over = drop.rows.filter(row => row.status === "warn");
      return dedupeTargets(over.map(row => circuitTarget(row.boardId, boardName(row.boardId), row.circuitId, row.code)));
    }
    case "point_coverage":
    case "unassigned": {
      const gaps = uncoveredPoints(building, distribution);
      const floorIds = [...new Set(gaps.map(g => g.floorId))];
      return floorIds.map(floorId => {
        const floor = building.floors.find(f => f.id === floorId);
        return { kind: "floor" as const, id: floorId, label: floor ? `Floor ${floor.code} — ${floor.name}` : floorId, floorId };
      });
    }
    default:
      return [];
  }
}

function complianceLevel(status: string): IssueLevel {
  switch (status) {
    case "PASS":
    case "NOT APPLICABLE":
      return "pass";
    case "FAIL":
      return "blocked";
    case "WARNING":
    case "MISSING DATA":
      return "warn";
    default:
      return "manual";
  }
}

function complianceTargets(checkId: string, distribution: DistributionModel): DiagramTarget[] {
  const main = distribution.boards.find(b => b.kind === "main");
  if (!main) return [];
  // Only supply/load consistency maps onto the main board; other compliance checks
  // are project-scope documentation duties with no single diagram element.
  if (checkId === "supply-consistency" || checkId === "load-evidence") return [boardTarget(main.id, main.name)];
  return [];
}

export function buildDesignIssues(building: ElectricalBuilding, distribution?: DistributionModel): LinkedIssue[] {
  const dist = distribution ?? generateDistribution(building);
  const issues: LinkedIssue[] = [];

  const review = designReview(building);
  for (const check of review.checks) {
    issues.push({
      id: `design:${check.id}`,
      source: "design",
      category: CATEGORY_LABELS[check.category],
      level: check.status,
      title: check.title,
      detail: check.detail,
      targets: designTargets(check, building, dist),
    });
  }

  const compliance = evaluateCompliance(building);
  for (const check of compliance.checks) {
    issues.push({
      id: `compliance:${check.id}`,
      source: "compliance",
      category: "Standards & compliance",
      level: complianceLevel(check.status),
      title: check.title,
      detail: `${check.status}. ${check.explanation}`,
      targets: complianceTargets(check.id, dist),
    });
  }

  return issues.sort((a, b) => {
    const byLevel = LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level];
    if (byLevel !== 0) return byLevel;
    const aLinked = a.targets.length ? 0 : 1;
    const bLinked = b.targets.length ? 0 : 1;
    if (aLinked !== bLinked) return aLinked - bLinked;
    return a.id.localeCompare(b.id);
  });
}

export function linkedIssueStats(issues: LinkedIssue[]) {
  return {
    total: issues.length,
    linked: issues.filter(i => i.targets.length > 0).length,
    projectScope: issues.filter(i => i.targets.length === 0).length,
    blocked: issues.filter(i => i.level === "blocked").length,
    warn: issues.filter(i => i.level === "warn").length,
    manual: issues.filter(i => i.level === "manual").length,
  };
}

export function issueTargetsForBoard(issues: LinkedIssue[], boardId: string): LinkedIssue[] {
  return issues.filter(issue => issue.targets.some(target => target.boardId === boardId));
}
