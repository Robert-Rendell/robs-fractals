"use client";

import { useEffect, useRef, type RefObject } from "react";
import styles from "./mandelbrot-bifurcation.module.css";

const REAL_MIN = -2.5;
const REAL_MAX = 1.0;
const IMAG_MIN = -1.25;
const IMAG_MAX = 1.25;
// The real orbit of z -> z^2 + c stays bounded only for c in [-2, 1/4], and
// within that range it never leaves [-2, 2].
const C_MIN = -2;
const C_MAX = 0.25;
const ORBIT_MAX = 2;
const CENTER_X = (REAL_MIN + REAL_MAX) / 2;

function cFromR(r: number): number {
  return r / 2 - (r * r) / 4;
}

// Scene axes: world x = Re(c), world z = -Im(c), so the Mandelbrot set lies
// flat in the y = 0 plane. World y is the value of the real orbit
// z_n -> z_n^2 + c, so the bifurcation diagram stands upright in the z = 0
// plane, cutting through the set along its real axis.

// The plane is shaded per screen pixel on the GPU rather than from a fixed
// texture, so zooming in resolves real detail (down to float precision,
// ~1e-7 in c) instead of magnifying texels.
const MANDELBROT_MAX_ITER = 4000;

const mandelbrotVertexShader = /* glsl */ `
  varying vec2 vC;
  void main() {
    vC = vec2(mix(${REAL_MIN.toFixed(4)}, ${REAL_MAX.toFixed(4)}, uv.x),
              mix(${IMAG_MIN.toFixed(4)}, ${IMAG_MAX.toFixed(4)}, uv.y));
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const mandelbrotFragmentShader = /* glsl */ `
  uniform int uMaxIter;
  varying vec2 vC;
  void main() {
    vec2 z = vec2(0.0);
    int iter = 0;
    for (int i = 0; i < ${MANDELBROT_MAX_ITER}; i++) {
      if (i >= uMaxIter || dot(z, z) > 65536.0) break;
      z = vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + vC;
      iter++;
    }
    if (iter >= uMaxIter) {
      gl_FragColor = vec4(58.0, 53.0, 43.0, 245.0) / 255.0;
      return;
    }
    // Smooth escape time; the large bailout keeps it free of banding.
    float nu = log2(log2(dot(z, z)) * 0.5);
    float s = float(iter) + 1.0 - nu;
    // Over the first 40 iterations this matches the 2D panel's gradient;
    // beyond that it keeps cycling (log-spaced) so deep-zoom boundary
    // detail doesn't all clamp to one colour.
    float sl = 40.0 * log2(1.0 + s / 40.0);
    float t = 0.5 - 0.5 * cos(3.14159265 * sl / 40.0);
    vec3 rgb = vec3(60.0 + 150.0 * t, 150.0 + 70.0 * (1.0 - t), 230.0 - 80.0 * t) / 255.0;
    // Fade the far exterior out so the plane reads as the set's silhouette
    // rather than an opaque slab hiding the diagram.
    float alpha = 0.08 + 0.8 * clamp(s / 40.0, 0.0, 1.0);
    gl_FragColor = vec4(rgb, alpha);
  }
