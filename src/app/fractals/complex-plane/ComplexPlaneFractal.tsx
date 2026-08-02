"use client";

import { useEffect, useRef } from "react";
import styles from "./complex-plane.module.css";

type Complex = [number, number];

interface Segment {
  a: Complex;
  b: Complex;
  depth: number;
}

function apexFractalComplex(
  a: Complex,
  b: Complex,
  depth: number,
  c: Complex,
): Segment[] {
  const segs: Segment[] = [];
  const add = (z1: Complex, z2: Complex): Complex => [z1[0] + z2[0], z1[1] + z2[1]];
  const sub = (z1: Complex, z2: Complex): Complex => [z1[0] - z2[0], z1[1] - z2[1]];
  const mid = (z1: Complex, z2: Complex): Complex => [
    (z1[0] + z2[0]) / 2,
    (z1[1] + z2[1]) / 2,
  ];
  const mul = (z1: Complex, z2: Complex): Complex => [
    z1[0] * z2[0] - z1[1] * z2[1],
    z1[0] * z2[1] + z1[1] * z2[0],
  ];
  const conj = (z: Complex): Complex => [z[0], -z[1]];
  const iC: Complex = [0, 1];
  const muL = mul(iC, c);
  const muR = mul(iC, conj(c));

  function gen(a: Complex, b: Complex, depth: number) {
    segs.push({ a, b, depth });
    if (depth <= 0) return;
    const m = mid(a, b);
    const v = sub(b, a);
    gen(m, add(m, mul(muL, v)), depth - 1);
    gen(m, add(m, mul(muR, v)), depth - 1);
  }
  gen(a, b, depth);
  return segs;
}

