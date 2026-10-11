import { z } from "zod";

export const GEOCODING_PROVIDERS = ["geoapify"] as const;
export type GeocodingProvider = (typeof GEOCODING_PROVIDERS)[number];

export const geoapifyAutocompleteSchema = z.object({
  formatted: z.string().min(1).max(500),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  city: z.string().max(200).optional(),
  postcode: z.string().max(20).optional(),
  country: z.string().max(100).optional(),
  country_code: z.string().length(2).optional(),
  street: z.string().max(200).optional(),
  housenumber: z.string().max(20).optional(),
  state: z.string().max(200).optional(),
  county: z.string().max(200).optional(),
  district: z.string().max(200).optional(),
  result_type: z.enum(["building", "street", "city", "postcode", "municipality", "county", "state", "country"]).optional(),
  rank: z.object({
    confidence: z.number().min(0).max(1).optional(),
    confidence_city_level: z.number().min(0).max(1).optional(),
    match_type: z.enum(["full_match", "partial_match"]).optional(),
  }).optional(),
});

export type GeoapifyAutocompleteResult = z.infer<typeof geoapifyAutocompleteSchema>;

export const geocodedAddressSchema = z.object({
  formattedAddress: z.string().min(1).max(500),
  street: z.string().max(200).optional(),
  houseNumber: z.string().max(20).optional(),
  city: z.string().max(200).optional(),
  postcode: z.string().max(20).optional(),
  country: z.string().max(100).optional(),
  countryCode: z.string().length(2).optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  resultType: z.enum(["building", "street", "city", "postcode", "municipality", "county", "state", "country"]).optional(),
  confidence: z.number().min(0).max(1).optional(),
  provider: z.enum(GEOCODING_PROVIDERS),
  providerRaw: z.unknown().optional(),
});

export type GeocodedAddress = z.infer<typeof geocodedAddressSchema>;

export function mapGeoapifyToGeocodedAddress(result: GeoapifyAutocompleteResult, provider: GeocodingProvider = "geoapify"): GeocodedAddress {
  return geocodedAddressSchema.parse({
    formattedAddress: result.formatted,
    street: result.street,
    houseNumber: result.housenumber,
    city: result.city,
    postcode: result.postcode,
    country: result.country,
    countryCode: result.country_code,
    latitude: result.lat,
    longitude: result.lon,
    resultType: result.result_type,
    confidence: result.rank?.confidence ?? result.rank?.confidence_city_level,
    provider,
    providerRaw: result,
  });
}

export const autocompleteRequestSchema = z.object({
  query: z.string().min(3).max(200),
  limit: z.number().int().min(1).max(10).default(5),
  biasCountry: z.string().length(2).optional(),
  filterCountries: z.array(z.string().length(2)).optional(),
});

export type AutocompleteRequest = z.infer<typeof autocompleteRequestSchema>;

export function geocodingConfig() {
  const apiKey = process.env.GEOAPIFY_API_KEY;
  if (!apiKey) return null;
  return { apiKey };
}

export const DEFAULT_BIAS_COUNTRY = "pt";
export const DEFAULT_LIMIT = 5;
export const MIN_QUERY_LENGTH = 3;
export const DEBOUNCE_MS = 350;