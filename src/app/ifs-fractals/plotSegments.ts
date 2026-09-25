import type { Segment } from "./ifsDefs";

export function plotSegments(
  canvas: HTMLCanvasElement,
  segments: Segment[],
  color: string,
  // `hues` recolours the path from the first hue to the second in drawing
  // order, which makes a single space-filling curve's route readable.
  opts: { glow?: boolean; hues?: [number, number] } = {},
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.fillStyle = "#050506";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (segments.length === 0) return;

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [x1, y1, x2, y2] of segments) {
    if (x1 < minX) minX = x1;
    if (x1 > maxX) maxX = x1;
    if (x2 < minX) minX = x2;
    if (x2 > maxX) maxX = x2;
    if (y1 < minY) minY = y1;
    if (y1 > maxY) maxY = y1;
    if (y2 < minY) minY = y2;
    if (y2 > maxY) maxY = y2;
  }
  const pad = 0.08;
  const w = maxX - minX || 1;
  const h = maxY - minY || 1;
  const scale = (1 - pad * 2) * Math.min(canvas.width / w, canvas.height / h);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const ox = canvas.width / 2;
  const oy = canvas.height / 2;

  // Batched into a fixed number of paths so a gradient costs a few dozen
  // strokes rather than one per segment.
  const batches = opts.hues ? Math.min(96, segments.length) : 1;
  const paths: Path2D[] = [];
  for (let b = 0; b < batches; b++) {
    const path = new Path2D();
    const from = Math.floor((b * segments.length) / batches);
    const to = Math.floor(((b + 1) * segments.length) / batches);
    for (let i = from; i < to; i++) {
      const [x1, y1, x2, y2] = segments[i];
      path.moveTo(ox + (x1 - cx) * scale, oy - (y1 - cy) * scale);
      path.lineTo(ox + (x2 - cx) * scale, oy - (y2 - cy) * scale);
    }
    paths.push(path);
  }
  const strokeAll = () => {
    paths.forEach((path, b) => {
      if (opts.hues) {
        const [h0, h1] = opts.hues;
        const t = batches === 1 ? 0 : b / (batches - 1);
        ctx.strokeStyle = `hsl(${h0 + (h1 - h0) * t} 80% 64%)`;
      }
      ctx.stroke(path);
    });
  };

  ctx.strokeStyle = color;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  // A soft blurred pass underneath a crisp one gives a single organic curve
  // the same phosphor-glow feel as the attractor plots. Skipped for dense
  // rectilinear grids (like the H-tree) where the blur just smears
  // thousands of overlapping axis-aligned lines into a grey haze.
  if (opts.glow ?? true) {
    ctx.filter = "blur(2.5px)";
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 3;
    strokeAll();
    ctx.filter = "none";
    ctx.globalAlpha = 1;
  }
  ctx.lineWidth = 1;
  strokeAll();
}
