import { performance } from 'node:perf_hooks';

/**
 * Downloads `url` once and measures it.
 *
 * Timing starts right before the request is sent and stops when the last
 * byte of the body has been received, so it includes DNS, TCP/TLS handshake
 * (when the connection is not reused), server think time and the transfer.
 *
 * `Accept-Encoding: identity` is sent so that the byte counter reflects what
 * actually travels over the wire, not a decompressed body.
 *
 * @param {string} url
 * @param {object} [opts]
 * @param {number} [opts.timeoutMs]  abort the request after this many ms
 * @param {AbortSignal} [opts.signal] external cancellation (Ctrl+C)
 * @param {(p: {bytes: number, total: number|null, elapsedMs: number}) => void} [opts.onProgress]
 * @returns {Promise<{status: number, bytes: number, total: number|null, ttfbMs: number, durationMs: number}>}
 */
export async function measure(url, { timeoutMs = 60_000, signal, onProgress } = {}) {
  const signals = [AbortSignal.timeout(timeoutMs)];
  if (signal) signals.push(signal);

  const started = performance.now();
  const res = await fetch(url, {
    headers: {
      'accept-encoding': 'identity',
      'cache-control': 'no-cache',
      'user-agent': 'speedtest-cli (+https://github.com/AlexPanich/speedtest)',
    },
    redirect: 'follow',
    signal: AbortSignal.any(signals),
  });
  const ttfbMs = performance.now() - started;

  if (!res.ok) {
    // Drain the body so the connection can be reused, then report.
    await res.body?.cancel().catch(() => {});
    throw new HttpError(res.status, res.statusText);
  }

  const lengthHeader = res.headers.get('content-length');
  const total = lengthHeader ? Number(lengthHeader) : null;

  let bytes = 0;
  if (res.body) {
    for await (const chunk of res.body) {
      bytes += chunk.byteLength;
      onProgress?.({ bytes, total, elapsedMs: performance.now() - started });
    }
  }

  return {
    status: res.status,
    bytes,
    total,
    ttfbMs,
    durationMs: performance.now() - started,
  };
}

export class HttpError extends Error {
  constructor(status, statusText) {
    super(`HTTP ${status}${statusText ? ` ${statusText}` : ''}`);
    this.name = 'HttpError';
    this.status = status;
  }
}

/** Human-readable reason for a failed request. */
export function describeError(err) {
  if (err instanceof HttpError) return err.message;
  if (err?.name === 'TimeoutError') return 'timeout';
  if (err?.name === 'AbortError') return 'aborted';
  const cause = err?.cause;
  if (cause?.code) return `${cause.code}${cause.hostname ? ` (${cause.hostname})` : ''}`;
  if (cause?.message) return cause.message;
  return err?.message ?? String(err);
}
