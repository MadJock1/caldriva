import logoMarkData from "./logo-mark.json";

export type LogoMark = {
  name: string;
  source: string;
  viewBox: [number, number, number, number];
  bounds: [number, number, number, number];
  path: string;
};

/**
 * Canonical Caldriva emblem geometry. The single source of truth shared by the
 * React <Logo /> component, the generated SVG/PNG/ICO assets (see
 * scripts/generate-brand-assets.mjs) and the PDF report vector drawing.
 */
export const logoMark = logoMarkData as unknown as LogoMark;

/** Optical margin (in reference units) added around the artwork for balanced lockups. */
const MARK_MARGIN = 10;

const [minX, minY, maxX, maxY] = logoMark.bounds;

const round = (value: number) => Math.round(value * 1000) / 1000;

/**
 * A tightly cropped viewBox around the emblem so lockups and icons can control
 * their own whitespace instead of inheriting the reference canvas padding.
 */
export const logoMarkViewBox = [
  round(minX - MARK_MARGIN),
  round(minY - MARK_MARGIN),
  round(maxX - minX + MARK_MARGIN * 2),
  round(maxY - minY + MARK_MARGIN * 2),
].join(" ");

/** Width-to-height ratio of the tightly cropped emblem, matching logoMarkViewBox. */
export const logoMarkAspectRatio = (maxX - minX + MARK_MARGIN * 2) / (maxY - minY + MARK_MARGIN * 2);

/** Default accessible label for the full lockup. */
export const logoAccessibleName = "CALDRIVA Engineering & Technology";
