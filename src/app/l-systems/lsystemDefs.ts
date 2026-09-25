import { expandLSystem, turtleSegments, type Segment } from "../ifs-fractals/ifsDefs";

export type LSystemFamily = "space-filling" | "tiling" | "plant";

export interface LSystemDef {
  id: string;
  name: string;
  family: LSystemFamily;
  description: string;
  axiom: string;
  rules: Record<string, string>;
  angle: number;
  iterations: number;
  // Initial turtle heading in degrees; 90 grows plants upward.
  heading?: number;
  color: string;
  // Hue sweep along the drawing order, for single unbranched paths.
  hues?: [number, number];
  glow?: boolean;
}

export function computeLSystem(def: LSystemDef): Segment[] {
  return turtleSegments(
    expandLSystem(def.axiom, def.rules, def.iterations),
    def.angle,
    def.heading ?? 0,
  );
}

// Rules as printed on the cards: arrows, true minus signs, and rules that
// erase a symbol shown as ε rather than an empty string.
export function formatSpec(def: LSystemDef): string {
  const pretty = (s: string) => s.replace(/-/g, "−") || "ε";
  return [
    `axiom: ${pretty(def.axiom)}`,
    ...Object.entries(def.rules).map(([k, v]) => `${k} → ${pretty(v)}`),
  ].join("\n");
}

export const L_SYSTEMS: LSystemDef[] = [
  {
    id: "hilbert",
    name: "Hilbert curve",
    family: "space-filling",
    description:
      "A single unbroken path that visits every cell of a 2ⁿ × 2ⁿ grid, and keeps points that are close along the curve close in the plane — which is why databases and GPUs use it to lay out 2D data in 1D memory.",
    axiom: "A",
    rules: { A: "+BF-AFA-FB+", B: "-AF+BFB+FA-" },
    angle: 90,
    iterations: 6,
    color: "hsl(190 80% 64%)",
    hues: [190, 320],
  },
  {
    id: "moore",
    name: "Moore curve",
    family: "space-filling",
    description:
      "Four Hilbert curves joined end to end into a closed loop, so the path finishes one step from where it started.",
    axiom: "LFL+F+LFL",
    rules: { L: "-RF+LFL+FR-", R: "+LF-RFR-FL+" },
    angle: 90,
    iterations: 5,
    color: "hsl(40 85% 62%)",
    hues: [40, 170],
  },
  {
    id: "peano",
    name: "Peano curve",
    family: "space-filling",
    description:
      "The first space-filling curve ever published (1890), a year before Hilbert's. It subdivides into a 3 × 3 grid instead of 2 × 2, snaking through each block in an S.",
    axiom: "X",
    rules: { X: "XFYFX+F+YFXFY-F-XFYFX", Y: "YFXFY-F-XFYFX+F+YFXFY" },
    angle: 90,
    iterations: 4,
    color: "hsl(260 75% 70%)",
    hues: [260, 380],
  },
  {
    id: "gosper",
    name: "Gosper curve",
    family: "space-filling",
    description:
      "Also called the flowsnake. It fills a region on the hexagonal lattice, and the region it fills — the Gosper island — tiles the plane with seven copies of itself.",
    axiom: "F",
    rules: { F: "F-G--G+F++FF+G-", G: "+F-GG--G-F++F+G" },
    angle: 60,
    iterations: 4,
    color: "hsl(150 70% 58%)",
    hues: [150, 260],
  },
  {
    id: "arrowhead",
    name: "Sierpiński arrowhead",
    family: "tiling",
    description:
      "Two symbols that swap the direction they turn in each other's rules. The single path zig-zags into a Sierpiński triangle without ever crossing itself or lifting the pen.",
    axiom: "F",
    rules: { F: "G-F-G", G: "F+G+F" },
    angle: 60,
    iterations: 7,
    color: "hsl(20 85% 62%)",
    hues: [20, 60],
  },
  {
    id: "koch-island",
    name: "Quadratic Koch island",
    family: "tiling",
    description:
      "Mandelbrot's right-angled cousin of the Koch snowflake: every edge of a square becomes an eight-segment zig-zag, so the coastline gets longer forever while the area stays fixed.",
    axiom: "F+F+F+F",
    rules: { F: "F+F-F-FF+F+F-F" },
    angle: 90,
    iterations: 3,
    color: "hsl(200 85% 62%)",
    glow: false,
  },
  {
    id: "penrose",
    name: "Penrose tiling",
    family: "tiling",
    description:
      "Four non-drawing symbols stand for the four half-rhombus orientations, and each rewrites into smaller ones. The result is the Penrose P3 tiling of thick and thin rhombs, which covers the plane but never repeats.",
    axiom: "[N]++[N]++[N]++[N]++[N]",
    rules: {
      M: "OF++PF----NF[-OF----MF]++",
      N: "+OF--PF[---MF--NF]+",
      O: "-MF++NF[+++OF++PF]-",
      P: "--OF++++MF[+PF++++NF]--NF",
      F: "",
    },
    angle: 36,
    iterations: 5,
    color: "hsl(45 90% 64%)",
    glow: false,
  },
  {
    id: "weed",
    name: "Weed",
    family: "plant",
    description:
      "The simplest branching grammar: every stem becomes a stem with a leaf on each side. Lindenmayer designed L-systems in 1968 to model exactly this kind of growth in algae and simple plants.",
    axiom: "F",
    rules: { F: "F[+F]F[-F]F" },
    angle: 25.7,
    iterations: 5,
    heading: 90,
    color: "hsl(100 55% 58%)",
  },
  {
    id: "bush",
    name: "Bush",
    family: "plant",
    description:
      "Each stem doubles in length and sprouts two three-segment twigs that curl in opposite directions, giving a dense, windswept shrub.",
    axiom: "F",
    rules: { F: "FF-[-F+F+F]+[+F-F-F]" },
    angle: 22.5,
    iterations: 4,
    heading: 90,
    color: "hsl(140 50% 55%)",
  },
  {
    id: "twig",
    name: "Twig",
    family: "plant",
    description:
      "A bud X becomes a stem with two side buds and a continuing tip, while stems double in length each generation. Older growth ends up longer, as it does in a real plant.",
    axiom: "X",
    rules: { X: "F[+X][-X]FX", F: "FF" },
    angle: 25.7,
    iterations: 7,
    heading: 90,
    color: "hsl(80 60% 58%)",
  },
  {
    id: "fern",
    name: "Fractal plant",
    family: "plant",
    description:
      "The canonical example from The Algorithmic Beauty of Plants. Brackets nested two deep let whole side-branches fork again, which gives the asymmetric, fern-like sweep.",
    axiom: "X",
    rules: { X: "F-[[X]+X]+F[+FX]-X", F: "FF" },
    angle: 22.5,
    iterations: 6,
    heading: 70,
    color: "hsl(120 55% 56%)",
  },
];

export const L_SYSTEM_PARAMS = (def: LSystemDef) =>
  `angle=${def.angle}°  iterations=${def.iterations}`;
