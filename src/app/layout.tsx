import type { Metadata, Viewport } from "next";
import { Manrope, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { ThemeProvider } from "@/lib/theme/ThemeProvider";
import { brand } from "@/lib/brand";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: `${brand.name} ${brand.descriptor} - Design smarter. Engineer better.`,
    template: `%s | ${brand.name} ${brand.descriptor}`,
  },
  description: "Professional engineering simulation tools and consulting services for solar PV, electrical, HVAC, plumbing, and hydraulic systems. Analyze building performance and connect with qualified engineers.",
  keywords: ["engineering", "solar PV", "HVAC", "electrical", "plumbing", "hydraulics", "building simulation", "energy analysis"],
  authors: [{ name: brand.name }],
  creator: brand.name,
  publisher: brand.name,
  robots: "index, follow",
  openGraph: {
    type: "website",
    locale: "en_GB",
    siteName: `${brand.name} ${brand.descriptor}`,
    title: `${brand.name} ${brand.descriptor} - Design smarter. Engineer better.`,
    description: "Professional engineering simulation tools and consulting services for solar PV, electrical, HVAC, plumbing, and hydraulic systems.",
  },
  twitter: {
    card: "summary_large_image",
    title: `${brand.name} ${brand.descriptor}`,
    description: "Professional engineering simulation tools and consulting services.",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F5F7FA" },
    { media: "(prefers-color-scheme: dark)", color: "#080B11" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${manrope.variable} ${jetbrainsMono.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="min-h-full flex flex-col bg-background text-text" suppressHydrationWarning>
        <ThemeProvider>
          <Header />
          <main id="main" className="flex-1 pt-16 lg:pt-18">{children}</main>
          <Footer />
        </ThemeProvider>
      </body>
    </html>
  );
}
