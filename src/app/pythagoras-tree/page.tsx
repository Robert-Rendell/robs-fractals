import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Pythagoras Tree | Rob's Fractals",
};

const subPages = [
  {
    href: "/pythagoras-tree/original",
    label: "1. Original Generator",
    description: "A square with a right triangle erected on its top edge — the rule everything below recurses.",
  },
  {
    href: "/pythagoras-tree/basic",
    label: "2. Basic Fractal",
    description: "The classic 2D tree — the generator applied 11 generations deep at a fixed 45° split.",
  },
  {
    href: "/pythagoras-tree/complex-plane",
    label: "3. 3D, Mapped to the Complex Plane",
    description:
      "The same generator built from cubes instead of squares, twisted through a third dimension, with the split angle driven by a complex parameter c you control by dragging a point.",
  },
];

export default function PythagorasTreePage() {
  return (
    <div>
      <h1>Pythagoras Tree</h1>
      <p style={{ color: "var(--muted)", marginTop: "0.5rem" }}>
        A branching Iterated Function System: a square sprouts two smaller squares from a right
        triangle on its top edge, recursively.
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
