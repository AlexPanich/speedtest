import { measure, describeError } from './measure.js';
import { summarize } from './stats.js';

/**
 * Downloads `url` `count` times strictly one after another.
 * A failed request does not stop the series; it is recorded and skipped
 * in the statistics.
 *
 * @param {string} url
 * @param {object} opts
 * @param {number} opts.count
 * @param {number} opts.timeoutMs
 * @param {AbortSignal} [opts.signal]
 * @param {object} [opts.reporter] optional hooks: start, progress, done, fail
 */
export async function runBenchmark(url, { count, timeoutMs, signal, reporter = {} }) {
  const results = [];

  for (let i = 0; i < count; i++) {
    if (signal?.aborted) break;
    reporter.start?.(i);
    try {
      const r = await measure(url, {
        timeoutMs,
        signal,
        onProgress: (p) => reporter.progress?.(i, p),
      });
      const result = { index: i, ok: true, ...r };
      results.push(result);
      reporter.done?.(i, result);
    } catch (err) {
      if (signal?.aborted) break;
      const result = { index: i, ok: false, error: describeError(err) };
      results.push(result);
      reporter.fail?.(i, result);
    }
  }

  const ok = results.filter((r) => r.ok);
  return {
    url,
    requested: count,
    completed: results.length,
    failed: results.length - ok.length,
    aborted: Boolean(signal?.aborted),
    results,
    summary: summarize(ok),
  };
}