`;

function bifurcationPositions(columns: number, discard: number, keep: number): Float32Array {
  const positions = new Float32Array(columns * keep * 3);
  let n = 0;
  for (let i = 0; i < columns; i++) {
    const c = C_MIN + (i / (columns - 1)) * (C_MAX - C_MIN);
    let x = 0;
    for (let k = 0; k < discard + keep; k++) {
      x = x * x + c;
      if (k >= discard) {
        positions[n++] = c - CENTER_X;
        positions[n++] = x;
        positions[n++] = 0;
      }
    }
  }
  return positions;
}

function orbitPositions(c: number, count: number): Float32Array {
  const positions = new Float32Array(count * 3);
  let x = 0;
  for (let k = 0; k < 1000; k++) x = x * x + c;
  for (let k = 0; k < count; k++) {
    x = x * x + c;
    positions[k * 3] = c - CENTER_X;
    positions[k * 3 + 1] = x;
    positions[k * 3 + 2] = 0;
  }
  return positions;
}

export default function Intersection3D({
  rInputRef,
}: {
  rInputRef: RefObject<HTMLInputElement | null>;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrapEl = wrapRef.current;
    const rInputEl = rInputRef.current;
    if (!wrapEl || !rInputEl) return;
    const wrap: HTMLDivElement = wrapEl;
    const rInput: HTMLInputElement = rInputEl;

    let disposed = false;
    const cleanupFns: Array<() => void> = [];

    (async () => {
      const THREE = await import("three");
      const { OrbitControls } = await import("three/examples/jsm/controls/OrbitControls.js");
      if (disposed) return;

      const width = wrap.clientWidth || 300;
      const height = wrap.clientHeight || 300;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(42, width / height, 0.0005, 100);
      // setR() slides camera and target along x to the slider's c.
      camera.position.set(0, 1.0, 5.4);

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(width, height, false);
      wrap.appendChild(renderer.domElement);

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.minDistance = 0.01;
      // Zooming toward the cursor lets you dive straight into one fork or
      // periodic window instead of always toward the orbit target.
      controls.zoomToCursor = true;
      controls.zoomSpeed = 1.8;
      controls.maxDistance = 14;
      controls.target.set(0, 0, 0);

      const disposables: Array<{ dispose(): void }> = [];

      // Mandelbrot plane
      const planeGeom = new THREE.PlaneGeometry(REAL_MAX - REAL_MIN, IMAG_MAX - IMAG_MIN);
      const planeMat = new THREE.ShaderMaterial({
        uniforms: { uMaxIter: { value: 200 } },
        vertexShader: mandelbrotVertexShader,
        fragmentShader: mandelbrotFragmentShader,
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const plane = new THREE.Mesh(planeGeom, planeMat);
      // PlaneGeometry spans x/y with +y as the texture's top; laying it down
      // with -90° about x sends +y to -z, i.e. +Im(c) to -z as the axes above
      // require.
      plane.rotation.x = -Math.PI / 2;
      scene.add(plane);
      disposables.push(planeGeom, planeMat);

      // Bifurcation diagram of the real orbit
      const bifGeom = new THREE.BufferGeometry();
      bifGeom.setAttribute(
        "position",
        new THREE.BufferAttribute(bifurcationPositions(4000, 400, 250), 3),
      );
      const bifMat = new THREE.PointsMaterial({
        color: 0xf0b860,
        size: 1.5,
        sizeAttenuation: false,
        transparent: true,
        opacity: 0.14,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const bif = new THREE.Points(bifGeom, bifMat);
      bif.renderOrder = 1;
      scene.add(bif);
      disposables.push(bifGeom, bifMat);

      // Faint frame around the bifurcation plane, plus the shared real axis
      const frameGeom = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(C_MIN - CENTER_X, -ORBIT_MAX, 0),
        new THREE.Vector3(C_MAX - CENTER_X, -ORBIT_MAX, 0),
        new THREE.Vector3(C_MAX - CENTER_X, ORBIT_MAX, 0),
        new THREE.Vector3(C_MIN - CENTER_X, ORBIT_MAX, 0),
        new THREE.Vector3(C_MIN - CENTER_X, -ORBIT_MAX, 0),
      ]);
      const frameMat = new THREE.LineBasicMaterial({
        color: 0xe8e6dd,
        transparent: true,
        opacity: 0.12,
      });
      scene.add(new THREE.Line(frameGeom, frameMat));
      const axisGeom = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(REAL_MIN - CENTER_X, 0, 0),
        new THREE.Vector3(REAL_MAX - CENTER_X, 0, 0),
      ]);
      const axisMat = new THREE.LineBasicMaterial({
        color: 0xe8e6dd,
        transparent: true,
        opacity: 0.35,
      });
      scene.add(new THREE.Line(axisGeom, axisMat));
      disposables.push(frameGeom, frameMat, axisGeom, axisMat);

      // Current-c marker: a vertical slice plus that c's orbit
      const markerGeom = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, -ORBIT_MAX, 0),
        new THREE.Vector3(0, ORBIT_MAX, 0),
      ]);
      const markerMat = new THREE.LineBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.55,
      });
      const marker = new THREE.Line(markerGeom, markerMat);
      marker.renderOrder = 2;
      scene.add(marker);
      const ORBIT_COUNT = 128;
      const orbitGeom = new THREE.BufferGeometry();
      const orbitAttr = new THREE.BufferAttribute(new Float32Array(ORBIT_COUNT * 3), 3);
      orbitGeom.setAttribute("position", orbitAttr);
      const orbitMat = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 5,
        sizeAttenuation: false,
        depthWrite: false,
        depthTest: false,
      });
      const orbit = new THREE.Points(orbitGeom, orbitMat);
      orbit.renderOrder = 3;
      scene.add(orbit);
      disposables.push(markerGeom, markerMat, orbitGeom, orbitMat);

      let frame = 0;
      function requestRender() {
        if (frame) return;
        frame = requestAnimationFrame(() => {
          frame = 0;
          // update() reports whether damping is still moving the camera.
          if (controls.update()) requestRender();
          // Deeper zooms need more iterations to resolve the boundary; scale
          // the budget with how far in the camera is.
          const dist = camera.position.distanceTo(controls.target);
          planeMat.uniforms.uMaxIter.value = Math.round(
            Math.min(MANDELBROT_MAX_ITER, Math.max(200, 200 + 250 * Math.log2(4 / dist))),
          );
          renderer.render(scene, camera);
        });
      }

      function setR(r: number) {
        const c = cFromR(r);
        marker.position.x = c - CENTER_X;
        // Keep the view centred on the slice: translate camera and target
        // together so the viewing angle and zoom are preserved.
        const dx = c - CENTER_X - controls.target.x;
        controls.target.x += dx;
        camera.position.x += dx;
        (orbitAttr.array as Float32Array).set(orbitPositions(c, ORBIT_COUNT));
        orbitAttr.needsUpdate = true;
        orbitGeom.computeBoundingSphere();
        requestRender();
      }

      const onRInput = () => setR(Number(rInput.value));
      rInput.addEventListener("input", onRInput);
      controls.addEventListener("change", requestRender);

      const resizeObserver = new ResizeObserver(() => {
        const w = wrap.clientWidth;
        const h = wrap.clientHeight;
        if (!w || !h) return;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h, false);
        requestRender();
      });
      resizeObserver.observe(wrap);

      setR(Number(rInput.value));

      cleanupFns.push(() => {
        if (frame) cancelAnimationFrame(frame);
        rInput.removeEventListener("input", onRInput);
        controls.removeEventListener("change", requestRender);
        resizeObserver.disconnect();
        controls.dispose();
        disposables.forEach((d) => d.dispose());
        renderer.dispose();
        renderer.domElement.remove();
      });
    })();

    return () => {
      disposed = true;
      cleanupFns.forEach((fn) => fn());
    };
  }, [rInputRef]);

  return (
    <div className={styles.panelWrap3d}>
      <span className={styles.panelLabel}>
        Where they meet — the c-plane lying flat, with the real orbit of z → z² + c standing
        upright along its real axis (drag to orbit, scroll or pinch to zoom)
      </span>
      <div ref={wrapRef} className={`${styles.canvasWrap} ${styles.canvasWrap3d}`} />
    </div>
  );
}
