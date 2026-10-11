"use client";
import { useId, useRef, useState, useEffect } from "react";
import { z } from "zod";
import { geocodedAddressSchema, type GeocodedAddress } from "@/lib/geocoding";

export function AddressAutocomplete({ onSelect, value = "", label = "Search address", biasCountry = "pt" }: { onSelect: (address: GeocodedAddress) => void; value?: string; label?: string; placeholder?: string; biasCountry?: string }) {
  const id = useId();
  const [query, setQuery] = useState(value);
  const [rows, setRows] = useState<GeocodedAddress[]>([]);
  const [active, setActive] = useState(-1);
  const [message, setMessage] = useState("");
  const controller = useRef<AbortController | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sequence = useRef(0);
  function cancel() { sequence.current++; controller.current?.abort(); if (timer.current) clearTimeout(timer.current); }
  useEffect(() => () => { controller.current?.abort(); if (timer.current) clearTimeout(timer.current); }, []);
  function search(text: string) {
    cancel(); setQuery(text); setRows([]); setActive(-1); setMessage("");
    if (text.trim().length < 3) return;
    const request = sequence.current;
    setMessage("Searching addresses…");
    timer.current = setTimeout(async () => {
      const abort = new AbortController(); controller.current = abort;
      try {
        const response = await fetch(`/api/geocoding/autocomplete?${new URLSearchParams({ query: text.trim(), biasCountry, limit: "5" })}`, { signal: abort.signal });
        if (request !== sequence.current) return;
        if (!response.ok) throw new Error(response.status === 503 ? "Address service not configured. Select location on map." : [401, 403].includes(response.status) ? "Address service API key rejected. Select location on map." : response.status === 429 ? "Rate limit reached. Please retry shortly." : "Address service temporarily unavailable. Select location on map.");
        const data = z.object({ results: z.array(geocodedAddressSchema).max(5) }).parse(await response.json());
        if (request !== sequence.current) return;
        setRows(data.results); setMessage(data.results.length ? `${data.results.length} suggestions available.` : "No matching addresses found.");
      } catch (error) { if (request === sequence.current && !abort.signal.aborted) setMessage(error instanceof Error ? error.message : "Address service temporarily unavailable."); }
    }, 350);
  }
  function select(row: GeocodedAddress) { cancel(); setQuery(row.formattedAddress); setRows([]); setMessage(""); onSelect(row); }
  return <div className="relative">
    <label htmlFor={id} className="block text-sm mb-2">{label}</label>
    <input id={id} role="combobox" aria-autocomplete="list" aria-expanded={rows.length > 0} aria-controls={`${id}-list`} aria-activedescendant={active >= 0 ? `${id}-${active}` : undefined} value={query} maxLength={200} autoComplete="off" className="input-base" onChange={e => search(e.target.value)} onKeyDown={e => {
      if (e.key === "Escape") { cancel(); setRows([]); setMessage(""); }
      if (!rows.length) return;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); setActive(i => e.key === "ArrowDown" ? (i + 1) % rows.length : (i <= 0 ? rows.length - 1 : i - 1)); }
      if (e.key === "Enter" && active >= 0) { e.preventDefault(); select(rows[active]); }
    }} />
    {!!rows.length && <ul id={`${id}-list`} role="listbox" aria-label="Address suggestions" className="absolute z-50 w-full bg-surface-elevated border rounded-lg shadow-lg">{rows.map((row, i) => <li id={`${id}-${i}`} key={i} role="option" aria-selected={active === i} onMouseDown={e => e.preventDefault()} onClick={() => select(row)} className={`p-3 cursor-pointer text-sm ${active === i ? "bg-primary/20" : ""}`}>{row.formattedAddress}</li>)}</ul>}
    <p role="status" className="text-xs text-text-muted mt-2">{message}</p>
  </div>;
}
