"use client";

import Link from "next/link";
import { brand } from "@/lib/brand";
import { disciplines } from "@/lib/catalogue";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <>
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-background pt-20 pb-20 lg:pt-28 lg:pb-28">
        <div className="container">
          <div className="grid lg:grid-cols-[1.1fr_1fr] gap-12 lg:gap-16 items-start">
            {/* Left: Copy */}
            <div className="max-w-xl">
              <p className="text-primary text-xs uppercase tracking-[0.2em] mb-4">
                Building Intelligence · Preliminary Design
              </p>
              <h1 className="text-4xl lg:text-5xl xl:text-6xl font-semibold tracking-tight leading-[1.05] text-text-primary mb-6">
                {brand.heroHeadline}
              </h1>
              <p className="text-lg lg:text-xl text-text-secondary mb-8 max-w-xl">
                {brand.heroSubtext}
              </p>
              <div className="flex flex-wrap gap-3 mb-10">
                <Link href="/tools/solar">
                  <Button size="lg" className="w-full sm:w-auto">
                    {brand.primaryCTA}
                    <svg className="ml-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </Button>
                </Link>
                <Link href="/request-quote">
                  <Button variant="secondary" size="lg" className="w-full sm:w-auto">
                    {brand.secondaryCTA}
                  </Button>
                </Link>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm text-text-muted">
                <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface border border-border">
                  <svg className="h-3.5 w-3.5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  Solar PV
                </span>
                <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface border border-border">
                  <svg className="h-3.5 w-3.5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Electrical
                </span>
                <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface border border-border">
                  <svg className="h-3.5 w-3.5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  HVAC
                </span>
              </div>
            </div>

            {/* Right: Product Preview */}
            <div className="relative">
              <div className="relative aspect-[4/3] rounded-2xl bg-surface border border-border overflow-hidden">
                <svg
                  viewBox="0 0 400 300"
                  className="w-full h-full"
                  preserveAspectRatio="xMidYMid meet"
                  aria-hidden="true"
                  role="img"
                  aria-label="Solar engineering preview showing a stylized rooftop with panel layout, capacity and production metrics"
                >
                  <defs>
                    <linearGradient id="roofGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#1B2533" />
                      <stop offset="100%" stopColor="#121924" />
                    </linearGradient>
                    <linearGradient id="panelGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#4F8CFF" stopOpacity="0.6" />
                      <stop offset="100%" stopColor="#4F8CFF" stopOpacity="0.2" />
                    </linearGradient>
                    <linearGradient id="amberGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#FFB800" />
                      <stop offset="100%" stopColor="#FF8C00" />
                    </linearGradient>
                    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                      <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                      <feMerge>
                        <feMergeNode in="coloredBlur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                    <clipPath id="roofClip">
                      <path d="M40,80 L360,80 L380,220 L20,220 Z" />
                    </clipPath>
                  </defs>

                  {/* Background grid */}
                  <g stroke="#293344" strokeWidth="0.5" opacity="0.4">
                    <line x1="0" y1="0" x2="400" y2="0" />
                    <line x1="0" y1="50" x2="400" y2="50" />
                    <line x1="0" y1="100" x2="400" y2="100" />
                    <line x1="0" y1="150" x2="400" y2="150" />
                    <line x1="0" y1="200" x2="400" y2="200" />
                    <line x1="0" y1="250" x2="400" y2="250" />
                    <line x1="0" y1="300" x2="400" y2="300" />
                    <line x1="50" y1="0" x2="50" y2="300" />
                    <line x1="100" y1="0" x2="100" y2="300" />
                    <line x1="150" y1="0" x2="150" y2="300" />
                    <line x1="200" y1="0" x2="200" y2="300" />
                    <line x1="250" y1="0" x2="250" y2="300" />
                    <line x1="300" y1="0" x2="300" y2="300" />
                    <line x1="350" y1="0" x2="350" y2="300" />
                  </g>

                  {/* Roof outline */}
                  <path
                    d="M40,80 L360,80 L380,220 L20,220 Z"
                    fill="url(#roofGradient)"
                    stroke="#4F8CFF"
                    strokeWidth="2"
                    strokeOpacity="0.5"
                  />

                  {/* Solar panels */}
                  <g clipPath="url(#roofClip)">
                    <g filter="url(#glow)">
                      {Array.from({ length: 5 }, (_, row) => (
                        <g key={row}>
                          {Array.from({ length: 7 }, (_, col) => (
                            <rect
                              key={col}
                              x={60 + col * 42}
                              y={100 + row * 24}
                              width="36"
                              height="18"
                              rx="2"
                              fill="url(#panelGradient)"
                              stroke="#4F8CFF"
                              strokeWidth="1"
                              strokeOpacity="0.4"
                              opacity="0.85"
                            />
                          ))}
                        </g>
                      ))}
                    </g>
                  </g>

                  {/* Roof vertices */}
                  <circle cx="40" cy="80" r="5" fill="#4F8CFF" stroke="#F8FAFC" strokeWidth="2" />
                  <circle cx="360" cy="80" r="5" fill="#4F8CFF" stroke="#F8FAFC" strokeWidth="2" />
                  <circle cx="380" cy="220" r="5" fill="#4F8CFF" stroke="#F8FAFC" strokeWidth="2" />
                  <circle cx="20" cy="220" r="5" fill="#4F8CFF" stroke="#F8FAFC" strokeWidth="2" />

                  {/* Dimension lines */}
                  <g stroke="#4F8CFF" strokeWidth="1" strokeDasharray="4 3" opacity="0.6">
                    <line x1="40" y1="70" x2="360" y2="70" />
                    <line x1="370" y1="80" x2="370" y2="220" />
                  </g>

                  {/* Dimension labels */}
                  <text x="200" y="62" textAnchor="middle" fontSize="10" fill="#A8B5C8" fontFamily="Manrope, Inter, sans-serif" fontWeight="500">12.4 m</text>
                  <text x="378" y="150" textAnchor="start" fontSize="10" fill="#A8B5C8" fontFamily="Manrope, Inter, sans-serif" fontWeight="500" transform="rotate(-90, 378, 150)">8.7 m</text>

                  {/* Orientation indicator */}
                  <g transform="translate(330, 50)">
                    <circle cx="0" cy="0" r="18" fill="#121924" stroke="#293344" strokeWidth="1" />
                    <path d="M0,-12 L0,12 M-12,0 L12,0" stroke="#293344" strokeWidth="0.5" />
                    <path d="M0,0 L0,-10" stroke="#4F8CFF" strokeWidth="2" strokeLinecap="round">
                      <animateTransform
                        attributeName="transform"
                        type="rotate"
                        from="0"
                        to="360"
                        dur="20s"
                        repeatCount="indefinite"
                      />
                    </path>
                    <text x="0" y="22" textAnchor="middle" fontSize="7" fill="#7A8B9E" fontFamily="Manrope, Inter, sans-serif">N</text>
                  </g>

                  {/* KPI Overlay - Top Right */}
                  <g transform="translate(280, 20)">
                    <rect x="0" y="0" width="100" height="56" rx="8" fill="#121924" stroke="#293344" strokeWidth="1" opacity="0.95" />
                    <text x="50" y="16" textAnchor="middle" fontSize="8" fill="#7A8B9E" fontFamily="Manrope, Inter, sans-serif" fontWeight="500">CAPACITY</text>
                    <text x="50" y="36" textAnchor="middle" fontSize="18" fill="#F8FAFC" fontFamily="Manrope, Inter, sans-serif" fontWeight="700">12.4 kWp</text>
                    <text x="50" y="50" textAnchor="middle" fontSize="7" fill="#4F8CFF" fontFamily="Manrope, Inter, sans-serif" fontWeight="500">35 panels × 355 W</text>
                  </g>

                  {/* Production Overlay - Bottom Right */}
                  <g transform="translate(280, 90)">
                    <rect x="0" y="0" width="100" height="56" rx="8" fill="#121924" stroke="#293344" strokeWidth="1" opacity="0.95" />
                    <text x="50" y="16" textAnchor="middle" fontSize="8" fill="#7A8B9E" fontFamily="Manrope, Inter, sans-serif" fontWeight="500">ANNUAL PRODUCTION</text>
                    <text x="50" y="36" textAnchor="middle" fontSize="18" fill="#FFB800" fontFamily="Manrope, Inter, sans-serif" fontWeight="700">14,200 kWh</text>
                    <text x="50" y="50" textAnchor="middle" fontSize="7" fill="#4F8CFF" fontFamily="Manrope, Inter, sans-serif" fontWeight="500">Specific yield: 1,145 kWh/kWp</text>
                  </g>

                  {/* Demo badge */}
                  <text x="200" y="285" textAnchor="middle" fontSize="9" fill="#7A8B9E" fontFamily="Manrope, Inter, sans-serif" fontStyle="italic">Demo data — illustrative values for Lisbon, PT</text>
                </svg>

                {/* Live indicator */}
                <div className="absolute bottom-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-full bg-background/80 backdrop-blur border border-border">
                  <span className="w-2 h-2 rounded-full bg-success animate-pulse" aria-hidden="true" />
                  <span className="text-xs font-medium text-text-secondary">Live PVGIS data</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Decorative accent lines */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1px] h-32 bg-gradient-to-b from-primary/30 to-transparent" />
          <div className="absolute bottom-0 right-1/4 w-[1px] h-24 bg-gradient-to-t from-primary/20 to-transparent" />
        </div>
      </section>

      {/* Engineering Tools Grid */}
      <section className="py-16 lg:py-24 bg-surface/30 border-y border-border">
        <div className="container">
          <header className="max-w-2xl mx-auto text-center mb-12 lg:mb-16">
            <p className="text-primary text-xs uppercase tracking-[0.2em] mb-3">Engineering Tools</p>
            <h2 className="text-3xl lg:text-4xl font-semibold text-text-primary mb-4">
              Start with the system that matters.
            </h2>
            <p className="text-text-secondary">
              Each module is built for real engineering workflows — from preliminary simulation to professional design brief.
            </p>
          </header>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {disciplines.map((d, i) => (
              <Link
                key={d.slug}
                href={`/services/${d.slug}`}
                className="group panel p-6 hover:border-primary/50 transition-all duration-200"
              >
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-2xl font-medium text-text-muted/50">{String(i + 1).padStart(2, "0")}</span>
                  <span className="text-primary text-xs uppercase tracking-wider">{d.slug}</span>
                </div>
                <h3 className="text-xl font-semibold text-text-primary mb-3 group-hover:text-primary transition-colors">
                  {d.name} <span className="inline-block group-hover:translate-x-1 transition-transform">→</span>
                </h3>
                <p className="text-text-secondary">{d.description}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* How Caldriva Works */}
      <section className="py-16 lg:py-24 bg-background">
        <div className="container">
          <header className="max-w-2xl mx-auto text-center mb-12 lg:mb-16">
            <p className="text-primary text-xs uppercase tracking-[0.2em] mb-3">Process</p>
            <h2 className="text-3xl lg:text-4xl font-semibold text-text-primary mb-4">
              From a location to an informed decision.
            </h2>
            <p className="text-text-secondary">
              A structured workflow that keeps your assumptions visible and results traceable.
            </p>
          </header>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                number: "01",
                title: "Model",
                description: "Locate your site, outline roof geometry and confirm orientation. Your measurements and assumptions remain visible.",
                icon: (
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                )
              },
              {
                number: "02",
                title: "Simulate",
                description: "Request a real PVGIS solar estimate, then explore explicitly simplified financial assumptions with clear limitations.",
                icon: (
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                )
              },
              {
                number: "03",
                title: "Review",
                description: "Use preliminary results to prepare a scope for professional engineering review. Connect with qualified engineers when ready.",
                icon: (
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )
              },
            ].map((step) => (
              <article key={step.number} className="panel p-6 relative">
                <div className="absolute -top-3 -right-3 text-5xl font-semibold text-primary/5">{step.number}</div>
                <div className="relative z-10">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 text-primary mb-4">
                    {step.icon}
                  </div>
                  <h3 className="text-lg font-semibold text-text-primary mb-2">{step.title}</h3>
                  <p className="text-text-secondary">{step.description}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Engineering Services */}
      <section className="py-16 lg:py-24 bg-surface/30 border-y border-border">
        <div className="container">
          <header className="max-w-2xl mx-auto text-center mb-12 lg:mb-16">
            <p className="text-primary text-xs uppercase tracking-[0.2em] mb-3">Engineering Services</p>
            <h2 className="text-3xl lg:text-4xl font-semibold text-text-primary mb-4">
              Professional engineering when you need it.
            </h2>
            <p className="text-text-secondary">
              Preliminary tools are free. For certified designs, permit packages and construction documents, connect with our network of qualified engineers.
            </p>
          </header>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { title: "Solar PV Design", desc: "Certified PV system designs, structural calculations and permit packages.", icon: "solar" },
              { title: "Electrical Engineering", desc: "Power distribution, lighting design and code-compliant electrical plans.", icon: "electrical" },
              { title: "HVAC & Mechanical", desc: "Heating, cooling, ventilation and energy recovery system design.", icon: "hvac" },
              { title: "Plumbing & Hydraulics", desc: "Water supply, drainage, fire protection and hydraulic calculations.", icon: "plumbing" },
            ].map((service) => (
              <article key={service.title} className="panel p-6 hover:border-primary/50 transition-all duration-200">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <svg className="h-5 w-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    {service.icon === "solar" && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1m4 4h-1m-15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />}
                    {service.icon === "electrical" && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />}
                    {service.icon === "hvac" && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />}
                    {service.icon === "plumbing" && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />}
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-text-primary mb-2">{service.title}</h3>
                <p className="text-text-secondary text-sm">{service.desc}</p>
                <Link href="/request-quote" className="inline-flex items-center gap-1.5 mt-4 text-sm font-medium text-primary hover:text-primary-hover transition-colors">
                  Request design <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-16 lg:py-24 bg-background">
        <div className="container">
          <header className="max-w-2xl mx-auto text-center mb-12 lg:mb-16">
            <p className="text-primary text-xs uppercase tracking-[0.2em] mb-3">Why Caldriva</p>
            <h2 className="text-3xl lg:text-4xl font-semibold text-text-primary mb-4">
              Built for better project conversations.
            </h2>
            <p className="text-text-secondary">
              Homeowners can investigate an idea. Architects and contractors can record assumptions and prepare a clearer engineering brief.
            </p>
          </header>
          <div className="grid md:grid-cols-2 gap-6 lg:gap-8">
            <div className="space-y-6">
              <div className="space-y-4">
                {[
                  ["Is this a certified design?", "No. Automated results are preliminary estimates. Structural suitability, electrical safety and permit compliance require qualified professional review."],
                  ["What is measured from the map?", "A drawn polygon provides approximate horizontal area. Pitch, height, structural strength and shading are not measured from map tiles."],
                  ["Where is my building saved?", "Save local draft stores inputs in this browser. Save to account stores them privately in the configured Supabase project and requires sign-in."],
                  ["Can I request a quotation?", "You can prepare a project brief. Online submission will be enabled after the company contact and customer workflow are configured."],
                ].map(([q, a]) => (
                  <details key={q} className="panel p-5 group">
                    <summary className="cursor-pointer font-medium text-text-primary list-none flex items-center justify-between group-hover:text-primary transition-colors">
                      {q}
                      <svg className="h-5 w-5 text-text-muted group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </summary>
                    <p className="mt-3 text-text-secondary">{a}</p>
                  </details>
                ))}
              </div>
            </div>
            <div>
              <Link href="/tools/solar">
                <Button size="xl" className="w-full">
                  Explore the Solar Studio →
                </Button>
              </Link>
              <p className="mt-6 text-center text-text-muted">
                Free to use · No account required for local drafts · Exportable reports
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 lg:py-24 bg-surface border-y border-border">
        <div className="container text-center">
          <h2 className="text-3xl lg:text-4xl font-semibold text-text-primary mb-4">
            Ready to explore your building?
          </h2>
          <p className="text-text-secondary mb-8 max-w-2xl mx-auto">
            Start with a free solar estimate. No account required. Save locally or connect your cloud workspace when ready.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/tools/solar">
              <Button size="xl" className="w-full sm:w-auto">
                Open Building Studio
                <svg className="ml-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Button>
            </Link>
            <Link href="/request-quote">
              <Button variant="secondary" size="xl" className="w-full sm:w-auto">
                Prepare a Project Brief
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}