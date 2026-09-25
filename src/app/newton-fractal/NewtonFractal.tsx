"use client";

import { useEffect, useRef } from "react";
import {
  NewtonField,
  POLYNOMIALS,
  findRoots,
  newtonStep,
  type Complex,
} from "./newtonEngine";
import styles from "./newton-fractal.module.css";

const MAX_STEPS = 60;
const PLAY_INTERVAL_MS = 140;
// Complex-plane width shown across the viewport's shorter side at reset.
const DEFAULT_SPAN = 3.2;
// Render at a fraction of full resolution while dragging or zooming, then
// sharpen once the view settles.
const PREVIEW_DOWNSCALE = 4;
const SETTLE_MS = 180;

const ROOT_COLORS: [number, number, number][] = [
  [239, 71, 111],
  [255, 209, 102],
  [17, 138, 178],
  [6, 214, 160],
  [155, 93, 229],
  [255, 138, 76],
  [120, 200, 255],
  [241, 91, 181],
];

function formatComplex([r, i]: Complex): string {
  const re = Math.abs(r) < 5e-7 ? 0 : r;
  const im = Math.abs(i) < 5e-7 ? 0 : i;
  return `${re.toFixed(4)} ${im < 0 ? "−" : "+"} ${Math.abs(im).toFixed(4)}i`;
}

