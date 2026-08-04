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
const MIN_CAM_DIST = 0.5;
const MAX_CAM_DIST = 8;
const WHEEL_POWER_SCALE = 0.6;

const TRAVEL_SPEED = 1.2;
const TRAVEL_ACCEL_TIME = 1.2;
const TRAVEL_MIN_SPEED_FACTOR = 0.15;
const MOUSE_LOOK_SENSITIVITY = 0.0025;
const TRAVEL_PITCH_LIMIT = 1.5;
const TRAVEL_ROLL_SPEED = 1.4;

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
  const travelButtonRef = useRef<HTMLButtonElement>(null);
  const precisionButtonRef = useRef<HTMLButtonElement>(null);
  const resetButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const viewportEl = viewportRef.current;
    const powerInputEl = powerRef.current;
    const powerTooltipEl = powerTooltipRef.current;
    const tickMarksEl = tickMarksRef.current;
    const flyButtonEl = flyButtonRef.current;
    const colorButtonEl = colorButtonRef.current;
    const travelButtonEl = travelButtonRef.current;
    const precisionButtonEl = precisionButtonRef.current;
    const resetButtonEl = resetButtonRef.current;
    if (
      !viewportEl ||
      !powerInputEl ||
      !powerTooltipEl ||
      !tickMarksEl ||
      !flyButtonEl ||
      !colorButtonEl ||
      !travelButtonEl ||
      !precisionButtonEl ||
      !resetButtonEl
    ) {
      return;
    }
    const viewport: HTMLDivElement = viewportEl;
    const powerInput: HTMLInputElement = powerInputEl;
    const powerTooltip: HTMLDivElement = powerTooltipEl;
    const tickMarks: HTMLDivElement = tickMarksEl;
    const flyButton: HTMLButtonElement = flyButtonEl;
    const colorButton: HTMLButtonElement = colorButtonEl;
    const precisionButton: HTMLButtonElement = precisionButtonEl;
    const travelButton: HTMLButtonElement = travelButtonEl;
    const resetButton: HTMLButtonElement = resetButtonEl;

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
      let adaptiveEps = false;
      let travelMode = false;
      // Stays true after travel input stops, so the free-fly camera position
      // is preserved (view doesn't snap back to orbit mode) until the user
      // explicitly hits Reset.
      let travelCameraActive = false;
      let travelRafId = 0;
      let travelPos: Vec3 = [0, 0, 0];
      let travelYaw = 0;
      let travelPitch = 0;
      let travelRoll = 0;
      let travelLastTime = 0;
      let travelMoveTime = 0;
      const heldKeys = new Set<string>();
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
        uAdaptiveEps: { value: 0 },
      };

      const material = new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms,
      });
      const geometry = new THREE.PlaneGeometry(2, 2);
      const mesh = new THREE.Mesh(geometry, material);
      scene.add(mesh);

      // In travel mode, "forward" is wherever the mouse is looking (yaw/pitch
      // set by pointer-lock mouse movement) rather than always facing the
      // origin — yaw=0/pitch=0 looks down -Z, matching the orbit camera's
      // convention at rotY=rotX=0.
      function getTravelBasis() {
        const forward = norm3([
          Math.sin(travelYaw) * Math.cos(travelPitch),
          Math.sin(travelPitch),
          -Math.cos(travelYaw) * Math.cos(travelPitch),
        ]);
        const worldUp: Vec3 = [0, 1, 0];
        const levelRight = norm3(cross3(forward, worldUp));
        const levelUp = cross3(levelRight, forward);

        // Q/E roll around the look axis — the one axis the mouse (yaw/pitch)
        // can't turn — by rotating right/up within their own plane.
        const cosR = Math.cos(travelRoll);
        const sinR = Math.sin(travelRoll);
        const right: Vec3 = [
          levelRight[0] * cosR + levelUp[0] * sinR,
          levelRight[1] * cosR + levelUp[1] * sinR,
          levelRight[2] * cosR + levelUp[2] * sinR,
        ];
        const up: Vec3 = [
          levelUp[0] * cosR - levelRight[0] * sinR,
          levelUp[1] * cosR - levelRight[1] * sinR,
          levelUp[2] * cosR - levelRight[2] * sinR,
        ];
        return { forward, right, up };
      }

      function updateCameraUniforms() {
        let camPos: Vec3;
        let forward: Vec3;
        let right: Vec3;
        let up: Vec3;

        if (travelCameraActive) {
          camPos = travelPos;
          ({ forward, right, up } = getTravelBasis());
        } else {
          camPos = [
            camDist * Math.sin(rotY) * Math.cos(rotX),
            camDist * Math.sin(rotX),
            camDist * Math.cos(rotY) * Math.cos(rotX),
          ];
          forward = norm3([-camPos[0], -camPos[1], -camPos[2]]);
          const worldUp: Vec3 = [0, 1, 0];
          right = norm3(cross3(forward, worldUp));
          up = cross3(right, forward);
        }

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
        if (travelCameraActive) return;
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
        if (travelCameraActive || !activePointers.has(e.pointerId)) return;
        activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

        if (activePointers.size >= 2) {
          const dist = getPinchDist();
          if (dist !== null && lastPinchDist !== null) {
            camDist *= lastPinchDist / dist;
            camDist = Math.max(MIN_CAM_DIST, Math.min(MAX_CAM_DIST, camDist));
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
        if (travelCameraActive) return;
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
        if (travelCameraActive) {
          // No camera zoom while free-flying — repurpose scroll to drive the
          // Power slider instead, in the same piecewise position space the
          // slider itself uses so a "notch" feels consistent across the
          // whole range.
          const currentPos = powerToSliderPos(power);
          const newPos = Math.max(
            0,
            Math.min(SLIDER_MAX, currentPos - e.deltaY * WHEEL_POWER_SCALE),
          );
          applyPower(sliderPosToPower(newPos));
          return;
        }
        camDist *= 1 + e.deltaY * 0.001;
        camDist = Math.max(MIN_CAM_DIST, Math.min(MAX_CAM_DIST, camDist));
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

      // Used by tick-mark clicks and travel-mode scroll (not the slider's
      // own input event) to jump straight to a specific power — this is the
      // only path that writes back to powerInput.value, so live dragging
      // never round-trips through powerToSliderPos/sliderPosToPower and
      // drifts.
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
        if (travelCameraActive) resetView();
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

      const onPrecisionToggle = () => {
        adaptiveEps = !adaptiveEps;
        uniforms.uAdaptiveEps.value = adaptiveEps ? 1 : 0;
        precisionButton.textContent = adaptiveEps ? "Deep zoom detail: on" : "Deep zoom detail: off";
        precisionButton.setAttribute("aria-pressed", String(adaptiveEps));
        render();
      };

      // Stops WASD/mouse-look input capture, but deliberately leaves
      // travelPos/Yaw/Pitch/Roll and travelCameraActive untouched — the view
      // stays exactly where travel left it until resetView() is called.
      function exitTravelMode() {
        if (!travelMode) return;
        travelMode = false;
        cancelAnimationFrame(travelRafId);
        travelRafId = 0;
        heldKeys.clear();
        travelMoveTime = 0;
        travelButton.textContent = "Travel";
        travelButton.setAttribute("aria-pressed", "false");
        if (document.pointerLockElement === renderer.domElement) {
          document.exitPointerLock();
        }
      }

      function resetView() {
        exitTravelMode();
        travelCameraActive = false;
        travelRoll = 0;
        rotX = INITIAL_ROT_X;
        rotY = INITIAL_ROT_Y;
        camDist = INITIAL_CAM_DIST;
        render();
      }

      function travelStep(now: number) {
        const dt = Math.min((now - travelLastTime) / 1000, 0.1);
        travelLastTime = now;

        let rollDir = 0;
        if (heldKeys.has("q")) rollDir -= 1;
        if (heldKeys.has("e")) rollDir += 1;
        if (rollDir !== 0) {
          travelRoll += rollDir * TRAVEL_ROLL_SPEED * dt;
        }

        let moveX = 0;
        let moveZ = 0;
        if (heldKeys.has("w")) moveZ += 1;
        if (heldKeys.has("s")) moveZ -= 1;
        if (heldKeys.has("d")) moveX += 1;
        if (heldKeys.has("a")) moveX -= 1;

        if (moveX !== 0 || moveZ !== 0 || rollDir !== 0) {
          const { forward, right } = getTravelBasis();
          if (moveX !== 0 || moveZ !== 0) {
            travelMoveTime += dt;
            const rampT = Math.min(1, travelMoveTime / TRAVEL_ACCEL_TIME);
            const eased = rampT * rampT * (3 - 2 * rampT); // smoothstep
            const speedFactor = TRAVEL_MIN_SPEED_FACTOR + (1 - TRAVEL_MIN_SPEED_FACTOR) * eased;

            const len = Math.hypot(moveX, moveZ) || 1;
            moveX /= len;
            moveZ /= len;
            const dist = TRAVEL_SPEED * speedFactor * dt;
            travelPos = [
              travelPos[0] + (forward[0] * moveZ + right[0] * moveX) * dist,
              travelPos[1] + (forward[1] * moveZ + right[1] * moveX) * dist,
              travelPos[2] + (forward[2] * moveZ + right[2] * moveX) * dist,
            ];
          } else {
            travelMoveTime = 0;
          }
          render();
        } else {
          travelMoveTime = 0;
        }

        travelRafId = requestAnimationFrame(travelStep);
      }

      const onTravelToggle = () => {
        if (travelMode) {
          exitTravelMode();
          return;
        }

        if (flying) {
          flying = false;
          cancelAnimationFrame(flyRafId);
          flyRafId = 0;
          flyButton.textContent = "Fly around";
          flyButton.setAttribute("aria-pressed", "false");
        }

        if (!travelCameraActive) {
          // First time entering travel this session — seed position/
          // orientation from the current orbit view so it doesn't snap to a
          // new spot. If travel was used before and only paused (not reset),
          // travelPos/Yaw/Pitch/Roll are already wherever it was left.
          const camPos: Vec3 = [
            camDist * Math.sin(rotY) * Math.cos(rotX),
            camDist * Math.sin(rotX),
            camDist * Math.cos(rotY) * Math.cos(rotX),
          ];
          const orbitForward = norm3([-camPos[0], -camPos[1], -camPos[2]]);
          travelPos = camPos;
          travelPitch = Math.asin(Math.max(-1, Math.min(1, orbitForward[1])));
          travelYaw = Math.atan2(orbitForward[0], -orbitForward[2]);
          travelRoll = 0;
          travelCameraActive = true;
        }

        travelMode = true;
        travelButton.textContent = "Stop travelling";
        travelButton.setAttribute("aria-pressed", "true");
        travelLastTime = performance.now();
        renderer.domElement.requestPointerLock();
        travelRafId = requestAnimationFrame(travelStep);
      };

      const onTravelLook = (e: MouseEvent) => {
        if (!travelMode || document.pointerLockElement !== renderer.domElement) return;
        travelYaw += e.movementX * MOUSE_LOOK_SENSITIVITY;
        travelPitch -= e.movementY * MOUSE_LOOK_SENSITIVITY;
        travelPitch = Math.max(-TRAVEL_PITCH_LIMIT, Math.min(TRAVEL_PITCH_LIMIT, travelPitch));
        render();
      };

      const onKeyDown = (e: KeyboardEvent) => {
        if (!travelMode) return;
        const key = e.key.toLowerCase();
        if (
          key === "w" ||
          key === "a" ||
          key === "s" ||
          key === "d" ||
          key === "q" ||
          key === "e"
        ) {
          heldKeys.add(key);
          e.preventDefault();
        }
      };
      const onKeyUp = (e: KeyboardEvent) => {
        heldKeys.delete(e.key.toLowerCase());
      };
      const onPointerLockChange = () => {
        if (travelMode && document.pointerLockElement !== renderer.domElement) {
          exitTravelMode();
        }
      };

      renderer.domElement.addEventListener("pointerdown", onPointerDown);
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
      window.addEventListener("pointercancel", onPointerUp);
      renderer.domElement.addEventListener("wheel", onWheel, { passive: false });
      powerInput.addEventListener("input", onPowerInput);
      flyButton.addEventListener("click", onFlyToggle);
      colorButton.addEventListener("click", onColorToggle);
      precisionButton.addEventListener("click", onPrecisionToggle);
      tickMarks.addEventListener("click", onTickClick);
      travelButton.addEventListener("click", onTravelToggle);
      resetButton.addEventListener("click", resetView);
      renderer.domElement.addEventListener("mousemove", onTravelLook);
      window.addEventListener("keydown", onKeyDown);
      window.addEventListener("keyup", onKeyUp);
      document.addEventListener("pointerlockchange", onPointerLockChange);

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
        cancelAnimationFrame(travelRafId);
        if (document.pointerLockElement === renderer.domElement) {
          document.exitPointerLock();
        }
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
        precisionButton.removeEventListener("click", onPrecisionToggle);
        tickMarks.removeEventListener("click", onTickClick);
        travelButton.removeEventListener("click", onTravelToggle);
        resetButton.removeEventListener("click", resetView);
        renderer.domElement.removeEventListener("mousemove", onTravelLook);
        window.removeEventListener("keydown", onKeyDown);
        window.removeEventListener("keyup", onKeyUp);
        document.removeEventListener("pointerlockchange", onPointerLockChange);
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
        <button
          ref={precisionButtonRef}
          type="button"
          className={styles.toggleButton}
          aria-pressed="false"
        >
          Deep zoom detail: off
        </button>
        <button
          ref={travelButtonRef}
          type="button"
          className={`${styles.toggleButton} ${styles.travelButton}`}
          aria-pressed="false"
        >
          Travel
        </button>
        <button ref={resetButtonRef} type="button" className={styles.toggleButton}>
          Reset view
        </button>
      </div>
      <div ref={viewportRef} className={styles.viewport} />
      <p className={styles.hint}>
        The 3D analogue of the Mandelbrot set: instead of iterating a complex number z → zⁿ + c,
        this generalizes &quot;raise a vector to the nth power&quot; to 3D via spherical
        coordinates, then tests whether each point&apos;s orbit escapes — the same escape-time
        idea as Mandelbrot itself, rendered by raymarching a distance estimator since there&apos;s
        no simple surface equation to draw directly. Drag to orbit, scroll or pinch to zoom. Toggle
        Travel to fly free with WASD while the mouse looks around, and Q/E to roll — the one axis
        the mouse can&apos;t turn (locks the pointer; press Esc or toggle again to leave). Stopping
        Travel keeps you exactly where you were — use Reset view to snap back to the default orbit
        view.
      </p>
    </div>
  );
}
