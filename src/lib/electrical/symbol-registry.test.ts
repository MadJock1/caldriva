import { expect, it } from "vitest";
import { electricalPointSchema, registeredSymbol, RESIDENTIAL_SYMBOL_IDS } from "./index";

it("registers residential symbol candidates with provenance and no invented IEC identifier", () => {
  const socket = registeredSymbol("CAL-SOCKET-001");
  expect(RESIDENTIAL_SYMBOL_IDS).toContain("CAL-SOCKET-001");
  expect(socket).toMatchObject({ verification: "CANDIDATE", sourceDocumentVersion: null, reviewer: null });
  expect(socket?.iecIdentifier).toBeUndefined();
});

it("persists editable CAD symbol-instance properties separately from position", () => {
  const point = electricalPointSchema.parse({ id: "socket-1", kind: "socket", x: 2, y: 3, elevationM: 0.3, symbolId: "CAL-SOCKET-001", deviceReference: "S-01", description: "Kitchen worktop outlet", rotationDeg: 90, scale: 1.2, manufacturer: "Example", productReference: "P-1", datasheetUrl: "https://example.test/p-1", productVerificationStatus: "UNVERIFIED", roomId: null, note: "" });
  expect(point).toMatchObject({ x: 2, y: 3, elevationM: 0.3, rotationDeg: 90, scale: 1.2, deviceReference: "S-01" });
});
