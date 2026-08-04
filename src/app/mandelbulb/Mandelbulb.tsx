"use client";

import { useEffect, useRef } from "react";
import { fragmentShader, vertexShader } from "./mandelbulbShader";
import styles from "./mandelbulb.module.css";

type Vec3 = [number, number, number];

const POWER_MIN = 2;
const POWER_MAX = 69;
const POWER_TICKS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

const INITIAL_ROT_X = 0.3;
const INITIAL_ROT_Y = 0.6;
const INITIAL_CAM_DIST = 3.0;

// The slider itself moves over a linear 0..SLIDER_MAX position space that
// maps piecewise-linearly onto the power range, devoting most of the track
// to POWER_MIN..12 (where the interesting detail lives) and compressing
// 12..POWER_MAX into the rest — so dragging is far more precise in the
// sweet spot even though the underlying power step is still fine everywhere.
const SLIDER_MAX = 1000;
const SLIDER_SPLIT = 750;
const SLIDER_SPLIT_POWER = 12;

// Matches the thumb width set on the range input in mandelbulb.module.css —
// needed to keep the tooltip centered over the thumb rather than the track.
const SLIDER_THUMB_WIDTH = 16;

const powerToSliderPos = (power: number): number => {
  if (power <= SLIDER_SPLIT_POWER) {
    return ((power - POWER_MIN) / (SLIDER_SPLIT_POWER - POWER_MIN)) * SLIDER_SPLIT;
  }
  return (
    SLIDER_SPLIT +
    ((power - SLIDER_SPLIT_POWER) / (POWER_MAX - SLIDER_SPLIT_POWER)) * (SLIDER_MAX - SLIDER_SPLIT)
  );
};

