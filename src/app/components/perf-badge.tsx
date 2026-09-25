"use client";

import { useEffect, useState } from "react";
import styles from "./perf-badge.module.css";

// Browsers don't expose real per-page CPU or GPU utilisation, so each figure
// here is the closest thing that can actually be measured from inside the page:
//   CPU — main-thread busy time, inferred from how much idle time
//         requestIdleCallback is handed (workers aren't included).
//   RAM — JS heap in use (performance.memory, Chromium only).
//   GPU — GPU time spent on this page's WebGL2 commands, via
//         EXT_disjoint_timer_query_webgl2, as a share of wall-clock time.

type TimerExt = {
  TIME_ELAPSED_EXT: number;
  GPU_DISJOINT_EXT: number;
};

type TrackedContext = {
  gl: WebGL2RenderingContext;
  ext: TimerExt | null;
  canvas: HTMLCanvasElement | OffscreenCanvas;
  active: WebGLQuery | null;
  pending: WebGLQuery[];
  lastConnectedAt: number;
};

const tracked = new Set<TrackedContext>();
let gpuRendererName: string | null = null;

// WebGL contexts are created by page components (usually after an async
// `import("three")`), so the hook has to be in place before any of them run —
// hence patching at module evaluation rather than in an effect. The flag keeps
// Fast Refresh from wrapping getContext twice.
const PATCH_FLAG = "__perfBadgeGetContextPatched";
if (typeof window !== "undefined" && !(window as unknown as Record<string, boolean>)[PATCH_FLAG]) {
  (window as unknown as Record<string, boolean>)[PATCH_FLAG] = true;
  const original = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (
    this: HTMLCanvasElement,
    type: string,
    ...rest: unknown[]
  ) {
    const ctx = (original as (...args: unknown[]) => RenderingContext | null).call(
      this,
      type,
      ...rest,
    );
    if (type === "webgl2" && ctx instanceof WebGL2RenderingContext) trackContext(ctx, this);
    return ctx;
  } as typeof original;
}

function trackContext(gl: WebGL2RenderingContext, canvas: HTMLCanvasElement) {
  for (const t of tracked) if (t.gl === gl) return;
  const ext = gl.getExtension("EXT_disjoint_timer_query_webgl2") as TimerExt | null;
  if (!gpuRendererName) {
    const info = gl.getExtension("WEBGL_debug_renderer_info");
    gpuRendererName = String(
      gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER) ?? "",
    );
  }
  tracked.add({ gl, ext, canvas, active: null, pending: [], lastConnectedAt: performance.now() });
}

// Called once per browser frame. Each context always has one TIME_ELAPSED
// query open from this frame's callback to the next, so every command issued
// in between — i.e. that frame's rendering — lands in exactly one query.
// Returns GPU nanoseconds from queries that resolved this frame.
function pollGpu(now: number): number {
  let ns = 0;
  for (const t of tracked) {
    const { gl, ext } = t;
    if (gl.isContextLost()) {
      tracked.delete(t);
      continue;
    }
    if (!ext) continue;
    if (t.active) {
      gl.endQuery(ext.TIME_ELAPSED_EXT);
      t.pending.push(t.active);
      t.active = null;
    }
    while (t.pending.length) {
      const q = t.pending[0];
      if (!gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) break;
      // A disjoint event (e.g. GPU clock change) invalidates in-flight timings.
      if (!gl.getParameter(ext.GPU_DISJOINT_EXT)) {
        ns += gl.getQueryParameter(q, gl.QUERY_RESULT) as number;
      }
      gl.deleteQuery(q);
      t.pending.shift();
    }
    const connected = t.canvas instanceof HTMLCanvasElement ? t.canvas.isConnected : true;
    if (connected) t.lastConnectedAt = now;
    // Pages remove their canvas on unmount; stop querying (and let the
    // context be collected) once it's been gone for a moment. The grace
    // period covers renderers that create the canvas before appending it.
    if (!connected && now - t.lastConnectedAt > 2000) {
      t.pending.forEach((q) => gl.deleteQuery(q));
      tracked.delete(t);
      continue;
    }
    if (t.pending.length < 16) {
      const q = gl.createQuery();
      if (q) {
        gl.beginQuery(ext.TIME_ELAPSED_EXT, q);
        t.active = q;
      }
    }
  }
  return ns;
}

