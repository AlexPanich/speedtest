/** Decimal (SI) units: 1 MB = 1 000 000 bytes, 1 Mbit/s = 1 000 000 bit/s. */

export function formatBytes(bytes) {
  const units = ['B', 'kB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let i = 0;
  while (value >= 1000 && i < units.length - 1) {
    value /= 1000;
    i++;
  }
  return `${i === 0 ? value : value.toFixed(value < 10 ? 2 : 1)} ${units[i]}`;
}

/** Primary unit of the tool: megabits per second. */
export function formatMbps(bitsPerSecond) {
  const mbps = bitsPerSecond / 1e6;
  return `${mbps.toFixed(mbps < 10 ? 2 : 1)} Mbit/s`;
}

export function formatMBps(bitsPerSecond) {
  const mBps = bitsPerSecond / 8 / 1e6;
  return `${mBps.toFixed(mBps < 10 ? 2 : 1)} MB/s`;
}

export function formatDuration(ms) {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

const SPARK = '▁▂▃▄▅▆▇█';

/** Tiny inline chart: one block per value, height relative to min..max. */
export function sparkline(values) {
  if (values.length === 0) return '';
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;
  return values
    .map((v) => SPARK[span === 0 ? SPARK.length >> 1 : Math.round(((v - min) / span) * (SPARK.length - 1))])
    .join('');
}

/** Progress bar of fixed `width` cells with 1/8 sub-cell precision. */
export function progressBar(fraction, width) {
  const f = Math.min(1, Math.max(0, fraction));
  const eighths = Math.round(f * width * 8);
  const full = Math.floor(eighths / 8);
  const rest = eighths % 8;
  const partial = rest ? ' ▏▎▍▌▋▊▉'[rest] : '';
  return ('█'.repeat(full) + partial).padEnd(width, '·');
}
