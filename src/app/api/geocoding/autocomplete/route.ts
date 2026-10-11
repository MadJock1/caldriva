import { NextRequest, NextResponse } from "next/server";
import { geocodingConfig, geoapifyAutocompleteSchema, autocompleteRequestSchema, mapGeoapifyToGeocodedAddress, type GeoapifyAutocompleteResult, DEFAULT_BIAS_COUNTRY, DEFAULT_LIMIT } from "@/lib/geocoding";

const GEOAPIFY_BASE = "https://api.geoapify.com/v1/geocode/autocomplete";

export async function GET(request: NextRequest) {
  const config = geocodingConfig();
  if (!config) {
    return NextResponse.json({ error: "Geocoding provider not configured." }, { status: 503 });
  }

  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get("query") ?? "";
  const limitParam = searchParams.get("limit");
  const biasCountry = searchParams.get("biasCountry") ?? DEFAULT_BIAS_COUNTRY;
  const filterCountries = searchParams.get("filterCountries")?.split(",").filter(Boolean) ?? [];

  const parsed = autocompleteRequestSchema.safeParse({ query, limit: limitParam ? Number(limitParam) : DEFAULT_LIMIT, biasCountry, filterCountries });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request parameters." }, { status: 400 });
  }

  const { query: q, limit, biasCountry: bc } = parsed.data;
  const fc = parsed.data.filterCountries ?? [];

  const url = new URL(GEOAPIFY_BASE);
  const params = new URLSearchParams();
  params.set("text", q);
  params.set("limit", String(limit));
  params.set("apiKey", config.apiKey);
  params.set("bias", `countrycode:${bc}`);
  if (fc.length > 0) params.set("filter", `countrycode:${fc.join(",")}`);
  url.search = params.toString();

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(8000), cache: "no-store" });
    if (!response.ok) {
      return NextResponse.json({ error: "Geocoding provider error." }, { status: 502 });
    }
    const data = await response.json();
    const features = Array.isArray(data.features) ? data.features : [];
    const parsedFeatures = features.map((f: { properties: unknown }) => geoapifyAutocompleteSchema.safeParse(f.properties));
    const validFeatures = parsedFeatures.filter((r: { success: boolean; data?: GeoapifyAutocompleteResult }): r is { success: true; data: GeoapifyAutocompleteResult } => r.success);
    const results = validFeatures.map((r: { success: true; data: GeoapifyAutocompleteResult }) => mapGeoapifyToGeocodedAddress(r.data));
    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ error: "Geocoding request failed." }, { status: 502 });
  }
}