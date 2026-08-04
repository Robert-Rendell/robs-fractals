"use client";

import { useEffect, useRef } from "react";
import { pythagorasSquares2D } from "../pythagorasGeometry";
import styles from "./basic.module.css";

const DEPTH = 11;
const THETA = (45 * Math.PI) / 180;

export default function PythagorasBasicFractal() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvasEl = canvasRef.current;
    if (!canvasEl) return;
    const canvas: HTMLCanvasElement = canvasEl;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    function render() {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const w = Math.max(1, Math.round(rect.width * dpr));
      const h = Math.max(1, Math.round(rect.height * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      ctx!.clearRect(0, 0, canvas.width, canvas.height);

      const trunkSize = Math.min(canvas.width, canvas.height) * 0.16;
      const squares = pythagorasSquares2D(
        [canvas.width / 2 - trunkSize / 2, canvas.height * 0.92],
        [1, 0],
        trunkSize,
        DEPTH,
        THETA,
      );

      squares.forEach((sq) => {
        const gen = DEPTH - sq.depth;
        const t = DEPTH > 0 ? gen / DEPTH : 0;
        ctx!.beginPath();
        sq.corners.forEach(([x, y], i) => {
          if (i === 0) ctx!.moveTo(x, y);
          else ctx!.lineTo(x, y);
        });
        ctx!.closePath();
        ctx!.fillStyle = `rgb(${55 + 150 * t}, ${138 - 40 * t}, ${221 - 90 * t})`;
        ctx!.fill();
        ctx!.strokeStyle = "rgba(22, 20, 15, 0.5)";
        ctx!.lineWidth = 1;
        ctx!.stroke();
      });
    }

    const resizeObserver = new ResizeObserver(() => render());
    resizeObserver.observe(canvas);
    render();

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <div className={styles.container}>
      <h1 className={styles.heading}>Pythagoras tree — basic recursion</h1>
      <div className={styles.canvasWrap}>
        <canvas ref={canvasRef} className={styles.canvas} />
      </div>
      <p className={styles.hint}>
        The generator from the previous page, applied to both new legs, over and over: each
        square spawns two smaller squares at a fixed 45° split, eleven generations deep.
      </p>
    </div>
  );
}
