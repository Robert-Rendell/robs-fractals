import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Om Fractal | Rob's Fractals",
};

const subPages = [
  {
    href: "/om-fractal/original",
    label: "1. Original Image",
    description: "The source glyph everything below is built from.",
  },
  {
    href: "/om-fractal/basic",
    label: "2. Basic Fractal",
    description: "A simple recursive self-similar placement of the glyph — no complex numbers yet.",
  },
  {
    href: "/om-fractal/complex-plane",
    label: "3. Mapped to the Complex Plane",
    description: "The same idea, driven by a complex parameter c you control by dragging a point.",
  },
];

export default function OmFractalPage() {
  return (
    <div>
      <h1>Om Fractal</h1>
      <p style={{ color: "var(--muted)", marginTop: "0.5rem" }}>
        A fractal built from a single image, in five steps. 3D and 4D versions are still to
        come.
      </p>
      <ul
        style={{
          listStyle: "none",
          marginTop: "1.5rem",
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
        }}
      >
        {subPages.map((page) => (
          <li key={page.href}>
            <Link href={page.href} style={{ fontWeight: 600 }}>
              {page.label}
            </Link>
            <p style={{ color: "var(--muted)", marginTop: "0.25rem" }}>{page.description}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
