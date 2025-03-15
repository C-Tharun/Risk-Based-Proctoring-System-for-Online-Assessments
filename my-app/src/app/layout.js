import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
  display: "swap",
  adjustFontFallback: false,
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
  adjustFontFallback: false,
});

export const metadata = {
  title: "Risk-Based Proctoring System",
  description: "Advanced AI-powered proctoring system for secure online assessments",
  keywords: ["online proctoring", "exam monitoring", "AI proctoring", "online assessment", "academic integrity"],
  authors: [{ name: "Your Name" }],
  viewport: "width=device-width, initial-scale=1, maximum-scale=1",
  themeColor: "#2563eb",
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="antialiased bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}