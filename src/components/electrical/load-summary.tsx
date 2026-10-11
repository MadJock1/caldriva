"use client";
import { buildingSummary, formatWatts, PHASES, type ElectricalBuilding } from "@/lib/electrical";

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="bg-background rounded-lg p-4 border border-border">
      <p className="text-xs uppercase tracking-wider text-text-muted">{label}</p>
      <strong className="block text-xl mt-1 tabular-nums">{value}</strong>
      {hint && <p className="text-xs text-text-muted mt-1">{hint}</p>}
    </div>
  );
}

export function LoadSummary({ building }: { building: ElectricalBuilding }) {
  const summary = buildingSummary(building);
  const balance = summary.balance;
  const maxPhase = Math.max(1, ...PHASES.map(p => balance.perPhaseVA[p]));
  return (
    <div className="space-y-6">
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="Apartments" value={summary.apartmentCount.toLocaleString("en-GB")} hint={`${summary.floorCount} floor(s)`} />
        <Kpi label="Connected load" value={formatWatts(summary.connected.demandVA)} hint="after utilisation & demand" />
        <Kpi label="Diversified demand" value={formatWatts(summary.diversified.demandVA)} hint="apartment + building diversity" />
        <Kpi label="Design demand" value={`${(summary.demandWithMargin.demandVA / 1000).toFixed(1)} kVA`} hint={`+${(building.service.designMargin * 100).toFixed(0)}% margin · ${summary.lineCurrentA.toFixed(0)} A`} />
      </div>

      <section className="bg-surface border border-border rounded-xl p-5">
        <h3 className="font-semibold text-lg mb-3">Phase balance (estimated demand, VA)</h3>
        {summary.phases === 1 ? (
          <p className="text-sm text-text-muted">Single-phase supply — phase balancing is not applicable.</p>
        ) : (
          <div className="space-y-3">
            {PHASES.map(phase => (
              <div key={phase} className="grid grid-cols-[3rem_1fr_6rem] items-center gap-3 text-sm">
                <span className="font-mono">{phase}</span>
                <div className="bg-background rounded h-5 border border-border">
                  <div className="bg-primary h-full rounded" style={{ width: `${(balance.perPhaseVA[phase] / maxPhase) * 100}%` }} />
                </div>
                <span className="text-right tabular-nums">{formatWatts(balance.perPhaseVA[phase])}</span>
              </div>
            ))}
            <p className="text-xs text-text-muted">
              Estimated imbalance {balance.imbalancePercent.toFixed(1)}% (target ≤ 15%).{" "}
              {balance.unassignedVA > 0 && `${formatWatts(balance.unassignedVA)} of single-phase demand is unallocated.`}
            </p>
          </div>
        )}
      </section>

      <section className="bg-surface border border-border rounded-xl p-5">
        <h3 className="font-semibold text-lg mb-3">Per floor</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-text-muted border-b border-border">
                <th className="py-2 pr-4">Floor</th>
                <th className="py-2 pr-4">Apartments</th>
                <th className="py-2 pr-4">Connected W</th>
                <th className="py-2 pr-4">Demand VA</th>
                <th className="py-2">Energy kWh/day*</th>
              </tr>
            </thead>
            <tbody>
              {summary.perFloor.map(row => {
                const floor = building.floors.find(f => f.id === row.floorId);
                return (
                  <tr key={row.floorId} className="border-b border-border/60">
                    <td className="py-2 pr-4 font-medium">{row.code} · {floor?.name}</td>
                    <td className="py-2 pr-4 tabular-nums">{floor?.apartments.length ?? 0}</td>
                    <td className="py-2 pr-4 tabular-nums">{row.totals.connectedW.toFixed(0)}</td>
                    <td className="py-2 pr-4 tabular-nums">{row.totals.demandVA.toFixed(0)}</td>
                    <td className="py-2 tabular-nums">{row.totals.energyKwhPerDay.toFixed(1)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-text-muted mt-3">* Indicative energy uses editable hours-per-day assumptions, not metered data.</p>
      </section>
    </div>
  );
}
