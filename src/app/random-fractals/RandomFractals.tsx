"use client";

import { useEffect, useRef } from "react";
import { RANDOM_FRACTALS, type RandomDef, type RandomFamily } from "./randomDefs";
import styles from "./random-fractals.module.css";

const CANVAS_SIZE = 640;

const FAMILIES: {
  family: RandomFamily;
  title: string;
  count: string;
  desc: React.ReactNode;
}[] = [
  {
    family: "walk",
    title: "Random walks",
    count: "paths · colour = time",
    desc: (
      <>
        Add up random steps and you get a curve with no smooth pieces anywhere. Its
        self-similarity is only statistical: zoom in on a stretch and it won&apos;t match the
        whole exactly, but it will be just as rough, with the same distribution of wiggles.
      </>
    ),
  },
  {
    family: "surface",
    title: "Random surfaces",
    count: "fBm · Hurst exponent H",
    desc: (
      <>
        The same idea on a 2D grid. Random displacement shrinks by a fixed ratio at each finer
        scale, so a single parameter controls how rough the surface is. Mandelbrot argued that
        mountains and coastlines are this kind of object, and his opening example about coastline
        length is where the modern idea of a fractal began.
      </>
    ),
  },
  {
    family: "cluster",
    title: "Growth & clusters",
    count: "lattice · emergent",
    desc: (
      <>
        Here randomness builds a shape rather than roughening one. Particles stick where they
        land, sites open with some probability, or squares survive a coin flip, and a fractal
        dimension emerges from the statistics even though no individual step is self-similar.
      </>
    ),
  },
];

function RandomCard({
  def,
  canvasRefs,
}: {
  def: RandomDef;
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
        <div className={styles.cardSpec}>{def.method}</div>
        <div className={styles.cardParams}>{def.params}</div>
      </div>
    </article>
  );
}

export default function RandomFractals() {
  const canvasRefs = useRef<Map<string, HTMLCanvasElement>>(new Map());

  useEffect(() => {
    let cancelled = false;

    // One sample per macrotask; DLA in particular is tens of millions of
    // random-walk steps and shouldn't hold up the rest of the page.
    let i = 0;
    function runNext() {
      if (cancelled || i >= RANDOM_FRACTALS.length) return;
      const def = RANDOM_FRACTALS[i];
      const canvas = canvasRefs.current.get(def.id);
      const ctx = canvas?.getContext("2d");
      if (canvas && ctx) def.draw(ctx, canvas.width);
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
      <p className={styles.eyebrow}>Stochastic field guide</p>
      <h1 className={styles.heading}>Random Fractal Atlas</h1>
      <p className={styles.intro}>
        Nature&apos;s fractals are never exact copies of themselves. A coastline, a mountain
        range or a lightning bolt only looks the same at every scale on average. These{" "}
        {RANDOM_FRACTALS.length} are built from chance rather than a fixed rule. Each is drawn
        from a fixed random seed so the picture is repeatable, but a different seed would give
        a different sample with the same statistics.
      </p>
      <div className={styles.legend}>
        <div className={styles.legendItem}>
          <span className={`${styles.legendMark} ${styles.legendMarkPath}`} />
          Paths: one random process traced over time
        </div>
        <div className={styles.legendItem}>
          <span className={`${styles.legendMark} ${styles.legendMarkField}`} />
          Fields and clusters: a random grid, shown as a single snapshot
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
            {RANDOM_FRACTALS.filter((d) => d.family === family).map((def) => (
              <RandomCard key={def.id} def={def} canvasRefs={canvasRefs} />
            ))}
          </div>
        </section>
      ))}

      <footer className={styles.footer}>
        Rendered client-side, in your browser, on this load, from a seeded{" "}
        <code>mulberry32</code> generator, so the same seed always gives the same picture. The
        dimensions quoted are the theoretical values for each process; any finite sample only
        approximates them. Every method and parameter shown is exactly what produced the image
        above it.
      </footer>
    </div>
  );
}
