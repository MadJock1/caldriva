import { ALL_IC60617_SYMBOLS, type IECSymbolMetadata } from "./iec60617/symbolLibrary";

export const SYMBOL_VERIFICATION_STATUSES = ["VERIFIED", "CANDIDATE", "CUSTOM", "REQUIRES_REVIEW"] as const;
export type SymbolVerificationStatus = (typeof SYMBOL_VERIFICATION_STATUSES)[number];

export type RegisteredElectricalSymbol = IECSymbolMetadata & {
  verification: SymbolVerificationStatus;
  sourceReference: string;
  sourceDocumentVersion: string | null;
  attribution: string;
  license: string;
  verificationEvidence: string | null;
  reviewer: string | null;
  verificationDate: string | null;
};

// These geometry records are authored in Caldriva and are not an IEC asset import.
export const ELECTRICAL_SYMBOL_REGISTRY: RegisteredElectricalSymbol[] = ALL_IC60617_SYMBOLS.map(symbol => ({
  ...symbol,
  verification: "CANDIDATE",
  sourceReference: "Caldriva residential electrical vector library",
  sourceDocumentVersion: null,
  attribution: "Caldriva Engineering & Technology",
  license: "Caldriva-authored geometry; IEC source review pending",
  verificationEvidence: null,
  reviewer: null,
  verificationDate: null,
}));

export const RESIDENTIAL_SYMBOL_IDS = ["CAL-SOCKET-001", "CAL-LIGHT-001", "CAL-SWITCH-001", "CAL-MCB-001", "CAL-EARTH-001", "CAL-TERMINAL-001"] as const;

export function registeredSymbol(symbolId: string) {
  return ELECTRICAL_SYMBOL_REGISTRY.find(symbol => symbol.symbolId === symbolId) ?? null;
}
