/**
 * Aggregates the results of successful runs.
 *
 * Speed is computed as total bytes / total transfer time, which is the same
 * as (average bytes) / (average time). This weights every byte equally,
 * unlike averaging per-request speeds which would over-weight short runs.
 *
 * @param {{bytes: number, durationMs: number, ttfbMs: number}[]} runs
 */
export function summarize(runs) {
  if (runs.length === 0) return null;

  const durations = runs.map((r) => r.durationMs);
  const totalBytes = sum(runs.map((r) => r.bytes));
  const totalMs = sum(durations);

  return {
    count: runs.length,
    totalBytes,
    totalMs,
    avgMs: totalMs / runs.length,
    minMs: Math.min(...durations),
    maxMs: Math.max(...durations),
    medianMs: median(durations),
    stdevMs: stdev(durations),
    avgTtfbMs: sum(runs.map((r) => r.ttfbMs)) / runs.length,
    bitsPerSecond: totalMs > 0 ? (totalBytes * 8) / (totalMs / 1000) : 0,
  };
}

export function speedBps(bytes, ms) {
  return ms > 0 ? (bytes * 8) / (ms / 1000) : 0;
}

export function sum(xs) {
  return xs.reduce((a, b) => a + b, 0);
}

export function median(xs) {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function stdev(xs) {
  if (xs.length < 2) return 0;
  const mean = sum(xs) / xs.length;
  return Math.sqrt(sum(xs.map((x) => (x - mean) ** 2)) / (xs.length - 1));
}
