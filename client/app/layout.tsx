import type { Metadata } from "next";
import {
  Familjen_Grotesk,
  Fraunces,
  JetBrains_Mono,
  Newsreader,
} from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import QueryProvider from "@/shared/components/providers/query-provider";
import { ThemeProvider } from "@/shared/components/providers/theme-provider";

/* Display — page headings, brand, numerals. */
const display = Fraunces({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--brand-display",
});

/* UI chrome — buttons, labels, nav, card titles. */
const ui = Familjen_Grotesk({
  subsets: ["latin"],
  variable: "--brand-ui",
});

/* Reading — generated answers, summaries, reports. */
const reading = Newsreader({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--brand-reading",
});

/* Metadata — citations, source types, model ids. */
const code = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--brand-code",
});

export const metadata: Metadata = {
  title: "Manthan — churn your sources into understanding",
  description:
    "Manthan turns PDFs, websites, YouTube and notes into one grounded workspace: cited answers, summaries, flashcards, quizzes and mind maps from the material you actually trust.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn(
        "h-full",
        "antialiased",
        "font-sans",
        display.variable,
        ui.variable,
        reading.variable,
        code.variable,
      )}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <QueryProvider>
            {children}
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
