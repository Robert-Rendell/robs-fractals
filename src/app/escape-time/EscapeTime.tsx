"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { ESCAPE_FRACTALS, renderEscape, type EscapeDef, type EscapeFamily } from "./escapeDefs";
import styles from "./escape-time.module.css";

const CANVAS_SIZE = 640;

const FAMILIES: {
  family: EscapeFamily;
  title: string;
  count: string;
  desc: React.ReactNode;
}[] = [
  {
    family: "parameter",
    title: "Parameter-space sets",
    count: "one pixel per c · z₀ = 0",
    desc: (
      <>
        Each pixel picks a different map (a different <code>c</code>) and asks one question: does
        the orbit of 0 stay bounded? Black means yes. Outside the set, colour shows how many
        steps the orbit took to escape past radius 16, smoothed so the bands blend.
      </>
    ),
  },
  {
    family: "julia",
    title: "Julia sets",
    count: "one pixel per z₀ · c fixed",
    desc: (
      <>
        Fix one <code>c</code> and vary the starting point instead. Every point of the Mandelbrot
        set has its own Julia set, and the four below come from very different neighbourhoods
        of it: a bulb, a branch tip, the boundary of the main cardioid, and just past its cusp.
      </>
    ),
  },
  {
    family: "beyond",
    title: "Beyond z² + c",
    count: "root-finding · real axis · 3D",
    desc: (
      <>
        The same per-point iteration applied to other questions: which root Newton&apos;s method
        finds, what happens along the real axis, and what a &ldquo;Mandelbrot set&rdquo; looks
        like in three dimensions. The 3D ones get their own interactive pages.
      </>
    ),
  },
];

function EscapeCard({
  def,
  canvasRefs,
}: {
  def: EscapeDef;
  canvasRefs: React.RefObject<Map<string, HTMLCanvasElement>>;
}) {
  return (
    <article id={def.id} className={styles.card}>
      {def.kind === "generated" ? (
        <div className={styles.canvasWrap}>
          <canvas
            width={CANVAS_SIZE}
            height={CANVAS_SIZE}
            ref={(el) => {
              if (el) canvasRefs.current.set(def.id, el);
              else canvasRefs.current.delete(def.id);
            }}
          />
        </div>
      ) : (
        <Link href={def.href} className={styles.thumbWrap}>
          <Image
            src={def.thumbSrc}
            alt={`${def.name} thumbnail`}
            width={320}
            height={320}
            className={styles.thumbImg}
          />
        </Link>
      )}
      <div className={styles.cardBody}>
        <div className={styles.cardName}>{def.name}</div>
        <p className={styles.cardDesc}>{def.description}</p>
        {def.kind === "generated" ? (
          <>
            <div className={styles.cardSpec}>{def.formula}</div>
            <div className={styles.cardParams}>{def.params}</div>
          </>
        ) : (
          <Link href={def.href} className={styles.cardLink}>
            Open full interactive version →
          </Link>
        )}
      </div>
    </article>
  );
}

export default function EscapeTime() {
  const canvasRefs = useRef<Map<string, HTMLCanvasElement>>(new Map());

  useEffect(() => {
    let cancelled = false;
    const generated = ESCAPE_FRACTALS.filter((d) => d.kind === "generated");

    // Each render is a few hundred thousand pixel orbits; one per macrotask
    // keeps the page painting between them.
    let i = 0;
    function runNext() {
      if (cancelled || i >= generated.length) return;
      const def = generated[i];
      const canvas = canvasRefs.current.get(def.id);
      const ctx = canvas?.getContext("2d");
      if (canvas && ctx && def.kind === "generated") {
        const data = renderEscape(def, canvas.width);
        ctx.putImageData(new ImageData(data, canvas.width, canvas.height), 0, 0);
      }
      i++;
      setTimeout(runNext, 0);
    }
    runNext();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className={styles.page}>
      <p className={styles.eyebrow}>Complex-dynamics field guide</p>
      <h1 className={styles.heading}>Escape-Time Atlas</h1>
      <p className={styles.intro}>
        Nothing is drawn here in the usual sense. For every pixel, a simple formula is fed back
        into itself until the result either runs off to infinity or clearly never will, and the
        pixel is coloured by how fast that happened. The fractal is a map of behaviour: the
        border between points that escape and points that stay is infinitely detailed. Every
        image below is iterated pixel by pixel in your browser.
      </p>
      <div className={styles.legend}>
        <div className={styles.legendItem}>
          <span className={`${styles.legendMark} ${styles.legendMarkParam}`} />
          Parameter plane: each pixel is a different map, all started from 0
        </div>
        <div className={styles.legendItem}>
          <span className={`${styles.legendMark} ${styles.legendMarkDyn}`} />
          Dynamical plane: one map, each pixel is a different starting point
        </div>
      </div>

      {FAMILIES.map(({ family, title, count, desc }) => (
        <section key={family} className={styles.family}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>{title}</h2>
            <span className={styles.sectionCount}>{count}</span>
          </div>
          <p className={styles.sectionDesc}>{desc}</p>
          <div className={styles.grid}>
            {ESCAPE_FRACTALS.filter((d) => d.family === family).map((def) => (
              <EscapeCard key={def.id} def={def} canvasRefs={canvasRefs} />
            ))}
          </div>
        </section>
      ))}

      <footer className={styles.footer}>
        Rendered client-side, in your browser, on this load: one orbit per pixel, bailout at |z|
        = 16, with the smoothed escape count <code>n + 1 − log_d(log₂|z|)</code> (d is the
        power of z) run through a cosine palette. The main cardioid and period-2 bulb are skipped analytically on the
        full Mandelbrot view. Every formula and parameter shown is exactly what produced the
        image above it.
      </footer>
    </div>
  );
}
