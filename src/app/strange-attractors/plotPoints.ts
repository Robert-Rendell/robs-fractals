import type { Vec2 } from "./attractorDefs";

export function plotPoints(
  canvas: HTMLCanvasElement,
  pts: Vec2[],
  color: string,
  opts: { alpha?: number; pointSize?: number; pad?: number } = {},
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.fillStyle = "#050506";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [x, y] of pts) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const pad = opts.pad ?? 0.06;
  const w = maxX - minX || 1;
  const h = maxY - minY || 1;
  const scale = (1 - pad * 2) * Math.min(canvas.width / w, canvas.height / h);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const ox = canvas.width / 2;
  const oy = canvas.height / 2;

  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = color;
  ctx.globalAlpha = opts.alpha ?? 0.12;
  const r = opts.pointSize ?? 0.9;
  for (const [x, y] of pts) {
    const px = ox + (x - cx) * scale;
    const py = oy - (y - cy) * scale;
    ctx.fillRect(px - r / 2, py - r / 2, r, r);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
}
