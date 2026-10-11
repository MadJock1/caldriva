"use client";
import { generateDistribution, circuitTypeLabels, pointCoverageStats, schedulePoints, uncoveredPoints, voltageDropReport, csaFor, CIRCUIT_TYPES, type Board, type ElectricalBuilding, type Feeder } from "@/lib/electrical";

const kva = (va: number) => `${(va / 1000).toFixed(1)} kVA`;

type Placed = { board: Board; x: number; y: number };

const COLUMN: Record<Board["kind"], number> = { main: 0, common: 1, floor: 2, apartment: 3 };
const BOX_W = 132;
const BOX_H = 38;
const COL_W = 194;
const V_GAP = 16;
const ORIGIN_X = 24;
const ORIGIN_Y = 30;

function layoutBoards(boards: Board[]): Placed[] {
  const columns = new Map<number, Board[]>();
  for (const board of boards) {
    const col = COLUMN[board.kind];
    const list = columns.get(col) ?? [];
    list.push(board);
    columns.set(col, list);
  }
  const placed: Placed[] = [];
  for (const [col, list] of columns) {
    list.forEach((board, i) => {
      placed.push({ board, x: ORIGIN_X + col * COL_W, y: ORIGIN_Y + i * (BOX_H + V_GAP) });
    });
  }
  return placed;
}

function Center(p: Placed) {
  return { cx: p.x + BOX_W / 2, cy: p.y + BOX_H / 2, right: p.x + BOX_W, left: p.x, y: p.y + BOX_H / 2 };
}

function SingleLine({ boards, feeders }: { boards: Board[]; feeders: Feeder[] }) {
  const placed = layoutBoards(boards);
  const byId = new Map(placed.map(p => [p.board.id, p]));
  const columnCounts = new Map<number, number>();
  for (const board of boards) columnCounts.set(COLUMN[board.kind], (columnCounts.get(COLUMN[board.kind]) ?? 0) + 1);
  const rows = Math.max(1, ...columnCounts.values());
  const height = ORIGIN_Y + rows * (BOX_H + V_GAP) + 30;
  const width = ORIGIN_X + 4 * COL_W;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="img" aria-label="Single-line distribution diagram" className="bg-background rounded-lg border border-border">
      <defs>
        <marker id="arrow-sld" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 z" fill="var(--color-text-muted)" /></marker>
      </defs>
      {feeders.map(feeder => {
        const from = byId.get(feeder.from);
        const to = byId.get(feeder.to);
        if (!from || !to) return null;
        const a = Center(from);
        const b = Center(to);
        const midX = (a.right + b.left) / 2;
        const d = `M ${a.right} ${a.y} H ${midX} V ${b.y} H ${b.left}`;
        return <path key={feeder.id} d={d} fill="none" stroke="var(--color-border-strong)" strokeWidth={1.5} markerEnd="url(#arrow-sld)" />;
      })}
      {placed.map(({ board, x, y }) => (
        <g key={board.id}>
          <rect x={x} y={y} width={BOX_W} height={BOX_H} rx={7} fill="var(--color-surface)" stroke={board.kind === "main" ? "var(--color-primary)" : "var(--color-border)"} strokeWidth={board.kind === "main" ? 2 : 1} />
          <text x={x + 8} y={y + 16} fill="var(--color-text-primary)" fontSize={11} fontWeight={600}>{board.name.length > 20 ? `${board.name.slice(0, 19)}…` : board.name}</text>
          <text x={x + 8} y={y + 30} fill="var(--color-text-muted)" fontSize={10}>{kva(board.totals.demandVA)} · {board.currentA.toFixed(0)} A</text>
        </g>
      ))}
    </svg>
  );
}

function Riser({ building }: { building: ElectricalBuilding }) {
  const apartments = building.floors.map(f => ({ floor: f, count: f.apartments.length }));
  const floorsAsc = [...building.floors].sort((a, b) => a.level - b.level);
  const rowH = 54;
  const height = 60 + (floorsAsc.length + 1) * rowH;
  const width = 620;
  const riserX = 150;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="img" aria-label="Riser diagram" className="bg-background rounded-lg border border-border">
      <rect x={40} y={height - 46} width={110} height={34} rx={7} fill="var(--color-surface)" stroke="var(--color-primary)" strokeWidth={2} />
      <text x={52} y={height - 25} fill="var(--color-text-primary)" fontSize={11} fontWeight={600}>MDB</text>
      <line x1={riserX} y1={height - 29} x2={riserX} y2={30} stroke="var(--color-border-strong)" strokeWidth={3} />
      {floorsAsc.map((floor, i) => {
        const y = 40 + i * rowH;
        const apts = apartments.find(a => a.floor.id === floor.id)?.count ?? 0;
        return (
          <g key={floor.id}>
            <line x1={riserX} y1={y} x2={riserX + 60} y2={y} stroke="var(--color-border-strong)" strokeWidth={1.5} />
            <circle cx={riserX} cy={y} r={4} fill="var(--color-primary)" />
            <rect x={riserX + 60} y={y - 15} width={110} height={30} rx={6} fill="var(--color-surface)" stroke="var(--color-border)" />
            <text x={riserX + 68} y={y + 4} fill="var(--color-text-primary)" fontSize={11}>FDB {floor.code}</text>
            <text x={riserX + 180} y={y + 4} fill="var(--color-text-muted)" fontSize={11}>{floor.name} · {apts} apt.</text>
          </g>
        );
      })}
    </svg>
  );
}

