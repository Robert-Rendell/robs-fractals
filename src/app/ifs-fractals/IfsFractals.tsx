"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { IFS_FRACTALS, type IfsDef } from "./ifsDefs";
import { plotSegments } from "./plotSegments";
import styles from "./ifs-fractals.module.css";

const CANVAS_SIZE = 640;

function IfsCard({
  def,
  canvasRefs,
}: {
  def: IfsDef;
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
            <div className={styles.cardSpec}>{def.spec}</div>
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

export default function IfsFractals() {
  const canvasRefs = useRef<Map<string, HTMLCanvasElement>>(new Map());

  useEffect(() => {
    let cancelled = false;
    const generated = IFS_FRACTALS.filter((d) => d.kind === "generated");

    // One fractal per macrotask so the page paints and stays responsive
    // instead of blocking on all of them in a single frame.
    let i = 0;
    function runNext() {
      if (cancelled || i >= generated.length) return;
      const def = generated[i];
      const canvas = canvasRefs.current.get(def.id);
      if (canvas && def.kind === "generated") {
        plotSegments(canvas, def.compute(), def.color, { glow: def.glow });
      }
      i++;
      setTimeout(runNext, 0);
    }
    runNext();

    return () => {
      cancelled = true;
    };
  }, []);

  const curves = IFS_FRACTALS.filter((d) => d.family === "curve");
  const branches = IFS_FRACTALS.filter((d) => d.family === "branch");

  return (
    <div className={styles.page}>
      <p className={styles.eyebrow}>Contraction-map field guide</p>
      <h1 className={styles.heading}>IFS Fractal Atlas</h1>
      <p className={styles.intro}>
        An Iterated Function System builds a fractal from a small set of contraction maps applied
        over and over — the fractal is whatever shape is left once you apply them infinitely
        many times. The examples below fall into two visibly different families depending on how
        the replacement happens, each drawn live in this page.
      </p>
      <div className={styles.legend}>
        <div className={styles.legendItem}>
          <span className={`${styles.legendMark} ${styles.legendMarkCurve}`} />
          Curve-replacement — a segment becomes a polyline that keeps the same two endpoints
        </div>
        <div className={styles.legendItem}>
          <span className={`${styles.legendMark} ${styles.legendMarkBranch}`} />
          Branching — new segments sprout from a point without reconnecting to the far end
        </div>
      </div>

      <section className={styles.family}>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>Curve-replacement</h2>
          <span className={styles.sectionCount}>{curves.length} systems · L-system</span>
        </div>
        <p className={styles.sectionDesc}>
          Each of these is a Lindenmayer system: a starting string is rewritten by a substitution
          rule some number of times, then read by a turtle that moves forward on every{" "}
          <code>F</code> and turns on every <code>+</code>/<code>−</code>. Same engine, four very
          different curves, purely from the angle and the rule.
        </p>
        <div className={styles.grid}>
          {curves.map((def) => (
            <IfsCard key={def.id} def={def} canvasRefs={canvasRefs} />
          ))}
        </div>
      </section>

      <section className={styles.family}>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>Branching</h2>
          <span className={styles.sectionCount}>{branches.length} systems</span>
        </div>
        <p className={styles.sectionDesc}>
          Here the recursion sprouts new shapes from a point — usually a midpoint or a tip —
          rather than replacing a segment end-to-end, so the structure grows outward like a plant
          or a wiring diagram instead of thickening a single curve.
        </p>
        <div className={styles.grid}>
          {branches.map((def) => (
            <IfsCard key={def.id} def={def} canvasRefs={canvasRefs} />
          ))}
        </div>
      </section>

      <footer className={styles.footer}>
        Rendered client-side, in your browser, on this load: each curve is expanded from its
        L-system rule and walked by a turtle once, the H-tree is drawn by direct recursion, then
        every segment is stroked in one pass with a soft blurred pass underneath for glow. Every
        rule and parameter shown is exactly what produced the image above it.
      </footer>
    </div>
  );
}
