// Critically damped springs: every animated value eases, nothing snaps.

export class Spring {
  value: number;
  velocity = 0;
  target: number;
  constructor(value = 0, public halfLife = 0.12) {
    this.value = value;
    this.target = value;
  }
  update(dt: number, target = this.target): number {
    this.target = target;
    const omega = (2 * 0.6931471805599453) / Math.max(1e-4, this.halfLife);
    const x = omega * dt;
    const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
    const change = this.value - target;
    const temp = (this.velocity + omega * change) * dt;
    this.velocity = (this.velocity - omega * temp) * exp;
    this.value = target + (change + temp) * exp;
    return this.value;
  }
  snap(v: number) {
    this.value = v;
    this.target = v;
    this.velocity = 0;
  }
}

/** Angle spring that takes the short way round. */
export class AngleSpring extends Spring {
  update(dt: number, target = this.target): number {
    let d = target - this.value;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    return super.update(dt, this.value + d);
  }
}

export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smoothstep = (a: number, b: number, v: number) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
export const damp = (a: number, b: number, lambda: number, dt: number) => lerp(a, b, 1 - Math.exp(-lambda * dt));
export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