type Stats = {
  cpu: number | null;
  heapMb: number | null;
  heapLimitMb: number | null;
  gpu: number | null;
  fps: number | null;
};

const EMPTY: Stats = { cpu: null, heapMb: null, heapLimitMb: null, gpu: null, fps: null };

function level(pct: number | null): string {
  if (pct === null) return "";
  if (pct >= 80) return styles.high;
  if (pct >= 50) return styles.mid;
  return styles.low;
}

function Meter({ label, value, pct }: { label: string; value: string; pct: number | null }) {
  return (
    <div className={styles.metric}>
      <span className={styles.label}>{label}</span>
      <span className={styles.value}>{value}</span>
      <span className={styles.track}>
        <span
          className={`${styles.fill} ${level(pct)}`}
          style={{ width: `${Math.min(100, Math.max(0, pct ?? 0))}%` }}
        />
      </span>
    </div>
  );
}

export default function PerfBadge() {
  const [stats, setStats] = useState<Stats>(EMPTY);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const hasIdle = typeof window.requestIdleCallback === "function";
    let idleMs = 0;
    let idleHandle = 0;
    const onIdle = (deadline: IdleDeadline) => {
      // Chrome runs at most one of these per idle period (a re-request waits
      // for the next one), so summing the time remaining at the start of
      // each approximates the page's total idle time.
      idleMs += deadline.timeRemaining();
      idleHandle = window.requestIdleCallback(onIdle);
    };
    if (hasIdle) idleHandle = window.requestIdleCallback(onIdle);

    let frames = 0;
    let gpuNs = 0;
    let windowStart = performance.now();
    let raf = 0;

    const tick = (now: number) => {
      frames++;
      gpuNs += pollGpu(now);
      const elapsed = now - windowStart;
      if (elapsed >= 1000) {
        const memory = (
          performance as Performance & {
            memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number };
          }
        ).memory;
        const anyTimer = Array.from(tracked).some((t) => t.ext);
        setStats({
          cpu: hasIdle ? Math.max(0, Math.min(100, 100 * (1 - idleMs / elapsed))) : null,
          heapMb: memory ? memory.usedJSHeapSize / 1048576 : null,
          heapLimitMb: memory ? memory.jsHeapSizeLimit / 1048576 : null,
          gpu: anyTimer ? Math.min(100, (100 * gpuNs) / 1e6 / elapsed) : tracked.size ? null : 0,
          fps: (frames * 1000) / elapsed,
        });
        frames = 0;
        gpuNs = 0;
        idleMs = 0;
        windowStart = now;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      if (hasIdle) window.cancelIdleCallback(idleHandle);
    };
  }, []);

  const { cpu, heapMb, heapLimitMb, gpu, fps } = stats;
  const heapPct = heapMb !== null && heapLimitMb ? (100 * heapMb) / heapLimitMb : null;

  return (
    <button
      type="button"
      className={styles.badge}
      onClick={() => setExpanded((v) => !v)}
      aria-expanded={expanded}
      aria-label="Page performance"
    >
      <div className={styles.row}>
        <Meter label="CPU" value={cpu === null ? "—" : `${cpu.toFixed(0)}%`} pct={cpu} />
        <Meter label="RAM" value={heapMb === null ? "—" : `${heapMb.toFixed(0)} MB`} pct={heapPct} />
        <Meter label="GPU" value={gpu === null ? "—" : `${gpu.toFixed(0)}%`} pct={gpu} />
        <span className={styles.fps}>{fps === null ? "—" : `${fps.toFixed(0)} fps`}</span>
      </div>
      {expanded && (
        <div className={styles.details}>
          <p>
            <b>CPU</b> main-thread busy time{cpu === null && " (unsupported in this browser)"}.
            Web workers aren&apos;t included.
          </p>
          <p>
            <b>RAM</b> JS heap in use
            {heapLimitMb ? ` of a ${heapLimitMb.toFixed(0)} MB limit` : " (Chromium only)"}.
            GPU memory and DOM aren&apos;t counted.
          </p>
          <p>
            <b>GPU</b> time the GPU spends on this page&apos;s WebGL work
            {gpu === null && " (timer queries unavailable in this browser)"}
            {gpuRendererName ? ` — ${gpuRendererName}` : ""}.
          </p>
        </div>
      )}
    </button>
  );
}
