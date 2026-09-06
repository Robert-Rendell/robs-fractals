export type Vec2 = [number, number];
export type AttractorFamily = "flow" | "map";

export interface AttractorDef {
  id: string;
  name: string;
  family: AttractorFamily;
  description: string;
  equations: string;
  params: string;
  color: string;
  alpha: number;
  pointSize: number;
  compute: () => Vec2[];
}

function rk4Step(f: (s: number[]) => number[], state: number[], dt: number): number[] {
  const k1 = f(state);
  const s2 = state.map((v, i) => v + (k1[i] * dt) / 2);
  const k2 = f(s2);
  const s3 = state.map((v, i) => v + (k2[i] * dt) / 2);
  const k3 = f(s3);
  const s4 = state.map((v, i) => v + k3[i] * dt);
  const k4 = f(s4);
  return state.map((v, i) => v + (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
}

// Every flow below is advanced with this fixed-step RK4 integrator and its
// first `burn` steps are dropped so the initial transient (before the
// trajectory settles onto the attractor) never gets plotted.
function integrate(
  f: (s: number[]) => number[],
  state0: number[],
  dt: number,
  steps: number,
  project: (s: number[]) => Vec2,
  burn = 200,
): Vec2[] {
  let state = state0.slice();
  const pts: Vec2[] = [];
  for (let i = 0; i < steps; i++) {
    state = rk4Step(f, state, dt);
    if (i > burn) pts.push(project(state));
  }
  return pts;
}

function iterateMap(f: (s: Vec2) => Vec2, state0: Vec2, steps: number, warmup = 50): Vec2[] {
  let state: Vec2 = [state0[0], state0[1]];
  const pts: Vec2[] = [];
  for (let i = 0; i < steps; i++) {
    state = f(state);
    if (i > warmup) pts.push(state);
  }
  return pts;
}

export const ATTRACTORS: AttractorDef[] = [
  {
    id: "lorenz",
    name: "Lorenz attractor",
    family: "flow",
    description:
      "The original strange attractor — a simplified model of convective rolls in the atmosphere that never settles and never repeats.",
    equations: "dx/dt = σ(y − x)\ndy/dt = x(ρ − z) − y\ndz/dt = xy − βz",
    params: "σ=10  ρ=28  β=8/3  dt=0.006",
    color: "hsl(200 90% 68%)",
    alpha: 0.1,
    pointSize: 1,
    compute: () => {
      const sigma = 10, rho = 28, beta = 8 / 3;
      const f = ([x, y, z]: number[]) => [sigma * (y - x), x * (rho - z) - y, x * y - beta * z];
      return integrate(f, [0.1, 0, 0], 0.006, 30000, (s) => [s[0], s[2]]);
    },
  },
  {
    id: "rossler",
    name: "Rössler attractor",
    family: "flow",
    description:
      "A deliberately minimal chaotic flow, built to be the simplest possible system with a single stretch-and-fold band.",
    equations: "dx/dt = −y − z\ndy/dt = x + ay\ndz/dt = b + z(x − c)",
    params: "a=0.2  b=0.2  c=5.7  dt=0.02",
    color: "hsl(20 95% 64%)",
    alpha: 0.12,
    pointSize: 1,
    compute: () => {
      const a = 0.2, b = 0.2, c = 5.7;
      const f = ([x, y, z]: number[]) => [-y - z, x + a * y, b + z * (x - c)];
      return integrate(f, [1, 1, 1], 0.02, 40000, (s) => [s[0], s[1]]);
    },
  },
  {
    id: "chua",
    name: "Chua's circuit attractor",
    family: "flow",
    description:
      "Chaos from an actual buildable electronic circuit — a piecewise-linear resistor is the only nonlinearity in the whole system.",
    equations: "dx/dt = α(y − x − h(x))\ndy/dt = x − y + z\ndz/dt = −βy",
    params: "α=15.6  β=28  dt=0.02",
    color: "hsl(268 85% 72%)",
    alpha: 0.12,
    pointSize: 1,
    compute: () => {
      const alpha = 15.6, beta = 28, m0 = -1.143, m1 = -0.714;
      const h = (x: number) => m1 * x + 0.5 * (m0 - m1) * (Math.abs(x + 1) - Math.abs(x - 1));
      const f = ([x, y, z]: number[]) => [alpha * (y - x - h(x)), x - y + z, -beta * y];
      return integrate(f, [0.7, 0, 0], 0.02, 40000, (s) => [s[0], s[1]]);
    },
  },
  {
    id: "thomas",
    name: "Thomas' attractor",
    family: "flow",
    description:
      "Symmetric under swapping x, y and z in turn — the same sine-driven damping loops back on all three axes equally.",
    equations: "dx/dt = sin(y) − bx\ndy/dt = sin(z) − by\ndz/dt = sin(x) − bz",
    params: "b=0.208186  dt=0.05",
    color: "hsl(152 80% 68%)",
    alpha: 0.05,
    pointSize: 1,
    compute: () => {
      const b = 0.208186;
      const f = ([x, y, z]: number[]) => [Math.sin(y) - b * x, Math.sin(z) - b * y, Math.sin(x) - b * z];
      return integrate(f, [0.1, 0, 0], 0.05, 150000, (s) => [s[0], s[1]]);
    },
  },
  {
    id: "aizawa",
    name: "Aizawa attractor",
    family: "flow",
    description:
      "A cubic twist on the Lorenz-style rotor — the extra z³ term folds the flow into a layered, spinning-top shape.",
    equations: "dx/dt = (z−b)x − dy\ndy/dt = dx + (z−b)y\ndz/dt = c+az−z³/3−(x²+y²)(1+ez)+fzx³",
    params: "a=.95 b=.7 c=.6 d=3.5 e=.25 f=.1",
    color: "hsl(48 95% 66%)",
    alpha: 0.1,
    pointSize: 1,
    compute: () => {
      const a = 0.95, b = 0.7, c = 0.6, d = 3.5, e = 0.25, ff = 0.1;
      const f = ([x, y, z]: number[]) => [
        (z - b) * x - d * y,
        d * x + (z - b) * y,
        c + a * z - (z * z * z) / 3 - (x * x + y * y) * (1 + e * z) + ff * z * x * x * x,
      ];
      return integrate(f, [0.1, 0, 0.1], 0.01, 40000, (s) => [s[0], s[2]]);
    },
  },
  {
    id: "henon",
    name: "Hénon map",
    family: "map",
    description:
      "One of the first maps proven to have a strange attractor — a quadratic fold-and-squash repeated on a single point.",
    equations: "xₙ₊₁ = 1 − axₙ² + yₙ\nyₙ₊₁ = bxₙ",
    params: "a=1.4  b=0.3",
    color: "hsl(112 85% 68%)",
    alpha: 0.06,
    pointSize: 0.7,
    compute: () => {
      const a = 1.4, b = 0.3;
      const f = ([x, y]: Vec2): Vec2 => [1 - a * x * x + y, b * x];
      return iterateMap(f, [0, 0], 400000, 50);
    },
  },
  {
    id: "ikeda",
    name: "Ikeda map",
    family: "map",
    description:
      "Models light circulating in a nonlinear optical cavity — the rotation angle itself depends on distance from the center.",
    equations: "tₙ = 0.4 − 6/(1+xₙ²+yₙ²)\nxₙ₊₁ = 1+u(xₙcos tₙ−yₙsin tₙ)\nyₙ₊₁ = u(xₙsin tₙ+yₙcos tₙ)",
    params: "u=0.9",
    color: "hsl(228 90% 72%)",
    alpha: 0.15,
    pointSize: 1,
    compute: () => {
      const u = 0.9;
      const f = ([x, y]: Vec2): Vec2 => {
        const t = 0.4 - 6 / (1 + x * x + y * y);
        const ct = Math.cos(t), st = Math.sin(t);
        return [1 + u * (x * ct - y * st), u * (x * st + y * ct)];
      };
      return iterateMap(f, [0.1, 0.1], 100000, 5000);
    },
  },
  {
    id: "clifford",
    name: "Clifford attractor",
    family: "map",
    description:
      "A trigonometric map with no physical origin story — invented purely to explore what four sine-and-cosine terms can draw.",
    equations: "xₙ₊₁ = sin(ayₙ) + c·cos(axₙ)\nyₙ₊₁ = sin(bxₙ) + d·cos(byₙ)",
    params: "a=−1.4  b=1.6  c=1.0  d=0.7",
    color: "hsl(330 90% 70%)",
    alpha: 0.08,
    pointSize: 1,
    compute: () => {
      const a = -1.4, b = 1.6, c = 1.0, d = 0.7;
      const f = ([x, y]: Vec2): Vec2 => [Math.sin(a * y) + c * Math.cos(a * x), Math.sin(b * x) + d * Math.cos(b * y)];
      return iterateMap(f, [0.1, 0.1], 150000, 50);
    },
  },
  {
    id: "dejong",
    name: "De Jong attractor",
    family: "map",
    description:
      "Clifford's sibling map — same four-parameter trig form, rearranged, producing a completely different ribboned lattice.",
    equations: "xₙ₊₁ = sin(ayₙ) − cos(bxₙ)\nyₙ₊₁ = sin(cxₙ) − cos(dyₙ)",
    params: "a=1.4  b=−2.3  c=2.4  d=−2.1",
    color: "hsl(172 85% 65%)",
    alpha: 0.08,
    pointSize: 1,
    compute: () => {
      const a = 1.4, b = -2.3, c = 2.4, d = -2.1;
      const f = ([x, y]: Vec2): Vec2 => [Math.sin(a * y) - Math.cos(b * x), Math.sin(c * x) - Math.cos(d * y)];
      return iterateMap(f, [0.1, 0.1], 150000, 50);
    },
  },
  {
    id: "tinkerbell",
    name: "Tinkerbell map",
    family: "map",
    description:
      "A quadratic map named for the winged shape its attractor traces once the transient spiral settles down.",
    equations: "xₙ₊₁ = xₙ²−yₙ² + axₙ + byₙ\nyₙ₊₁ = 2xₙyₙ + cxₙ + dyₙ",
    params: "a=0.9  b=−0.6013  c=2.0  d=0.5",
    color: "hsl(38 95% 66%)",
    alpha: 0.3,
    pointSize: 1.1,
    compute: () => {
      const a = 0.9, b = -0.6013, c = 2.0, d = 0.5;
      const f = ([x, y]: Vec2): Vec2 => [x * x - y * y + a * x + b * y, 2 * x * y + c * x + d * y];
      return iterateMap(f, [0.1, 0.1], 60000, 50);
    },
  },
  {
    id: "gm",
    name: "Gumowski–Mira map",
    family: "map",
    description:
      "Developed at CERN to study particle-beam stability — small tweaks to a and b swing it between rings, spirals, and this lattice.",
    equations: "G(x) = ax + 2(1−a)x²/(1+x²)\nxₙ₊₁ = yₙ + byₙ(1−0.7yₙ²) + G(xₙ)\nyₙ₊₁ = −xₙ + G(xₙ₊₁)",
    params: "a=0.008  b=0.05",
    color: "hsl(280 80% 74%)",
    alpha: 0.1,
    pointSize: 1,
    compute: () => {
      const a = 0.008, b = 0.05;
      const G = (x: number) => a * x + (2 * (1 - a) * x * x) / (1 + x * x);
      const f = ([x, y]: Vec2): Vec2 => {
        const xn = y + b * y * (1 - 0.7 * y * y) + G(x);
        const yn = -x + G(xn);
        return [xn, yn];
      };
      return iterateMap(f, [0.1, 0.1], 150000, 50);
    },
  },
];
