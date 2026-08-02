import Link from "next/link";

const links = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
  { href: "/fractals/complex-plane", label: "Complex Plane" },
  { href: "/fractals/3d-iterated", label: "3D Iterated" },
];

export default function Nav() {
  return (
    <nav
      style={{
        display: "flex",
        gap: "1.5rem",
        padding: "1rem 1.5rem",
        borderBottom: "1px solid var(--border)",
      }}
    >
      {links.map((link) => (
        <Link key={link.href} href={link.href}>
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
