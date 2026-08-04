import Image from "next/image";
import Link from "next/link";
import styles from "./home.module.css";

export default function Home() {
  return (
    <div>
      <h1>Rob&apos;s Fractals</h1>
      <p style={{ color: "var(--muted)", marginTop: "0.5rem" }}>
        Welcome to the home page.
      </p>
      <div className={styles.cards}>
        <Link href="/apex-fractal" className={styles.card}>
          <Image
            src="/apex-fractal-thumb.svg"
            alt="Apex Fractal thumbnail"
            width={320}
            height={220}
            className={styles.thumb}
          />
          <div className={styles.cardBody}>
            <div className={styles.cardTitle}>Apex Fractal</div>
            <div className={styles.cardDescription}>
              An interactive recursive generator, mapped to the complex plane and iterated in
              3D.
            </div>
          </div>
        </Link>
      </div>

      <section className={styles.categories}>
        <h2>Fractal Categories</h2>
        <p>
          Fractals are usually grouped by how they&apos;re generated, not by what they look
          like — and Mandelbrot and the Apex Fractal actually sit in two of the most
          fundamental categories:
        </p>
        <div className={styles.accordion}>
          <details className={styles.accordionItem} name="fractal-categories" open>
            <summary className={styles.accordionSummary}>
              <span>1. Escape-time / dynamical fractals</span>
              <span className={styles.accordionIcon} aria-hidden="true">
                +
              </span>
            </summary>
            <div className={styles.accordionContent}>
              Iterate a function per point, color by whether the orbit escapes to infinity or
              stays bounded. This is Mandelbrot (z → z² + c), Julia sets (same map, fixed c,
              varying starting z), the Burning Ship, and Newton fractals (basins of attraction
              for root-finding). The fractal is a map of behavior over parameter/state space, not
              a constructed shape.
            </div>
          </details>

          <details className={styles.accordionItem} name="fractal-categories">
            <summary className={styles.accordionSummary}>
              <span>2. Iterated Function Systems (IFS)</span>
              <span className={styles.accordionIcon} aria-hidden="true">
                +
              </span>
            </summary>
            <div className={styles.accordionContent}>
              A small set of contraction maps applied recursively; the fractal is the attractor.
              This splits into two visually distinct sub-families:
              <ul className={styles.subList}>
                <li>
                  <strong>Curve-replacement</strong>: a segment is replaced by a connected
                  polyline that keeps the same endpoints — Koch snowflake, dragon curve, Lévy C
                  curve, Cesàro/de Rham curves.
                </li>
                <li>
                  <strong>Branching</strong>: new segments sprout from a point (often a
                  midpoint) without reconnecting to the far endpoint — Pythagoras tree, H-trees,
                  and the Apex Fractal falls here.
                </li>
              </ul>
            </div>
          </details>

          <details className={styles.accordionItem} name="fractal-categories">
            <summary className={styles.accordionSummary}>
              <span>3. L-systems (Lindenmayer systems)</span>
              <span className={styles.accordionIcon} aria-hidden="true">
                +
              </span>
            </summary>
            <div className={styles.accordionContent}>
              String-rewriting grammars driving turtle graphics. Heavily overlaps with branching
              IFS (fractal plants, the Hilbert curve) but generalizes it to arbitrary rule-based
              grammars rather than fixed geometric maps.
            </div>
          </details>

          <details className={styles.accordionItem} name="fractal-categories">
            <summary className={styles.accordionSummary}>
              <span>4. Strange attractors</span>
              <span className={styles.accordionIcon} aria-hidden="true">
                +
              </span>
            </summary>
            <div className={styles.accordionContent}>
              Fractal-dimensional sets arising from chaotic continuous dynamical systems, plotted
              in phase space rather than image space. Lorenz attractor, Hénon map, Rössler
              attractor.
            </div>
          </details>

          <details className={styles.accordionItem} name="fractal-categories">
            <summary className={styles.accordionSummary}>
              <span>5. Random/statistical fractals</span>
              <span className={styles.accordionIcon} aria-hidden="true">
                +
              </span>
            </summary>
            <div className={styles.accordionContent}>
              Self-similar only in a statistical sense, built from stochastic processes.
              Fractional Brownian motion, diffusion-limited aggregation, Perlin-noise terrain,
              coastlines (Mandelbrot&apos;s original motivating example).
            </div>
          </details>

          <details className={styles.accordionItem} name="fractal-categories">
            <summary className={styles.accordionSummary}>
              <span>6. Cellular-automaton / combinatorial fractals</span>
              <span className={styles.accordionIcon} aria-hidden="true">
                +
              </span>
            </summary>
            <div className={styles.accordionContent}>
              Fractal patterns emerging from discrete rule iteration, e.g. Sierpiński&apos;s
              triangle from Pascal&apos;s triangle mod 2, or Rule 90.
            </div>
          </details>
        </div>
        <p>
          Categories 2, 3, and 6 are all special cases of Hutchinson&apos;s IFS theory
          (deterministic self-similarity via contraction mappings); 1 and 4 are fundamentally
          about dynamical-systems behavior rather than direct construction; 5 relaxes exact
          self-similarity to a statistical one.
        </p>
      </section>
    </div>
  );
}
