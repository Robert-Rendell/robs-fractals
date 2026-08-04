"use client";

import { useEffect, useRef } from "react";
import styles from "./mandelbrot-bifurcation.module.css";

const REAL_MIN = -2.5;
const REAL_MAX = 1.0;
const IMAG_MIN = -1.25;
const IMAG_MAX = 1.25;
const R_MIN = 1;
const R_MAX = 4;

// The exact affine conjugacy between the logistic map and z -> z^2 + c:
// substituting x = -z/r + 1/2 into x -> r*x*(1-x) and simplifying yields
// z -> z^2 + c with c = r/2 - r^2/4. Over r in [1, 4] this sweeps c
// monotonically from 0.25 (the main cardioid's cusp) down to -2 (the
// leftmost tip of the set) — i.e. across the Mandelbrot set's entire real
// axis exactly once.
function cFromR(r: number): number {
  return r / 2 - (r * r) / 4;
}

export default function MandelbrotBifurcation() {
  const mandelbrotWrapRef = useRef<HTMLDivElement>(null);
  const mandelbrotCanvasRef = useRef<HTMLCanvasElement>(null);
  const bifurcationWrapRef = useRef<HTMLDivElement>(null);
  const bifurcationCanvasRef = useRef<HTMLCanvasElement>(null);
  const rInputRef = useRef<HTMLInputElement>(null);
  const rOutRef = useRef<HTMLSpanElement>(null);
  const cOutRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const mandelbrotWrapEl = mandelbrotWrapRef.current;
    const mandelbrotCanvasEl = mandelbrotCanvasRef.current;
    const bifurcationWrapEl = bifurcationWrapRef.current;
    const bifurcationCanvasEl = bifurcationCanvasRef.current;
    const rInputEl = rInputRef.current;
    if (
      !mandelbrotWrapEl ||
      !mandelbrotCanvasEl ||
      !bifurcationWrapEl ||
      !bifurcationCanvasEl ||
      !rInputEl
    ) {
      return;
    }
    const mCtxEl = mandelbrotCanvasEl.getContext("2d");
    const bCtxEl = bifurcationCanvasEl.getContext("2d");
    if (!mCtxEl || !bCtxEl) return;

    const mandelbrotWrap: HTMLDivElement = mandelbrotWrapEl;
    const mandelbrotCanvas: HTMLCanvasElement = mandelbrotCanvasEl;
    const bifurcationWrap: HTMLDivElement = bifurcationWrapEl;
    const bifurcationCanvas: HTMLCanvasElement = bifurcationCanvasEl;
    const rInput: HTMLInputElement = rInputEl;
    const mCtx: CanvasRenderingContext2D = mCtxEl;
    const bCtx: CanvasRenderingContext2D = bCtxEl;

    let r = 3.5;
    let mandelbrotStatic: HTMLCanvasElement | null = null;
    let bifurcationStatic: HTMLCanvasElement | null = null;

    function mandelbrotPixelFromComplex(
      cr: number,
      ci: number,
      w: number,
      h: number,
    ): [number, number] {
      const realRange = REAL_MAX - REAL_MIN;
      const imagRange = IMAG_MAX - IMAG_MIN;
      const scale = Math.min(w / realRange, h / imagRange);
      const offsetX = (w - realRange * scale) / 2;
      const offsetY = (h - imagRange * scale) / 2;
      return [offsetX + (cr - REAL_MIN) * scale, offsetY + (IMAG_MAX - ci) * scale];
    }

    function renderMandelbrotStatic(w: number, h: number): HTMLCanvasElement {
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return canvas;

      const imageData = ctx.createImageData(w, h);
      const data = imageData.data;
      const realRange = REAL_MAX - REAL_MIN;
      const imagRange = IMAG_MAX - IMAG_MIN;
      const scale = Math.min(w / realRange, h / imagRange);
      const offsetX = (w - realRange * scale) / 2;
      const offsetY = (h - imagRange * scale) / 2;
      const maxIter = 100;

      for (let py = 0; py < h; py++) {
        const ci = IMAG_MAX - (py - offsetY) / scale;
        for (let px = 0; px < w; px++) {
          const cr = REAL_MIN + (px - offsetX) / scale;
          let zr = 0;
          let zi = 0;
          let iter = 0;
          // A large bailout radius (rather than the mathematically-sufficient
          // 2) makes the smooth/continuous escape-time formula below well
          // behaved, avoiding the banding you'd get from raw integer counts.
          while (zr * zr + zi * zi <= 65536 && iter < maxIter) {
            const nzr = zr * zr - zi * zi + cr;
            const nzi = 2 * zr * zi + ci;
            zr = nzr;
            zi = nzi;
            iter++;
          }
          const idx = (py * w + px) * 4;
          if (iter === maxIter) {
            data[idx] = 22;
            data[idx + 1] = 20;
            data[idx + 2] = 15;
            data[idx + 3] = 255;
          } else {
            const logZn = Math.log(zr * zr + zi * zi) / 2;
            const nu = Math.log(logZn / Math.LN2) / Math.LN2;
            const smoothIter = iter + 1 - nu;
            const t = Math.min(1, Math.max(0, smoothIter / 40));
            data[idx] = Math.round(60 + 150 * t);
            data[idx + 1] = Math.round(150 + 70 * (1 - t));
            data[idx + 2] = Math.round(230 - 80 * t);
            data[idx + 3] = 255;
          }
        }
      }
      ctx.putImageData(imageData, 0, 0);
      return canvas;
    }

    function renderBifurcationStatic(w: number, h: number): HTMLCanvasElement {
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return canvas;

      ctx.fillStyle = "#201d17";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "rgba(90,165,230,0.45)";
      const iterations = 700;
      const discard = 300;
      for (let px = 0; px < w; px++) {
        const rr = R_MIN + (px / w) * (R_MAX - R_MIN);
        let x = 0.5;
        for (let i = 0; i < iterations; i++) {
          x = rr * x * (1 - x);
          if (i >= discard) {
            const py = h - x * h;
            ctx.fillRect(px, py, 1, 1);
          }
        }
      }
      return canvas;
    }

    function drawMarkers() {
      if (!mandelbrotStatic || !bifurcationStatic) return;
      const mw = mandelbrotCanvas.width;
      const mh = mandelbrotCanvas.height;
      const bw = bifurcationCanvas.width;
      const bh = bifurcationCanvas.height;

      mCtx.clearRect(0, 0, mw, mh);
      mCtx.drawImage(mandelbrotStatic, 0, 0);
      const c = cFromR(r);
      const [axisStartX, axisY] = mandelbrotPixelFromComplex(REAL_MIN, 0, mw, mh);
      const [axisEndX] = mandelbrotPixelFromComplex(REAL_MAX, 0, mw, mh);
      const [mx, my] = mandelbrotPixelFromComplex(c, 0, mw, mh);

      mCtx.strokeStyle = "rgba(232,230,221,0.35)";
      mCtx.lineWidth = 1;
      mCtx.beginPath();
      mCtx.moveTo(axisStartX, axisY);
      mCtx.lineTo(axisEndX, axisY);
      mCtx.stroke();

      mCtx.beginPath();
      mCtx.arc(mx, my, 5, 0, Math.PI * 2);
      mCtx.fillStyle = "#ffffff";
      mCtx.fill();
      mCtx.strokeStyle = "#16140f";
      mCtx.lineWidth = 1.5;
      mCtx.stroke();

      bCtx.clearRect(0, 0, bw, bh);
      bCtx.drawImage(bifurcationStatic, 0, 0);
      const bx = ((r - R_MIN) / (R_MAX - R_MIN)) * bw;
      bCtx.strokeStyle = "#ffffff";
      bCtx.lineWidth = 1.5;
      bCtx.beginPath();
      bCtx.moveTo(bx, 0);
      bCtx.lineTo(bx, bh);
      bCtx.stroke();

      if (rOutRef.current) rOutRef.current.textContent = r.toFixed(3);
      if (cOutRef.current) cOutRef.current.textContent = c.toFixed(3);
    }

    function resizeMandelbrot() {
      const rect = mandelbrotWrap.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const w = Math.max(1, Math.round(rect.width * dpr));
      const h = Math.max(1, Math.round(rect.height * dpr));
      if (mandelbrotCanvas.width !== w || mandelbrotCanvas.height !== h) {
        mandelbrotCanvas.width = w;
        mandelbrotCanvas.height = h;
      }
      mandelbrotStatic = renderMandelbrotStatic(w, h);
    }

    function resizeBifurcation() {
      const rect = bifurcationWrap.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const w = Math.max(1, Math.round(rect.width * dpr));
      const h = Math.max(1, Math.round(rect.height * dpr));
      if (bifurcationCanvas.width !== w || bifurcationCanvas.height !== h) {
        bifurcationCanvas.width = w;
        bifurcationCanvas.height = h;
      }
      bifurcationStatic = renderBifurcationStatic(w, h);
    }

    const onRInput = () => {
      r = Number(rInput.value);
      drawMarkers();
    };
    rInput.addEventListener("input", onRInput);

    const mandelbrotResizeObserver = new ResizeObserver(() => {
      resizeMandelbrot();
      drawMarkers();
    });
    mandelbrotResizeObserver.observe(mandelbrotWrap);

    const bifurcationResizeObserver = new ResizeObserver(() => {
      resizeBifurcation();
      drawMarkers();
    });
    bifurcationResizeObserver.observe(bifurcationWrap);

    resizeMandelbrot();
    resizeBifurcation();
    drawMarkers();

    return () => {
      rInput.removeEventListener("input", onRInput);
      mandelbrotResizeObserver.disconnect();
      bifurcationResizeObserver.disconnect();
    };
  }, []);

  return (
    <div className={styles.container}>
      <h1 className={styles.heading}>Mandelbrot ↔ the logistic map</h1>
      <div className={styles.row}>
        <div className={styles.panelWrap}>
          <span className={styles.panelLabel}>Mandelbrot set (real axis highlighted)</span>
          <div ref={mandelbrotWrapRef} className={styles.canvasWrap}>
            <canvas ref={mandelbrotCanvasRef} />
          </div>
        </div>
        <div className={styles.panelWrap}>
          <span className={styles.panelLabel}>Logistic map bifurcation diagram</span>
          <div ref={bifurcationWrapRef} className={styles.canvasWrap}>
            <canvas ref={bifurcationCanvasRef} />
          </div>
        </div>
      </div>
      <div className={styles.controls}>
        <label className={styles.sliderLabel}>r (logistic map parameter)</label>
        <div className={styles.sliderRow}>
          <input ref={rInputRef} type="range" min={1} max={4} step={0.001} defaultValue={3.5} />
          <span className={styles.readout}>
            r = <span ref={rOutRef}>3.500</span>, c = <span ref={cOutRef}>-0.375</span>
          </span>
        </div>
      </div>
      <p className={styles.hint}>
        The logistic map x → r·x·(1−x) is exactly conjugate to z → z² + c via c = r/2 − r²/4.
        Dragging r sweeps c along the Mandelbrot set&apos;s real axis (white line) — the
        period-doubling cascade in the bifurcation diagram is the same structure as the bulbs
        strung along that axis, down to sharing the same Feigenbaum scaling ratio.
      </p>
    </div>
  );
}
