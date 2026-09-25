"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { plotSegments } from "../ifs-fractals/plotSegments";
import {
  L_SYSTEMS,
  L_SYSTEM_PARAMS,
  computeLSystem,
  formatSpec,
  type LSystemDef,
  type LSystemFamily,
} from "./lsystemDefs";
import styles from "./l-systems.module.css";

const CANVAS_SIZE = 640;

const FAMILIES: {
  family: LSystemFamily;
  title: string;
  count: string;
  desc: React.ReactNode;
}[] = [
  {
    family: "space-filling",
    title: "Space-filling curves",
    count: "single path · colour follows the route",
    desc: (
      <>
        One unbroken line that, in the limit, passes through every point of a square or hexagonal
        region. The symbols the turtle can&apos;t draw (<code>A</code>, <code>B</code>,{" "}
        <code>L</code>, <code>R</code>, <code>X</code>, <code>Y</code>) only steer the rewriting.
        The colour sweeps from the start of the path to the end, so you can follow its route
        around the grid.
      </>
    ),
  },
  {
    family: "tiling",
    title: "Edge rewriting & tilings",
    count: "coastlines · aperiodic order",
    desc: (
      <>
        Every edge is replaced by a longer, more crooked version of itself, or, in the Penrose
        case, every tile is replaced by smaller tiles. The rule is fixed but the curve&apos;s
        length grows without bound, and that is the fractal part.
      </>
    ),
  },
  {
    family: "plant",
    title: "Bracketed plants",
    count: "[ push · ] pop",
    desc: (
      <>
        Add a stack and a turtle can branch: <code>[</code> saves its position and heading,{" "}
        <code>]</code> jumps back to them. Aristid Lindenmayer, a biologist, invented L-systems to
        describe plant growth, and a handful of these rules is enough for convincing weeds,
        bushes and ferns.
      </>
    ),
  },
];

function LSystemCard({
  def,
  canvasRefs,
}: {
  def: LSystemDef;
  canvasRefs: React.RefObject<Map<string, HTMLCanvasElement>>;
}) {
  return (
    <article id={def.id} className={styles.card}>
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
      <div className={styles.cardBody}>
        <div className={styles.cardName}>{def.name}</div>
        <p className={styles.cardDesc}>{def.description}</p>
        <div className={styles.cardSpec}>{formatSpec(def)}</div>
        <div className={styles.cardParams}>{L_SYSTEM_PARAMS(def)}</div>
      </div>
    </article>
  );
}

export default function LSystems() {
  const canvasRefs = useRef<Map<string, HTMLCanvasElement>>(new Map());

  useEffect(() => {
    let cancelled = false;

    // One system per macrotask so the page paints and stays responsive
    // instead of blocking on every expansion and stroke in one frame.
    let i = 0;
    function runNext() {
      if (cancelled || i >= L_SYSTEMS.length) return;
      const def = L_SYSTEMS[i];
      const canvas = canvasRefs.current.get(def.id);
      if (canvas) {
        plotSegments(canvas, computeLSystem(def), def.color, { glow: def.glow, hues: def.hues });
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
      <p className={styles.eyebrow}>String-rewriting field guide</p>
      <h1 className={styles.heading}>L-System Atlas</h1>
      <p className={styles.intro}>
        An L-system is a grammar: start from a short string, rewrite every symbol in parallel by
        a fixed rule, and repeat. Then hand the result to a turtle that draws forward on{" "}
        <code>F</code> or <code>G</code> and turns on <code>+</code> and <code>−</code>. The{" "}
        {L_SYSTEMS.length} systems below all use that one engine and differ only in their rules
        and angle. The curves on the <Link href="/ifs-fractals">IFS Fractal Atlas</Link> (Koch,
        dragon, Lévy, Cesàro) are drawn by the same engine, so they aren&apos;t repeated here.
      </p>
      <div className={styles.legend}>
        <div className={styles.legendItem}>
          <span className={`${styles.legendMark} ${styles.legendMarkCurve}`} />
          Unbranched: one continuous path, the pen never lifts
        </div>
        <div className={styles.legendItem}>
          <span className={`${styles.legendMark} ${styles.legendMarkBranch}`} />
          Bracketed: the turtle saves and restores its place, so the path forks
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
            {L_SYSTEMS.filter((d) => d.family === family).map((def) => (
              <LSystemCard key={def.id} def={def} canvasRefs={canvasRefs} />
            ))}
          </div>
        </section>
      ))}

      <footer className={styles.footer}>
        Rendered client-side, in your browser, on this load: each grammar is expanded as a
        string, walked once by the turtle, and every segment is stroked in a single pass, with a
        soft blurred pass underneath for glow wherever it doesn&apos;t muddy a dense grid. Every rule and parameter shown is exactly what
        produced the image above it.
      </footer>
    </div>
  );
}
