import { standardsRegistry, type Reference } from "../../engineering/standards/registry";

// Data-driven sizing rule set for the Portuguese low-voltage framework.
//
// Every rule points at an entry in the shared standards registry (`sourceRef`) so
// the rule can be traced to the same source record used elsewhere in the product.
// Each rule is marked `status: "unverified"` until a named reviewer confirms the
// exact text, edition and applicability. The sizing engine surfaces the unverified
// status as a visible finding and must never present a rule as approved.

export type RuleStatus = "unverified" | "verified";

export type SizingRule = {
  id: string;
  title: string;
  intent: string;
  /** Identifier of the matching record in src/lib/engineering/standards/registry.ts. */
  sourceRef: string;
  /** Human-readable citation for display, mirroring the registry identifier. */
  sourceIdentifier: string;
  status: RuleStatus;
  verificationNote: string;
};

export const ptRtiebtSizingRules: readonly SizingRule[] = [
  {
    id: "breaker-at-or-above-design-current",
    title: "Protective device at or above the design current",
    intent: "The smallest standard protective-device rating not below the circuit design current (Ib) is selected.",
    sourceRef: "rtiebt",
    sourceIdentifier: "RTIEBT / Portaria 949-A/2006",
    status: "unverified",
    verificationNote: "Confirm the rule text, edition/amendments and that the bounded rating list is acceptable before treating this as verified.",
  },
  {
    id: "cable-capacity-at-or-above-device-rating",
    title: "Cable current-carrying capacity at or above the device rating",
    intent: "The conductor must be able to carry the protective-device rating (In) for the intended installation method.",
    sourceRef: "hd60364",
    sourceIdentifier: "HD 60364 series",
    status: "unverified",
    verificationNote: "Capacity depends on installation method, grouping, ambient temperature and conductor material; confirm against a verified table.",
  },
  {
    id: "voltage-drop-within-limit",
    title: "Voltage drop within the project limit",
    intent: "The selected conductor must keep the estimated voltage drop at or below the supplied limit.",
    sourceRef: "rtiebt",
    sourceIdentifier: "RTIEBT / Portaria 949-A/2006",
    status: "unverified",
    verificationNote: "Confirm the applicable drop limit(s) and the calculation basis for the circuit type before relying on this rule.",
  },
  {
    id: "device-and-cable-coordination",
    title: "Protective device and cable coordination",
    intent: "Device and cable are coordinated from verified datasheets, including the device's operating characteristics and disconnection behaviour.",
    sourceRef: "devices-cables",
    sourceIdentifier: "Protective-device and cable product standards",
    status: "unverified",
    verificationNote: "Requires manufacturer device curves and cable datasheets; the engine does not model tripping curves.",
  },
  {
    id: "installation-method-capacity-basis",
    title: "Installation-method capacity basis",
    intent: "Current-carrying capacity is taken from a verified per-method table, not from an illustrative placeholder.",
    sourceRef: "hd60364",
    sourceIdentifier: "HD 60364 series",
    status: "unverified",
    verificationNote: "The bundled capacity tables are illustrative placeholders (verified: false) and must be replaced with verified data.",
  },
];

export function sizingRuleById(id: string): SizingRule | undefined {
  return ptRtiebtSizingRules.find((rule) => rule.id === id);
}

export function sizingRuleSource(rule: SizingRule): Reference | null {
  return standardsRegistry.find((reference) => reference.id === rule.sourceRef) ?? null;
}

export function unverifiedSizingRules(rules: readonly SizingRule[] = ptRtiebtSizingRules): SizingRule[] {
  return rules.filter((rule) => rule.status === "unverified");
}
