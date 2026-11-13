import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarize, median, stdev } from '../src/stats.js';
import { formatBytes, formatMbps, formatDuration, sparkline, progressBar } from '../src/format.js';

test('summarize: speed is total bits / total seconds', () => {
  const s = summarize([
    { bytes: 1_000_000, durationMs: 1000, ttfbMs: 10 },
    { bytes: 1_000_000, durationMs: 3000, ttfbMs: 30 },
  ]);
  assert.equal(s.totalBytes, 2_000_000);
  assert.equal(s.avgMs, 2000);
  assert.equal(s.avgTtfbMs, 20);
  assert.equal(s.bitsPerSecond, 4_000_000); // 16 Mbit over 4 s
});

test('summarize: empty input', () => {
  assert.equal(summarize([]), null);
});

test('median / stdev', () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 2, 3]), 2.5);
  assert.equal(stdev([5]), 0);
  assert.ok(Math.abs(stdev([2, 4, 4, 4, 5, 5, 7, 9]) - 2.138) < 0.001);
});

test('formatters use decimal units', () => {
  assert.equal(formatBytes(999), '999 B');
  assert.equal(formatBytes(24_883_200), '24.9 MB');
  assert.equal(formatBytes(1_500_000_000), '1.50 GB');
  assert.equal(formatMbps(162_100_000), '162.1 Mbit/s');
  assert.equal(formatMbps(5_000_000), '5.00 Mbit/s');
  assert.equal(formatDuration(45.4), '45 ms');
  assert.equal(formatDuration(1234), '1.23 s');
});

test('sparkline and progress bar', () => {
  assert.equal(sparkline([1, 2, 3]), '▁▅█');
  assert.equal(sparkline([5, 5]), '▅▅');
  assert.equal(progressBar(0, 4), '····');
  assert.equal(progressBar(1, 4), '████');
  assert.equal(progressBar(0.5, 4), '██··');
});