export function DistributionView({ building, onChange }: { building: ElectricalBuilding; onChange?: (b: ElectricalBuilding) => void }) {
  const distribution = generateDistribution(building);
  const schedule = schedulePoints(building, distribution);
  const coverage = pointCoverageStats(building, distribution);
  const gaps = uncoveredPoints(building, distribution);
  const drop = voltageDropReport(building, distribution);
  const hasPoints = building.plans.some(p => p.points.length > 0);
  const assumptions = building.cableAssumptions;
  const setAssumptions = (next: typeof assumptions) => onChange?.({ ...building, cableAssumptions: next });
  return (
    <div className="space-y-6">
      {distribution.warnings.length > 0 && (
        <ul className="bg-warning-muted border border-warning/40 rounded-xl p-4 space-y-1 text-sm text-warning">
          {distribution.warnings.map((w, i) => <li key={i}>{w}</li>)}
        </ul>
      )}

      <section className="bg-surface border border-border rounded-xl p-5">
        <h3 className="font-semibold text-lg mb-2">Single-line diagram</h3>
        <p className="text-sm text-text-muted mb-4">{distribution.boards.length} boards · {distribution.circuitCount} circuits. Schematic topology only — not a construction drawing.</p>
        <div className="overflow-auto"><SingleLine boards={distribution.boards} feeders={distribution.feeders} /></div>
      </section>

      <section className="bg-surface border border-border rounded-xl p-5">
        <h3 className="font-semibold text-lg mb-2">Riser diagram</h3>
        <p className="text-sm text-text-muted mb-4">Vertical distribution from the main board through floor boards. Cable sizes and protective devices are not selected.</p>
        <div className="overflow-auto"><Riser building={building} /></div>
      </section>

      {coverage.total > 0 && (
        <section className="bg-surface border border-border rounded-xl p-5">
          <h3 className="font-semibold text-lg mb-2">Point schedule</h3>
          <p className="text-sm text-text-muted mb-4">
            Circuits traced from the placed floor-plan points. {coverage.covered} of {coverage.total} circuit-requiring point(s) sit on {coverage.circuitsUsed} circuit(s).
            Switches and data outlets are control/information devices and are not counted.
          </p>
          {gaps.length > 0 && (
            <ul className="bg-warning-muted border border-warning/40 rounded-xl p-3 mb-4 space-y-1 text-sm text-warning">
              {gaps.slice(0, 8).map(gap => (
                <li key={gap.point.id}>{gap.point.kind} point at ({gap.point.x.toFixed(1)}, {gap.point.y.toFixed(1)}) m has no circuit — link its room to the hierarchy and generate a distribution.</li>
              ))}
              {gaps.length > 8 && <li>…and {gaps.length - 8} more.</li>}
            </ul>
          )}
          {schedule.length === 0 ? (
            <p className="text-sm text-text-muted">No points are placed on any circuit yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-text-muted"><th className="p-2">Ref</th><th className="p-2">Board</th><th className="p-2">Function</th><th className="p-2">Type</th><th className="p-2">Phase</th><th className="p-2">Points</th><th className="p-2">Rooms served</th><th className="p-2 text-right">Demand VA</th></tr></thead>
                <tbody>
                  {schedule.map(row => (
                    <tr key={row.circuitId} className="border-t border-border/60">
                      <td className="p-2 font-mono">{row.code}</td>
                      <td className="p-2 font-mono">{row.boardId}</td>
                      <td className="p-2">{row.function}</td>
                      <td className="p-2">{circuitTypeLabels[row.type]}</td>
                      <td className="p-2 font-mono">{row.phase ?? "—"}</td>
                      <td className="p-2 tabular-nums">{row.pointCount}</td>
                      <td className="p-2 text-text-muted">{row.rooms.join(", ")}</td>
                      <td className="p-2 tabular-nums text-right">{row.demandVA.toFixed(0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {hasPoints && (
        <section className="bg-surface border border-border rounded-xl p-5">
          <h3 className="font-semibold text-lg mb-2">Route lengths &amp; voltage drop</h3>
          <p className="text-sm text-text-muted mb-4">
            Preliminary estimate from the cable-route sketch using the assumed conductor material and cross-sections below. Routes are L-shaped
            Manhattan sketches; the worst branch per circuit is used. Confirm against the final cable schedule and measured lengths.
          </p>
          <div className="flex flex-wrap items-end gap-3 mb-4">
            <label className="text-sm">Material
              <select className="ml-2 border border-border bg-surface rounded-lg p-2 text-sm" value={assumptions.material} disabled={!onChange} onChange={e => setAssumptions({ ...assumptions, material: e.target.value as typeof assumptions.material })}>
                <option value="copper">Copper</option>
                <option value="aluminium">Aluminium</option>
              </select>
            </label>
            <label className="text-sm">Max drop target (%)
              <input type="number" min={0.5} max={10} step={0.5} value={assumptions.maxDropPercent} disabled={!onChange} onChange={e => { const n = e.target.valueAsNumber; if (Number.isFinite(n)) setAssumptions({ ...assumptions, maxDropPercent: Math.min(10, Math.max(0.5, n)) }); }} className="w-24 ml-2 border border-border bg-surface rounded-lg p-2 text-sm" />
            </label>
            {drop.rows.length > 0 && (
              <span className={`text-sm ${drop.overLimit ? "text-warning" : "text-success"}`}>
                Worst case {drop.maxDropPercent.toFixed(2)}% · {drop.overLimit} over limit
              </span>
            )}
          </div>
          <details className="mb-4">
            <summary className="cursor-pointer text-sm">Assumed cable cross-sections (mm²)</summary>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-3">
              {CIRCUIT_TYPES.map(type => (
                <label key={type} className="text-xs text-text-muted">{circuitTypeLabels[type]}
                  <input type="number" min={0.5} max={400} step={0.5} value={csaFor(type, assumptions)} disabled={!onChange} onChange={e => { const n = e.target.valueAsNumber; if (Number.isFinite(n)) setAssumptions({ ...assumptions, csaByType: { ...assumptions.csaByType, [type]: Math.min(400, Math.max(0.5, n)) } }); }} className="mt-1 w-full border border-border bg-surface rounded-lg p-1.5 text-sm" />
                </label>
              ))}
            </div>
          </details>
          {drop.rows.length === 0 ? (
            <p className="text-sm text-text-muted">No cable routes sketched yet. Open the Plan step and click &ldquo;Auto-route points&rdquo;, then return here.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-text-muted"><th className="p-2">Ref</th><th className="p-2">Board</th><th className="p-2">Type</th><th className="p-2">Phases</th><th className="p-2">Worst length (m)</th><th className="p-2">CSA (mm²)</th><th className="p-2">Current (A)</th><th className="p-2">Drop (V)</th><th className="p-2">Drop (%)</th></tr></thead>
                <tbody>
                  {drop.rows.map(row => (
                    <tr key={row.circuitId} className="border-t border-border/60">
                      <td className="p-2 font-mono">{row.code}</td>
                      <td className="p-2 font-mono">{row.boardId}</td>
                      <td className="p-2">{circuitTypeLabels[row.type]}</td>
                      <td className="p-2 font-mono">{row.phases === 3 ? "3~" : "1~"}</td>
                      <td className="p-2 tabular-nums">{row.lengthM.toFixed(1)}</td>
                      <td className="p-2 tabular-nums">{row.csaMm2}</td>
                      <td className="p-2 tabular-nums">{row.currentA.toFixed(1)}</td>
                      <td className="p-2 tabular-nums">{row.dropVolts.toFixed(2)}</td>
                      <td className={`p-2 tabular-nums ${row.status === "warn" ? "text-warning" : ""}`}>{row.dropPercent.toFixed(2)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <section className="bg-surface border border-border rounded-xl p-5">
        <h3 className="font-semibold text-lg mb-3">Board schedule</h3>
        <div className="space-y-4">
          {distribution.boards.map(board => (
            <div key={board.id} className="border border-border rounded-lg">
              <div className="flex flex-wrap justify-between gap-2 p-3 border-b border-border">
                <strong>{board.name}</strong>
                <span className="text-sm text-text-muted">{board.kind} · {kva(board.totals.demandVA)} · {board.currentA.toFixed(0)} A</span>
              </div>
              {board.circuits.length === 0 ? (
                <p className="p-3 text-sm text-text-muted">No outgoing circuits.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="text-left text-text-muted"><th className="p-2">Ref</th><th className="p-2">Function</th><th className="p-2">Type</th><th className="p-2">Phase</th><th className="p-2">Demand VA</th><th className="p-2">Current A</th></tr></thead>
                    <tbody>
                      {board.circuits.map(circuit => (
                        <tr key={circuit.id} className="border-t border-border/60">
                          <td className="p-2 font-mono">{circuit.code}</td>
                          <td className="p-2">{circuit.function}</td>
                          <td className="p-2">{circuitTypeLabels[circuit.type]}</td>
                          <td className="p-2 font-mono">{circuit.phases === 3 ? "3~" : circuit.phase ?? "—"}</td>
                          <td className="p-2 tabular-nums">{circuit.totals.demandVA.toFixed(0)}</td>
                          <td className="p-2 tabular-nums">{circuit.currentA.toFixed(1)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
