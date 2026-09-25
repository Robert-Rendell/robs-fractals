export type AutomatonFamily = "elementary" | "combinatorial" | "grid";

// A finished pattern: one byte per cell, row-major. State 0 is empty
// background; state n > 0 is drawn with palette[n - 1].
export interface CellGrid {
  width: number;
  height: number;
  cells: Uint8Array;
}

export interface AutomatonDef {
  id: string;
  name: string;
  family: AutomatonFamily;
  description: string;
  rule: string;
  params: string;
  palette: string[];
  // Rendered cell height ÷ width. √3 turns the 1D space-time triangles
  // equilateral instead of squat.
  cellAspect: number;
  compute: () => CellGrid;
}

const SQRT3 = Math.sqrt(3);

// Evenly spaced hex colours from `from` to `to`, inclusive — used for
// patterns whose state is a generation count or a residue rather than a
// small fixed set.
function ramp(from: string, to: string, n: number): string[] {
  const a = [1, 3, 5].map((i) => parseInt(from.slice(i, i + 2), 16));
  const b = [1, 3, 5].map((i) => parseInt(to.slice(i, i + 2), 16));
  const out: string[] = [];
  for (let k = 0; k < n; k++) {
    const t = n === 1 ? 0 : k / (n - 1);
    out.push(
      "#" +
        a
          .map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, "0"))
          .join(""),
    );
  }
  return out;
}

// Runs a Wolfram elementary rule from a single live cell for `steps`
// generations, stacking each generation as a row so the result is the
// space-time diagram. The row is wide enough that the light cone never
// reaches the edge.
function elementary(rule: number, steps: number): CellGrid {
  const width = 2 * steps + 1;
  const height = steps + 1;
  const cells = new Uint8Array(width * height);
  let row = new Uint8Array(width);
  row[steps] = 1;
  for (let t = 0; t < height; t++) {
    cells.set(row, t * width);
    const next = new Uint8Array(width);
    for (let x = 1; x < width - 1; x++) {
      const idx = (row[x - 1] << 2) | (row[x] << 1) | row[x + 1];
      next[x] = (rule >> idx) & 1;
    }
    row = next;
  }
  return { width, height, cells };
}

// Pascal's triangle with every entry reduced mod p, laid out centred like
// the elementary rules so the two families line up. Each residue gets its
// own colour; zeros are the holes.
function pascalMod(p: number, rows: number): CellGrid {
  const width = 2 * rows - 1;
  const cells = new Uint8Array(width * rows);
  let prev = new Uint8Array([1]);
  for (let n = 0; n < rows; n++) {
    const offset = rows - 1 - n;
    for (let k = 0; k <= n; k++) cells[n * width + offset + 2 * k] = prev[k];
    const next = new Uint8Array(n + 2);
    next[0] = 1;
    next[n + 1] = 1;
    for (let k = 1; k <= n; k++) next[k] = (prev[k - 1] + prev[k]) % p;
    prev = next;
  }
  // Fill the gap between adjacent entries so each value reads as a solid
  // two-cell-wide brick rather than a dotted lattice.
  for (let n = 0; n < rows; n++) {
    const base = n * width + (rows - 1 - n);
    for (let k = 0; k < n; k++) {
      const a = cells[base + 2 * k];
      if (a && a === cells[base + 2 * k + 2]) cells[base + 2 * k + 1] = a;
    }
  }
  return { width, height: rows, cells };
}