const sliderPosToPower = (pos: number): number => {
  if (pos <= SLIDER_SPLIT) {
    return POWER_MIN + (pos / SLIDER_SPLIT) * (SLIDER_SPLIT_POWER - POWER_MIN);
  }
  return (
    SLIDER_SPLIT_POWER +
    ((pos - SLIDER_SPLIT) / (SLIDER_MAX - SLIDER_SPLIT)) * (POWER_MAX - SLIDER_SPLIT_POWER)
  );
};

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
  const powerTooltipRef = useRef<HTMLDivElement>(null);
  const tickMarksRef = useRef<HTMLDivElement>(null);
  const flyButtonRef = useRef<HTMLButtonElement>(null);
  const colorButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const viewportEl = viewportRef.current;
    const powerInputEl = powerRef.current;
    const powerTooltipEl = powerTooltipRef.current;
    const tickMarksEl = tickMarksRef.current;
    const flyButtonEl = flyButtonRef.current;
    const colorButtonEl = colorButtonRef.current;
    if (
      !viewportEl ||
      !powerInputEl ||
      !powerTooltipEl ||
      !tickMarksEl ||
      !flyButtonEl ||
      !colorButtonEl
    ) {
      return;
    }
    const viewport: HTMLDivElement = viewportEl;
    const powerInput: HTMLInputElement = powerInputEl;
    const powerTooltip: HTMLDivElement = powerTooltipEl;
    const tickMarks: HTMLDivElement = tickMarksEl;
    const flyButton: HTMLButtonElement = flyButtonEl;
    const colorButton: HTMLButtonElement = colorButtonEl;

    let disposed = false;
    const cleanupFns: Array<() => void> = [];

    (async () => {
      const THREE = await import("three");
      if (disposed) return;

      let rotX = INITIAL_ROT_X;
      let rotY = INITIAL_ROT_Y;
      let camDist = INITIAL_CAM_DIST;
      let power = 8;
      let dragging = false;
      let lastX = 0;
      let lastY = 0;
      let flying = false;
      let flyRafId = 0;
      let flyTime = 0;
      let colorful = false;
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
        uColorful: { value: 0 },
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
      function positionTooltip() {
        const percent = Number(powerInput.value) / SLIDER_MAX;
        const trackWidth = powerInput.clientWidth;
        const x = SLIDER_THUMB_WIDTH / 2 + percent * (trackWidth - SLIDER_THUMB_WIDTH);
        powerTooltip.style.left = `${x}px`;
      }

      function updatePowerDisplay() {
        const text = power.toFixed(4);
        if (powerOutRef.current) powerOutRef.current.textContent = text;
        powerTooltip.textContent = text;
        positionTooltip();
      }

      function updateFromPower() {
        uniforms.uPower.value = power;
        updatePowerDisplay();
        render();
      }

      const onPowerInput = () => {
        power = sliderPosToPower(Number(powerInput.value));
        updateFromPower();
      };

      // Used by tick-mark clicks (not the slider's own input event) to jump
      // to a specific power — this is the only path that writes back to
      // powerInput.value, so live dragging never round-trips through
      // powerToSliderPos/sliderPosToPower and drifts.
      function applyPower(newPower: number) {
        power = newPower;
        powerInput.value = String(powerToSliderPos(newPower));
        updateFromPower();
      }

      const onTickClick = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        const tickEl = target.closest("[data-power]") as HTMLElement | null;
        if (!tickEl) return;
        applyPower(Number(tickEl.dataset.power));
      };

      function flyStep() {
        if (!dragging) {
          flyTime += 0.01;
          rotY += 0.006;
          rotX = Math.sin(flyTime * 0.6) * 0.6;
          render();
        }
        flyRafId = requestAnimationFrame(flyStep);
      }

      const onFlyToggle = () => {
        flying = !flying;
        flyButton.textContent = flying ? "Stop flying" : "Fly around";
        flyButton.setAttribute("aria-pressed", String(flying));
        if (flying) {
          flyTime = 0;
          flyRafId = requestAnimationFrame(flyStep);
        } else {
          cancelAnimationFrame(flyRafId);
          flyRafId = 0;
          rotX = INITIAL_ROT_X;
          rotY = INITIAL_ROT_Y;
          camDist = INITIAL_CAM_DIST;
          render();
        }
      };

      const onColorToggle = () => {
        colorful = !colorful;
        uniforms.uColorful.value = colorful ? 1 : 0;
        colorButton.textContent = colorful ? "Colouring: on" : "Colouring: off";
        colorButton.setAttribute("aria-pressed", String(colorful));
        render();
      };

      renderer.domElement.addEventListener("pointerdown", onPointerDown);
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
      window.addEventListener("pointercancel", onPointerUp);
      renderer.domElement.addEventListener("wheel", onWheel, { passive: false });
      powerInput.addEventListener("input", onPowerInput);
      flyButton.addEventListener("click", onFlyToggle);
      colorButton.addEventListener("click", onColorToggle);
      tickMarks.addEventListener("click", onTickClick);

      const resizeObserver = new ResizeObserver(() => {
        const width = viewport.clientWidth;
        const height = viewport.clientHeight;
        if (width === 0 || height === 0) return;
        renderer.setSize(width, height);
        uniforms.uResolution.value.set(width, height);
        render();
      });
      resizeObserver.observe(viewport);

      const trackResizeObserver = new ResizeObserver(() => positionTooltip());
      trackResizeObserver.observe(powerInput);

      render();
      updatePowerDisplay();

      cleanupFns.push(() => {
        cancelAnimationFrame(flyRafId);
        resizeObserver.disconnect();
        trackResizeObserver.disconnect();
        renderer.domElement.removeEventListener("pointerdown", onPointerDown);
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
        window.removeEventListener("pointercancel", onPointerUp);
        renderer.domElement.removeEventListener("wheel", onWheel);
        powerInput.removeEventListener("input", onPowerInput);
        flyButton.removeEventListener("click", onFlyToggle);
        colorButton.removeEventListener("click", onColorToggle);
        tickMarks.removeEventListener("click", onTickClick);
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
      <div className={styles.header}>
        <h1 className={styles.heading}>Mandelbulb</h1>
        <div className={styles.controls}>
          <label className={styles.sliderLabel}>Power (n)</label>
          <div className={styles.sliderRow}>
            <div className={styles.sliderTrack}>
              <input
                ref={powerRef}
                type="range"
                min={0}
                max={SLIDER_MAX}
                step="any"
                defaultValue={powerToSliderPos(8)}
              />
              <div ref={powerTooltipRef} className={styles.tooltip}>
                8.0000
              </div>
              <div ref={tickMarksRef} className={styles.tickMarks}>
                {POWER_TICKS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={styles.tick}
                    data-power={n}
                    aria-label={`Set power to ${n}`}
                    style={{ left: `${(powerToSliderPos(n) / SLIDER_MAX) * 100}%` }}
                  >
                    <span className={styles.tickLine} />
                    <span className={styles.tickLabel}>{n}</span>
                  </button>
                ))}
              </div>
            </div>
            <span ref={powerOutRef}>8.0000</span>
          </div>
        </div>
        <button
          ref={flyButtonRef}
          type="button"
          className={styles.toggleButton}
          aria-pressed="false"
        >
          Fly around
        </button>
        <button
          ref={colorButtonRef}
          type="button"
          className={styles.toggleButton}
          aria-pressed="false"
        >
          Colouring: off
        </button>
      </div>
      <div ref={viewportRef} className={styles.viewport} />
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
