"use client";

import { useTheme } from "@/lib/theme/ThemeProvider";
import { Button } from "@/components/ui/button";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";

export function CanvasBackgroundToggle() {
  const { canvasBackground, syncCanvasWithTheme, setCanvasBackground, setSyncCanvasWithTheme } = useTheme();

  const bgOptions: { value: "white" | "black"; label: string; icon: React.ReactNode; description: string }[] = [
    {
      value: "white",
      label: "White Drawing Canvas",
      description: "Classic paper-like background",
      icon: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
        </svg>
      ),
    },
    {
      value: "black",
      label: "Classic CAD Black",
      description: "Traditional dark CAD background",
      icon: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
      ),
    },
  ];

  const currentOption = bgOptions.find((o) => o.value === canvasBackground);

  return (
    <div className="flex items-center gap-2">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant={syncCanvasWithTheme ? "secondary" : "ghost"}
            size="icon"
            aria-label={`Canvas background: ${currentOption?.label || canvasBackground}. Click to change.`}
            className="relative"
            title={syncCanvasWithTheme ? "Synced with theme" : undefined}
          >
            {currentOption?.icon || (
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5z" />
              </svg>
            )}
            {syncCanvasWithTheme && (
              <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary/20 border border-primary flex items-center justify-center">
                <svg className="h-2.5 w-2.5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-1" side="bottom" align="end">
          <div className="grid gap-1" role="radiogroup" aria-label="Select canvas background">
            {bgOptions.map((option) => (
              <button
                key={option.value}
                role="radio"
                aria-checked={canvasBackground === option.value}
                onClick={() => setCanvasBackground(option.value)}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  canvasBackground === option.value
                    ? "bg-primary/10 text-primary"
                    : "text-text-secondary hover:bg-surface hover:text-text-primary"
                }`}
              >
                <span className="flex-shrink-0">{option.icon}</span>
                <div className="text-left">
                  <div>{option.label}</div>
                  <div className="text-xs text-text-muted">{option.description}</div>
                </div>
              </button>
            ))}
          </div>
          <div className="border-t border-border my-1" />
          <label className="flex items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:text-text-primary cursor-pointer">
            <input
              type="checkbox"
              checked={syncCanvasWithTheme}
              onChange={(e) => setSyncCanvasWithTheme(e.target.checked)}
              className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
            />
            <span>Sync with application theme</span>
          </label>
        </PopoverContent>
      </Popover>
    </div>
  );
}