import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pythagoras Tree: Original | Rob's Fractals",
};

// A single square (side s) with a right triangle erected on its top edge.
// The triangle's right angle sits at the point that splits the top edge
// into legs of length s·cos(θ) and s·sin(θ) — by Pythagoras, the two
// squares built on those legs have combined area exactly s². Recursing
// this rule on both legs is the whole fractal; this page shows just the
// one generator step it's built from.
const S = 160;
const THETA = (45 * Math.PI) / 180;
const ORIGIN_X = 130;
const BASE_Y = 260;

export default function PythagorasOriginalPage() {
  const p0: [number, number] = [ORIGIN_X, BASE_Y];
  const p1: [number, number] = [ORIGIN_X + S, BASE_Y];
  const p2: [number, number] = [ORIGIN_X + S, BASE_Y - S];
  const p3: [number, number] = [ORIGIN_X, BASE_Y - S];

  const cosT = Math.cos(THETA);
  const sinT = Math.sin(THETA);
  const legScale = S * cosT;
  const apex: [number, number] = [p3[0] + legScale * cosT, p3[1] - legScale * sinT];

  const square = `${p0[0]},${p0[1]} ${p1[0]},${p1[1]} ${p2[0]},${p2[1]} ${p3[0]},${p3[1]}`;
  const triangle = `${p3[0]},${p3[1]} ${p2[0]},${p2[1]} ${apex[0]},${apex[1]}`;

  return (
    <div>
      <h1>Pythagoras Tree: Original</h1>
      <p style={{ color: "var(--muted)", marginTop: "0.5rem" }}>
        The generator everything below is built from: a square, and a right triangle erected on
        its top edge.
      </p>
      <div
        style={{
          marginTop: "1.5rem",
          background: "#16140f",
          borderRadius: "12px",
          padding: "1.5rem",
          maxWidth: "420px",
        }}
      >
        <svg viewBox="0 0 420 300" width="100%" height="auto">
          <polygon points={square} fill="#378add" fillOpacity={0.85} />
          <polygon points={triangle} fill="none" stroke="#e8e6dd" strokeWidth={1.5} />
          <circle cx={apex[0]} cy={apex[1]} r={3} fill="#e8e6dd" />
          <text x={apex[0] + 8} y={apex[1] - 6} fill="#e8e6dd" fontSize={12}>
            right angle
          </text>
          <text
            x={(p3[0] + apex[0]) / 2 - 26}
            y={(p3[1] + apex[1]) / 2}
            fill="#888780"
            fontSize={12}
          >
            θ
          </text>
        </svg>
      </div>
      <p style={{ color: "var(--muted)", marginTop: "1rem", maxWidth: "560px" }}>
        The triangle&apos;s apex splits the top edge into two legs, length s·cos(θ) and s·sin(θ).
        Because the angle at the apex is exactly 90°, squares built on those two legs have
        combined area equal to the original square&apos;s (a² + b² = s²) — the same identity as
        the Pythagorean theorem, which gives the fractal its name. Recursing this rule onto each
        new leg, generation after generation, produces the tree in the next two pages.
      </p>
    </div>
  );
}
