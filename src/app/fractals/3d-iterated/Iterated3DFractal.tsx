"use client";

import { useEffect, useRef } from "react";
import type * as ThreeTypes from "three";
import styles from "./iterated-3d.module.css";

type Point2 = [number, number];
type Point3 = [number, number, number];

interface Segment3D {
  A: Point3;
  B: Point3;
  depth: number;
}

function apexFractal3D(
  A: Point3,
  B: Point3,
  depth: number,
  angle: number,
  scale: number,
  twistStep: number,
): Segment3D[] {
  const segs: Segment3D[] = [];
  const sub = (a: Point3, b: Point3): Point3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const add = (a: Point3, b: Point3): Point3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const mul = (a: Point3, s: number): Point3 => [a[0] * s, a[1] * s, a[2] * s];
  const mid = (a: Point3, b: Point3): Point3 => [
    (a[0] + b[0]) / 2,
    (a[1] + b[1]) / 2,
    (a[2] + b[2]) / 2,
  ];
  const cross = (a: Point3, b: Point3): Point3 => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
  const norm = (v: Point3): Point3 => {
    const l = Math.hypot(v[0], v[1], v[2]) || 1;
    return [v[0] / l, v[1] / l, v[2] / l];
  };

  function gen(A: Point3, B: Point3, depth: number, twist: number) {
    segs.push({ A, B, depth });
    if (depth <= 0) return;
    const M = mid(A, B);
    const d = norm(sub(B, A));
    const parentLen = Math.hypot(...sub(B, A));
    const legLen = parentLen * scale;
    const ref: Point3 = Math.abs(d[1]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
    const right = norm(cross(d, ref));
    const up = cross(right, d);
    const rad = (angle * Math.PI) / 180;
    const tw = (twist * Math.PI) / 180;
    const axis = norm(add(mul(right, Math.cos(tw)), mul(up, Math.sin(tw))));
    for (let i = 0; i < 2; i++) {
      const sign = i === 0 ? -1 : 1;
      const childDir = norm(add(mul(axis, Math.cos(rad)), mul(d, sign * Math.sin(rad))));
      const childEnd = add(M, mul(childDir, legLen));
      gen(M, childEnd, depth - 1, twist + twistStep);
    }
  }
  gen(A, B, depth, 0);
  return segs;
}

export default function Iterated3DFractal() {
  const svgRef = useRef<SVGSVGElement>(null);
  const ptRef = useRef<SVGCircleElement>(null);
  const vecRef = useRef<SVGLineElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const cOutRef = useRef<HTMLSpanElement>(null);
  const scaleOutRef = useRef<HTMLSpanElement>(null);
  const thetaOutRef = useRef<HTMLSpanElement>(null);
  const twistRef = useRef<HTMLInputElement>(null);
  const twistOutRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const svgEl = svgRef.current;
    const ptEl = ptRef.current;
    const vecEl = vecRef.current;
    const viewportEl = viewportRef.current;
    const twistInputEl = twistRef.current;
    if (!svgEl || !ptEl || !vecEl || !viewportEl || !twistInputEl) return;

    // Re-bind with explicit non-null types: TS's closure analysis doesn't
    // retain the narrowing above inside nested function declarations below.
    const svg: SVGSVGElement = svgEl;
    const pt: SVGCircleElement = ptEl;
    const vec: SVGLineElement = vecEl;
    const viewport: HTMLDivElement = viewportEl;
    const twistInput: HTMLInputElement = twistInputEl;

    let disposed = false;
    const cleanupFns: Array<() => void> = [];

    (async () => {
      const THREE = await import("three");
      if (disposed) return;

      const R = 74;
      const CX = 90;
      const CY = 90;
      let cRe = 0.44;
      let cIm = 0.44;
      let twistStep = 60;
      let dragC = false;
      let dragV = false;
      let lastX = 0;
      let lastY = 0;
      let rotX = 0.25;
      let rotY = 0.5;
      let camDist = 260;
      let line: ThreeTypes.LineSegments | null = null;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(50, viewport.clientWidth / 400, 0.1, 5000);
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setSize(viewport.clientWidth, 400);
      renderer.setPixelRatio(window.devicePixelRatio || 1);
      viewport.appendChild(renderer.domElement);

      const grid = new THREE.GridHelper(300, 10, 0x555550, 0x333330);
      (grid.material as ThreeTypes.Material).transparent = true;
      (grid.material as ThreeTypes.Material).opacity = 0.12;
      scene.add(grid);

      const group = new THREE.Group();
      scene.add(group);

      function buildLine() {
        if (line) {
          group.remove(line);
          line.geometry.dispose();
          (line.material as ThreeTypes.Material).dispose();
        }
        const scale = Math.hypot(cRe, cIm);
        const theta = (Math.atan2(cIm, cRe) * 180) / Math.PI;
        const depth = scale < 0.5 ? 11 : scale < 0.7 ? 9 : 7;
        const segs = apexFractal3D([-110, 0, 0], [110, 0, 0], depth, theta, scale, twistStep);
        const positions: number[] = [];
        const colors: number[] = [];
        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;
        let minZ = Infinity;
        let maxZ = -Infinity;
        segs.forEach((s) => {
          const gen = depth - s.depth;
          const t = depth > 0 ? gen / depth : 0;
          const c = new THREE.Color();
          c.setRGB((60 + 150 * t) / 255, (150 + 70 * (1 - t)) / 255, (230 - 80 * t) / 255);
          positions.push(...s.A, ...s.B);
          colors.push(c.r, c.g, c.b, c.r, c.g, c.b);
          [s.A, s.B].forEach((p) => {
            minX = Math.min(minX, p[0]);
            maxX = Math.max(maxX, p[0]);
            minY = Math.min(minY, p[1]);
            maxY = Math.max(maxY, p[1]);
            minZ = Math.min(minZ, p[2]);
            maxZ = Math.max(maxZ, p[2]);
          });
        });
        const geom = new THREE.BufferGeometry();
        geom.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
        geom.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
        const mat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9 });
        line = new THREE.LineSegments(geom, mat);
        const cx = (minX + maxX) / 2;
        const cy = (minY + maxY) / 2;
        const cz = (minZ + maxZ) / 2;
        line.position.set(-cx, -cy, -cz);
        group.add(line);
      }

      const planeToScreen = (re: number, im: number): Point2 => [CX + re * R, CY - im * R];
      const screenToPlane = (x: number, y: number): Point2 => [(x - CX) / R, (CY - y) / R];

      function updateReadout() {
        const scale = Math.hypot(cRe, cIm);
        const theta = (Math.atan2(cIm, cRe) * 180) / Math.PI;
        if (cOutRef.current) {
          cOutRef.current.textContent =
            cRe.toFixed(2) + (cIm >= 0 ? " + " : " - ") + Math.abs(cIm).toFixed(2) + "i";
        }
        if (scaleOutRef.current) scaleOutRef.current.textContent = scale.toFixed(2);
        if (thetaOutRef.current) thetaOutRef.current.textContent = theta.toFixed(0) + "°";
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
        updateReadout();
        buildLine();
      }

      function pointerPosC(e: PointerEvent): Point2 {
        const rect = svg.getBoundingClientRect();
        const x = (e.clientX - rect.left) * (180 / rect.width);
        const y = (e.clientY - rect.top) * (180 / rect.height);
        return screenToPlane(x, y);
      }

      const onPtDown = () => {
        dragC = true;
      };
      const onSvgDown = (e: PointerEvent) => {
        if (e.target === pt) return;
        dragC = true;
        const [re, im] = pointerPosC(e);
        setC(re, im);
      };
      const onWindowUp = () => {
        dragC = false;
        dragV = false;
        renderer.domElement.style.cursor = "grab";
      };
      const onWindowMove = (e: PointerEvent) => {
        if (dragC) {
          const [re, im] = pointerPosC(e);
          setC(re, im);
        }
      };
      const onViewportDown = (e: PointerEvent) => {
        dragV = true;
        lastX = e.clientX;
        lastY = e.clientY;
        renderer.domElement.style.cursor = "grabbing";
      };
      const onViewportMove = (e: PointerEvent) => {
        if (!dragV) return;
        rotY += (e.clientX - lastX) * 0.008;
        rotX += (e.clientY - lastY) * 0.008;
        rotX = Math.max(-1.55, Math.min(1.55, rotX));
        lastX = e.clientX;
        lastY = e.clientY;
      };
      const onWheel = (e: WheelEvent) => {
        e.preventDefault();
        camDist *= 1 + e.deltaY * 0.001;
        camDist = Math.max(60, Math.min(900, camDist));
      };
      const onTwistInput = () => {
        twistStep = Number(twistInput.value);
        if (twistOutRef.current) twistOutRef.current.textContent = twistStep + "°";
        buildLine();
      };

      pt.addEventListener("pointerdown", onPtDown);
      svg.addEventListener("pointerdown", onSvgDown);
      window.addEventListener("pointerup", onWindowUp);
      window.addEventListener("pointermove", onWindowMove);
      renderer.domElement.addEventListener("pointerdown", onViewportDown);
      renderer.domElement.addEventListener("pointermove", onViewportMove);
      renderer.domElement.addEventListener("wheel", onWheel, { passive: false });
      twistInput.addEventListener("input", onTwistInput);

      let rafId = 0;
      function animate() {
        rafId = requestAnimationFrame(animate);
        camera.position.set(
          camDist * Math.sin(rotY) * Math.cos(rotX),
          camDist * Math.sin(rotX),
          camDist * Math.cos(rotY) * Math.cos(rotX),
        );
        camera.lookAt(0, 0, 0);
        renderer.render(scene, camera);
      }

      setC(0.44, 0.44);
      animate();

      cleanupFns.push(() => {
        cancelAnimationFrame(rafId);
        pt.removeEventListener("pointerdown", onPtDown);
        svg.removeEventListener("pointerdown", onSvgDown);
        window.removeEventListener("pointerup", onWindowUp);
        window.removeEventListener("pointermove", onWindowMove);
        renderer.domElement.removeEventListener("pointerdown", onViewportDown);
        renderer.domElement.removeEventListener("pointermove", onViewportMove);
        renderer.domElement.removeEventListener("wheel", onWheel);
        twistInput.removeEventListener("input", onTwistInput);
        if (line) {
          line.geometry.dispose();
          (line.material as ThreeTypes.Material).dispose();
        }
        (grid.material as ThreeTypes.Material).dispose();
        grid.geometry.dispose();
        renderer.dispose();
        if (renderer.domElement.parentNode === viewport) {
          viewport.removeChild(renderer.domElement);
        }
      });
    })();

    return () => {
      disposed = true;
      cleanupFns.forEach((fn) => fn());
    };
  }, []);

  return (
    <div className={styles.container}>
      <h1 className={styles.heading}>Apex fractal — iterated in 3D</h1>
      <div className={styles.row}>
        <div className={styles.panel}>
          <svg
            ref={svgRef}
            className={styles.plane}
            width={180}
            height={180}
            viewBox="0 0 180 180"
          >
            <line x1={8} y1={90} x2={172} y2={90} stroke="#5f5e5a" strokeWidth={1} />
            <line x1={90} y1={8} x2={90} y2={172} stroke="#5f5e5a" strokeWidth={1} />
            <circle
              cx={90}
              cy={90}
              r={74}
              fill="none"
              stroke="#3a3833"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
            <line ref={vecRef} x1={90} y1={90} x2={122} y2={58} stroke="#378add" strokeWidth={1.5} />
            <circle ref={ptRef} cx={122} cy={58} r={6} fill="#378add" style={{ cursor: "grab" }} />
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
          </div>
          <label className={styles.twistLabel}>Twist (the extra 3D parameter)</label>
          <div className={styles.twistRow}>
            <input ref={twistRef} type="range" min={0} max={180} step={1} defaultValue={60} />
            <span ref={twistOutRef}>60°</span>
          </div>
        </div>
        <div ref={viewportRef} className={styles.viewport} />
      </div>
      <p className={styles.hint}>
        Twist 0° = flat, matches the 2D shape exactly. Drag the viewport to orbit; drag the dot
        to change scale/angle.
      </p>
    </div>
  );
}
