/**
 * Statistical helpers for the income-tiles dashboard.
 *
 * Everything here works from *published percentile thresholds and income shares* —
 * we never have microdata. Where a source omits a quantity we reconstruct it with an
 * explicitly-labelled model (lognormal calibrated on median/mean + Gini) so the UI can
 * badge the value as modeled rather than measured.
 */

/** Inverse standard normal CDF (Acklam's rational approximation, |err| < 1.15e-9). */
export function normInv(p: number): number {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
  const pLow = 0.02425;
  let q: number, r: number;
  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p <= 1 - pLow) {
    q = p - 0.5;
    r = q * q;
    return ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }
  q = Math.sqrt(-2 * Math.log(1 - p));
  return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
}

/** Standard normal CDF via Abramowitz–Stegun 7.1.26 erf approximation. */
export function normCdf(z: number): number {
  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-x * x);
  return 0.5 * (1 + sign * y);
}

/** Lognormal shape parameter implied by a Gini coefficient: G = 2Φ(σ/√2) − 1. */
export function sigmaFromGini(gini: number): number {
  const g = Math.min(Math.max(gini, 0.01), 0.95);
  return Math.SQRT2 * normInv((g + 1) / 2);
}

export interface Anchor {
  p: number;
  x: number;
}

/**
 * Monotone quantile function built from published percentile thresholds.
 * Interpolation happens in (probit, log-dollar) space: linear there is exactly a
 * lognormal locally, which respects the heavy right tail far better than linear-in-p.
 */
export function makeQuantile(anchors: Anchor[]): (p: number) => number {
  const pts = anchors
    .filter((a) => Number.isFinite(a.x) && a.x > 0 && a.p > 0 && a.p < 1)
    .sort((a, b) => a.p - b.p);
  const zs = pts.map((a) => normInv(a.p));
  const ls = pts.map((a) => Math.log(a.x));
  return (p: number) => {
    if (pts.length === 0) return NaN;
    if (pts.length === 1) return pts[0].x;
    const z = normInv(Math.min(Math.max(p, 1e-6), 1 - 1e-7));
    if (z <= zs[0]) {
      const slope = (ls[1] - ls[0]) / (zs[1] - zs[0]);
      return Math.exp(ls[0] + slope * (z - zs[0]));
    }
    const n = pts.length;
    if (z >= zs[n - 1]) {
      const slope = (ls[n - 1] - ls[n - 2]) / (zs[n - 1] - zs[n - 2]);
      return Math.exp(ls[n - 1] + slope * (z - zs[n - 1]));
    }
    let i = 0;
    while (i < n - 2 && zs[i + 1] < z) i++;
    const t = (z - zs[i]) / (zs[i + 1] - zs[i]);
    return Math.exp(ls[i] + t * (ls[i + 1] - ls[i]));
  };
}

/** Invert a monotone quantile function by bisection. Returns p in [0,1]. */
export function invertQuantile(q: (p: number) => number, x: number): number {
  if (!Number.isFinite(x)) return NaN;
  let lo = 1e-6;
  let hi = 1 - 1e-7;
  if (x <= q(lo)) return 0;
  if (x >= q(hi)) return 1;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (q(mid) < x) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Monotone cubic Hermite (Fritsch–Carlson) interpolator — used for Lorenz curves. */
export function makeMonotoneSpline(xs: number[], ys: number[]): (x: number) => number {
  const n = xs.length;
  if (n === 0) return () => NaN;
  if (n === 1) return () => ys[0];
  const dx: number[] = [];
  const slopes: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(xs[i + 1] - xs[i]);
    slopes.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  }
  const m: number[] = new Array(n).fill(0);
  m[0] = slopes[0];
  m[n - 1] = slopes[n - 2];
  for (let i = 1; i < n - 1; i++) {
    if (slopes[i - 1] * slopes[i] <= 0) m[i] = 0;
    else m[i] = (slopes[i - 1] + slopes[i]) / 2;
  }
  for (let i = 0; i < n - 1; i++) {
    if (slopes[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
    } else {
      const a = m[i] / slopes[i];
      const b = m[i + 1] / slopes[i];
      const s = a * a + b * b;
      if (s > 9) {
        const tau = 3 / Math.sqrt(s);
        m[i] = tau * a * slopes[i];
        m[i + 1] = tau * b * slopes[i];
      }
    }
  }
  return (x: number) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (i < n - 2 && xs[i + 1] < x) i++;
    const h = dx[i];
    const t = (x - xs[i]) / h;
    const t2 = t * t;
    const t3 = t2 * t;
    return (
      (2 * t3 - 3 * t2 + 1) * ys[i] +
      (t3 - 2 * t2 + t) * h * m[i] +
      (-2 * t3 + 3 * t2) * ys[i + 1] +
      (t3 - t2) * h * m[i + 1]
    );
  };
}

/** Gini from a Lorenz function, by trapezoid on a fine grid. */
export function giniFromLorenz(L: (p: number) => number): number {
  const N = 2000;
  let area = 0;
  let prev = L(0);
  for (let i = 1; i <= N; i++) {
    const cur = L(i / N);
    area += ((prev + cur) / 2) * (1 / N);
    prev = cur;
  }
  return Math.max(0, Math.min(1, 1 - 2 * area));
}

/**
 * Relative cumulative income captured below each percentile, obtained by numerically
 * integrating a quantile function. Used to fill in the part of a Lorenz curve a source
 * doesn't publish (e.g. WID publishes only top shares).
 */
export function integrateQuantile(q: (p: number) => number, upTo: number, steps = 4000): { grid: number[]; cum: number[] } {
  const grid: number[] = [];
  const cum: number[] = [];
  let acc = 0;
  const h = upTo / steps;
  let prev = q(1e-6);
  grid.push(0);
  cum.push(0);
  for (let i = 1; i <= steps; i++) {
    const p = i * h;
    const cur = q(Math.min(p, 1 - 1e-7));
    acc += ((prev + cur) / 2) * h;
    prev = cur;
    grid.push(p);
    cum.push(acc);
  }
  return { grid, cum };
}

export const MAD_SCALE = 1.4826;
/** 0.6745 = Φ⁻¹(0.75). Robust σ = (P75 − P25) / (2 × 0.6745), identical to 1.4826·MAD for a Gaussian. */
export const IQR_TO_SIGMA = 1 / (2 * 0.674489750196082);
