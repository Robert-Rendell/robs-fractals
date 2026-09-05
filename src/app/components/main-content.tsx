"use client";

import { usePathname } from "next/navigation";

// These fractal viewports want to fill the whole window edge-to-edge —
// everywhere else keeps the standard page padding.
const FULL_BLEED_PATHS = new Set(["/mandelbulb", "/mandelbox"]);

export default function MainContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // next.config.ts sets trailingSlash: true, so usePathname() returns paths
  // like "/mandelbulb/" rather than "/mandelbulb" — strip it before matching.
  const normalizedPathname = pathname.length > 1 ? pathname.replace(/\/$/, "") : pathname;
  const fullBleed = FULL_BLEED_PATHS.has(normalizedPathname);

  return (
    <main
      style={{
        padding: fullBleed ? 0 : "2rem 1.5rem",
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {children}
    </main>
  );
}
