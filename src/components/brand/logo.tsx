import { cn } from "@/lib/utils";
import { brand } from "@/lib/brand";
import { logoMark, logoMarkViewBox, logoMarkAspectRatio, logoAccessibleName } from "@/lib/logo";

export type LogoVariant = "horizontal" | "stacked" | "symbol";
/** `auto` follows the active theme tokens; `mono` inherits the parent colour. */
export type LogoTone = "auto" | "mono";
export type LogoSize = "sm" | "md" | "lg" | "xl";

type SizeSpec = {
  mark: number;
  gap: string;
  stackedGap: string;
  internalGap: string;
  word: string;
  descriptor: string;
  descriptorSpacing: string;
};

const SIZES: Record<LogoSize, SizeSpec> = {
  sm: {
    mark: 24,
    gap: "gap-2",
    stackedGap: "gap-1.5",
    internalGap: "gap-1",
    word: "text-[0.95rem]",
    descriptor: "text-[0.52rem]",
    descriptorSpacing: "tracking-[0.2em]",
  },
  md: {
    mark: 34,
    gap: "gap-2.5",
    stackedGap: "gap-2",
    internalGap: "gap-1",
    word: "text-[1.25rem]",
    descriptor: "text-[0.6rem]",
    descriptorSpacing: "tracking-[0.24em]",
  },
  lg: {
    mark: 44,
    gap: "gap-3",
    stackedGap: "gap-2.5",
    internalGap: "gap-1.5",
    word: "text-[1.6rem]",
    descriptor: "text-[0.68rem]",
    descriptorSpacing: "tracking-[0.26em]",
  },
  xl: {
    mark: 60,
    gap: "gap-4",
    stackedGap: "gap-3",
    internalGap: "gap-1.5",
    word: "text-[2.1rem]",
    descriptor: "text-[0.82rem]",
    descriptorSpacing: "tracking-[0.3em]",
  },
};

export type LogoProps = {
  variant?: LogoVariant;
  tone?: LogoTone;
  size?: LogoSize;
  /** Show the "Engineering & Technology" descriptor under/next to the wordmark. */
  descriptor?: boolean;
  /** Accessible name used when the lockup renders as a bare symbol. */
  title?: string;
  className?: string;
  markClassName?: string;
  wordmarkClassName?: string;
  descriptorClassName?: string;
};

/**
 * Caldriva brand lockup. Renders the approved emblem geometry plus the wordmark
 * so it stays crisp, accessible and theme-aware on any surface.
 */
export function Logo({
  variant = "horizontal",
  tone = "auto",
  size = "md",
  descriptor = true,
  title = logoAccessibleName,
  className,
  markClassName,
  wordmarkClassName,
  descriptorClassName,
}: LogoProps) {
  const dims = SIZES[size];
  const mono = tone === "mono";
  const showWordmark = variant !== "symbol";

  const mark = (
    <svg
      viewBox={logoMarkViewBox}
      width={Math.round(dims.mark * logoMarkAspectRatio)}
      height={dims.mark}
      fill="currentColor"
      focusable="false"
      className={cn("shrink-0", !mono && "text-primary", markClassName)}
      role={showWordmark ? undefined : "img"}
      aria-label={showWordmark ? undefined : title}
      aria-hidden={showWordmark ? true : undefined}
    >
      <path d={logoMark.path} />
    </svg>
  );

  if (!showWordmark) {
    return <span className={cn("inline-flex text-current", className)}>{mark}</span>;
  }

  const wordmark = (
    <span
      className={cn(
        "whitespace-nowrap font-bold uppercase leading-none tracking-[0.08em]",
        !mono && "text-text-primary",
        dims.word,
        wordmarkClassName,
      )}
    >
      {brand.name}
    </span>
  );

  const descriptorText = descriptor ? (
    <span
      className={cn(
        "whitespace-nowrap font-medium uppercase leading-none",
        mono ? "opacity-60" : "text-text-muted",
        dims.descriptor,
        dims.descriptorSpacing,
        descriptorClassName,
      )}
    >
      {brand.descriptor}
    </span>
  ) : null;

  if (variant === "stacked") {
    return (
      <span className={cn("inline-flex flex-col items-center text-center text-current", dims.stackedGap, className)}>
        {mark}
        <span className={cn("flex flex-col items-center", dims.internalGap)}>
          {wordmark}
          {descriptorText}
        </span>
      </span>
    );
  }

  return (
    <span className={cn("inline-flex items-center text-current", dims.gap, className)}>
      {mark}
      <span className={cn("flex flex-col", dims.internalGap)}>
        {wordmark}
        {descriptorText}
      </span>
    </span>
  );
}
