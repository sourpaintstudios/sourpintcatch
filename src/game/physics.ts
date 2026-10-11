export const GRAVITY = 9.81;
export const LINEAR_DRAG = 0.04;
export const GLOVE_R = 0.25;
export const LOCK_R = 0.5;
export const GEM_R = 0.08;
export const MPH_TO_MS = 0.44704;
export const PARTNER_Z = -21.6;
export const POCKET_Z = 0.05;

export type V3 = { x: number; y: number; z: number };

export function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}

export function clone(v: V3): V3 {
  return { x: v.x, y: v.y, z: v.z };
}

export function dist(a: V3, b: V3) {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

export function integrate(p: V3, v: V3, dt: number) {
  v.y -= GRAVITY * dt;
  const damp = Math.max(0, 1 - LINEAR_DRAG * dt);
  v.x *= damp;
  v.y *= damp;
  v.z *= damp;
  p.x += v.x * dt;
  p.y += v.y * dt;
  p.z += v.z * dt;
}

export function fly(
  origin: V3,
  velocity: V3,
  planeZ: number,
  dt = 1 / 120,
): { point: V3; time: number; grounded: boolean } | null {
  const p = clone(origin);
  const v = clone(velocity);
  const going = Math.sign(planeZ - origin.z) || -1;
  let t = 0;
  for (let i = 0; i < 120 * 6; i++) {
    const prev = clone(p);
    integrate(p, v, dt);
    t += dt;
    const crossed =
      going < 0 ? prev.z >= planeZ && p.z <= planeZ : prev.z <= planeZ && p.z >= planeZ;
    if (crossed) {
      const dz = p.z - prev.z;
      const u = dz === 0 ? 1 : (planeZ - prev.z) / dz;
      return {
        point: {
          x: prev.x + (p.x - prev.x) * u,
          y: prev.y + (p.y - prev.y) * u,
          z: planeZ,
        },
        time: t,
        grounded: false,
      };
    }
    if (p.y < 0.04) {
      return { point: clone(p), time: t, grounded: true };
    }
  }
  return null;
}

export type Launch = {
  velocity: V3;
  reached: boolean;
  angle: number;
  miss: number;
  hang: number;
};

export function solveLaunch(
  origin: V3,
  target: V3,
  speed: number,
  desiredAngle: number,
  maxMiss = 0.55,
): Launch {
  const dx = target.x - origin.x;
  const dz = target.z - origin.z;
  const flat = Math.hypot(dx, dz) || 1;
  const fx = dx / flat;
  const fz = dz / flat;
  let best: Launch | null = null;
  let bestScore = Infinity;
  let farthestZ = Infinity;
  let farthest: Launch | null = null;

  for (let i = 0; i <= 42; i++) {
    const angle = 0.08 + (i / 42) * 1.12;
    const cos = Math.cos(angle);
    const velocity = {
      x: fx * speed * cos,
      y: speed * Math.sin(angle),
      z: fz * speed * cos,
    };
    const hit = fly(origin, velocity, target.z);
    if (!hit) continue;
    if (hit.grounded) {
      if (hit.point.z < farthestZ) {
        farthestZ = hit.point.z;
        farthest = {
          velocity,
          reached: false,
          angle,
          miss: 99,
          hang: hit.time,
        };
      }
      continue;
    }
    const miss = Math.hypot(hit.point.x - target.x, hit.point.y - target.y);
    if (miss > maxMiss) continue;
    const score = Math.abs(angle - desiredAngle);
    if (score < bestScore) {
      bestScore = score;
      best = { velocity, reached: true, angle, miss, hang: hit.time };
    }
  }

  if (best) return best;
  if (farthest) return farthest;
  const angle = 0.45;
  const cos = Math.cos(angle);
  return {
    velocity: { x: fx * speed * cos, y: speed * Math.sin(angle), z: fz * speed * cos },
    reached: false,
    angle,
    miss: 99,
    hang: 0,
  };
}

const MPH_CURVE: Array<[number, number]> = [
  [0.6, 27],
  [1.0, 33],
  [1.5, 44],
  [2.0, 52],
  [2.5, 63],
  [3.15, 71],
];

export function mphFromG(g: number) {
  if (g <= MPH_CURVE[0][0]) return MPH_CURVE[0][1];
  for (let i = 1; i < MPH_CURVE.length; i++) {
    const [g0, m0] = MPH_CURVE[i - 1];
    const [g1, m1] = MPH_CURVE[i];
    if (g <= g1) return m0 + ((m1 - m0) * (g - g0)) / (g1 - g0);
  }
  return MPH_CURVE[MPH_CURVE.length - 1][1];
}

export type Sample = { t: number; g: number };

export function readSwing(
  samples: Sample[],
):
  | { ok: false; reason: "soft" | "quick" | "slow" }
  | { ok: true; peak: number; jerk: number; duration: number } {
  if (samples.length < 2) return { ok: false, reason: "soft" };
  let peak = 0;
  for (const s of samples) peak = Math.max(peak, s.g);
  if (peak < 0.6) return { ok: false, reason: "soft" };
  const active = samples.filter((s) => s.g >= 0.55);
  if (active.length < 2) return { ok: false, reason: "soft" };
  const duration = (active[active.length - 1].t - active[0].t) / 1000;
  if (duration < 0.15) return { ok: false, reason: "quick" };
  if (duration > 0.8) return { ok: false, reason: "slow" };
  let jerkAcc = 0;
  let n = 0;
  for (let i = 1; i < active.length; i++) {
    const dt = (active[i].t - active[i - 1].t) / 1000;
    if (dt < 0.004 || dt > 0.2) continue;
    jerkAcc += Math.abs(active[i].g - active[i - 1].g) / dt;
    n++;
  }
  const jerkRate = n ? jerkAcc / n : 0;
  const jerk = clamp((jerkRate - 5) / 34, 0, 1);
  return { ok: true, peak, jerk, duration };
}

export type Quality = "True" | "Loft" | "Pop" | "Short";

export function qualityFrom(jerk: number, reached: boolean): Quality {
  if (!reached) return "Short";
  if (jerk < 0.28) return "True";
  if (jerk < 0.62) return "Loft";
  return "Pop";
}

export function segmentSphereHit(p0: V3, p1: V3, center: V3, radius: number): number | null {
  const dx = p1.x - p0.x;
  const dy = p1.y - p0.y;
  const dz = p1.z - p0.z;
  const fx = p0.x - center.x;
  const fy = p0.y - center.y;
  const fz = p0.z - center.z;
  const a = dx * dx + dy * dy + dz * dz;
  const c = fx * fx + fy * fy + fz * fz - radius * radius;
  if (a < 1e-8) return c <= 0 ? 0 : null;
  const b = 2 * (fx * dx + fy * dy + fz * dz);
  const disc = b * b - 4 * a * c;
  if (disc < 0) return null;
  const s = Math.sqrt(disc);
  const t1 = (-b - s) / (2 * a);
  if (t1 >= 0 && t1 <= 1) return t1;
  const t2 = (-b + s) / (2 * a);
  if (t2 >= 0 && t2 <= 1) return t2;
  return null;
}

export function segmentPointDist(p0: V3, p1: V3, c: V3) {
  const dx = p1.x - p0.x;
  const dy = p1.y - p0.y;
  const dz = p1.z - p0.z;
  const len2 = dx * dx + dy * dy + dz * dz;
  let u = 0;
  if (len2 > 1e-8) {
    u = ((c.x - p0.x) * dx + (c.y - p0.y) * dy + (c.z - p0.z) * dz) / len2;
    u = clamp(u, 0, 1);
  }
  return Math.hypot(p0.x + dx * u - c.x, p0.y + dy * u - c.y, p0.z + dz * u - c.z);
}

export function closingSpeed(vel: V3, from: V3, to: V3) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dz = to.z - from.z;
  const m = Math.hypot(dx, dy, dz);
  if (m < 1e-5) return 0;
  return (vel.x * dx + vel.y * dy + vel.z * dz) / m;
}

