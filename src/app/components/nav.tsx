"use client";

import Link from "next/link";
import { useState } from "react";
import styles from "./nav.module.css";

const links = [
  { href: "/", label: "Home" },
  { href: "/apex-fractal", label: "Apex Fractal" },
  { href: "/mandelbulb", label: "Mandelbulb" },
  { href: "/mandelbrot-bifurcation", label: "Mandelbrot & Bifurcation" },
  { href: "/om-fractal", label: "Om Fractal" },
  { href: "/pythagoras-tree", label: "Pythagoras Tree" },
];

export default function Nav() {
  const [open, setOpen] = useState(false);
  const closeMenu = () => setOpen(false);

  return (
    <nav className={styles.nav}>
      <div className={styles.row}>
        <div className={styles.links}>
          {links.map((link) => (
            <Link key={link.href} href={link.href}>
              {link.label}
            </Link>
          ))}
        </div>

        <button
          type="button"
          className={styles.toggle}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <span className={`${styles.toggleBar} ${open ? styles.toggleBarTop : ""}`} />
          <span className={`${styles.toggleBar} ${open ? styles.toggleBarHidden : ""}`} />
          <span className={`${styles.toggleBar} ${open ? styles.toggleBarBottom : ""}`} />
        </button>
      </div>

      {open && (
        <div className={styles.mobileLinks}>
          {links.map((link) => (
            <Link key={link.href} href={link.href} onClick={closeMenu}>
              {link.label}
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
}
