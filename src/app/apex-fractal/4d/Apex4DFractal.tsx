"use client";

import { useEffect, useRef } from "react";
import type * as ThreeTypes from "three";
import styles from "./apex-4d.module.css";

type Point2 = [number, number];
type Point3 = [number, number, number];

interface Segment3D {
  A: Point3;
  B: Point3;
  depth: number;
  // Sequence of branch choices (0 = left, 1 = right) taken from the root to
  // reach this segment. This is this node's address in the binary tree —
  // the "which parallel universe does this lineage belong to" coordinate.
  path: number[];
}

function apexFractal3DFixed(
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
  const dot = (a: Point3, b: Point3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const norm = (v: Point3): Point3 => {
    const l = Math.hypot(v[0], v[1], v[2]) || 1;
    return [v[0] / l, v[1] / l, v[2] / l];
  };

  // Rotation-minimizing frame transport: carries the perpendicular "right"
  // vector from a parent segment's direction (t0) to a child's direction
  // (t1) via the minimal rotation between them, instead of recomputing it
  // from scratch against a fixed world axis. Recomputing from scratch is
  // what the original generator does, and it's discontinuous: whenever a
  // branch direction crosses the reference-vector threshold, that branch's
  // frame flips relative to its siblings, kicking the branch out of the
  // plane even when twist is 0. Transporting the frame keeps twist=0 exactly
  // flat, matching the 2D complex-plane fractal.
  const transportRight = (t0: Point3, t1: Point3, right0: Point3): Point3 => {
    const d = Math.max(-1, Math.min(1, dot(t0, t1)));
    if (d > 0.999999) return right0;
    if (d < -0.999999) {
      const fallbackRef: Point3 = Math.abs(t1[1]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
      return norm(cross(t1, fallbackRef));
    }
    const k = norm(cross(t0, t1));
    const theta = Math.acos(d);
    const kv = dot(k, right0);
    const kCrossV = cross(k, right0);
    return norm(
      add(
        add(mul(right0, Math.cos(theta)), mul(kCrossV, Math.sin(theta))),
        mul(k, kv * (1 - Math.cos(theta))),
      ),
    );
  };

  function gen(
    A: Point3,
    B: Point3,
    depth: number,
    twist: number,
    prevDir: Point3 | null,
    prevRight: Point3 | null,
    path: number[],
  ) {
    segs.push({ A, B, depth, path });
    if (depth <= 0) return;
    const M = mid(A, B);
    const d = norm(sub(B, A));
    const parentLen = Math.hypot(...sub(B, A));
    const legLen = parentLen * scale;

    const right =
      prevDir && prevRight
        ? transportRight(prevDir, d, prevRight)
        : norm(cross(d, Math.abs(d[1]) < 0.9 ? [0, 0, 1] : [1, 0, 0]));
    const up = cross(right, d);

    const rad = (angle * Math.PI) / 180;
    const tw = (twist * Math.PI) / 180;
    const axis = norm(add(mul(right, Math.cos(tw)), mul(up, Math.sin(tw))));
    for (let i = 0; i < 2; i++) {
      const sign = i === 0 ? -1 : 1;
      const childDir = norm(add(mul(axis, Math.cos(rad)), mul(d, sign * Math.sin(rad))));
      const childEnd = add(M, mul(childDir, legLen));
      gen(M, childEnd, depth - 1, twist + twistStep, d, right, [...path, i]);
    }
  }
  gen(A, B, depth, 0, null, null, []);
  return segs;
}

// Interprets a slider value in [0, 1) as a binary expansion and reads off
// its first `length` bits — this picks out one specific root-to-leaf
// lineage (one "universe") out of the 2^length possible ones.
function universeToBits(value: number, length: number): number[] {
  const bits: number[] = [];
  let v = Math.min(Math.max(value, 0), 0.9999999);
  for (let i = 0; i < length; i++) {
    v *= 2;
    const bit = Math.floor(v);
    bits.push(bit);
    v -= bit;
  }
  return bits;
}

// How many leading bits a segment's address shares with the selected
// universe's address. If it shares all of its own bits, the segment lies
// exactly on the lineage leading to that universe. Otherwise, the returned
// index is how deep the two lineages stayed identical before diverging —
// this is the tree's natural ultrametric distance between branches.
function sharedPrefixLength(path: number[], targetBits: number[]): number {
  let i = 0;
  while (i < path.length && path[i] === targetBits[i]) i++;
  return i;
}

export default function Apex4DFractal() {
  const svgRef = useRef<SVGSVGElement>(null);
  const ptRef = useRef<SVGCircleElement>(null);
  const vecRef = useRef<SVGLineElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const cOutRef = useRef<HTMLSpanElement>(null);
  const scaleOutRef = useRef<HTMLSpanElement>(null);
  const thetaOutRef = useRef<HTMLSpanElement>(null);
  const twistRef = useRef<HTMLInputElement>(null);
  const twistOutRef = useRef<HTMLSpanElement>(null);
  const universeRef = useRef<HTMLInputElement>(null);
  const universeOutRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const svgEl = svgRef.current;
    const ptEl = ptRef.current;
    const vecEl = vecRef.current;
    const viewportEl = viewportRef.current;
    const twistInputEl = twistRef.current;
    const universeInputEl = universeRef.current;
    if (!svgEl || !ptEl || !vecEl || !viewportEl || !twistInputEl || !universeInputEl) return;

    // Re-bind with explicit non-null types: TS's closure analysis doesn't
    // retain the narrowing above inside nested function declarations below.
    const svg: SVGSVGElement = svgEl;
    const pt: SVGCircleElement = ptEl;
    const vec: SVGLineElement = vecEl;
    const viewport: HTMLDivElement = viewportEl;
    const twistInput: HTMLInputElement = twistInputEl;
    const universeInput: HTMLInputElement = universeInputEl;

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
      let universeValue = 0.5;
      let dragC = false;
      let dragV = false;
      let lastX = 0;
      let lastY = 0;
      let rotX = 0.25;
      let rotY = 0.5;
      let camDist = 260;
      let line: ThreeTypes.LineSegments | null = null;

      const backgroundColor = new THREE.Color(0x16140f);

      const initialWidth = viewport.clientWidth || 300;
      const initialHeight = viewport.clientHeight || 400;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(50, initialWidth / initialHeight, 0.1, 5000);
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setSize(initialWidth, initialHeight);
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
        const segs = apexFractal3DFixed([-110, 0, 0], [110, 0, 0], depth, theta, scale, twistStep);
        const targetBits = universeToBits(universeValue, depth);
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
          const baseColor = new THREE.Color();
          baseColor.setRGB((60 + 150 * t) / 255, (150 + 70 * (1 - t)) / 255, (230 - 80 * t) / 255);

          const shared = sharedPrefixLength(s.path, targetBits);
          const onSelectedLineage = shared >= s.path.length;
          const brightness = onSelectedLineage ? 1 : Math.max(0.12, shared / depth);
          const c = baseColor.clone().lerp(backgroundColor, 1 - brightness);

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

      const onPtDown = (e: PointerEvent) => {
        dragC = true;
        pt.setPointerCapture(e.pointerId);
        e.preventDefault();
      };
      const onSvgDown = (e: PointerEvent) => {
        if (e.target === pt) return;
        dragC = true;
        const [re, im] = pointerPosC(e);
        setC(re, im);
        e.preventDefault();
      };
      const onWindowUp = (e: PointerEvent) => {
        dragC = false;
        dragV = false;
        renderer.domElement.style.cursor = "grab";
        if (pt.hasPointerCapture(e.pointerId)) {
          pt.releasePointerCapture(e.pointerId);
        }
        if (renderer.domElement.hasPointerCapture(e.pointerId)) {
          renderer.domElement.releasePointerCapture(e.pointerId);
        }
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
        renderer.domElement.setPointerCapture(e.pointerId);
        e.preventDefault();
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
      const onUniverseInput = () => {
        universeValue = Number(universeInput.value);
        if (universeOutRef.current) universeOutRef.current.textContent = universeValue.toFixed(3);
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
      universeInput.addEventListener("input", onUniverseInput);

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

      const resizeObserver = new ResizeObserver(() => {
        const width = viewport.clientWidth;
        const height = viewport.clientHeight;
        if (width === 0 || height === 0) return;
        renderer.setSize(width, height);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      });
      resizeObserver.observe(viewport);

      setC(0.44, 0.44);
      animate();

      cleanupFns.push(() => {
        cancelAnimationFrame(rafId);
        resizeObserver.disconnect();
        pt.removeEventListener("pointerdown", onPtDown);
        svg.removeEventListener("pointerdown", onSvgDown);
        window.removeEventListener("pointerup", onWindowUp);
        window.removeEventListener("pointermove", onWindowMove);
        renderer.domElement.removeEventListener("pointerdown", onViewportDown);
        renderer.domElement.removeEventListener("pointermove", onViewportMove);
        renderer.domElement.removeEventListener("wheel", onWheel);
        twistInput.removeEventListener("input", onTwistInput);
        universeInput.removeEventListener("input", onUniverseInput);
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
      <h1 className={styles.heading}>Apex fractal — 4D (parallel universes)</h1>
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
          <label className={styles.sliderLabel}>Twist (the 3rd axis)</label>
          <div className={styles.sliderRow}>
            <input ref={twistRef} type="range" min={0} max={180} step={1} defaultValue={60} />
            <span ref={twistOutRef}>60°</span>
          </div>
          <label className={styles.sliderLabel}>Universe (the 4th axis)</label>
          <div className={styles.sliderRow}>
            <input
              ref={universeRef}
              type="range"
              min={0}
              max={0.9999}
              step={0.0005}
              defaultValue={0.5}
            />
            <span ref={universeOutRef}>0.500</span>
          </div>
        </div>
        <div ref={viewportRef} className={styles.viewport} />
      </div>
      <p className={styles.hint}>
        Every root-to-leaf path through this tree is one parallel universe&apos;s full lineage —
        all of them coexist at once, drawn together. The Universe slider reads its value as a
        binary address and highlights the one lineage it selects; every other branch fades in
        proportion to how early it diverged from that lineage (a shared long prefix = a nearby
        universe, an early split = a very different one). Drag the viewport to orbit; drag the
        dot to change scale/angle.
      </p>
    </div>
  );
}
