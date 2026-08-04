// Shared recursive construction for the Pythagoras Tree: given a base edge
// (origin -> origin + dir*size), erect a square on it, then split the top
// edge at the point that makes a right angle with the two remaining legs —
// the classic property that keeps the child squares' combined area equal to
// the parent's (a² + b² = c²). Both the flat 2D version and the 3D version
// below share this same split rule; the 3D version just carries a full
// orthonormal frame (u, v, w) instead of a single 2D direction, and adds an
// optional twist so children fan out of the plane.

export type Vec2 = [number, number];

export interface Square2D {
  corners: [Vec2, Vec2, Vec2, Vec2];
  depth: number;
}

const add2 = (a: Vec2, b: Vec2): Vec2 => [a[0] + b[0], a[1] + b[1]];
const sub2 = (a: Vec2, b: Vec2): Vec2 => [a[0] - b[0], a[1] - b[1]];
const scale2 = (a: Vec2, s: number): Vec2 => [a[0] * s, a[1] * s];
const normalize2 = (a: Vec2): Vec2 => {
  const l = Math.hypot(a[0], a[1]) || 1;
  return [a[0] / l, a[1] / l];
};
// Rotate the base direction 90° so growth points up the screen (canvas y
// grows downward, so "up" is the negated-x/y swap below).
const perp2 = (a: Vec2): Vec2 => [a[1], -a[0]];

export function pythagorasSquares2D(
  origin: Vec2,
  dir: Vec2,
  size: number,
  depth: number,
  theta: number,
  minSize = 1.5,
): Square2D[] {
  const out: Square2D[] = [];

  function gen(origin: Vec2, u: Vec2, size: number, depth: number) {
    const v = perp2(u);
    const p0 = origin;
    const p1 = add2(origin, scale2(u, size));
    const p2 = add2(p1, scale2(v, size));
    const p3 = add2(origin, scale2(v, size));
    out.push({ corners: [p0, p1, p2, p3], depth });
    if (depth <= 0 || size < minSize) return;

    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);
    const legScale = size * cosT;
    const apex = add2(p3, add2(scale2(u, legScale * cosT), scale2(v, legScale * sinT)));
    const leftLen = size * cosT;
    const rightLen = size * sinT;

    if (leftLen > minSize * 0.5) {
      gen(p3, normalize2(sub2(apex, p3)), leftLen, depth - 1);
    }
    if (rightLen > minSize * 0.5) {
      gen(apex, normalize2(sub2(p2, apex)), rightLen, depth - 1);
    }
  }

  gen(origin, dir, size, depth);
  return out;
}

// --- 3D ---

export interface Cube3D {
  position: [number, number, number];
  quaternion: [number, number, number, number];
  size: number;
  depth: number;
}

// THREE is passed in rather than imported at module scope, matching the
// dynamic `await import("three")` pattern used by the other 3D fractal
// pages (three.js is only ever loaded client-side, after mount).
export function pythagorasCubes3D(
  THREE: typeof import("three"),
  theta: number,
  twistStepDeg: number,
  maxDepth: number,
  rootSize: number,
  maxCubes = 6000,
): Cube3D[] {
  const out: Cube3D[] = [];
  const twistStep = (twistStepDeg * Math.PI) / 180;
  const cosT = Math.cos(theta);
  const sinT = Math.sin(theta);

  function pushCube(
    origin: InstanceType<typeof THREE.Vector3>,
    u: InstanceType<typeof THREE.Vector3>,
    v: InstanceType<typeof THREE.Vector3>,
    w: InstanceType<typeof THREE.Vector3>,
    size: number,
    depth: number,
  ) {
    const center = origin
      .clone()
      .addScaledVector(u, size / 2)
      .addScaledVector(v, size / 2)
      .addScaledVector(w, size / 2);
    const basis = new THREE.Matrix4().makeBasis(u, v, w);
    const quat = new THREE.Quaternion().setFromRotationMatrix(basis);
    out.push({
      position: [center.x, center.y, center.z],
      quaternion: [quat.x, quat.y, quat.z, quat.w],
      size,
      depth,
    });
  }

  function gen(
    origin: InstanceType<typeof THREE.Vector3>,
    u: InstanceType<typeof THREE.Vector3>,
    v: InstanceType<typeof THREE.Vector3>,
    w: InstanceType<typeof THREE.Vector3>,
    size: number,
    depth: number,
    twist: number,
  ) {
    if (out.length >= maxCubes) return;
    pushCube(origin, u, v, w, size, depth);
    if (depth <= 0 || size < 1) return;

    const topLeft = origin.clone().addScaledVector(v, size);
    const legScale = size * cosT;
    const apex = topLeft
      .clone()
      .addScaledVector(u, legScale * cosT)
      .addScaledVector(v, legScale * sinT);

    const leftLen = size * cosT;
    const rightLen = size * sinT;
    const nextTwist = twist + twistStep;

    if (leftLen > 0.5) {
      const newU = apex.clone().sub(topLeft).normalize();
      const newV0 = new THREE.Vector3().crossVectors(w, newU).normalize();
      const twistQuat = new THREE.Quaternion().setFromAxisAngle(newU, nextTwist);
      const newV = newV0.clone().applyQuaternion(twistQuat).normalize();
      const newW = new THREE.Vector3().crossVectors(newU, newV).normalize();
      gen(topLeft, newU, newV, newW, leftLen, depth - 1, nextTwist);
    }

    if (rightLen > 0.5) {
      const topRight = origin.clone().addScaledVector(u, size).addScaledVector(v, size);
      const newU = topRight.clone().sub(apex).normalize();
      const newV0 = new THREE.Vector3().crossVectors(w, newU).normalize();
      const twistQuat = new THREE.Quaternion().setFromAxisAngle(newU, nextTwist);
      const newV = newV0.clone().applyQuaternion(twistQuat).normalize();
      const newW = new THREE.Vector3().crossVectors(newU, newV).normalize();
      gen(apex, newU, newV, newW, rightLen, depth - 1, nextTwist);
    }
  }

  const rootOrigin = new THREE.Vector3(-rootSize / 2, -rootSize * 0.9, 0);
  gen(
    rootOrigin,
    new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(0, 0, 1),
    rootSize,
    maxDepth,
    0,
  );

  return out;
}
