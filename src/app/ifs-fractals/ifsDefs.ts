export type Segment = [number, number, number, number];
export type IfsFamily = "curve" | "branch";

interface GeneratedIfsDef {
  kind: "generated";
  id: string;
  name: string;
  family: IfsFamily;
  description: string;
  spec: string;
  params: string;
  color: string;
  glow?: boolean;
  compute: () => Segment[];
}

interface LinkedIfsDef {
  kind: "linked";
  id: string;
  name: string;
  family: IfsFamily;
  description: string;
  thumbSrc: string;
  href: string;
}

export type IfsDef = GeneratedIfsDef | LinkedIfsDef;

function expandLSystem(axiom: string, rules: Record<string, string>, iterations: number): string {
  let s = axiom;
  for (let i = 0; i < iterations; i++) {
    let next = "";
    for (const ch of s) next += rules[ch] ?? ch;
    s = next;
  }
  return s;
}

// Interprets an L-system string as turtle-graphics moves: F/G draw forward
// one unit, +/- turn by the given angle, [/] push/pop position+heading for
// branching systems. Every fractal below reduces to this one primitive.
function turtleSegments(instructions: string, angleDeg: number, startAngleDeg = 0): Segment[] {
  const angle = (angleDeg * Math.PI) / 180;
  let x = 0, y = 0, dir = (startAngleDeg * Math.PI) / 180;
  const stack: Array<[number, number, number]> = [];
  const segments: Segment[] = [];
  for (const ch of instructions) {
    if (ch === "F" || ch === "G") {
      const nx = x + Math.cos(dir);
      const ny = y + Math.sin(dir);
      segments.push([x, y, nx, ny]);
      x = nx;
      y = ny;
    } else if (ch === "+") {
      dir += angle;
    } else if (ch === "-") {
      dir -= angle;
    } else if (ch === "[") {
      stack.push([x, y, dir]);
    } else if (ch === "]") {
      const top = stack.pop();
      if (top) [x, y, dir] = top;
    }
  }
  return segments;
}

export const IFS_FRACTALS: IfsDef[] = [
  {
    kind: "generated",
    id: "koch",
    name: "Koch snowflake",
    family: "curve",
    description:
      "Each segment splits into four, with the middle third replaced by two sides of an equilateral triangle poking outward — an infinite perimeter enclosing a finite area.",
    spec: "axiom: F++F++F\nF → F-F++F-F",
    params: "angle=60°  iterations=4",
    color: "hsl(160 70% 55%)",
    compute: () => {
      const s = expandLSystem("F++F++F", { F: "F-F++F-F" }, 4);
      return turtleSegments(s, 60);
    },
  },
  {
    kind: "generated",
    id: "dragon",
    name: "Heighway dragon curve",
    family: "curve",
    description:
      "Fold a strip of paper in half repeatedly, always the same way, then unfold every crease to a right angle — this is the curve that traces out.",
    spec: "axiom: FX\nX → X+YF+\nY → −FX−Y",
    params: "angle=90°  iterations=13",
    color: "hsl(300 70% 65%)",
    compute: () => {
      const s = expandLSystem("FX", { X: "X+YF+", Y: "-FX-Y" }, 13);
      return turtleSegments(s, 90);
    },
  },
  {
    kind: "generated",
    id: "levy",
    name: "Lévy C curve",
    family: "curve",
    description:
      "The same fold-and-turn idea as the dragon curve at a gentler 45° — produces a dense, self-crossing C instead of a right-angled spiral.",
    spec: "axiom: F\nF → +F--F+",
    params: "angle=45°  iterations=14",
    color: "hsl(210 80% 65%)",
    compute: () => {
      const s = expandLSystem("F", { F: "+F--F+" }, 14);
      return turtleSegments(s, 45);
    },
  },
  {
    kind: "generated",
    id: "cesaro",
    name: "Cesàro curve",
    family: "curve",
    description:
      "The Koch curve's replacement rule run at 85° instead of 60° — one member of the de Rham family of curves built by splitting a segment at a fixed angle.",
    spec: "axiom: F\nF → F+F--F+F",
    params: "angle=85°  iterations=6",
    color: "hsl(45 85% 60%)",
    compute: () => {
      const s = expandLSystem("F", { F: "F+F--F+F" }, 6);
      return turtleSegments(s, 85);
    },
  },
  {
    kind: "generated",
    id: "htree",
    name: "H-tree",
    family: "branch",
    description:
      "An H sprouts a smaller H from each of its four tips, scaled down by √2 each time — used as a literal circuit layout for reaching every leaf with equal wire length.",
    spec: "recurse(size):\n  draw H at size\n  4× recurse(size / √2)",
    params: "depth=3",
    color: "hsl(20 75% 60%)",
    glow: false,
    compute: () => {
      const segments: Segment[] = [];
      const depth = 3;
      function recurse(cx: number, cy: number, size: number, level: number) {
        if (level > depth) return;
        const half = size / 2;
        const x1 = cx - half;
        const x2 = cx + half;
        segments.push([x1, cy, x2, cy]);
        segments.push([x1, cy - half, x1, cy + half]);
        segments.push([x2, cy - half, x2, cy + half]);
        const next = size / Math.SQRT2;
        recurse(x1, cy - half, next, level + 1);
        recurse(x1, cy + half, next, level + 1);
        recurse(x2, cy - half, next, level + 1);
        recurse(x2, cy + half, next, level + 1);
      }
      recurse(0, 0, 1, 0);
      return segments;
    },
  },
  {
    kind: "linked",
    id: "pythagoras-tree",
    name: "Pythagoras tree",
    family: "branch",
    description:
      "A square sprouts two smaller squares from a right triangle on its top edge, recursively. Full interactive 2D and 3D version on its own page.",
    thumbSrc: "/pythagoras-tree-thumb.svg",
    href: "/pythagoras-tree",
  },
  {
    kind: "linked",
    id: "apex-fractal",
    name: "Apex Fractal",
    family: "branch",
    description:
      "An interactive recursive generator mapped to the complex plane and iterated in 3D. Full interactive version, with 3D/4D and complex-plane modes, on its own page.",
    thumbSrc: "/apex-fractal-thumb.svg",
    href: "/apex-fractal",
  },
];