export function evaluateCatch(
  prev: V3,
  next: V3,
  aim: V3,
  vel: V3,
): { caught: boolean; gem: boolean; glove: V3 } {
  const glove = { x: aim.x, y: aim.y, z: aim.z };
  const dEnd = dist(next, aim);
  if (dEnd < LOCK_R && dEnd > 1e-5) {
    const k = Math.min(1, Math.max(0, 1 - (GLOVE_R * 0.88) / dEnd));
    glove.x = aim.x + (next.x - aim.x) * k;
    glove.y = aim.y + (next.y - aim.y) * k;
    glove.z = aim.z + (next.z - aim.z) * k;
  }
  const hit = segmentSphereHit(prev, next, glove, GLOVE_R);
  const inside = dist(next, glove) <= GLOVE_R;
  const closing = closingSpeed(vel, prev, aim);
  const caught = (hit != null || inside) && closing > 0;
  const gem = caught && segmentPointDist(prev, next, aim) <= GEM_R;
  return { caught, gem, glove };
}

export function selfTest() {
  const errors: string[] = [];
  const origin = { x: 0, y: 1.2, z: POCKET_Z };
  const target = { x: 0, y: 1.28, z: PARTNER_Z };
  const slow = solveLaunch(origin, target, 30 * MPH_TO_MS, 0.4);
  const normal = solveLaunch(origin, target, 44 * MPH_TO_MS, 0.22);
  const hard = solveLaunch(origin, target, 65 * MPH_TO_MS, 0.18);
  const pop = solveLaunch(origin, target, 48 * MPH_TO_MS, 1.05);
  const flat = solveLaunch(origin, target, 48 * MPH_TO_MS, 0.18);
  if (slow.reached) errors.push(`30mph should fall short, hang ${slow.hang.toFixed(2)}`);
  if (!normal.reached) errors.push(`44mph should reach, miss ${normal.miss.toFixed(2)}`);
  if (!hard.reached) errors.push(`65mph should reach, miss ${hard.miss.toFixed(2)}`);
  if (!pop.reached || !flat.reached) errors.push("pop/flat should both reach");
  else if (pop.angle + 0.001 < flat.angle) {
    errors.push(`pop angle ${pop.angle.toFixed(2)} below flat ${flat.angle.toFixed(2)}`);
  }
  const back = solveLaunch(
    { x: 0, y: 1.28, z: PARTNER_Z },
    { x: 0.25, y: 1.45, z: POCKET_Z },
    16.4,
    0.6,
    0.22,
  );
  if (!back.reached || back.miss > 0.22) {
    errors.push(`return miss ${back.miss.toFixed(2)} reached ${back.reached}`);
  }
  const aim = { x: 0, y: 1.16, z: POCKET_Z };
  const gem = evaluateCatch(
    { x: 0, y: 1.16, z: -0.3 },
    { x: 0, y: 1.16, z: 0.1 },
    aim,
    { x: 0, y: 0, z: 16 },
  );
  if (!gem.caught || !gem.gem) errors.push("centerline should be a web gem");
  const save = evaluateCatch(
    { x: 0, y: 1.16, z: -0.2 },
    { x: 0, y: 1.16, z: 0.08 },
    { x: 0.4, y: 1.16, z: POCKET_Z },
    { x: 0, y: 0, z: 14 },
  );
  if (!save.caught || save.gem) errors.push("0.4m offset should catch without gem");
  const miss = evaluateCatch(
    { x: 0, y: 1.16, z: -0.2 },
    { x: 0, y: 1.16, z: 0.08 },
    { x: 0.85, y: 1.16, z: POCKET_Z },
    { x: 0, y: 0, z: 14 },
  );
  if (miss.caught) errors.push("0.85m offset should miss");
  return errors;
}
