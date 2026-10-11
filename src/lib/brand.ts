export const brand = {
  name: 'CALDRIVA',
  descriptor: 'Engineering & Technology',
  tagline: 'Design smarter. Engineer better.',
  heroHeadline: "Your building. Smarter engineering.",
  heroSubtext: "Analyze solar potential, estimate building systems and connect with professional engineers.",
  primaryCTA: "Explore Your Building",
  secondaryCTA: "Request Engineering Design",
  
  colors: {
    // Core palette
    background: '#080B11',
    surface: '#121924',
    surfaceElevated: '#1B2533',
    border: '#293344',
    borderStrong: '#3A4556',
    textPrimary: '#F8FAFC',
    textSecondary: '#A8B5C8',
    textMuted: '#7A8B9E',
    
    // Accent colors
    primary: '#4F8CFF',
    primaryHover: '#3478F6',
    primaryMuted: '#4F8CFF20',
    solarAmber: '#FFB800',
    solarAmberMuted: '#FFB80020',
    
    // Semantic colors
    success: '#10B981',
    successMuted: '#10B98120',
    warning: '#F59E0B',
    warningMuted: '#F59E0B20',
    error: '#EF4444',
    errorMuted: '#EF444420',
  },
  
  typography: {
    fontFamily: 'Manrope, Inter, system-ui, sans-serif',
    fontFamilyMono: 'JetBrains Mono, monospace',
    // Scale
    displayXl: 'clamp(2.5rem, 5vw, 4rem)',
    displayLg: 'clamp(2rem, 4vw, 3rem)',
    displayMd: 'clamp(1.5rem, 3vw, 2.25rem)',
    displaySm: 'clamp(1.25rem, 2.5vw, 1.75rem)',
    headingLg: 'clamp(1.25rem, 2.5vw, 1.5rem)',
    headingMd: 'clamp(1.125rem, 2vw, 1.25rem)',
    headingSm: 'clamp(1rem, 1.5vw, 1.125rem)',
    bodyLg: '1.125rem',
    bodyMd: '1rem',
    bodySm: '0.875rem',
    bodyXs: '0.75rem',
    monoMd: '0.875rem',
    monoSm: '0.75rem',
  },
  
  spacing: {
    base: 4,
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    '2xl': 48,
    '3xl': 64,
  },
  
  borderRadius: {
    sm: '0.25rem',
    md: '0.375rem',
    lg: '0.5rem',
    xl: '0.75rem',
    '2xl': '1rem',
    full: '9999px',
  },
  
  shadows: {
    xs: '0 1px 2px 0 rgb(0 0 0 / 0.3)',
    sm: '0 1px 3px 0 rgb(0 0 0 / 0.4), 0 1px 2px -1px rgb(0 0 0 / 0.4)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.4), 0 2px 4px -2px rgb(0 0 0 / 0.3)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.4), 0 4px 6px -4px rgb(0 0 0 / 0.3)',
    xl: '0 20px 25px -5px rgb(0 0 0 / 0.4), 0 8px 10px -6px rgb(0 0 0 / 0.3)',
    glow: '0 0 20px -5px rgb(79 140 255 / 0.3)',
    glowAmber: '0 0 20px -5px rgb(255 184 0 / 0.3)',
  },
  
  breakpoints: {
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    '2xl': '1536px',
  },
  
  // Animation durations
  motion: {
    fast: '150ms',
    normal: '200ms',
    slow: '300ms',
    slower: '400ms',
  },
  
  // Z-index scale
  zIndex: {
    dropdown: 100,
    sticky: 200,
    modal: 300,
    popover: 400,
    tooltip: 500,
    toast: 600,
  },
} as const;

export type Brand = typeof brand;