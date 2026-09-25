export type Complex = [number, number];

export interface Polynomial {
  id: string;
  label: string;
  // Real coefficients, highest power first; always monic.
  coeffs: number[];
  note: string;
}

export const POLYNOMIALS: Polynomial[] = [
  {
    id: "z3-1",
    label: "z³ − 1",
    coeffs: [1, 0, 0, -1],
    note: "The classic: three cube roots of unity, three basins, and every boundary point touches all three.",
  },
  {
    id: "z4-1",
    label: "z⁴ − 1",
    coeffs: [1, 0, 0, 0, -1],
    note: "Four roots on the axes. The basins meet along the diagonals, where the method is pulled equally between neighbouring roots.",
  },
  {
    id: "z5-1",
    label: "z⁵ − 1",
    coeffs: [1, 0, 0, 0, 0, -1],
    note: "Five-fold symmetry. More roots means more basins sharing each boundary, so the boundary is more tangled.",
  },
  {
    id: "z3-2z+2",
    label: "z³ − 2z + 2",
    coeffs: [1, 0, -2, 2],
    note: "Newton's method can fail. Starting at 0 gives 1, then 0, then 1 forever: an attracting 2-cycle. The regions that stay dark never find a root. Click inside one to watch its orbit bounce.",
  },
  {
    id: "z8+15z4-16",
    label: "z⁸ + 15z⁴ − 16",
    coeffs: [1, 0, 0, 0, 15, 0, 0, 0, -16],
    note: "Eight roots in two rings (moduli 1 and 2). The inner and outer basins interleave into flower-like petals.",
  },
];

// Durand–Kerner: refine all n roots at once from points on a circle. Only
// runs once per polynomial, so plain and robust beats fast.
export function findRoots(coeffs: number[]): Complex[] {
  const n = coeffs.length - 1;
  let roots: Complex[] = Array.from({ length: n }, (_, k) => {
    const a = (2 * Math.PI * k) / n + 0.4;
    return [0.9 * Math.cos(a), 0.9 * Math.sin(a)];
  });
  for (let iter = 0; iter < 500; iter++) {
    let moved = 0;
    roots = roots.map((r, i) => {
      const [pr, pi] = evalPoly(coeffs, r[0], r[1])[0];
      let dr = 1, di = 0;
      roots.forEach((s, j) => {
        if (i === j) return;
        const ar = r[0] - s[0], ai = r[1] - s[1];
        [dr, di] = [dr * ar - di * ai, dr * ai + di * ar];
      });
      const den = dr * dr + di * di || 1e-300;
      const qr = (pr * dr + pi * di) / den, qi = (pi * dr - pr * di) / den;
      moved = Math.max(moved, Math.hypot(qr, qi));
      return [r[0] - qr, r[1] - qi];
    });
    if (moved < 1e-14) break;
  }
  return roots;
}

// Horner's rule for p(z) and p'(z) together.
export function evalPoly(coeffs: number[], zr: number, zi: number): [Complex, Complex] {
  let pr = 0, pi = 0, dr = 0, di = 0;
  for (const c of coeffs) {
    [dr, di] = [dr * zr - di * zi + pr, dr * zi + di * zr + pi];
    [pr, pi] = [pr * zr - pi * zi + c, pr * zi + pi * zr];
  }
  return [[pr, pi], [dr, di]];
}

// One relaxed Newton step: z ← z − a·p(z)/p'(z). a = 1 is plain Newton.
export function newtonStep(coeffs: number[], relax: number, zr: number, zi: number): Complex {
  const [[pr, pi], [dr, di]] = evalPoly(coeffs, zr, zi);
  const den = dr * dr + di * di;
  if (den === 0) return [zr, zi];
  const qr = (pr * dr + pi * di) / den, qi = (pi * dr - pr * di) / den;
  return [zr - relax * qr, zi - relax * qi];
}

const CONVERGED_SQ = 1e-10;

// The whole grid of starting points, advanced one Newton step at a time so
// the page can show the basins forming. Pixels that have landed on a root
// are frozen and skipped.
export class NewtonField {
  readonly w: number;
  readonly h: number;
  step = 0;
  private zr: Float64Array;
  private zi: Float64Array;
  // Step at which each pixel first came within reach of a root, or −1.
  private conv: Int16Array;
  private near: Uint8Array;

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.zr = new Float64Array(w * h);
    this.zi = new Float64Array(w * h);
    this.conv = new Int16Array(w * h);
    this.near = new Uint8Array(w * h);
  }

  reset(toComplex: (px: number, py: number) => Complex, roots: Complex[]) {
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const i = y * this.w + x;
        const [r, im] = toComplex(x + 0.5, y + 0.5);
        this.zr[i] = r;
        this.zi[i] = im;
        this.conv[i] = -1;
      }
    }
    this.step = 0;
    this.classify(roots);
  }

  // Same maths as newtonStep, inlined without tuple allocations: this loop
  // runs once per pixel per step, and allocation made it ~5× slower.
  advance(coeffs: number[], relax: number, roots: Complex[]) {
    const n = coeffs.length;
    for (let i = 0; i < this.zr.length; i++) {
      if (this.conv[i] >= 0) continue;
      const zr = this.zr[i], zi = this.zi[i];
      let pr = 0, pi = 0, dr = 0, di = 0;
      for (let c = 0; c < n; c++) {
        const ndr = dr * zr - di * zi + pr;
        di = dr * zi + di * zr + pi;
        dr = ndr;
        const npr = pr * zr - pi * zi + coeffs[c];
        pi = pr * zi + pi * zr;
        pr = npr;
      }
      const den = dr * dr + di * di;
      if (den === 0) continue;
      this.zr[i] = zr - (relax * (pr * dr + pi * di)) / den;
      this.zi[i] = zi - (relax * (pi * dr - pr * di)) / den;
    }
    this.step++;
    this.classify(roots);
  }

  private classify(roots: Complex[]) {
    for (let i = 0; i < this.zr.length; i++) {
      if (this.conv[i] >= 0) continue;
      let best = 0, bestD = Infinity;
      for (let k = 0; k < roots.length; k++) {
        const dx = this.zr[i] - roots[k][0], dy = this.zi[i] - roots[k][1];
        const d = dx * dx + dy * dy;
        if (d < bestD) { bestD = d; best = k; }
      }
      this.near[i] = best;
      if (bestD < CONVERGED_SQ) this.conv[i] = this.step;
    }
  }

  // Converged pixels in their root's colour, brighter the sooner they
  // arrived; the rest a dim tint of whichever root they're currently
  // nearest, so the undecided regions visibly shrink as you step.
  paint(out: Uint8ClampedArray, cols: [number, number, number][]) {
    for (let i = 0; i < this.zr.length; i++) {
      const c = cols[this.near[i] % cols.length];
      const o = i * 4;
      const k = this.conv[i];
      const shade = k >= 0 ? 0.3 + 0.7 * Math.pow(0.9, k) : 0.13;
      out[o] = c[0] * shade;
      out[o + 1] = c[1] * shade;
      out[o + 2] = c[2] * shade;
      out[o + 3] = 255;
    }
  }

  convergedFraction(): number {
    let n = 0;
    for (let i = 0; i < this.conv.length; i++) if (this.conv[i] >= 0) n++;
    return n / this.conv.length;
  }
}
