export type EscapeFamily = "parameter" | "julia" | "beyond";

// Returns a smooth (fractional) escape count, or -1 for points that never
// escape within maxIter and are drawn as the set's interior.
type Kernel = (x: number, y: number, maxIter: number) => number;

interface GeneratedEscapeDef {
  kind: "generated";
  id: string;
  name: string;
  family: EscapeFamily;
  description: string;
  formula: string;
  params: string;
  // Complex-plane window: centre and the width it spans.
  center: [number, number];
  span: number;
  // Flip the imaginary axis so it grows downward (the Burning Ship only
  // looks like a ship this way up).
  flipY?: boolean;
  maxIter: number;
  // Cosine palette phase offsets (R, G, B) and how fast colour cycles
  // with escape count.
  palette: { phase: [number, number, number]; freq: number };
  kernel: Kernel;
  // Newton's method colours by which root is reached rather than by escape
  // speed, so it supplies its own colouring.
  colorize?: (x: number, y: number) => [number, number, number];
}

interface LinkedEscapeDef {
  kind: "linked";
  id: string;
  name: string;
  family: EscapeFamily;
  description: string;
  thumbSrc: string;
  href: string;
}

export type EscapeDef = GeneratedEscapeDef | LinkedEscapeDef;
export type { GeneratedEscapeDef };

const BAILOUT = 256;
const LOG2 = Math.log(2);

// Standard continuous-colouring correction: subtract how far past the
// bailout radius the last step overshot, so bands blend instead of stepping.
function smooth(n: number, zx: number, zy: number, power = 2): number {
  const logZn = Math.log(zx * zx + zy * zy) / 2;
  return n + 1 - Math.log(logZn / LOG2) / Math.log(power);
}

function julia(cx: number, cy: number): Kernel {
  return (x, y, maxIter) => {
    let zx = x, zy = y;
    for (let n = 0; n < maxIter; n++) {
      const xx = zx * zx, yy = zy * zy;
      if (xx + yy > BAILOUT) return smooth(n, zx, zy);
      zy = 2 * zx * zy + cy;
      zx = xx - yy + cx;
    }
    return -1;
  };
}

const NEWTON_ROOTS: [number, number][] = [
  [1, 0],
  [-0.5, Math.sqrt(3) / 2],
  [-0.5, -Math.sqrt(3) / 2],
];
const NEWTON_COLORS: [number, number, number][] = [
  [239, 71, 111],
  [255, 209, 102],
  [17, 138, 178],
];

// Newton's method on z³ − 1. Returns [root index, steps] so both the
// kernel (for the shared loop) and the colouring can use it.
function newton(x: number, y: number, maxIter: number): [number, number] {
  let zx = x, zy = y;
  for (let n = 0; n < maxIter; n++) {
    for (let r = 0; r < 3; r++) {
      const dx = zx - NEWTON_ROOTS[r][0], dy = zy - NEWTON_ROOTS[r][1];
      if (dx * dx + dy * dy < 1e-6) return [r, n];
    }
    // z ← z − (z³ − 1) / (3z²)
    const x2 = zx * zx, y2 = zy * zy;
    const z2x = x2 - y2, z2y = 2 * zx * zy;
    const z3x = z2x * zx - z2y * zy, z3y = z2x * zy + z2y * zx;
    const dx = 3 * z2x, dy = 3 * z2y;
    const den = dx * dx + dy * dy;
    if (den === 0) return [-1, n];
    const nx = z3x - 1, ny = z3y;
    zx -= (nx * dx + ny * dy) / den;
    zy -= (ny * dx - nx * dy) / den;
  }
  return [-1, maxIter];
}

