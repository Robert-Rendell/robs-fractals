// Raymarched Mandelbox: a 3D fractal built from a different primitive than
// the Mandelbulb's "raise to the nth power". Each iteration folds space back
// into a box (any coordinate outside [-1, 1] is reflected back in), then
// folds it back onto a sphere (points inside a small inner radius are
// inflated, points inside a larger outer radius are pushed toward its
// surface), then scales and re-adds the starting point — Tglad's formula.
// As with the Mandelbulb, there's no closed-form surface, so this is
// sphere-traced from a distance estimate derived from the same iteration.
export const vertexShader = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

export const fragmentShader = `
precision highp float;
varying vec2 vUv;

uniform vec2 uResolution;
uniform vec3 uCamPos;
uniform vec3 uCamRight;
uniform vec3 uCamUp;
uniform vec3 uCamForward;
uniform float uScale;
uniform float uTanHalfFov;
uniform float uColorful;
uniform float uAdaptiveEps;

const int MANDELBOX_ITER = 10;
const float MIN_RADIUS2 = 0.25;
const float FIXED_RADIUS2 = 1.0;
const float FOLD_LIMIT = 1.0;
// Once a point's orbit escapes this far, further iterations don't change its
// classification as "outside" — bailing out early keeps this DE's cost
// comparable to the Mandelbulb's r > 2.0 escape check instead of always
// paying for the full iteration count on every background pixel.
const float BAILOUT2 = 1.0e4;

void boxFold(inout vec3 z) {
  z = clamp(z, -FOLD_LIMIT, FOLD_LIMIT) * 2.0 - z;
}

void sphereFold(inout vec3 z, inout float dr) {
  float r2 = dot(z, z);
  if (r2 < MIN_RADIUS2) {
    float t = FIXED_RADIUS2 / MIN_RADIUS2;
    z *= t;
    dr *= t;
  } else if (r2 < FIXED_RADIUS2) {
    float t = FIXED_RADIUS2 / r2;
    z *= t;
    dr *= t;
  }
}

float mandelboxDE(vec3 pos) {
  vec3 z = pos;
  float dr = 1.0;
  for (int i = 0; i < MANDELBOX_ITER; i++) {
    boxFold(z);
    sphereFold(z, dr);
    z = uScale * z + pos;
    dr = dr * abs(uScale) + 1.0;
    if (dot(z, z) > BAILOUT2) break;
  }
  return length(z) / abs(dr);
}

// Re-runs the same iteration as mandelboxDE, once, at the final hit point,
// tracking the closest each axis of z ever got to zero along the orbit (the
// classic "orbit trap" technique). Kept separate from mandelboxDE so the
// raymarch loop and normal estimation — which call the distance estimator
// many times per pixel — don't pay for this extra bookkeeping.
vec3 mandelboxOrbitTrap(vec3 pos) {
  vec3 z = pos;
  float dr = 1.0;
  vec3 trap = vec3(1e10);
  for (int i = 0; i < MANDELBOX_ITER; i++) {
    boxFold(z);
    sphereFold(z, dr);
    z = uScale * z + pos;
    dr = dr * abs(uScale) + 1.0;
    trap = min(trap, abs(z));
    if (dot(z, z) > BAILOUT2) break;
  }
  return trap;
}

vec3 estimateNormal(vec3 p, float e) {
  vec2 h = vec2(e, 0.0);
  return normalize(vec3(
    mandelboxDE(p + h.xyy) - mandelboxDE(p - h.xyy),
    mandelboxDE(p + h.yxy) - mandelboxDE(p - h.yxy),
    mandelboxDE(p + h.yyx) - mandelboxDE(p - h.yyx)
  ));
}

void main() {
  vec2 ndc = (vUv * 2.0 - 1.0);
  ndc.x *= uResolution.x / uResolution.y;
  vec3 rd = normalize(uCamForward + ndc.x * uTanHalfFov * uCamRight + ndc.y * uTanHalfFov * uCamUp);
  vec3 ro = uCamPos;

  vec3 bg = vec3(0.086, 0.078, 0.059);

  // The fractal is bounded well inside this radius across the whole scale
  // range the UI exposes, so rays that never cross this sphere can skip the
  // (relatively expensive) distance estimator entirely — without this, every
  // background pixel would pay for the full raymarch, which is enough
  // fragment-shader work on slower/software GPUs to trigger a WebGL context
  // loss (TDR) on a single frame.
  const float BOUND_RADIUS = 2.4;
  float bDot = dot(ro, rd);
  float bC = dot(ro, ro) - BOUND_RADIUS * BOUND_RADIUS;
  float bDisc = bDot * bDot - bC;
  if (bDisc < 0.0) {
    gl_FragColor = vec4(bg, 1.0);
    return;
  }
  float bSqrt = sqrt(bDisc);
  float tNear = max(0.0, -bDot - bSqrt);
  float tFar = -bDot + bSqrt;
  if (tFar < 0.0) {
    gl_FragColor = vec4(bg, 1.0);
    return;
  }

  const int MAX_STEPS = 160;
  const float FIXED_EPS = 0.0015;
  const float MIN_EPS = 0.0003;
  const float EPS_DIST_SCALE = 0.0006;
  // The Mandelbox DE can overshoot near the box/sphere fold boundaries, so
  // steps are damped below the raw estimate (unlike the Mandelbulb's 0.9) to
  // avoid punching through thin shell-like surfaces.
  const float STEP_DAMPING = 0.6;

  float t = tNear;
  int steps = 0;
  bool hit = false;
  for (int i = 0; i < MAX_STEPS; i++) {
    vec3 p = ro + rd * t;
    float d = mandelboxDE(p);
    float eps = uAdaptiveEps > 0.5 ? max(MIN_EPS, t * EPS_DIST_SCALE) : FIXED_EPS;
    if (d < eps) { hit = true; steps = i; break; }
    t += d * STEP_DAMPING;
    steps = i;
    if (t > tFar) break;
  }

  if (!hit) {
    gl_FragColor = vec4(bg, 1.0);
    return;
  }

  vec3 p = ro + rd * t;
  const float FIXED_NORMAL_EPS = 0.0025;
  const float MIN_NORMAL_EPS = 0.0003;
  const float NORMAL_EPS_DIST_SCALE = 0.0009;
  float normalEps = uAdaptiveEps > 0.5 ? max(MIN_NORMAL_EPS, t * NORMAL_EPS_DIST_SCALE) : FIXED_NORMAL_EPS;
  vec3 n = estimateNormal(p, normalEps);
  vec3 lightDir = normalize(vec3(0.6, 0.8, 0.5));
  float diff = max(dot(n, lightDir), 0.0);
  float ao = 1.0 - float(steps) / float(MAX_STEPS);
  vec3 baseColor = vec3(0.72, 0.4, 0.2);
  if (uColorful > 0.5) {
    vec3 trap = mandelboxOrbitTrap(p);
    float t2 = (trap.x + trap.y + trap.z) / 3.0;
    baseColor = 0.5 + 0.5 * cos(6.28318 * (vec3(0.1, 0.4, 0.7) + t2 * 2.5));
  }
  vec3 color = baseColor * (0.15 + 0.85 * diff) * (0.4 + 0.6 * ao);
  float rim = pow(1.0 - max(dot(n, -rd), 0.0), 2.5);
  color += rim * vec3(0.8, 0.5, 0.3) * 0.5;

  gl_FragColor = vec4(color, 1.0);
}
`;
