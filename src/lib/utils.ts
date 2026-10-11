import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(
  value: number,
  options: {
    decimals?: number;
    unit?: string;
    locale?: string;
  } = {}
): string {
  const { decimals = 0, unit = "", locale = "en-GB" } = options;
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value) + (unit ? ` ${unit}` : "");
}

export function formatCurrency(
  value: number,
  currency: string = "EUR",
  locale: string = "en-GB"
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatEnergy(value: number, unit: "kWh" | "MWh" = "kWh"): string {
  if (unit === "MWh" || value >= 1000) {
    return formatNumber(value / 1000, { decimals: 1, unit: "MWh" });
  }
  return formatNumber(value, { decimals: 0, unit: "kWh" });
}

export function formatPower(value: number, unit: "W" | "kW" | "MW" = "kW"): string {
  if (unit === "W" || value < 1) {
    return formatNumber(value * 1000, { decimals: 0, unit: "W" });
  }
  if (unit === "MW" || value >= 1000) {
    return formatNumber(value / 1000, { decimals: 2, unit: "MW" });
  }
  return formatNumber(value, { decimals: 1, unit: "kW" });
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function truncate(text: string, length: number): string {
  if (text.length <= length) return text;
  return text.slice(0, length).trim() + "...";
}

export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

export function generateId(prefix: string = ""): string {
  return `${prefix}${Math.random().toString(36).substring(2, 11)}`;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function roundTo(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

export function calculatePercentage(value: number, total: number): number {
  if (total === 0) return 0;
  return roundTo((value / total) * 100, 1);
}