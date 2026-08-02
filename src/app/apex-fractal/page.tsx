import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Apex Fractal | Robs Fractals",
};

const subPages = [
  {
    href: "/apex-fractal/complex-plane",
    label: "Apex Fractal: Mapped to Complex Plane",
    description: "Drag a point on the complex plane to control the fractal generator.",
  },
  {
    href: "/apex-fractal/3d",
    label: "Apex Fractal: 3D",
    description: "The same generator, iterated and twisted through a third dimension.",
  },
];

export default function ApexFractalPage() {
  return (
    <div>
      <h1>Apex Fractal</h1>
      <ul style={{ listStyle: "none", marginTop: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
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