export const ESCAPE_FRACTALS: EscapeDef[] = [
  {
    kind: "generated",
    id: "mandelbrot",
    name: "Mandelbrot set",
    family: "parameter",
    description:
      "Every pixel is a different c, and every orbit starts from z = 0. Black points keep their orbit bounded forever. The set is also a catalogue of every quadratic Julia set: c inside it gives a connected Julia set, c outside gives dust.",
    formula: "z₀ = 0\nzₙ₊₁ = zₙ² + c\npixel = c",
    params: "centre=−0.6+0i  span=3.2  maxIter=300",
    center: [-0.6, 0],
    span: 3.2,
    maxIter: 300,
    palette: { phase: [0.0, 0.15, 0.3], freq: 0.045 },
    kernel: (cx, cy, maxIter) => {
      // Skip the main cardioid and period-2 bulb, where most of the
      // never-escaping (and so most expensive) pixels sit.
      const q = (cx - 0.25) ** 2 + cy * cy;
      if (q * (q + (cx - 0.25)) <= 0.25 * cy * cy) return -1;
      if ((cx + 1) ** 2 + cy * cy <= 1 / 16) return -1;
      let zx = 0, zy = 0;
      for (let n = 0; n < maxIter; n++) {
        const xx = zx * zx, yy = zy * zy;
        if (xx + yy > BAILOUT) return smooth(n, zx, zy);
        zy = 2 * zx * zy + cy;
        zx = xx - yy + cx;
      }
      return -1;
    },
  },
  {
    kind: "generated",
    id: "seahorse",
    name: "Seahorse Valley",
    family: "parameter",
    description:
      "A 200× zoom into the gap between the main cardioid and the period-2 bulb. Spirals made of smaller spirals keep appearing at every depth, and tiny distorted copies of the whole set are scattered among them.",
    formula: "z₀ = 0\nzₙ₊₁ = zₙ² + c\npixel = c",
    params: "centre=−0.745+0.113i  span=0.016  maxIter=600",
    center: [-0.7453, 0.1127],
    span: 0.016,
    maxIter: 600,
    palette: { phase: [0.55, 0.65, 0.8], freq: 0.03 },
    kernel: (cx, cy, maxIter) => {
      let zx = 0, zy = 0;
      for (let n = 0; n < maxIter; n++) {
        const xx = zx * zx, yy = zy * zy;
        if (xx + yy > BAILOUT) return smooth(n, zx, zy);
        zy = 2 * zx * zy + cy;
        zx = xx - yy + cx;
      }
      return -1;
    },
  },
  {
    kind: "generated",
    id: "multibrot",
    name: "Multibrot (d = 3)",
    family: "parameter",
    description:
      "Raise z to the third power instead of the second and the set gains a second axis of symmetry. In general zᵈ + c has d − 1 main lobes.",
    formula: "z₀ = 0\nzₙ₊₁ = zₙ³ + c",
    params: "centre=0+0i  span=3.0  maxIter=200",
    center: [0, 0],
    span: 3.0,
    maxIter: 200,
    palette: { phase: [0.3, 0.2, 0.2], freq: 0.06 },
    kernel: (cx, cy, maxIter) => {
      let zx = 0, zy = 0;
      for (let n = 0; n < maxIter; n++) {
        const xx = zx * zx, yy = zy * zy;
        if (xx + yy > BAILOUT) return smooth(n, zx, zy, 3);
        const nx = zx * (xx - 3 * yy) + cx;
        zy = zy * (3 * xx - yy) + cy;
        zx = nx;
      }
      return -1;
    },
  },
  {
    kind: "generated",
    id: "burning-ship",
    name: "Burning Ship",
    family: "parameter",
    description:
      "Take the absolute value of both parts of z before squaring. That one change breaks the analytic structure: the set loses its smooth symmetry and grows jagged masts and rigging instead of bulbs. This view zooms in on the small copy on the negative real axis that gives the set its name.",
    formula: "z₀ = 0\nzₙ₊₁ = (|Re z| + i|Im z|)² + c\n(imaginary axis points down)",
    params: "centre=−1.755−0.035i  span=0.1  maxIter=300",
    center: [-1.755, -0.035],
    span: 0.1,
    flipY: true,
    maxIter: 300,
    palette: { phase: [0.0, 0.1, 0.2], freq: 0.05 },
    kernel: (cx, cy, maxIter) => {
      let zx = 0, zy = 0;
      for (let n = 0; n < maxIter; n++) {
        const xx = zx * zx, yy = zy * zy;
        if (xx + yy > BAILOUT) return smooth(n, zx, zy);
        zy = Math.abs(2 * zx * zy) + cy;
        zx = xx - yy + cx;
      }
      return -1;
    },
  },
  {
    kind: "generated",
    id: "tricorn",
    name: "Tricorn",
    family: "parameter",
    description:
      "Conjugate z before squaring, so the map is anti-holomorphic. The set becomes three-cornered, and its edges are made of wiggly arcs rather than the Mandelbrot set's circles.",
    formula: "z₀ = 0\nzₙ₊₁ = z̄ₙ² + c",
    params: "centre=−0.3+0i  span=3.4  maxIter=200",
    center: [-0.3, 0],
    span: 3.4,
    maxIter: 200,
    palette: { phase: [0.6, 0.4, 0.2], freq: 0.05 },
    kernel: (cx, cy, maxIter) => {
      let zx = 0, zy = 0;
      for (let n = 0; n < maxIter; n++) {
        const xx = zx * zx, yy = zy * zy;
        if (xx + yy > BAILOUT) return smooth(n, zx, zy);
        zy = -2 * zx * zy + cy;
        zx = xx - yy + cx;
      }
      return -1;
    },
  },
  {
    kind: "generated",
    id: "rabbit",
    name: "Douady rabbit",
    family: "julia",
    description:
      "c sits inside a period-3 bulb of the Mandelbrot set, so every interior point is pulled towards a cycle of three. That's why each junction joins three 'ears', and it repeats at every scale.",
    formula: "z₀ = pixel\nzₙ₊₁ = zₙ² + c",
    params: "c=−0.123+0.745i  span=3.2  maxIter=300",
    center: [0, 0],
    span: 3.2,
    maxIter: 300,
    palette: { phase: [0.1, 0.35, 0.6], freq: 0.05 },
    kernel: julia(-0.123, 0.745),
  },
  {
    kind: "generated",
    id: "dendrite",
    name: "Dendrite",
    family: "julia",
    description:
      "For c = i the critical orbit lands on a repelling cycle instead of converging. The Julia set has no interior at all, only an infinitely branching tree of zero area.",
    formula: "z₀ = pixel\nzₙ₊₁ = zₙ² + c",
    params: "c=0+1i  span=3.2  maxIter=300",
    center: [0, 0],
    span: 3.2,
    maxIter: 300,
    palette: { phase: [0.5, 0.3, 0.1], freq: 0.08 },
    kernel: julia(0, 1),
  },
  {
    kind: "generated",
    id: "siegel",
    name: "Siegel disk",
    family: "julia",
    description:
      "Here c is tuned so the fixed point rotates by the golden-mean angle. Nearby points circle it forever without being pulled in or pushed out, and they fill a disk bounded by a fractal curve.",
    formula: "z₀ = pixel\nzₙ₊₁ = zₙ² + c",
    params: "c=−0.391−0.587i  span=3.0  maxIter=400",
    center: [0, 0],
    span: 3.0,
    maxIter: 400,
    palette: { phase: [0.0, 0.33, 0.67], freq: 0.04 },
    kernel: julia(-0.390541, -0.586788),
  },
  {
    kind: "generated",
    id: "dust",
    name: "Past the cusp",
    family: "julia",
    description:
      "c = 0.285 + 0.01i lies just past the cusp of the main cardioid, outside the Mandelbrot set, so strictly this Julia set is disconnected dust. Orbits linger near the old fixed point for so long that it still looks like a connected lace of spirals.",
    formula: "z₀ = pixel\nzₙ₊₁ = zₙ² + c",
    params: "c=0.285+0.01i  span=3.0  maxIter=500",
    center: [0, 0],
    span: 3.0,
    maxIter: 500,
    palette: { phase: [0.75, 0.5, 0.35], freq: 0.035 },
    kernel: julia(0.285, 0.01),
  },
  {
    kind: "generated",
    id: "newton",
    name: "Newton fractal",
    family: "beyond",
    description:
      "Nothing escapes here. Newton's method finds a root of z³ − 1 from every starting point, and each pixel is coloured by which of the three roots it reaches. Where any two basins meet, all three meet, so the boundary is fractal.",
    formula: "zₙ₊₁ = zₙ − (zₙ³ − 1) / 3zₙ²\ncolour = root reached\nshade = steps taken",
    params: "centre=0+0i  span=2.2  maxIter=40",
    center: [0, 0],
    span: 2.2,
    maxIter: 40,
    palette: { phase: [0, 0, 0], freq: 0 },
    kernel: (x, y, maxIter) => newton(x, y, maxIter)[1],
    colorize: (x, y) => {
      const [r, n] = newton(x, y, 40);
      if (r < 0) return [0, 0, 0];
      const shade = Math.max(0.15, 1 - n / 18);
      const c = NEWTON_COLORS[r];
      return [c[0] * shade, c[1] * shade, c[2] * shade];
    },
  },
  {
    kind: "linked",
    id: "mandelbrot-bifurcation",
    name: "Mandelbrot & Bifurcation",
    family: "beyond",
    description:
      "The Mandelbrot set's real axis next to the logistic map's bifurcation diagram, showing the same period-doubling route to chaos from two sides. Full interactive version on its own page.",
    thumbSrc: "/mandelbrot-bifurcation-thumb.png",
    href: "/mandelbrot-bifurcation",
  },
  {
    kind: "linked",
    id: "mandelbulb",
    name: "Mandelbulb",
    family: "beyond",
    description:
      "An escape-time fractal in 3D, using spherical coordinates in place of complex multiplication. Raymarched live on its own page.",
    thumbSrc: "/mandelbulb-thumb.png",
    href: "/mandelbulb",
  },
  {
    kind: "linked",
    id: "mandelbox",
    name: "Mandelbox",
    family: "beyond",
    description:
      "Also escape-time, but each step is a box fold and a sphere fold instead of a power. Raymarched live on its own page.",
    thumbSrc: "/mandelbox-thumb.png",
    href: "/mandelbox",
  },
];

