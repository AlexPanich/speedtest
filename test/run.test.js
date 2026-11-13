import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { runBenchmark } from '../src/run.js';
import { measure } from '../src/measure.js';
import { startServer } from './helpers.js';

let srv;
before(async () => (srv = await startServer()));
after(() => srv.close());

test('makes exactly N sequential requests and counts all bytes', async () => {
  const start = srv.hits();
  const report = await runBenchmark(srv.url('/file'), { count: 10, timeoutMs: 5000 });

  assert.equal(srv.hits() - start, 10);
  assert.equal(report.completed, 10);
  assert.equal(report.failed, 0);
  assert.equal(report.summary.count, 10);
  assert.equal(report.summary.totalBytes, srv.size * 10);
  assert.ok(report.summary.avgMs > 0);
  assert.ok(report.summary.bitsPerSecond > 0);
});

test('requests do not overlap', async () => {
  const spans = [];
  let current;
  await runBenchmark(srv.url('/chunked'), {
    count: 5,
    timeoutMs: 5000,
    reporter: {
      start: () => (current = { start: performance.now() }),
      done: () => spans.push({ ...current, end: performance.now() }),
    },
  });
  for (let i = 1; i < spans.length; i++) assert.ok(spans[i].start >= spans[i - 1].end);
});

test('works without Content-Length and follows redirects', async () => {
  const a = await measure(srv.url('/chunked'));
  assert.equal(a.bytes, srv.size);
  assert.equal(a.total, null);

  const b = await measure(srv.url('/redirect'));
  assert.equal(b.bytes, srv.size);
});

test('failed requests are reported and excluded from stats', async () => {
  const report = await runBenchmark(srv.url('/404'), { count: 3, timeoutMs: 5000 });
  assert.equal(report.failed, 3);
  assert.equal(report.summary, null);
  assert.equal(report.results[0].error, 'HTTP 404 Not Found');
});

test('per-request timeout', async () => {
  const report = await runBenchmark(srv.url('/slow'), { count: 1, timeoutMs: 100 });
  assert.equal(report.results[0].error, 'timeout');
});

test('abort stops the series early', async () => {
  const controller = new AbortController();
  const report = await runBenchmark(srv.url('/file'), {
    count: 10,
    timeoutMs: 5000,
    signal: controller.signal,
    reporter: { done: (i) => i === 2 && controller.abort() },
  });
  assert.equal(report.aborted, true);
  assert.equal(report.completed, 3);
  assert.equal(report.summary.count, 3);
});