export default function NewtonFractal() {
  const viewportRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const polySelectRef = useRef<HTMLSelectElement>(null);
  const stepInputRef = useRef<HTMLInputElement>(null);
  const relaxInputRef = useRef<HTMLInputElement>(null);
  const playButtonRef = useRef<HTMLButtonElement>(null);
  const prevButtonRef = useRef<HTMLButtonElement>(null);
  const nextButtonRef = useRef<HTMLButtonElement>(null);
  const resetButtonRef = useRef<HTMLButtonElement>(null);
  const stepOutRef = useRef<HTMLSpanElement>(null);
  const relaxOutRef = useRef<HTMLSpanElement>(null);
  const convergedOutRef = useRef<HTMLSpanElement>(null);
  const orbitOutRef = useRef<HTMLSpanElement>(null);
  const noteRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const viewportEl = viewportRef.current;
    const canvasEl = canvasRef.current;
    const polySelectEl = polySelectRef.current;
    const stepInputEl = stepInputRef.current;
    const relaxInputEl = relaxInputRef.current;
    const playButtonEl = playButtonRef.current;
    const prevButtonEl = prevButtonRef.current;
    const nextButtonEl = nextButtonRef.current;
    const resetButtonEl = resetButtonRef.current;
    if (
      !viewportEl || !canvasEl || !polySelectEl || !stepInputEl || !relaxInputEl ||
      !playButtonEl || !prevButtonEl || !nextButtonEl || !resetButtonEl
    ) {
      return;
    }
    const ctxEl = canvasEl.getContext("2d");
    if (!ctxEl) return;

    const viewport: HTMLDivElement = viewportEl;
    const canvas: HTMLCanvasElement = canvasEl;
    const ctx: CanvasRenderingContext2D = ctxEl;
    const polySelect: HTMLSelectElement = polySelectEl;
    const stepInput: HTMLInputElement = stepInputEl;
    const relaxInput: HTMLInputElement = relaxInputEl;
    const playButton: HTMLButtonElement = playButtonEl;

    let poly = POLYNOMIALS[0];
    let roots = findRoots(poly.coeffs);
    let relax = 1;
    let targetStep = 0;
    // View in CSS pixels: complex point at the viewport centre, and complex
    // units per CSS pixel.
    let center: Complex = [0, 0];
    let unitsPerPx = 0.01;
    let cssW = 1;
    let cssH = 1;
    let dpr = 1;
    let downscale = 1;
    let field: NewtonField | null = null;
    const offscreen = document.createElement("canvas");
    let image: ImageData | null = null;
    let orbitStart: Complex | null = null;
    let playTimer: number | null = null;
    let settleTimer: number | null = null;

    function fitView() {
      center = [0, 0];
      unitsPerPx = DEFAULT_SPAN / Math.min(cssW, cssH);
    }

    function toComplex(cssX: number, cssY: number): Complex {
      return [center[0] + (cssX - cssW / 2) * unitsPerPx, center[1] - (cssY - cssH / 2) * unitsPerPx];
    }

    function toCss([r, i]: Complex): [number, number] {
      return [cssW / 2 + (r - center[0]) / unitsPerPx, cssH / 2 - (i - center[1]) / unitsPerPx];
    }

    // Throws away all progress and replays the field from step 0 up to the
    // current target. Needed whenever the view, polynomial or relaxation
    // changes, since every pixel's orbit changes with them.
    function rebuild() {
      const bw = Math.max(1, Math.round((cssW * dpr) / downscale));
      const bh = Math.max(1, Math.round((cssH * dpr) / downscale));
      if (!field || field.w !== bw || field.h !== bh) {
        field = new NewtonField(bw, bh);
        offscreen.width = bw;
        offscreen.height = bh;
        image = new ImageData(bw, bh);
      }
      const sx = cssW / bw, sy = cssH / bh;
      field.reset((px, py) => toComplex(px * sx, py * sy), roots);
      while (field.step < targetStep) field.advance(poly.coeffs, relax, roots);
      draw();
    }

    function goToStep(k: number) {
      targetStep = Math.max(0, Math.min(MAX_STEPS, k));
      stepInput.value = String(targetStep);
      if (!field) return;
      if (targetStep < field.step) {
        rebuild();
        return;
      }
      while (field.step < targetStep) field.advance(poly.coeffs, relax, roots);
      draw();
    }

    function draw() {
      if (!field || !image) return;
      field.paint(image.data, ROOT_COLORS);
      const octx = offscreen.getContext("2d");
      if (!octx) return;
      octx.putImageData(image, 0, 0);

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.imageSmoothingEnabled = downscale === 1;
      ctx.drawImage(offscreen, 0, 0, canvas.width, canvas.height);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Roots as white rings, so it's clear what each basin is converging to.
      roots.forEach((root, k) => {
        const [x, y] = toCss(root);
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        const c = ROOT_COLORS[k % ROOT_COLORS.length];
        ctx.fillStyle = `rgb(${c[0]} ${c[1]} ${c[2]})`;
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.stroke();
      });

      drawOrbit();

      if (stepOutRef.current) stepOutRef.current.textContent = String(field.step);
      if (convergedOutRef.current) {
        convergedOutRef.current.textContent = `${(field.convergedFraction() * 100).toFixed(1)}%`;
      }
    }

    // The clicked point's own trajectory up to the current step: the
    // same iteration every pixel is doing, made visible for one of them.
    function drawOrbit() {
      if (!orbitStart) {
        if (orbitOutRef.current) orbitOutRef.current.textContent = "click the plane to trace a point";
        return;
      }
      const pts: Complex[] = [orbitStart];
      let reached = -1;
      for (let k = 0; k < targetStep && reached < 0; k++) {
        const [r, i] = pts[pts.length - 1];
        const next = newtonStep(poly.coeffs, relax, r, i);
        pts.push(next);
        reached = roots.findIndex((root) => Math.hypot(next[0] - root[0], next[1] - root[1]) < 1e-5);
      }
      ctx.beginPath();
      pts.forEach((p, k) => {
        const [x, y] = toCss(p);
        if (k === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = "rgba(255,255,255,0.85)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      pts.forEach((p, k) => {
        const [x, y] = toCss(p);
        ctx.beginPath();
        ctx.arc(x, y, k === 0 ? 4.5 : 3, 0, Math.PI * 2);
        ctx.fillStyle = k === 0 ? "#ffffff" : "#16140f";
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      });
      if (orbitOutRef.current) {
        const last = pts[pts.length - 1];
        const n = pts.length - 1;
        orbitOutRef.current.textContent =
          reached >= 0
            ? `z₀ = ${formatComplex(orbitStart)}   reached root ${formatComplex(roots[reached])} after ${n} step${n === 1 ? "" : "s"}`
            : `z₀ = ${formatComplex(orbitStart)}   →   z${toSubscript(n)} = ${formatComplex(last)}   (no root yet)`;
      }
    }

    function toSubscript(n: number): string {
      return String(n).replace(/\d/g, (d) => "₀₁₂₃₄₅₆₇₈₉"[Number(d)]);
    }

    function resize() {
      const rect = viewport.getBoundingClientRect();
      const firstLayout = cssW === 1 && cssH === 1;
      const oldMin = Math.min(cssW, cssH);
      cssW = Math.max(1, rect.width);
      cssH = Math.max(1, rect.height);
      dpr = Math.min(window.devicePixelRatio || 1, 1.25);
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      if (firstLayout) fitView();
      // Keep the same complex span across the shorter side when the
      // viewport resizes, rather than zooming with the window.
      else unitsPerPx *= oldMin / Math.min(cssW, cssH);
      rebuild();
    }

    // While interacting, re-render at low resolution for responsiveness;
    // after a short pause, redo it at full resolution.
    function interactiveRebuild() {
      downscale = PREVIEW_DOWNSCALE;
      rebuild();
      if (settleTimer !== null) window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(() => {
        settleTimer = null;
        downscale = 1;
        rebuild();
      }, SETTLE_MS);
    }

    function stopPlaying() {
      if (playTimer !== null) window.clearInterval(playTimer);
      playTimer = null;
      playButton.textContent = "▶ Play";
    }

    function startPlaying() {
      if (targetStep >= MAX_STEPS) goToStep(0);
      playButton.textContent = "❚❚ Pause";
      playTimer = window.setInterval(() => {
        if (targetStep >= MAX_STEPS) {
          stopPlaying();
          return;
        }
        goToStep(targetStep + 1);
      }, PLAY_INTERVAL_MS);
    }

    function setPolynomial(id: string) {
      poly = POLYNOMIALS.find((p) => p.id === id) ?? POLYNOMIALS[0];
      roots = findRoots(poly.coeffs);
      orbitStart = null;
      if (noteRef.current) noteRef.current.textContent = poly.note;
      rebuild();
    }

    // Pointer: drag to pan, click (no real movement) to trace an orbit.
    let dragStart: { x: number; y: number; center: Complex } | null = null;
    let dragged = false;
    const onPointerDown = (e: PointerEvent) => {
      viewport.setPointerCapture(e.pointerId);
      dragStart = { x: e.clientX, y: e.clientY, center: [...center] as Complex };
      dragged = false;
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!dragStart) return;
      const dx = e.clientX - dragStart.x, dy = e.clientY - dragStart.y;
      if (!dragged && Math.hypot(dx, dy) < 4) return;
      dragged = true;
      center = [dragStart.center[0] - dx * unitsPerPx, dragStart.center[1] + dy * unitsPerPx];
      interactiveRebuild();
    };
    const onPointerUp = (e: PointerEvent) => {
      if (dragStart && !dragged) {
        const rect = viewport.getBoundingClientRect();
        orbitStart = toComplex(e.clientX - rect.left, e.clientY - rect.top);
        draw();
      }
      dragStart = null;
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = viewport.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      const before = toComplex(mx, my);
      unitsPerPx *= Math.exp(e.deltaY * 0.0015);
      // Keep the point under the cursor fixed while zooming.
      const after = toComplex(mx, my);
      center = [center[0] + before[0] - after[0], center[1] + before[1] - after[1]];
      interactiveRebuild();
    };

    const onStepInput = () => {
      stopPlaying();
      goToStep(Number(stepInput.value));
    };
    const onRelaxInput = () => {
      relax = Number(relaxInput.value);
      if (relaxOutRef.current) relaxOutRef.current.textContent = relax.toFixed(2);
      interactiveRebuild();
    };
    const onPolyChange = () => setPolynomial(polySelect.value);
    const onPlay = () => (playTimer === null ? startPlaying() : stopPlaying());
    const onPrev = () => {
      stopPlaying();
      goToStep(targetStep - 1);
    };
    const onNext = () => {
      stopPlaying();
      goToStep(targetStep + 1);
    };
    const onReset = () => {
      fitView();
      orbitStart = null;
      rebuild();
    };

    viewport.addEventListener("pointerdown", onPointerDown);
    viewport.addEventListener("pointermove", onPointerMove);
    viewport.addEventListener("pointerup", onPointerUp);
    viewport.addEventListener("wheel", onWheel, { passive: false });
    stepInput.addEventListener("input", onStepInput);
    relaxInput.addEventListener("input", onRelaxInput);
    polySelect.addEventListener("change", onPolyChange);
    playButton.addEventListener("click", onPlay);
    prevButtonEl.addEventListener("click", onPrev);
    nextButtonEl.addEventListener("click", onNext);
    resetButtonEl.addEventListener("click", onReset);

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(viewport);
    if (noteRef.current) noteRef.current.textContent = poly.note;

    // Open by playing from step 0, so the first thing you see is the
    // basins forming out of the plain nearest-root regions.
    resize();
    startPlaying();

    return () => {
      stopPlaying();
      if (settleTimer !== null) window.clearTimeout(settleTimer);
      resizeObserver.disconnect();
      viewport.removeEventListener("pointerdown", onPointerDown);
      viewport.removeEventListener("pointermove", onPointerMove);
      viewport.removeEventListener("pointerup", onPointerUp);
      viewport.removeEventListener("wheel", onWheel);
      stepInput.removeEventListener("input", onStepInput);
      relaxInput.removeEventListener("input", onRelaxInput);
      polySelect.removeEventListener("change", onPolyChange);
      playButton.removeEventListener("click", onPlay);
      prevButtonEl.removeEventListener("click", onPrev);
      nextButtonEl.removeEventListener("click", onNext);
      resetButtonEl.removeEventListener("click", onReset);
    };
  }, []);

  return (
    <div className={styles.container}>
      <h1 className={styles.heading}>Newton fractal: step by step</h1>

      <div className={styles.controls}>
        <label className={styles.field}>
          <span className={styles.label}>Polynomial p(z)</span>
          <select ref={polySelectRef} className={styles.select} defaultValue={POLYNOMIALS[0].id}>
            {POLYNOMIALS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>

        <div className={`${styles.field} ${styles.stepField}`}>
          <span className={styles.label}>
            Newton step n = <span ref={stepOutRef}>0</span> · converged{" "}
            <span ref={convergedOutRef}>0%</span>
          </span>
          <div className={styles.stepRow}>
            <button ref={prevButtonRef} type="button" className={styles.button} aria-label="Previous step">
              ◀
            </button>
            <button ref={playButtonRef} type="button" className={`${styles.button} ${styles.playButton}`}>
              ▶ Play
            </button>
            <button ref={nextButtonRef} type="button" className={styles.button} aria-label="Next step">
              ▶
            </button>
            <input
              ref={stepInputRef}
              type="range"
              min={0}
              max={MAX_STEPS}
              step={1}
              defaultValue={0}
              className={styles.range}
            />
          </div>
        </div>

        <label className={styles.field}>
          <span className={styles.label}>
            Relaxation a = <span ref={relaxOutRef}>1.00</span>
          </span>
          <input
            ref={relaxInputRef}
            type="range"
            min={0.3}
            max={1.9}
            step={0.01}
            defaultValue={1}
            className={styles.range}
          />
        </label>

        <button ref={resetButtonRef} type="button" className={`${styles.button} ${styles.resetButton}`}>
          Reset view
        </button>
      </div>

      <div ref={viewportRef} className={styles.viewport}>
        <canvas ref={canvasRef} />
      </div>

      <div className={styles.readout}>
        <span ref={orbitOutRef} />
      </div>
      <p ref={noteRef} className={styles.note} />
      <p className={styles.hint}>
        Every pixel is a starting guess z₀, and each step replaces it with z − a·p(z)/p′(z). At
        step 0 the plane is just split by whichever root is nearest, and that split is not
        fractal. As you step forward, pixels that have landed on a root light up in that
        root&apos;s colour, brighter the faster they got there, while undecided pixels stay dim.
        The smooth regions fill in within a few steps. Near the boundaries, each extra step
        brings out finer detail, because a starting point there gets thrown towards a different
        root depending on tiny differences in where it began. Click anywhere to trace one
        point&apos;s orbit, scroll to zoom, drag to pan. The relaxation a changes the step size:
        a = 1 is plain Newton, and other values make the basins swirl.
      </p>
    </div>
  );
}
