"use client";
import { useState } from "react";
import Link from "next/link";
import { brand } from "@/lib/brand";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "./ThemeToggle";

const navLinks = [
  { label: "Services", href: "/services" },
  { label: "Tools", href: "/tools" },
  { label: "How it works", href: "/how-it-works" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
] as const;

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Background layer - doesn't intercept clicks */}
      <div
        className="fixed top-0 left-0 right-0 h-16 lg:h-18 bg-background/80 backdrop-blur-xl border-b border-border transition-all duration-200 pointer-events-none"
        aria-hidden="true"
      />

      {/* Content layer - intercepts clicks */}
      <header className="fixed top-0 left-0 right-0 z-[1000] pointer-events-auto h-16 lg:h-18">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-surface focus:rounded-lg focus:border focus:border-border focus:text-text-primary">
          Skip to content
        </a>
        <div className="container flex h-full items-center justify-between gap-4">
          <Link
            href="/"
            aria-label={`${brand.name} home`}
            className="flex items-center shrink-0"
          >
            <Logo variant="horizontal" size="md" descriptorClassName="hidden sm:block" />
          </Link>

          <nav
            aria-label="Main navigation"
            className="hidden lg:flex items-center gap-1"
          >
            {navLinks.map(({ label, href }) => (
              <Link
                key={href}
                href={href}
                className="px-3 py-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors rounded-lg hover:bg-surface"
              >
                {label}
              </Link>
            ))}
          </nav>

          <div className="hidden lg:flex items-center gap-3">
            <Link
              href="/tools/solar"
              className="btn-primary px-5 py-2.5 text-sm"
            >
              Building Studio
            </Link>
            <Link
              href="/dashboard"
              className="btn-secondary px-4 py-2.5 text-sm"
            >
              Dashboard
            </Link>
            <ThemeToggle />
          </div>

          <button
            className="lg:hidden btn-ghost p-2"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-expanded={mobileOpen}
            aria-controls="mobile-menu"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
          >
            <svg
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              {mobileOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {mobileOpen && (
          <nav
            id="mobile-menu"
            aria-label="Mobile navigation"
            className="lg:hidden animate-slide-in-from-top border-t border-border bg-background pointer-events-auto"
            style={{ top: "4rem" }} /* h-16 = 4rem */
          >
            <div className="container py-4 space-y-1">
              {navLinks.map(({ label, href }) => (
                <Link
                  key={href}
                  href={href}
                  className="block px-4 py-3 text-base font-medium text-text-secondary hover:text-text-primary hover:bg-surface rounded-lg transition-colors"
                  onClick={() => setMobileOpen(false)}
                >
                  {label}
                </Link>
              ))}
              <div className="pt-2 border-t border-border flex flex-col gap-2">
                <Link
                  href="/tools/solar"
                  className="btn-primary px-4 py-3 text-center"
                  onClick={() => setMobileOpen(false)}
                >
                  Building Studio
                </Link>
                <Link
                  href="/dashboard"
                  className="btn-secondary px-4 py-3 text-center"
                  onClick={() => setMobileOpen(false)}
                >
                  Dashboard
                </Link>
              </div>
            </div>
          </nav>
        )}
      </header>
    </>
  );
}