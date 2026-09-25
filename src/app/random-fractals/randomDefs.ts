export type RandomFamily = "walk" | "surface" | "cluster";

export interface RandomDef {
  id: string;
  name: string;
  family: RandomFamily;
  description: string;
  method: string;
  params: string;
  draw: (ctx: CanvasRenderingContext2D, size: number) => void;
}

const BG = "#050506";

// Small, fast seeded PRNG so every render (and its thumbnail) is the same
// sample. Statistically fine for pictures, not for cryptography.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(rand: () => number): () => number {
  return () => {
    const u = 1 - rand();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
  };
}

function clear(ctx: CanvasRenderingContext2D, size: number) {
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, size, size);
}

// Fits a point list into the canvas (aspect preserved) and strokes it as
// one path whose hue sweeps with time, so the order of the walk is visible.
function drawPath(
  ctx: CanvasRenderingContext2D,
  size: number,
  pts: [number, number][],
  hues: [number, number],
  lineWidth: number,
) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [x, y] of pts) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  const pad = 0.07;
  const scale = (size * (1 - 2 * pad)) / Math.max(maxX - minX || 1, maxY - minY || 1);
  const ox = size / 2 - ((minX + maxX) / 2) * scale;
  const oy = size / 2 - ((minY + maxY) / 2) * scale;
  const batches = 120;
  ctx.lineWidth = lineWidth;
  ctx.lineJoin = "round";
  ctx.globalAlpha = 0.85;
  for (let b = 0; b < batches; b++) {
    const from = Math.floor((b * (pts.length - 1)) / batches);
    const to = Math.floor(((b + 1) * (pts.length - 1)) / batches);
    ctx.beginPath();
    ctx.moveTo(ox + pts[from][0] * scale, oy + pts[from][1] * scale);
    for (let i = from + 1; i <= to; i++) ctx.lineTo(ox + pts[i][0] * scale, oy + pts[i][1] * scale);
    ctx.strokeStyle = `hsl(${hues[0] + ((hues[1] - hues[0]) * b) / (batches - 1)} 80% 62%)`;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

// Diamond-square on a (2ⁿ + 1)² grid. Each level halves the step and scales
// the random offsets by 2^(−H), which is what makes the surface statistically
// self-similar with Hurst exponent H.
function diamondSquare(n: number, hurst: number, rand: () => number): Float32Array {
  const size = (1 << n) + 1;
  const h = new Float32Array(size * size);
  const gauss = gaussian(rand);
  let step = size - 1;
  let amp = 1;
  while (step > 1) {
    const half = step / 2;
    for (let y = half; y < size; y += step) {
      for (let x = half; x < size; x += step) {
        const avg =
          (h[(y - half) * size + x - half] + h[(y - half) * size + x + half] +
            h[(y + half) * size + x - half] + h[(y + half) * size + x + half]) / 4;
        h[y * size + x] = avg + gauss() * amp;
      }
    }
    for (let y = 0; y < size; y += half) {
      for (let x = (y / half) % 2 === 0 ? half : 0; x < size; x += step) {
        let sum = 0, cnt = 0;
        if (y >= half) { sum += h[(y - half) * size + x]; cnt++; }
        if (y + half < size) { sum += h[(y + half) * size + x]; cnt++; }
        if (x >= half) { sum += h[y * size + x - half]; cnt++; }
        if (x + half < size) { sum += h[y * size + x + half]; cnt++; }
        h[y * size + x] = sum / cnt + gauss() * amp;
      }
    }
    step = half;
    amp *= Math.pow(2, -hurst);
  }
  return h;
}

function putPixels(
  ctx: CanvasRenderingContext2D,
  size: number,
  gridSize: number,
  color: (gx: number, gy: number) => [number, number, number],
) {
  const img = ctx.createImageData(size, size);
  for (let py = 0; py < size; py++) {
    const gy = Math.min(gridSize - 1, Math.floor((py / size) * gridSize));
    for (let px = 0; px < size; px++) {
      const gx = Math.min(gridSize - 1, Math.floor((px / size) * gridSize));
      const [r, g, b] = color(gx, gy);
      const o = (py * size + px) * 4;
      img.data[o] = r;
      img.data[o + 1] = g;
      img.data[o + 2] = b;
      img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

export const RANDOM_FRACTALS: RandomDef[] = [
  {
    id: "brownian",
    name: "Brownian motion",
    family: "walk",
    description:
      "A particle pushed by independent random kicks. Zoom in on any stretch and it looks just as rough as the whole, and its path has dimension 2: in the limit, it fills area.",
    method: "xₙ₊₁ = xₙ + N(0, 1)\nyₙ₊₁ = yₙ + N(0, 1)\ncolour = time",
    params: "steps=40 000  seed=7  D=2",
    draw: (ctx, size) => {
      clear(ctx, size);
      const g = gaussian(mulberry32(7));
      const pts: [number, number][] = [[0, 0]];
      for (let i = 0; i < 40000; i++) {
        const [x, y] = pts[pts.length - 1];
        pts.push([x + g(), y + g()]);
      }
      drawPath(ctx, size, pts, [190, 330], 0.6);
    },
  },
  {
    id: "levy-flight",
    name: "Lévy flight",
    family: "walk",
    description:
      "Same random direction, but step lengths come from a heavy-tailed distribution, so rare long jumps link dense clusters of short ones. Foraging albatrosses and sharks have been argued to search this way.",
    method: "θ ~ U(0, 2π)\nℓ = u^(−1/α),  u ~ U(0, 1)\nstep = ℓ·(cos θ, sin θ)",
    params: "α=1.5  steps=6 000  seed=11",
    draw: (ctx, size) => {
      clear(ctx, size);
      const r = mulberry32(11);
      const pts: [number, number][] = [[0, 0]];
      for (let i = 0; i < 6000; i++) {
        const [x, y] = pts[pts.length - 1];
        const theta = 2 * Math.PI * r();
        // Cap the very rare astronomical jump so one step can't shrink the
        // rest of the picture to a dot.
        const len = Math.min(400, Math.pow(1 - r(), -1 / 1.5));
        pts.push([x + len * Math.cos(theta), y + len * Math.sin(theta)]);
      }
      drawPath(ctx, size, pts, [30, 90], 0.7);
    },
  },
  {
    id: "fbm",
    name: "Fractional Brownian motion",
    family: "walk",
    description:
      "The Hurst exponent H sets how the curve's roughness scales. H = 0.5 is ordinary Brownian motion. Lower H is jagged and anti-persistent, like a noisy signal. Higher H is smooth and trending, like a coastline profile or a price chart.",
    method: "random midpoint displacement\nσ at level k ∝ 2^(−kH)\nD = 2 − H",
    params: "H = 0.2 · 0.5 · 0.8  points=2¹¹+1  seed=3",
    draw: (ctx, size) => {
      clear(ctx, size);
      const hursts = [0.2, 0.5, 0.8];
      const colors = ["hsl(0 80% 66%)", "hsl(45 90% 62%)", "hsl(190 80% 62%)"];
      const n = 1 << 11;
      hursts.forEach((H, k) => {
        const g = gaussian(mulberry32(3 + k));
        const v = new Float32Array(n + 1);
        v[n] = g();
        let amp = 0.5;
        for (let step = n; step > 1; step /= 2) {
          for (let i = step / 2; i < n; i += step) {
            v[i] = (v[i - step / 2] + v[i + step / 2]) / 2 + g() * amp;
          }
          amp *= Math.pow(2, -H);
        }
        let lo = Infinity, hi = -Infinity;
        for (const x of v) { lo = Math.min(lo, x); hi = Math.max(hi, x); }
        const bandTop = size * (0.08 + k * 0.29);
        const bandH = size * 0.24;
        ctx.beginPath();
        for (let i = 0; i <= n; i++) {
          const px = size * 0.05 + (i / n) * size * 0.9;
          const py = bandTop + bandH * (1 - (v[i] - lo) / (hi - lo || 1));
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.strokeStyle = colors[k];
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = colors[k];
        ctx.font = `${Math.round(size * 0.028)}px "IBM Plex Mono", monospace`;
        ctx.fillText(`H = ${H}`, size * 0.05, bandTop - size * 0.012);
      });
    },
  },
  {
    id: "terrain",
    name: "Fractal terrain",
    family: "surface",
    description:
      "Two-dimensional fBm, made with the diamond-square algorithm. Once it is coloured by height and lit from one side, the random surface reads immediately as mountains. Real topography has roughly this statistical self-similarity.",
    method: "diamond-square on (2ⁿ+1)² grid\nnoise σ halves by 2^(−H) per level\nhillshade from the north-west",
    params: "n=8 (257²)  H=0.85  seed=21",
    draw: (ctx, size) => {
      const N = 257;
      const h = diamondSquare(8, 0.85, mulberry32(21));
      let lo = Infinity, hi = -Infinity;
      for (const v of h) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
      const t = (i: number) => (h[i] - lo) / (hi - lo);
      const stops: [number, [number, number, number]][] = [
        [0.0, [18, 38, 82]], [0.4, [38, 88, 150]], [0.42, [196, 184, 132]],
        [0.47, [74, 128, 62]], [0.65, [58, 92, 48]], [0.78, [118, 102, 88]],
        [0.9, [220, 220, 226]], [1.0, [255, 255, 255]],
      ];
      const colorAt = (v: number): [number, number, number] => {
        for (let s = 1; s < stops.length; s++) {
          if (v <= stops[s][0]) {
            const [a, ca] = stops[s - 1], [b, cb] = stops[s];
            const f = (v - a) / (b - a || 1);
            return [0, 1, 2].map((c) => ca[c] + (cb[c] - ca[c]) * f) as [number, number, number];
          }
        }
        return stops[stops.length - 1][1];
      };
      putPixels(ctx, size, N, (x, y) => {
        const i = y * N + x;
        const v = t(i);
        const c = colorAt(v);
        if (v < 0.4) return c;
        const dx = t(i) - t(y * N + Math.max(0, x - 1));
        const dy = t(i) - t(Math.max(0, y - 1) * N + x);
        const light = Math.max(0.35, Math.min(1.35, 1 + (dx + dy) * 18));
        return [c[0] * light, c[1] * light, c[2] * light];
      });
    },
  },
  {
    id: "coastline",
    name: "Fractal coastline",
    family: "surface",
    description:
      "Mandelbrot's opening question: how long is the coast of Britain? Cut a rough random surface at sea level and the shoreline is a curve of dimension about 1.25 to 1.5, so its measured length keeps growing as the ruler shrinks.",
    method: "diamond-square height field\n× radial falloff (island)\nshore = cells where height crosses 0",
    params: "n=9 (513²)  H=0.55  seed=5  D≈1.45",
    draw: (ctx, size) => {
      const N = 513;
      const h = diamondSquare(9, 0.55, mulberry32(5));
      let lo = Infinity, hi = -Infinity;
      for (const v of h) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
      const land = new Uint8Array(N * N);
      for (let y = 0; y < N; y++) {
        for (let x = 0; x < N; x++) {
          const r = Math.hypot(x / (N - 1) - 0.5, y / (N - 1) - 0.5) * 2;
          // Raise the land near the centre and sink it near the edges, so
          // the zero crossing forms one island that fits in the frame.
          const v = (h[y * N + x] - lo) / (hi - lo) + 0.8 * (0.6 - r);
          land[y * N + x] = v > 0.5 ? 1 : 0;
        }
      }
      putPixels(ctx, size, N, (x, y) => {
        const i = y * N + x;
        const shore =
          land[i] &&
          ((x > 0 && !land[i - 1]) || (x < N - 1 && !land[i + 1]) ||
            (y > 0 && !land[i - N]) || (y < N - 1 && !land[i + N]));
        if (shore) return [255, 214, 120];
        return land[i] ? [34, 44, 40] : [8, 20, 36];
      });
    },
  },
  {
    id: "dla",
    name: "Diffusion-limited aggregation",
    family: "cluster",
    description:
      "Particles wander in one at a time by random walk and freeze on first contact with the cluster. Branch tips catch walkers before they can reach the fjords, so the tips grow fastest. The same branching shows up in mineral dendrites, lightning and electrodeposits.",
    method: "launch walker on circle r_max + 5\nrandom walk until adjacent to cluster\nstick; kill if r > 2·r_max + 20",
    params: "particles=9 000  grid=361²  seed=9  D≈1.71",
    draw: (ctx, size) => {
      const N = 361;
      const c = (N - 1) / 2;
      const r = mulberry32(9);
      const grid = new Uint16Array(N * N);
      grid[c * N + c] = 1;
      let rMax = 1;
      const total = 9000;
      const dirs = [1, -1, N, -N];
      for (let p = 2; p <= total; p++) {
        let stuck = false;
        while (!stuck) {
          const a = r() * 2 * Math.PI;
          let x = Math.round(c + (rMax + 5) * Math.cos(a));
          let y = Math.round(c + (rMax + 5) * Math.sin(a));
          const kill = Math.min(c - 2, 2 * rMax + 20);
          for (;;) {
            const i = y * N + x;
            if (grid[i - 1] || grid[i + 1] || grid[i - N] || grid[i + N]) {
              grid[i] = p;
              rMax = Math.max(rMax, Math.hypot(x - c, y - c));
              stuck = true;
              break;
            }
            const d = dirs[(r() * 4) | 0];
            x += d === 1 ? 1 : d === -1 ? -1 : 0;
            y += d === N ? 1 : d === -N ? -1 : 0;
            if (Math.hypot(x - c, y - c) > kill) break;
          }
        }
        if (rMax > c - 25) break;
      }
      putPixels(ctx, size, N, (x, y) => {
        const v = grid[y * N + x];
        if (!v) return [5, 5, 6];
        const t = v / total;
        return [
          120 + 135 * t,
          220 - 120 * t,
          255 - 40 * t,
        ];
      });
    },
  },
  {
    id: "percolation",
    name: "Critical percolation",
    family: "cluster",
    description:
      "Fill each square independently with probability p. Just below p_c ≈ 0.5927 every cluster is finite; just above, one spans everything. Exactly at p_c the largest cluster is a fractal full of holes at every scale.",
    method: "site open with probability p_c\nclusters = 4-connected open sites\nlargest cluster highlighted",
    params: "p=0.592746  grid=320²  seed=13  D=91/48≈1.896",
    draw: (ctx, size) => {
      const N = 320;
      const r = mulberry32(13);
      const open = new Uint8Array(N * N);
      for (let i = 0; i < open.length; i++) open[i] = r() < 0.592746 ? 1 : 0;
      const label = new Int32Array(N * N).fill(-1);
      const sizes: number[] = [];
      const stack: number[] = [];
      for (let s = 0; s < N * N; s++) {
        if (!open[s] || label[s] >= 0) continue;
        const id = sizes.length;
        let count = 0;
        label[s] = id;
        stack.push(s);
        while (stack.length) {
          const i = stack.pop()!;
          count++;
          const x = i % N;
          for (const j of [x > 0 ? i - 1 : -1, x < N - 1 ? i + 1 : -1, i - N, i + N]) {
            if (j >= 0 && j < N * N && open[j] && label[j] < 0) {
              label[j] = id;
              stack.push(j);
            }
          }
        }
        sizes.push(count);
      }
      const order = sizes.map((_, i) => i).sort((a, b) => sizes[b] - sizes[a]);
      const rank = new Map(order.slice(0, 6).map((id, k) => [id, k]));
      const top: [number, number, number][] = [
        [255, 190, 11], [251, 86, 7], [255, 0, 110], [131, 56, 236], [58, 134, 255], [6, 214, 160],
      ];
      putPixels(ctx, size, N, (x, y) => {
        const l = label[y * N + x];
        if (l < 0) return [5, 5, 6];
        const k = rank.get(l);
        return k === undefined ? [40, 42, 52] : top[k];
      });
    },
  },
  {
    id: "fractal-percolation",
    name: "Mandelbrot percolation",
    family: "cluster",
    description:
      "A random Sierpiński carpet: split the square into 3 × 3, keep each sub-square with probability p, and repeat inside the survivors. Each run gives a different pattern, but they all have the same dimension log₃(9p).",
    method: "square → 3 × 3 sub-squares\nkeep each with probability p\nrecurse into survivors",
    params: "p=0.78  depth=5 (243²)  seed=17  D=log₃7.02≈1.774",
    draw: (ctx, size) => {
      const N = 243;
      const r = mulberry32(17);
      const kept = new Uint8Array(N * N);
      const recurse = (x0: number, y0: number, s: number) => {
        if (s === 1) {
          kept[y0 * N + x0] = 1;
          return;
        }
        const t = s / 3;
        for (let j = 0; j < 3; j++) {
          for (let i = 0; i < 3; i++) {
            if (r() < 0.78) recurse(x0 + i * t, y0 + j * t, t);
          }
        }
      };
      recurse(0, 0, N);
      putPixels(ctx, size, N, (x, y) => (kept[y * N + x] ? [94, 234, 212] : [5, 5, 6]));
    },
  },
];
