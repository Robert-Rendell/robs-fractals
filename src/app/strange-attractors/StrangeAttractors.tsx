"use client";

import { useEffect, useRef } from "react";
import { ATTRACTORS } from "./attractorDefs";
import { plotPoints } from "./plotPoints";
import styles from "./strange-attractors.module.css";

const CANVAS_SIZE = 640;

export default function StrangeAttractors() {
  const canvasRefs = useRef<Map<string, HTMLCanvasElement>>(new Map());

  useEffect(() => {
    let cancelled = false;
    const flows = ATTRACTORS.filter((a) => a.family === "flow");
    const maps = ATTRACTORS.filter((a) => a.family === "map");
    const queue = [...flows, ...maps];

    // Each attractor is a decent chunk of synchronous math; running them one
    // per macrotask keeps the page painted and responsive instead of
    // blocking on ~2M loop iterations in a single frame.
    let i = 0;
    function runNext() {
      if (cancelled || i >= queue.length) return;
      const def = queue[i];
      const canvas = canvasRefs.current.get(def.id);
      if (canvas) {
        const pts = def.compute();
        plotPoints(canvas, pts, def.color, { alpha: def.alpha, pointSize: def.pointSize });
      }
      i++;
      setTimeout(runNext, 0);
    }
    runNext();

    return () => {
      cancelled = true;
    };
  }, []);

  const flows = ATTRACTORS.filter((a) => a.family === "flow");
  const maps = ATTRACTORS.filter((a) => a.family === "map");

  return (
    <div className={styles.page}>
      <p className={styles.eyebrow}>Phase-space field guide</p>
      <h1 className={styles.heading}>Strange Attractor Atlas</h1>
      <p className={styles.intro}>
        A strange attractor is the shape chaos settles into: a system that never repeats and
        never flies off to infinity still traces a bounded, infinitely-detailed surface in phase
        space. The eleven systems below are computed and drawn live, in this page, right now —
        tens to hundreds of thousands of points each, plotted where the trajectory actually goes
        and built up as density rather than time.
      </p>
      <div className={styles.legend}>
        <div className={styles.legendItem}>
          <span className={`${styles.legendMark} ${styles.legendMarkFlow}`} />
          Flow — a continuous system of ODEs, integrated step by step
        </div>
        <div className={styles.legendItem}>
          <span className={`${styles.legendMark} ${styles.legendMarkMap}`} />
          Map — a discrete formula, fed back into itself once per point
        </div>
      </div>

      <section className={styles.family}>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>Continuous flows</h2>
          <span className={styles.sectionCount}>{flows.length} systems · RK4</span>
        </div>
        <p className={styles.sectionDesc}>
          Each of these is a system of ordinary differential equations, advanced here with a
          fourth-order Runge–Kutta integrator and traced as one continuous curve — the route
          Edward Lorenz found into chaos in 1963, while trying to simplify a model of atmospheric
          convection.
        </p>
        <div className={styles.grid}>
          {flows.map((def) => (
            <article key={def.id} id={def.id} className={styles.card}>
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
                <div className={styles.cardSpec}>{def.equations}</div>
                <div className={styles.cardParams}>{def.params}</div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.family}>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>Discrete maps</h2>
          <span className={styles.sectionCount}>{maps.length} systems · iterated</span>
        </div>
        <p className={styles.sectionDesc}>
          These skip the differential equation: a point is fed back through one fixed formula
          tens of thousands of times, and the resulting scatter <em>is</em> the attractor —
          cheaper to compute than a flow, and often stranger to look at.
        </p>
        <div className={styles.grid}>
          {maps.map((def) => (
            <article key={def.id} id={def.id} className={styles.card}>
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
                <div className={styles.cardSpec}>{def.equations}</div>
                <div className={styles.cardParams}>{def.params}</div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <footer className={styles.footer}>
        Rendered client-side, in your browser, on this load: RK4 integration at the step size
        noted per flow, direct iteration for each map, both accumulated as low-alpha dots with{" "}
        <code>lighter</code> blending so overlap reads as brightness. Every equation and
        parameter shown is exactly what produced the image above it.
      </footer>
    </div>
  );
}
