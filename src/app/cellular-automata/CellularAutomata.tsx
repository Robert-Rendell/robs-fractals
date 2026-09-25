"use client";

import { useEffect, useRef } from "react";
import { AUTOMATA, type AutomatonDef, type AutomatonFamily } from "./automatonDefs";
import { plotCells } from "./plotCells";
import styles from "./cellular-automata.module.css";

const CANVAS_SIZE = 640;

const FAMILIES: {
  family: AutomatonFamily;
  title: string;
  count: string;
  desc: React.ReactNode;
}[] = [
  {
    family: "elementary",
    title: "Elementary automata",
    count: "1D · 2 states · 3-cell neighbourhood",
    desc: (
      <>
        A single row of cells, each updated from itself and its two neighbours by one of 256
        possible lookup tables. Stacking the generations top to bottom turns a 1D rule into a 2D
        picture — the <em>space-time diagram</em> — and that is where the fractal lives.
      </>
    ),
  },
  {
    family: "combinatorial",
    title: "Combinatorial patterns",
    count: "number-theoretic · closed form",
    desc: (
      <>
        No simulation at all: each cell is coloured by a formula in its coordinates — a binomial
        coefficient mod p, a digit test, a bitwise operation. They are the same fractals the
        automata produce, reached by counting instead of stepping, which is why Rule 90 and
        Pascal&apos;s triangle mod 2 are one and the same picture.
      </>
    ),
  },
  {
    family: "grid",
    title: "2D automata",
    count: "square lattice · iterated",
    desc: (
      <>
        Rules applied to a whole plane of cells at once. Only the final generation is shown, but
        each one keeps a record of how it grew — birth time, distance, or how many grains it
        holds — and the colour reads that record back out.
      </>
    ),
  },
];

function AutomatonCard({
  def,
  canvasRefs,
}: {
  def: AutomatonDef;
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
        <div className={styles.cardSpec}>{def.rule}</div>
        <div className={styles.cardParams}>{def.params}</div>
      </div>
    </article>
  );
}

export default function CellularAutomata() {
  const canvasRefs = useRef<Map<string, HTMLCanvasElement>>(new Map());

  useEffect(() => {
    let cancelled = false;

    // One pattern per macrotask so the page paints and stays responsive
    // instead of blocking on the sandpile and the 2D grids in one frame.
    let i = 0;
    function runNext() {
      if (cancelled || i >= AUTOMATA.length) return;
      const def = AUTOMATA[i];
      const canvas = canvasRefs.current.get(def.id);
      if (canvas) plotCells(canvas, def.compute(), def.palette, { cellAspect: def.cellAspect });
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
      <p className={styles.eyebrow}>Discrete-rule field guide</p>
      <h1 className={styles.heading}>Cellular Automaton Atlas</h1>
      <p className={styles.intro}>
        No curves, no equations over the reals — just cells that are on or off (or one of a
        handful of states), updated by a lookup rule that only ever sees a few neighbours.
        Iterate that and self-similarity appears on its own: Sierpiński&apos;s triangle from an
        XOR, a carpet from a digit test, nested patches from a pile of sand. The{" "}
        {AUTOMATA.length} patterns below are computed cell by cell in your browser as the page
        loads.
      </p>
      <div className={styles.legend}>
        <div className={styles.legendItem}>
          <span className={`${styles.legendMark} ${styles.legendMarkRows}`} />
          Triangles — one row per generation (or per n), time running downward
        </div>
        <div className={styles.legendItem}>
          <span className={`${styles.legendMark} ${styles.legendMarkGrid}`} />
          Squares — a 2D lattice of cells, shown whole
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
            {AUTOMATA.filter((d) => d.family === family).map((def) => (
              <AutomatonCard key={def.id} def={def} canvasRefs={canvasRefs} />
            ))}
          </div>
        </section>
      ))}

      <footer className={styles.footer}>
        Rendered client-side, in your browser, on this load: every cell is computed exactly — no
        sampling, no randomness — then drawn to the canvas with 3×3 supersampling so grids
        larger than the canvas average down instead of aliasing. Every rule and parameter shown
        is exactly what produced the image above it.
      </footer>
    </div>
  );
}
