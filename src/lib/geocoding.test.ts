import { describe, expect, it } from "vitest";
import { geocodedAddressSchema, geoapifyAutocompleteSchema, mapGeoapifyToGeocodedAddress, autocompleteRequestSchema, MIN_QUERY_LENGTH, DEBOUNCE_MS, DEFAULT_BIAS_COUNTRY, DEFAULT_LIMIT } from "./geocoding";

describe("geocoding types and helpers", () => {
  it("validates a well-formed Geoapify autocomplete result", () => {
    const raw = {
      formatted: "Rua da Alegria 12, 8000-123 Faro, Portugal",
      lat: 37.0194,
      lon: -7.9304,
      city: "Faro",
      postcode: "8000-123",
      country: "Portugal",
      country_code: "pt",
      street: "Rua da Alegria",
      housenumber: "12",
      result_type: "building",
      rank: { confidence: 0.95, confidence_city_level: 0.9, match_type: "full_match" },
    };
    const parsed = geoapifyAutocompleteSchema.safeParse(raw);
    expect(parsed.success).toBe(true);
  });

  it("maps Geoapify result to internal GeocodedAddress", () => {
    const raw = {
      formatted: "Rua da Alegria 12, 8000-123 Faro, Portugal",
      lat: 37.0194,
      lon: -7.9304,
      city: "Faro",
      postcode: "8000-123",
      country: "Portugal",
      country_code: "pt",
      street: "Rua da Alegria",
      housenumber: "12",
      result_type: "building",
      rank: { confidence: 0.95, match_type: "full_match" },
    };
    const parsed = geoapifyAutocompleteSchema.parse(raw);
    const mapped = mapGeoapifyToGeocodedAddress(parsed);
    expect(mapped.formattedAddress).toBe(raw.formatted);
    expect(mapped.latitude).toBe(raw.lat);
    expect(mapped.longitude).toBe(raw.lon);
    expect(mapped.street).toBe(raw.street);
    expect(mapped.houseNumber).toBe(raw.housenumber);
    expect(mapped.city).toBe(raw.city);
    expect(mapped.postcode).toBe(raw.postcode);
    expect(mapped.country).toBe(raw.country);
    expect(mapped.countryCode).toBe(raw.country_code);
    expect(mapped.resultType).toBe(raw.result_type);
    expect(mapped.confidence).toBe(raw.rank?.confidence);
    expect(mapped.provider).toBe("geoapify");
  });

  it("handles missing optional fields gracefully", () => {
    const raw = {
      formatted: "Lisbon, Portugal",
      lat: 38.7223,
      lon: -9.1393,
      country: "Portugal",
      country_code: "pt",
      result_type: "city",
      rank: { confidence_city_level: 0.8 },
    };
    const parsed = geoapifyAutocompleteSchema.parse(raw);
    const mapped = mapGeoapifyToGeocodedAddress(parsed);
    expect(mapped.street).toBeUndefined();
    expect(mapped.houseNumber).toBeUndefined();
    expect(mapped.confidence).toBe(0.8);
  });

  it("rejects invalid coordinates", () => {
    const raw = { formatted: "X", lat: 100, lon: -7.9304 };
    expect(geoapifyAutocompleteSchema.safeParse(raw).success).toBe(false);
  });

  it("validates autocomplete request parameters", () => {
    expect(autocompleteRequestSchema.safeParse({ query: "Far", limit: 5, biasCountry: "pt" }).success).toBe(true);
    expect(autocompleteRequestSchema.safeParse({ query: "ab" }).success).toBe(false);
    expect(autocompleteRequestSchema.safeParse({ query: "Far", limit: 15 }).success).toBe(false);
  });

  it("exposes constants", () => {
    expect(MIN_QUERY_LENGTH).toBe(3);
    expect(DEBOUNCE_MS).toBe(350);
    expect(DEFAULT_BIAS_COUNTRY).toBe("pt");
    expect(DEFAULT_LIMIT).toBe(5);
  });

  it("validates GeocodedAddress schema", () => {
    const valid = {
      formattedAddress: "Rua da Alegria 12, 8000-123 Faro, Portugal",
      street: "Rua da Alegria",
      houseNumber: "12",
      city: "Faro",
      postcode: "8000-123",
      country: "Portugal",
      countryCode: "pt",
      latitude: 37.0194,
      longitude: -7.9304,
      resultType: "building",
      confidence: 0.95,
      provider: "geoapify",
    };
    expect(geocodedAddressSchema.safeParse(valid).success).toBe(true);
    expect(geocodedAddressSchema.safeParse({ ...valid, latitude: 100 }).success).toBe(false);
    expect(geocodedAddressSchema.safeParse({ ...valid, countryCode: "PRT" }).success).toBe(false);
  });
});