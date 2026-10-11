"use client";
import Link from "next/link";
import { brand } from "@/lib/brand";
import { Logo } from "@/components/brand/logo";

export function Footer() {
  const year = 2025;

  return (
    <footer className="border-t border-border bg-surface/50">
      <div className="container py-12 lg:py-16">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <Link href="/" className="flex items-center" aria-label={`${brand.name} home`}>
              <Logo variant="horizontal" size="md" />
            </Link>
            <p className="mt-4 text-sm text-text-secondary max-w-xs">{brand.tagline}</p>
            <p className="mt-3 text-xs text-text-muted">Working brand · Portugal · European building projects</p>
          </div>

          <nav aria-label="Product" className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-text-muted">Product</h4>
            <ul className="space-y-2">
              <li><Link href="/tools/solar" className="text-sm text-text-secondary hover:text-text-primary transition-colors">Solar Studio</Link></li>
              <li><Link href="/services" className="text-sm text-text-secondary hover:text-text-primary transition-colors">Engineering Services</Link></li>
              <li><Link href="/tools" className="text-sm text-text-secondary hover:text-text-primary transition-colors">All Tools</Link></li>
              <li><Link href="/request-quote" className="text-sm text-text-secondary hover:text-text-primary transition-colors">Request Design</Link></li>
            </ul>
          </nav>

          <nav aria-label="Company" className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-text-muted">Company</h4>
            <ul className="space-y-2">
              <li><Link href="/about" className="text-sm text-text-secondary hover:text-text-primary transition-colors">About</Link></li>
              <li><Link href="/contact" className="text-sm text-text-secondary hover:text-text-primary transition-colors">Contact</Link></li>
              <li><Link href="/how-it-works" className="text-sm text-text-secondary hover:text-text-primary transition-colors">How it works</Link></li>
            </ul>
          </nav>

          <nav aria-label="Legal" className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-text-muted">Legal</h4>
            <ul className="space-y-2">
              <li><Link href="/privacy" className="text-sm text-text-secondary hover:text-text-primary transition-colors">Privacy</Link></li>
              <li><Link href="/terms" className="text-sm text-text-secondary hover:text-text-primary transition-colors">Terms</Link></li>
            </ul>
          </nav>
        </div>

        <div className="mt-10 pt-8 border-t border-border flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-text-muted">
            © {year} {brand.name} {brand.descriptor}. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="text-xs text-text-muted hover:text-text-primary transition-colors">Privacy</Link>
            <span className="text-xs text-text-muted">·</span>
            <Link href="/terms" className="text-xs text-text-muted hover:text-text-primary transition-colors">Terms</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}