export default function ComplexPlaneFractal() {
  const svgRef = useRef<SVGSVGElement>(null);
  const ptRef = useRef<SVGCircleElement>(null);
  const vecRef = useRef<SVGLineElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cOutRef = useRef<HTMLSpanElement>(null);
  const scaleOutRef = useRef<HTMLSpanElement>(null);
  const thetaOutRef = useRef<HTMLSpanElement>(null);
  const dimOutRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const svgEl = svgRef.current;
    const ptEl = ptRef.current;
    const vecEl = vecRef.current;
    const canvasEl = canvasRef.current;
    if (!svgEl || !ptEl || !vecEl || !canvasEl) return;
    const ctxEl = canvasEl.getContext("2d");
    if (!ctxEl) return;

    // Re-bind with explicit non-null types: TS's closure analysis doesn't
    // retain the narrowing above inside nested function declarations below.
    const svg: SVGSVGElement = svgEl;
    const pt: SVGCircleElement = ptEl;
    const vec: SVGLineElement = vecEl;
    const canvas: HTMLCanvasElement = canvasEl;
    const ctx: CanvasRenderingContext2D = ctxEl;

    const R = 90;
    const CX = 110;
    const CY = 110;
    let cRe = 0.44;
    let cIm = 0.44;
    let dragging = false;

    const planeToScreen = (re: number, im: number): Complex => [CX + re * R, CY - im * R];
    const screenToPlane = (x: number, y: number): Complex => [(x - CX) / R, (CY - y) / R];

    function updateAll() {
      const scale = Math.hypot(cRe, cIm);
      const theta = (Math.atan2(cIm, cRe) * 180) / Math.PI;
      const dim = Math.log(2) / Math.log(1 / Math.min(scale, 0.999));

      if (cOutRef.current) {
        cOutRef.current.textContent =
          cRe.toFixed(2) + (cIm >= 0 ? " + " : " - ") + Math.abs(cIm).toFixed(2) + "i";
      }
      if (scaleOutRef.current) scaleOutRef.current.textContent = scale.toFixed(2);
      if (thetaOutRef.current) thetaOutRef.current.textContent = theta.toFixed(0) + "°";
      if (dimOutRef.current) {
        dimOutRef.current.textContent = isFinite(dim) ? dim.toFixed(2) : "—";
      }

      const depth = scale < 0.5 ? 12 : scale < 0.7 ? 10 : 8;
      const segs = apexFractalComplex([-1, 0], [1, 0], depth, [cRe, cIm]);

      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;
      segs.forEach((s) => {
        [s.a, s.b].forEach((p) => {
          minX = Math.min(minX, p[0]);
          maxX = Math.max(maxX, p[0]);
          minY = Math.min(minY, p[1]);
          maxY = Math.max(maxY, p[1]);
        });
      });

      const w = canvas.width;
      const h = canvas.height;
      const pad = 30;
      const sx = (w - 2 * pad) / Math.max(maxX - minX, 0.001);
      const sy = (h - 2 * pad) / Math.max(maxY - minY, 0.001);
      const s = Math.min(sx, sy);
      const ox = w / 2 - ((minX + maxX) / 2) * s;
      const oy = h / 2 + ((minY + maxY) / 2) * s;

      ctx.clearRect(0, 0, w, h);
      segs.forEach((seg) => {
        const gen = depth - seg.depth;
        const t = depth > 0 ? gen / depth : 0;
        ctx.strokeStyle =
          "rgb(" +
          Math.round(60 + 150 * t) +
          "," +
          Math.round(150 + 70 * (1 - t)) +
          "," +
          Math.round(230 - 80 * t) +
          ")";
        ctx.lineWidth = Math.max(0.6, 2.4 * (1 - t));
        ctx.globalAlpha = 0.4 + 0.6 * (1 - t);
        ctx.beginPath();
        ctx.moveTo(ox + seg.a[0] * s, oy - seg.a[1] * s);
        ctx.lineTo(ox + seg.b[0] * s, oy - seg.b[1] * s);
        ctx.stroke();
      });
      ctx.globalAlpha = 1;
    }

    function setC(re: number, im: number) {
      const mag = Math.hypot(re, im);
      if (mag > 0.98) {
        re = (re / mag) * 0.98;
        im = (im / mag) * 0.98;
      }
      if (mag < 0.05) {
        re = (re / (mag || 1)) * 0.05;
        im = (im / (mag || 1)) * 0.05;
      }
      cRe = re;
      cIm = im;
      const [sx, sy] = planeToScreen(re, im);
      pt.setAttribute("cx", String(sx));
      pt.setAttribute("cy", String(sy));
      vec.setAttribute("x2", String(sx));
      vec.setAttribute("y2", String(sy));
      updateAll();
    }

    function pointerPos(e: PointerEvent): Complex {
      const rect = svg.getBoundingClientRect();
      const x = (e.clientX - rect.left) * (220 / rect.width);
      const y = (e.clientY - rect.top) * (220 / rect.height);
      return screenToPlane(x, y);
    }

    const onPtDown = () => {
      dragging = true;
      pt.style.cursor = "grabbing";
    };
    const onSvgDown = (e: PointerEvent) => {
      if (e.target === pt) return;
      dragging = true;
      const [re, im] = pointerPos(e);
      setC(re, im);
    };
    const onWindowUp = () => {
      dragging = false;
      pt.style.cursor = "grab";
    };
    const onWindowMove = (e: PointerEvent) => {
      if (!dragging) return;
      const [re, im] = pointerPos(e);
      setC(re, im);
    };

    pt.addEventListener("pointerdown", onPtDown);
    svg.addEventListener("pointerdown", onSvgDown);
    window.addEventListener("pointerup", onWindowUp);
    window.addEventListener("pointermove", onWindowMove);

    setC(0.44, 0.44);

    return () => {
      pt.removeEventListener("pointerdown", onPtDown);
      svg.removeEventListener("pointerdown", onSvgDown);
      window.removeEventListener("pointerup", onWindowUp);
      window.removeEventListener("pointermove", onWindowMove);
    };
  }, []);

  return (
    <div className={styles.container}>
      <h1 className={styles.heading}>
        Apex fractal — drag the point to change the generator
      </h1>
      <div className={styles.row}>
        <div className={styles.panel}>
          <svg
            ref={svgRef}
            className={styles.plane}
            width={220}
            height={220}
            viewBox="0 0 220 220"
          >
            <line x1={10} y1={110} x2={210} y2={110} stroke="#5f5e5a" strokeWidth={1} />
            <line x1={110} y1={10} x2={110} y2={210} stroke="#5f5e5a" strokeWidth={1} />
            <circle
              cx={110}
              cy={110}
              r={90}
              fill="none"
              stroke="#3a3833"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
            <line ref={vecRef} x1={110} y1={110} x2={149} y2={71} stroke="#378add" strokeWidth={1.5} />
            <circle ref={ptRef} cx={149} cy={71} r={7} fill="#378add" style={{ cursor: "grab" }} />
            <text className={styles.axisLabel} x={196} y={122} fill="#888780">
              Re
            </text>
            <text className={styles.axisLabel} x={116} y={20} fill="#888780">
              Im
            </text>
          </svg>
          <div className={styles.readout}>
            <div>
              c = <span ref={cOutRef}>0.44 + 0.44i</span>
            </div>
            <div>
              scale |c| = <span ref={scaleOutRef}>0.62</span>
            </div>
            <div>
              angle θ = <span ref={thetaOutRef}>45°</span>
            </div>
            <div>
              dimension D = <span ref={dimOutRef}>1.45</span>
            </div>
          </div>
        </div>
        <canvas ref={canvasRef} className={styles.fractal} width={420} height={420} />
      </div>
      <p className={styles.hint}>
        Drag the dot on the complex plane. Distance from center = scale, angle from the real
        axis = splay.
      </p>
    </div>
  );
}
