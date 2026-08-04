"use client";

import { useEffect, useRef } from "react";
import type * as ThreeTypes from "three";
import { pythagorasCubes3D } from "../pythagorasGeometry";
import styles from "./complex-plane.module.css";

type Point2 = [number, number];

export default function Pythagoras3DFractal() {
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
      let twistStep = 12;
      let dragC = false;
      let dragV = false;
      let lastX = 0;
      let lastY = 0;
      let rotX = 0.25;
      let rotY = 0.5;
      let camDist = 260;
      let mesh: ThreeTypes.InstancedMesh | null = null;
      const activePointers = new Map<number, { x: number; y: number }>();
      let lastPinchDist: number | null = null;

      const getPinchDist = () => {
        const pts = Array.from(activePointers.values());
        if (pts.length < 2) return null;
        return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      };

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

      const ambient = new THREE.AmbientLight(0xffffff, 0.55);
      scene.add(ambient);
      const key = new THREE.DirectionalLight(0xffffff, 1.1);
      key.position.set(150, 220, 180);
      scene.add(key);
      const fill = new THREE.DirectionalLight(0x9fc4ff, 0.4);
      fill.position.set(-150, -80, -120);
      scene.add(fill);

      const group = new THREE.Group();
      scene.add(group);

      const geometry = new THREE.BoxGeometry(1, 1, 1);
      const material = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.6,
        metalness: 0.05,
      });

      function buildTree() {
        if (mesh) {
          group.remove(mesh);
          mesh.dispose();
        }
        const scale = Math.hypot(cRe, cIm);
        const theta = Math.atan2(cIm, cRe);
        const depth = scale < 0.5 ? 11 : scale < 0.75 ? 9 : 7;
        const cubes = pythagorasCubes3D(THREE, theta, twistStep, depth, 90);

        const next = new THREE.InstancedMesh(geometry, material, Math.max(cubes.length, 1));
        const m = new THREE.Matrix4();
        const q = new THREE.Quaternion();
        const s = new THREE.Vector3();
        const color = new THREE.Color();

        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;
        let minZ = Infinity;
        let maxZ = -Infinity;

        cubes.forEach((cube, i) => {
          const gen = depth - cube.depth;
          const t = depth > 0 ? gen / depth : 0;
          q.set(cube.quaternion[0], cube.quaternion[1], cube.quaternion[2], cube.quaternion[3]);
          s.set(cube.size, cube.size, cube.size);
          m.compose(new THREE.Vector3(...cube.position), q, s);
          next.setMatrixAt(i, m);
          color.setRGB((60 + 150 * t) / 255, (150 + 70 * (1 - t)) / 255, (230 - 80 * t) / 255);
          next.setColorAt(i, color);

          const [x, y, z] = cube.position;
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
          minZ = Math.min(minZ, z);
          maxZ = Math.max(maxZ, z);
        });

        next.instanceMatrix.needsUpdate = true;
        if (next.instanceColor) next.instanceColor.needsUpdate = true;

        const cx = (minX + maxX) / 2;
        const cy = (minY + maxY) / 2;
        const cz = (minZ + maxZ) / 2;
        next.position.set(-cx, -cy, -cz);
        group.add(next);
        mesh = next;
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
        buildTree();
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

        activePointers.delete(e.pointerId);
        if (activePointers.size === 1) {
          const remaining = activePointers.values().next().value;
          dragV = true;
          if (remaining) {
            lastX = remaining.x;
            lastY = remaining.y;
          }
          lastPinchDist = null;
        } else if (activePointers.size === 0) {
          lastPinchDist = null;
        } else {
          lastPinchDist = getPinchDist();
        }
      };
      const onWindowMove = (e: PointerEvent) => {
        if (dragC) {
          const [re, im] = pointerPosC(e);
          setC(re, im);
        }
      };
      const onViewportDown = (e: PointerEvent) => {
        renderer.domElement.setPointerCapture(e.pointerId);
        activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

        if (activePointers.size === 1) {
          dragV = true;
          lastX = e.clientX;
          lastY = e.clientY;
          renderer.domElement.style.cursor = "grabbing";
        } else {
          dragV = false;
          lastPinchDist = getPinchDist();
        }
        e.preventDefault();
      };
      const onViewportMove = (e: PointerEvent) => {
        if (!activePointers.has(e.pointerId)) return;
        activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

        if (activePointers.size >= 2) {
          const dist = getPinchDist();
          if (dist !== null && lastPinchDist !== null) {
            camDist *= lastPinchDist / dist;
            camDist = Math.max(60, Math.min(900, camDist));
          }
          lastPinchDist = dist;
          return;
        }

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
        buildTree();
      };

      pt.addEventListener("pointerdown", onPtDown);
      svg.addEventListener("pointerdown", onSvgDown);
      window.addEventListener("pointerup", onWindowUp);
      window.addEventListener("pointercancel", onWindowUp);
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
        window.removeEventListener("pointercancel", onWindowUp);
        window.removeEventListener("pointermove", onWindowMove);
        renderer.domElement.removeEventListener("pointerdown", onViewportDown);
        renderer.domElement.removeEventListener("pointermove", onViewportMove);
        renderer.domElement.removeEventListener("wheel", onWheel);
        twistInput.removeEventListener("input", onTwistInput);
        if (mesh) {
          mesh.dispose();
        }
        geometry.dispose();
        material.dispose();
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
      <h1 className={styles.heading}>Pythagoras tree — 3D, mapped to the complex plane</h1>
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
          <label className={styles.twistLabel}>Twist (out-of-plane fan)</label>
          <div className={styles.twistRow}>
            <input ref={twistRef} type="range" min={0} max={90} step={1} defaultValue={12} />
            <span ref={twistOutRef}>12°</span>
          </div>
        </div>
        <div ref={viewportRef} className={styles.viewport} />
      </div>
      <p className={styles.hint}>
        Angle θ is the same split angle from the generator — 45° gives the classic symmetric
        tree, off-45° gives lopsided branches. Twist 0° stays flat, matching the 2D basic tree
        exactly; turning it up fans each generation of cubes out of the plane. Drag the viewport
        to orbit, scroll or pinch to zoom.
      </p>
    </div>
  );
}
