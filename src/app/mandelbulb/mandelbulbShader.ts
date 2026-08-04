// Raymarched Mandelbulb: the 3D analogue of the Mandelbrot set. Instead of
// iterating a complex number z -> z^n + c, this generalizes "raising a
// vector to the nth power" to 3D via spherical coordinates (the standard
// White/Nylander formula), then tests whether each point's orbit escapes.
// There's no simple closed-form surface to draw, so this is rendered by
// sphere-tracing a distance estimator derived from that iteration, the
// standard technique for real-time GPU rendering of escape-time fractals.
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
uniform float uPower;
uniform float uTanHalfFov;
uniform float uColorful;

float mandelbulbDE(vec3 pos) {
  vec3 z = pos;
  float dr = 1.0;
  float r = 0.0;
  for (int i = 0; i < 10; i++) {
    r = length(z);
    if (r > 2.0) break;
    float theta = acos(clamp(z.z / r, -1.0, 1.0));
    float phi = atan(z.y, z.x);
    float zr = pow(r, uPower);
    dr = pow(r, uPower - 1.0) * uPower * dr + 1.0;
    theta *= uPower;
    phi *= uPower;
    z = zr * vec3(sin(theta) * cos(phi), sin(theta) * sin(phi), cos(theta));
    z += pos;
  }
  return 0.5 * log(max(r, 1e-6)) * r / max(dr, 1e-6);
}

// Re-runs the same iteration as mandelbulbDE, once, at the final hit point,
// tracking the closest each axis of z ever got to zero along the orbit (the
// classic "orbit trap" technique). Kept separate from mandelbulbDE so the
// raymarch loop and normal estimation — which call the distance estimator
// many times per pixel — don't pay for this extra bookkeeping.
vec3 mandelbulbOrbitTrap(vec3 pos) {
  vec3 z = pos;
  vec3 trap = vec3(1e10);
  for (int i = 0; i < 10; i++) {
    float r = length(z);
    if (r > 2.0) break;
    trap = min(trap, abs(z));
    float theta = acos(clamp(z.z / r, -1.0, 1.0));
    float phi = atan(z.y, z.x);
    float zr = pow(r, uPower);
    theta *= uPower;
    phi *= uPower;
    z = zr * vec3(sin(theta) * cos(phi), sin(theta) * sin(phi), cos(theta));
    z += pos;
  }
  return trap;
}

vec3 estimateNormal(vec3 p) {
  float e = 0.0015;
  vec2 h = vec2(e, 0.0);
  return normalize(vec3(
    mandelbulbDE(p + h.xyy) - mandelbulbDE(p - h.xyy),
    mandelbulbDE(p + h.yxy) - mandelbulbDE(p - h.yxy),
    mandelbulbDE(p + h.yyx) - mandelbulbDE(p - h.yyx)
  ));
}

void main() {
  vec2 ndc = (vUv * 2.0 - 1.0);
  ndc.x *= uResolution.x / uResolution.y;
  vec3 rd = normalize(uCamForward + ndc.x * uTanHalfFov * uCamRight + ndc.y * uTanHalfFov * uCamUp);
  vec3 ro = uCamPos;

  const int MAX_STEPS = 96;
  const float MAX_DIST = 12.0;
  const float EPS = 0.0008;

  float t = 0.0;
  int steps = 0;
  bool hit = false;
  for (int i = 0; i < MAX_STEPS; i++) {
    vec3 p = ro + rd * t;
    float d = mandelbulbDE(p);
    if (d < EPS) { hit = true; steps = i; break; }
    t += d * 0.9;
    steps = i;
    if (t > MAX_DIST) break;
  }

  vec3 bg = vec3(0.086, 0.078, 0.059);
  if (!hit) {
    gl_FragColor = vec4(bg, 1.0);
    return;
  }

  vec3 p = ro + rd * t;
  vec3 n = estimateNormal(p);
  vec3 lightDir = normalize(vec3(0.6, 0.8, 0.5));
  float diff = max(dot(n, lightDir), 0.0);
  float ao = 1.0 - float(steps) / float(MAX_STEPS);
  vec3 baseColor = vec3(0.22, 0.54, 0.87);
  if (uColorful > 0.5) {
    vec3 trap = mandelbulbOrbitTrap(p);
    float t2 = (trap.x + trap.y + trap.z) / 3.0;
    baseColor = 0.5 + 0.5 * cos(6.28318 * (vec3(0.0, 0.33, 0.67) + t2 * 2.5));
  }
  vec3 color = baseColor * (0.15 + 0.85 * diff) * (0.4 + 0.6 * ao);
  float rim = pow(1.0 - max(dot(n, -rd), 0.0), 2.5);
  color += rim * vec3(0.3, 0.5, 0.8) * 0.5;

  gl_FragColor = vec4(color, 1.0);
}
`;