// Renders one generated def into an RGBA buffer, using an Inigo Quilez
// cosine palette over the smooth escape count; interior points are black.
export function renderEscape(def: GeneratedEscapeDef, size: number): Uint8ClampedArray<ArrayBuffer> {
  const out = new Uint8ClampedArray(size * size * 4);
  const scale = def.span / size;
  const [ph, freq] = [def.palette.phase, def.palette.freq];
  for (let py = 0; py < size; py++) {
    const dy = (py - size / 2 + 0.5) * scale;
    const y = def.center[1] + (def.flipY ? dy : -dy);
    for (let px = 0; px < size; px++) {
      const x = def.center[0] + (px - size / 2 + 0.5) * scale;
      const o = (py * size + px) * 4;
      out[o + 3] = 255;
      if (def.colorize) {
        const [r, g, b] = def.colorize(x, y);
        out[o] = r;
        out[o + 1] = g;
        out[o + 2] = b;
        continue;
      }
      const n = def.kernel(x, y, def.maxIter);
      if (n < 0) {
        out[o] = out[o + 1] = out[o + 2] = 5;
        continue;
      }
      const t = n * freq;
      // Fade the outermost bands to the page background so the canvas edge
      // doesn't show as a hard block of colour.
      const fade = Math.min(1, n / 12);
      out[o] = (0.5 + 0.5 * Math.cos(6.2832 * (t + ph[0]))) * 255 * fade;
      out[o + 1] = (0.5 + 0.5 * Math.cos(6.2832 * (t + ph[1]))) * 255 * fade;
      out[o + 2] = (0.5 + 0.5 * Math.cos(6.2832 * (t + ph[2]))) * 255 * fade;
    }
  }
  return out;
}
