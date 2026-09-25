import type { CellGrid } from "./automatonDefs";

const BACKGROUND: [number, number, number] = [5, 5, 6];
// Sub-samples per output pixel along each axis. Grids larger than the canvas
// get averaged instead of aliased; smaller ones just repeat the same cell.
const SUPERSAMPLE = 3;

function parseHex(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
}

// Pure RGBA rasterisation of a cell grid into a size×size square, letterboxed
// to respect cellAspect. Kept free of DOM APIs so it also runs under Node,
// which is how the home-page thumbnails were rendered.
export function rasterizeCells(
  grid: CellGrid,
  palette: string[],
  size: number,
  opts: { cellAspect?: number; pad?: number } = {},
): Uint8ClampedArray<ArrayBuffer> {
  const colors = [BACKGROUND, ...palette.map(parseHex)];
  const aspect = opts.cellAspect ?? 1;
  const pad = opts.pad ?? 0.06;
  const inner = size * (1 - pad * 2);
  const scale = Math.min(inner / grid.width, inner / (grid.height * aspect));
  const drawW = grid.width * scale;
  const drawH = grid.height * aspect * scale;
  const ox = (size - drawW) / 2;
  const oy = (size - drawH) / 2;

  const out = new Uint8ClampedArray(size * size * 4);
  const n = SUPERSAMPLE * SUPERSAMPLE;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0;
      for (let sy = 0; sy < SUPERSAMPLE; sy++) {
        const gy = Math.floor((py + (sy + 0.5) / SUPERSAMPLE - oy) / (scale * aspect));
        for (let sx = 0; sx < SUPERSAMPLE; sx++) {
          const gx = Math.floor((px + (sx + 0.5) / SUPERSAMPLE - ox) / scale);
          const inside = gx >= 0 && gx < grid.width && gy >= 0 && gy < grid.height;
          const c = colors[inside ? grid.cells[gy * grid.width + gx] : 0] ?? colors[colors.length - 1];
          r += c[0];
          g += c[1];
          b += c[2];
        }
      }
      const o = (py * size + px) * 4;
      out[o] = r / n;
      out[o + 1] = g / n;
      out[o + 2] = b / n;
      out[o + 3] = 255;
    }
  }
  return out;
}

export function plotCells(
  canvas: HTMLCanvasElement,
  grid: CellGrid,
  palette: string[],
  opts: { cellAspect?: number; pad?: number } = {},
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const data = rasterizeCells(grid, palette, canvas.width, opts);
  ctx.putImageData(new ImageData(data, canvas.width, canvas.height), 0, 0);
}
