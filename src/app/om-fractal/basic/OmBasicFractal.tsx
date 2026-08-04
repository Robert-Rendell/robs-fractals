"use client";

import { useEffect, useRef } from "react";
import { buildOmStamp, findGlyphBlobs, loadImage, type GlyphBlob } from "../omStamp";
import styles from "./basic.module.css";

const DEPTH = 8;
const TWIST_PER_GEN = (18 * Math.PI) / 180;
const FIT = 1.5;

function drawGenerator(
  ctx: CanvasRenderingContext2D,
  stamp: HTMLCanvasElement,
  anchors: GlyphBlob[],
  cx: number,
  cy: number,
  size: number,
  rotation: number,
  depth: number,
  alpha: number,
) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rotation);
  ctx.globalAlpha = alpha;
  ctx.drawImage(stamp, -size / 2, -size / 2, size, size);
  ctx.restore();
  if (depth <= 0) return;

  const cosR = Math.cos(rotation);
  const sinR = Math.sin(rotation);

  anchors.forEach((anchor, i) => {
    // The anchor's (cx, cy) is a fraction of the glyph's own bounding
    // square, measured from its top-left when unrotated. Convert that into
    // an offset from this stamp's own center, then rotate it by the same
    // amount this stamp itself was rotated, so the child lands inside the
    // anchor feature regardless of orientation.
    const localX = (anchor.cx - 0.5) * size;
    const localY = (anchor.cy - 0.5) * size;
    const childCx = cx + localX * cosR - localY * sinR;
    const childCy = cy + localX * sinR + localY * cosR;
    const childSize = size * anchor.r * 2 * FIT;
    const twistSign = i % 2 === 0 ? 1 : -1;
    const childRotation = rotation + TWIST_PER_GEN * twistSign;

    drawGenerator(ctx, stamp, anchors, childCx, childCy, childSize, childRotation, depth - 1, alpha * 0.92);
  });
}

export default function OmBasicFractal() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvasEl = canvasRef.current;
    if (!canvasEl) return;
    const canvas: HTMLCanvasElement = canvasEl;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let disposed = false;
    let stamp: HTMLCanvasElement | null = null;
    let anchors: GlyphBlob[] = [];

    function render() {
      if (!stamp || anchors.length === 0) return;
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const w = Math.max(1, Math.round(rect.width * dpr));
      const h = Math.max(1, Math.round(rect.height * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      ctx!.clearRect(0, 0, canvas.width, canvas.height);
      const size = Math.min(canvas.width, canvas.height) * 0.6;
      drawGenerator(ctx!, stamp, anchors, canvas.width / 2, canvas.height / 2, size, 0, DEPTH, 0.95);
      ctx!.globalAlpha = 1;
    }

    const resizeObserver = new ResizeObserver(() => render());
    resizeObserver.observe(canvas);

    loadImage("/om.svg").then((img) => {
      if (disposed) return;
      stamp = buildOmStamp(img, [55, 138, 221]);
      // Smallest two disjoint ink regions in the glyph itself — for the Om
      // symbol these are the dot and the crescent above the main curve.
      anchors = findGlyphBlobs(img).slice(0, 2);
      render();
    });

    return () => {
      disposed = true;
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <div className={styles.container}>
      <h1 className={styles.heading}>Om fractal — basic recursion</h1>
      <div className={styles.canvasWrap}>
        <canvas ref={canvasRef} className={styles.canvas} />
      </div>
      <p className={styles.hint}>
        Instead of picking arbitrary offsets, this rule finds the glyph&apos;s own smallest
        disjoint features — the dot and the crescent above the main curve — and recurses a full
        copy of the whole glyph into each one, rotating a little further with every generation.
      </p>
    </div>
  );
}
