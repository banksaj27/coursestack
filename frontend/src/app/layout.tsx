import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import ThemeSync from "@/components/ThemeSync";
import { THEME_BOOTSTRAP_SCRIPT } from "@/lib/themeAppearance";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Favicon: place `icon.png` in `src/app/` (Next.js metadata file convention).
export const metadata: Metadata = {
  title: "CourseStack",
  description:
    "CourseStack empowers anyone to learn by using AI to design personalized curricula through interactive conversation and real-time planning. CourseStack is designed to open doors to allow anyone to learn anything.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="h-full font-sans">
        <Script
          id="coursesstack-theme-bootstrap"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }}
        />
        <ThemeSync />
        {children}
      </body>
    </html>
  );
}
