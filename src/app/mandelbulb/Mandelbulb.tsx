"use client";

import { useEffect, useRef } from "react";
import { fragmentShader, vertexShader } from "./mandelbulbShader";
import styles from "./mandelbulb.module.css";

type Vec3 = [number, number, number];

const norm3 = (v: Vec3): Vec3 => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};
const cross3 = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

export default function Mandelbulb() {
  const viewportRef = useRef<HTMLDivElement>(null);
  const powerRef = useRef<HTMLInputElement>(null);
  const powerOutRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const viewportEl = viewportRef.current;
    const powerInputEl = powerRef.current;
    if (!viewportEl || !powerInputEl) return;
    const viewport: HTMLDivElement = viewportEl;
    const powerInput: HTMLInputElement = powerInputEl;

    let disposed = false;
    const cleanupFns: Array<() => void> = [];

    (async () => {
      const THREE = await import("three");
      if (disposed) return;

      let rotX = 0.3;
      let rotY = 0.6;
      let camDist = 3.0;
      let power = 8;
      let dragging = false;
      let lastX = 0;
      let lastY = 0;
      const activePointers = new Map<number, { x: number; y: number }>();
      let lastPinchDist: number | null = null;

      const getPinchDist = () => {
        const pts = Array.from(activePointers.values());
        if (pts.length < 2) return null;
        return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      };

      const initialWidth = viewport.clientWidth || 300;
      const initialHeight = viewport.clientHeight || 300;

      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      const renderer = new THREE.WebGLRenderer({ antialias: false });
      renderer.setSize(initialWidth, initialHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      viewport.appendChild(renderer.domElement);

      const uniforms = {
        uResolution: { value: new THREE.Vector2(initialWidth, initialHeight) },
        uCamPos: { value: new THREE.Vector3() },
        uCamRight: { value: new THREE.Vector3() },
        uCamUp: { value: new THREE.Vector3() },
        uCamForward: { value: new THREE.Vector3() },
        uPower: { value: power },
        uTanHalfFov: { value: Math.tan(((50 * Math.PI) / 180) / 2) },
      };

      const material = new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms,
      });
      const geometry = new THREE.PlaneGeometry(2, 2);
      const mesh = new THREE.Mesh(geometry, material);
      scene.add(mesh);

      function updateCameraUniforms() {
        const camPos: Vec3 = [
          camDist * Math.sin(rotY) * Math.cos(rotX),
          camDist * Math.sin(rotX),
          camDist * Math.cos(rotY) * Math.cos(rotX),
        ];
        const forward = norm3([-camPos[0], -camPos[1], -camPos[2]]);
        const worldUp: Vec3 = [0, 1, 0];
        const right = norm3(cross3(forward, worldUp));
        const up = cross3(right, forward);

        uniforms.uCamPos.value.set(...camPos);
        uniforms.uCamForward.value.set(...forward);
        uniforms.uCamRight.value.set(...right);
        uniforms.uCamUp.value.set(...up);
      }

      function render() {
        updateCameraUniforms();
        renderer.render(scene, camera);
      }

      const onPointerDown = (e: PointerEvent) => {
        renderer.domElement.setPointerCapture(e.pointerId);
        activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

        if (activePointers.size === 1) {
          dragging = true;
          lastX = e.clientX;
          lastY = e.clientY;
          renderer.domElement.style.cursor = "grabbing";
        } else {
          dragging = false;
          lastPinchDist = getPinchDist();
        }
        e.preventDefault();
      };
      const onPointerMove = (e: PointerEvent) => {
        if (!activePointers.has(e.pointerId)) return;
        activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

        if (activePointers.size >= 2) {
          const dist = getPinchDist();
          if (dist !== null && lastPinchDist !== null) {
            camDist *= lastPinchDist / dist;
            camDist = Math.max(1.2, Math.min(8, camDist));
          }
          lastPinchDist = dist;
          render();
          return;
        }

        if (!dragging) return;
        rotY += (e.clientX - lastX) * 0.008;
        rotX += (e.clientY - lastY) * 0.008;
        rotX = Math.max(-1.5, Math.min(1.5, rotX));
        lastX = e.clientX;
        lastY = e.clientY;
        render();
      };
      const onPointerUp = (e: PointerEvent) => {
        activePointers.delete(e.pointerId);
        if (renderer.domElement.hasPointerCapture(e.pointerId)) {
          renderer.domElement.releasePointerCapture(e.pointerId);
        }

        if (activePointers.size === 1) {
          const remaining = activePointers.values().next().value;
          dragging = true;
          if (remaining) {
            lastX = remaining.x;
            lastY = remaining.y;
          }
          lastPinchDist = null;
        } else if (activePointers.size === 0) {
          dragging = false;
          renderer.domElement.style.cursor = "grab";
          lastPinchDist = null;
        } else {
          lastPinchDist = getPinchDist();
        }
      };
      const onWheel = (e: WheelEvent) => {
        e.preventDefault();
        camDist *= 1 + e.deltaY * 0.001;
        camDist = Math.max(1.2, Math.min(8, camDist));
        render();
      };
      const onPowerInput = () => {
        power = Number(powerInput.value);
        uniforms.uPower.value = power;
        if (powerOutRef.current) powerOutRef.current.textContent = power.toFixed(1);
        render();
      };

      renderer.domElement.addEventListener("pointerdown", onPointerDown);
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
      window.addEventListener("pointercancel", onPointerUp);
      renderer.domElement.addEventListener("wheel", onWheel, { passive: false });
      powerInput.addEventListener("input", onPowerInput);

      const resizeObserver = new ResizeObserver(() => {
        const width = viewport.clientWidth;
        const height = viewport.clientHeight;
        if (width === 0 || height === 0) return;
        renderer.setSize(width, height);
        uniforms.uResolution.value.set(width, height);
        render();
      });
      resizeObserver.observe(viewport);

      render();

      cleanupFns.push(() => {
        resizeObserver.disconnect();
        renderer.domElement.removeEventListener("pointerdown", onPointerDown);
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
        window.removeEventListener("pointercancel", onPointerUp);
        renderer.domElement.removeEventListener("wheel", onWheel);
        powerInput.removeEventListener("input", onPowerInput);
        geometry.dispose();
        material.dispose();
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
      <h1 className={styles.heading}>Mandelbulb</h1>
      <div className={styles.row}>
        <div className={styles.panel}>
          <label className={styles.sliderLabel}>Power (n)</label>
          <div className={styles.sliderRow}>
            <input ref={powerRef} type="range" min={2} max={12} step={0.1} defaultValue={8} />
            <span ref={powerOutRef}>8.0</span>
          </div>
        </div>
        <div ref={viewportRef} className={styles.viewport} />
      </div>
      <p className={styles.hint}>
        The 3D analogue of the Mandelbrot set: instead of iterating a complex number z → zⁿ + c,
        this generalizes &quot;raise a vector to the nth power&quot; to 3D via spherical
        coordinates, then tests whether each point&apos;s orbit escapes — the same escape-time
        idea as Mandelbrot itself, rendered by raymarching a distance estimator since there&apos;s
        no simple surface equation to draw directly. Drag to orbit, scroll or pinch to zoom.
      </p>
    </div>
  );
}