export const AUTOMATA: AutomatonDef[] = [
  {
    id: "rule90",
    name: "Rule 90",
    family: "elementary",
    description:
      "Each cell becomes the XOR of its two neighbours. From a single live cell it draws Pascal's triangle mod 2 — which is to say, Sierpiński's triangle, exactly.",
    rule: "next[x] = left ⊕ right\n111 110 101 100 011 010 001 000\n 0   1   0   1   1   0   1   0",
    params: "seed=1 cell  generations=255  D=log₂3≈1.585",
    palette: ["#7fd4ff"],
    cellAspect: SQRT3,
    compute: () => elementary(90, 255),
  },
  {
    id: "rule150",
    name: "Rule 150",
    family: "elementary",
    description:
      "XOR of the cell and both neighbours — trinomial coefficients mod 2. Self-similar like Rule 90, but its scaling factor is the golden ratio rather than 2.",
    rule: "next[x] = left ⊕ self ⊕ right\n111 110 101 100 011 010 001 000\n 1   0   0   1   0   1   1   0",
    params: "seed=1 cell  generations=255  D=log₂(1+√5)≈1.694",
    palette: ["#b89cff"],
    cellAspect: SQRT3,
    compute: () => elementary(150, 255),
  },
  {
    id: "rule30",
    name: "Rule 30",
    family: "elementary",
    description:
      "The counterpoint: a rule just as simple that goes chaotic instead of nested. Its left edge stays regular while the right dissolves into triangles of every size — structure without exact self-similarity.",
    rule: "next[x] = left ⊕ (self ∨ right)\n111 110 101 100 011 010 001 000\n 0   0   0   1   1   1   1   0",
    params: "seed=1 cell  generations=255",
    palette: ["#ffb454"],
    cellAspect: SQRT3,
    compute: () => elementary(30, 255),
  },
  {
    id: "pascal3",
    name: "Pascal's triangle mod 3",
    family: "combinatorial",
    description:
      "Binomial coefficients reduced mod 3. The zeros carve out a three-way Sierpiński-like gasket, and Lucas's theorem says why: C(n,k) mod p depends only on the base-p digits of n and k.",
    rule: "C(n,k) = C(n−1,k−1) + C(n−1,k)   (mod 3)\ncolour = residue ∈ {1, 2}",
    params: "p=3  rows=243 (3⁵)  D=log₃6≈1.631",
    palette: ["#4fd1a5", "#e6f58a"],
    cellAspect: SQRT3,
    compute: () => pascalMod(3, 243),
  },
  {
    id: "pascal5",
    name: "Pascal's triangle mod 5",
    family: "combinatorial",
    description:
      "The same construction with p = 5: each triangle splits into fifteen upright copies of itself around an inverted void, and the four non-zero residues interleave inside them.",
    rule: "C(n,k) = C(n−1,k−1) + C(n−1,k)   (mod 5)\ncolour = residue ∈ {1, 2, 3, 4}",
    params: "p=5  rows=125 (5³)  D=log₅15≈1.683",
    palette: ["#ff6b8b", "#ff9f5a", "#ffd166", "#8bd3ff"],
    cellAspect: SQRT3,
    compute: () => pascalMod(5, 125),
  },
  {
    id: "carpet",
    name: "Sierpiński carpet",
    family: "combinatorial",
    description:
      "No recursion and no geometry: a cell is empty exactly when x and y have a 1 in the same base-3 digit position. Checking digits one at a time is the automaton; the carpet is what falls out.",
    rule: "empty ⇔ ∃ i : digit₃(x, i) = 1 ∧ digit₃(y, i) = 1\ncolour = number of base-3 digits that are 1 in x or y",
    params: "size=243×243 (3⁵)  D=log₃8≈1.893",
    palette: ramp("#2b6cb0", "#9be7ff", 6),
    cellAspect: 1,
    compute: () => {
      const size = 243;
      const cells = new Uint8Array(size * size);
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          let a = x, b = y, ones = 0, hole = false;
          while (a || b) {
            const da = a % 3, db = b % 3;
            if (da === 1 && db === 1) { hole = true; break; }
            if (da === 1 || db === 1) ones++;
            a = (a / 3) | 0;
            b = (b / 3) | 0;
          }
          if (!hole) cells[y * size + x] = ones + 1;
        }
      }
      return { width: size, height: size, cells };
    },
  },
  {
    id: "xor",
    name: "XOR table",
    family: "combinatorial",
    description:
      "The multiplication table of bitwise XOR, coloured by value. Every power-of-two square contains four rearranged copies of the one below it, so the texture is identical at every scale down to a single pixel.",
    rule: "state(x, y) = x ⊕ y   (bitwise)\ncolour ramps from 0 to 255",
    params: "size=256×256 (2⁸)",
    palette: ramp("#3a0ca3", "#f72585", 32).concat(ramp("#f72585", "#ffd166", 32)),
    cellAspect: 1,
    compute: () => {
      const size = 256;
      const cells = new Uint8Array(size * size);
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) cells[y * size + x] = ((x ^ y) >> 2) + 1;
      }
      return { width: size, height: size, cells };
    },
  },
  {
    id: "ulam-warburton",
    name: "Ulam–Warburton automaton",
    family: "grid",
    description:
      "A cell is born if exactly one of its four orthogonal neighbours is alive, and never dies. The growth front stays fractal forever, and every 2ⁿ generations the pattern contains four copies of itself from the previous stage.",
    rule: "born ⇔ exactly 1 of N, E, S, W alive\nalive cells survive forever\ncolour = generation of birth",
    params: "seed=1 cell  generations=127 (2⁷ − 1)",
    palette: ramp("#ffd166", "#ef476f", 64).concat(ramp("#ef476f", "#3a86ff", 64)),
    cellAspect: 1,
    compute: () => {
      const gens = 127;
      const size = 2 * gens + 3;
      const cells = new Uint8Array(size * size);
      const c = (size - 1) / 2;
      cells[c * size + c] = 1;
      for (let g = 1; g <= gens; g++) {
        const born: number[] = [];
        for (let y = 1; y < size - 1; y++) {
          for (let x = 1; x < size - 1; x++) {
            const i = y * size + x;
            if (cells[i]) continue;
            const n =
              (cells[i - 1] ? 1 : 0) +
              (cells[i + 1] ? 1 : 0) +
              (cells[i - size] ? 1 : 0) +
              (cells[i + size] ? 1 : 0);
            if (n === 1) born.push(i);
          }
        }
        for (const i of born) cells[i] = g + 1;
      }
      return { width: size, height: size, cells };
    },
  },
  {
    id: "replicator",
    name: "Parity replicator",
    family: "grid",
    description:
      "Every cell becomes the XOR of itself and its four orthogonal neighbours — Rule 150 lifted to two dimensions. The rule is linear mod 2, so after 2ⁿ steps any seed reappears as five clean copies, and every generation in between is a superposition of those copies nested inside each other.",
    rule: "next = self ⊕ N ⊕ E ⊕ S ⊕ W\ncolour = distance from the seed",
    params: "seed=1 cell  generations=127 (2⁷ − 1)",
    palette: ramp("#56cfe1", "#5a4fcf", 8).concat(ramp("#5a4fcf", "#c77dff", 8)),
    cellAspect: 1,
    compute: () => {
      const gens = 127;
      const size = 2 * gens + 3;
      const c = (size - 1) / 2;
      let cur = new Uint8Array(size * size);
      cur[c * size + c] = 1;
      for (let g = 0; g < gens; g++) {
        const next = new Uint8Array(size * size);
        for (let y = 1; y < size - 1; y++) {
          for (let x = 1; x < size - 1; x++) {
            const i = y * size + x;
            next[i] = cur[i] ^ cur[i - 1] ^ cur[i + 1] ^ cur[i - size] ^ cur[i + size];
          }
        }
        cur = next;
      }
      const cells = new Uint8Array(size * size);
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const i = y * size + x;
          const d = Math.abs(x - c) + Math.abs(y - c);
          if (cur[i]) cells[i] = 1 + Math.min(15, Math.floor((d / (gens + 1)) * 16));
        }
      }
      return { width: size, height: size, cells };
    },
  },
  {
    id: "sandpile",
    name: "Abelian sandpile",
    family: "grid",
    description:
      "Pour grains onto one cell; any cell holding four or more topples, sending one grain to each neighbour. The rule is purely local, yet the stable pile it settles into is a self-similar tiling of nested patches.",
    rule: "if h ≥ 4:  h −= 4,  each of N, E, S, W += 1\nrepeat until every h < 4\ncolour = final height 0 · 1 · 2 · 3",
    params: "grains=2¹⁵ at centre  grid=149×149",
    palette: ["#22223b", "#4cc9f0", "#f72585", "#7209b7"],
    cellAspect: 1,
    compute: () => {
      const size = 149;
      const c = (size - 1) / 2;
      const h = new Uint32Array(size * size);
      const touched = new Uint8Array(size * size);
      h[c * size + c] = 1 << 15;
      touched[c * size + c] = 1;
      // Toppling order doesn't affect the final state (that's the "abelian"
      // part), so sweep the active square in place and let each cell shed
      // all its multiples of four at once, widening the square as the pile
      // spreads.
      let r = 1;
      let unstable = true;
      while (unstable) {
        unstable = false;
        for (let y = c - r; y <= c + r; y++) {
          for (let x = c - r; x <= c + r; x++) {
            const i = y * size + x;
            const q = h[i] >> 2;
            if (!q) continue;
            unstable = true;
            h[i] &= 3;
            h[i - 1] += q;
            h[i + 1] += q;
            h[i - size] += q;
            h[i + size] += q;
            touched[i - 1] = touched[i + 1] = touched[i - size] = touched[i + size] = 1;
            if (Math.abs(x - c) === r || Math.abs(y - c) === r) r = Math.min(r + 1, c - 1);
          }
        }
      }
      const cells = new Uint8Array(size * size);
      for (let i = 0; i < cells.length; i++) if (touched[i]) cells[i] = h[i] + 1;
      return { width: size, height: size, cells };
    },
  },
];
