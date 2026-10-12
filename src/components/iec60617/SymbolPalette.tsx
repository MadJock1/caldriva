import React, { useMemo, useState } from "react";
import { ALL_IC60617_SYMBOLS, getSymbolsByCategory, getVerifiedSymbols, IEC_VERIFIED, IEC_KNOWN_CONVENTION, IEC_UNVERIFIED, type IECSymbolMetadata, type SymbolPrimitive } from "@/lib/electrical";

interface SymbolPaletteProps {
  onSymbolSelected: (symbol: IECSymbolMetadata) => void;
  showAll?: boolean;
  categoryFilter?: string;
  symbolIds?: readonly string[];
}

export const SymbolPalette: React.FC<SymbolPaletteProps> = ({
  onSymbolSelected,
  showAll = false,
  categoryFilter,
  symbolIds,
}) => {
  const [query, setQuery] = useState("");
  const symbols = useMemo(() => {
    const search = query.trim().toLowerCase();
    const matches = (symbol: IECSymbolMetadata) => !search || `${symbol.name} ${symbol.category} ${symbol.displayLabel}`.toLowerCase().includes(search);
    if (symbolIds) return ALL_IC60617_SYMBOLS.filter(symbol => symbolIds.includes(symbol.symbolId) && matches(symbol));
    if (categoryFilter) {
      return getSymbolsByCategory(categoryFilter).filter(matches);
    }
    return (showAll ? ALL_IC60617_SYMBOLS : getVerifiedSymbols()).filter(matches);
  }, [categoryFilter, query, showAll, symbolIds]);

  // Compute counts from full array to avoid TypeScript narrowing issues
  const verifiedCount = useMemo(() => ALL_IC60617_SYMBOLS.filter((s) => s.verificationStatus === IEC_VERIFIED).length, []);
  const unverifiedCount = useMemo(() => ALL_IC60617_SYMBOLS.filter((s) => s.verificationStatus === IEC_UNVERIFIED).length, []);
  const knownCount = useMemo(() => ALL_IC60617_SYMBOLS.filter((s) => s.verificationStatus === IEC_KNOWN_CONVENTION).length, []);

  return (
    <div className="symbol-palette" style={{
      width: "100%",
      maxHeight: showAll ? "none" : 500,
      overflowY: showAll ? "visible" : "auto",
      background: "#f8f9fa",
      border: "1px solid #e0e4e8",
      borderRadius: 6,
      padding: 8,
      fontFamily: "system-ui, sans-serif",
    }}>
      <div className="palette-header" style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 12,
        paddingBottom: 8,
        borderBottom: "1px solid #e0e4e8",
      }}>
        <h4 className="palette-title" style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>
          Symbol Library ({symbols.length} symbols)
        </h4>
        <div className="palette-counts" style={{ fontSize: 11, color: "#666" }}>
          {verifiedCount} verified / {knownCount} convention / {unverifiedCount} unverified
        </div>
      </div>
      <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search symbols" aria-label="Search electrical symbols" style={{ width: "100%", marginBottom: 8, padding: "6px 8px", border: "1px solid #ccd1d8", borderRadius: 4, fontSize: 12 }} />

      {/* Category filter */}
      {showAll && (
        <div className="palette-categories" style={{
          display: "flex",
          gap: 8,
          marginBottom: 8,
          flexWrap: "wrap",
        }}>
          <button
            onClick={() => {}}
            style={{
              padding: "4px 8px",
              background: "white",
              border: "1px solid #ccc",
              borderRadius: 4,
              cursor: "pointer",
              fontSize: 12,
            }}
          >
            All
          </button>
          {/* We'll add category buttons dynamically if needed */}
        </div>
      )}

      <div className="palette-symbols" style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))",
        gap: 6,
      }}>
        {symbols.map((symbol) => (
          <div
            key={symbol.symbolId}
            className="symbol-item"
            style={{
              border: "1px solid #ddd",
              borderRadius: 4,
              padding: 6,
              background: symbol.verificationStatus === IEC_UNVERIFIED ? "#ffeef0" : "white",
              cursor: "pointer",
              transition: "background 0.2s",
            }}
            onMouseOver={() => {}} // handled via CSS
            onClick={(e) => {
              e.stopPropagation();
              onSymbolSelected(symbol);
            }}
          >
            <div
              style={{
                width: "100%",
                height: 50,
                background: "#f0f2f5",
                borderRadius: 3,
                marginBottom: 4,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 11,
                color: "#555",
              }}
            >
              <SymbolPreview symbol={symbol} />
            </div>
            <div
              style={{
                width: "100%",
                height: 14,
                fontSize: 10,
                textAlign: "center",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {symbol.name}
            </div>
            {symbol.verificationStatus !== IEC_VERIFIED && (
              <span
                style={{
                  float: "right",
                  fontSize: 9,
                  color: "#dc3545",
                  marginTop: 2,
                }}
              >
                {symbol.verificationStatus}
              </span>
            )}
          </div>
        ))}
      </div>

      {showAll && unverifiedCount > 0 && (
        <div style={{
          marginTop: 8,
          fontSize: 11,
          color: "#dc3545",
          borderTop: "1px solid #ffeef0",
          paddingTop: 6,
        }}>
          <strong>{unverifiedCount} symbols marked unverified</strong> - review source documents before IEC use
        </div>
      )}
    </div>
  );
};

function SymbolPreview({ symbol }: { symbol: IECSymbolMetadata }) {
  return (
    <svg viewBox="-0.7 -0.7 1.4 1.4" width="48" height="48" aria-hidden="true">
      {symbol.geometry.primitives.map((primitive, index) => <PreviewPrimitive key={index} primitive={primitive} />)}
    </svg>
  );
}

function PreviewPrimitive({ primitive }: { primitive: SymbolPrimitive }) {
  const stroke = "#1f2937";
  if (primitive.type === "line") return <line x1={primitive.x1} y1={-primitive.y1} x2={primitive.x2} y2={-primitive.y2} stroke={stroke} strokeWidth={0.04} />;
  if (primitive.type === "circle") return <circle cx={primitive.cx} cy={-primitive.cy} r={primitive.r} fill="none" stroke={stroke} strokeWidth={0.04} />;
  if (primitive.type === "rect") return <rect x={primitive.x} y={-(primitive.y + primitive.height)} width={primitive.width} height={primitive.height} fill="none" stroke={stroke} strokeWidth={0.04} />;
  if (primitive.type === "polyline") return <polyline points={primitive.points.map((point) => `${point.x},${-point.y}`).join(" ")} fill={primitive.closed ? "#2563eb20" : "none"} stroke={stroke} strokeWidth={0.04} />;
  return <text x={primitive.x} y={-primitive.y} fill={stroke} fontSize={primitive.height} textAnchor="middle" dominantBaseline="middle">{primitive.value}</text>;
}
