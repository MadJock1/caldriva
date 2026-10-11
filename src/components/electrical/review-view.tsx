"use client";
import { Button } from "@/components/ui/button";
import { categoryLabels, designReview, REVIEW_STATUSES, type CheckStatus, type ElectricalBuilding, type ReviewStatus } from "@/lib/electrical";

const statusStyles: Record<CheckStatus, string> = {
  pass: "text-success border-success/40 bg-success-muted",
  warn: "text-warning border-warning/40 bg-warning-muted",
  blocked: "text-error border-error/40 bg-error-muted",
  manual: "text-text-secondary border-border bg-surface-elevated",
};

const statusLabel: Record<CheckStatus, string> = { pass: "Pass", warn: "Check", blocked: "Blocked", manual: "Manual" };

export function ReviewView({ building, onStatus }: { building: ElectricalBuilding; onStatus: (status: ReviewStatus) => void }) {
  const review = designReview(building);
  const categories = [...new Set(review.checks.map(c => c.category))];
  return (
    <div className="space-y-5">
      <div className="grid sm:grid-cols-4 gap-4">
        <div className="bg-surface border border-border rounded-xl p-4"><p className="text-xs uppercase tracking-wider text-text-muted">Engine status</p><strong className="block text-lg mt-1">{review.status}</strong></div>
        <div className="bg-surface border border-border rounded-xl p-4"><p className="text-xs uppercase tracking-wider text-text-muted">Passed</p><strong className="block text-lg mt-1">{review.checks.filter(c => c.status === "pass").length}</strong></div>
        <div className="bg-surface border border-border rounded-xl p-4"><p className="text-xs uppercase tracking-wider text-text-muted">Blocked</p><strong className="block text-lg mt-1">{review.blocked}</strong></div>
        <div className="bg-surface border border-border rounded-xl p-4"><p className="text-xs uppercase tracking-wider text-text-muted">Manual / engineer</p><strong className="block text-lg mt-1">{review.manual}</strong></div>
      </div>

      <p className="text-sm text-text-muted bg-surface border border-border rounded-xl p-4">
        This is an automatic, preliminary review. It does not certify compliance with any wiring regulation, select protective devices,
        or verify earthing, voltage drop or safety zones. A qualified engineer must complete and sign off the design.
      </p>

      {categories.map(category => (
        <section key={category} className="bg-surface border border-border rounded-xl p-5">
          <h3 className="font-semibold text-lg mb-3">{categoryLabels[category]}</h3>
          <ul className="space-y-3">
            {review.checks.filter(c => c.category === category).map(check => (
              <li key={check.id} className="flex flex-wrap items-start gap-3">
                <span className={`text-xs font-medium border rounded-full px-2.5 py-0.5 ${statusStyles[check.status]}`}>{statusLabel[check.status]}</span>
                <div className="min-w-0">
                  <p className="font-medium">{check.title}</p>
                  <p className="text-sm text-text-muted">{check.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <section className="bg-surface border border-border rounded-xl p-5">
        <h3 className="font-semibold text-lg mb-2">Design status</h3>
        <p className="text-sm text-text-muted mb-3">
          Generated designs stay preliminary until a qualified engineer reviews them. Setting a status here records workflow intent only.
        </p>
        <div className="flex flex-wrap gap-2">
          {REVIEW_STATUSES.map(status => (
            <Button key={status} size="sm" variant={building.reviewStatus === status ? "default" : "outline"} onClick={() => onStatus(status)}>{status}</Button>
          ))}
        </div>
      </section>
    </div>
  );
}
