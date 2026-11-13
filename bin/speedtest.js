#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { readFileSync } from 'node:fs';
import { runBenchmark } from '../src/run.js';
import { createColors, shouldUseColor } from '../src/colors.js';
import { createReporter, printHeader, printSummary } from '../src/ui.js';

const DEFAULT_URL = 'https://pub-e151508a76d44a9e9d305892e37d7b5c.r2.dev/aurora-4k.png';

const HELP = `
Usage: speedtest [url] [options]

Downloads <url> several times in a row, waiting for each response to finish,
and prints the average request time, total amount of data and download speed.

Arguments:
  url                    file to download (default: ${DEFAULT_URL})

Options:
  -n, --count <n>        number of sequential requests (default: 10)
  -t, --timeout <sec>    per-request timeout in seconds (default: 60)
      --json             print machine-readable JSON instead of the report
      --no-color         disable colors (NO_COLOR env is respected too)
  -v, --version          print version
  -h, --help             show this help

Units: sizes in decimal megabytes (1 MB = 10^6 bytes),
       speed in megabits per second (1 Mbit/s = 10^6 bit/s).

Examples:
  speedtest
  speedtest https://example.com/big.jpg -n 5
  speedtest https://example.com/big.jpg --json | jq .summary.mbps
`;

function fail(message) {
  process.stderr.write(`speedtest: ${message}\nTry 'speedtest --help'.\n`);
  process.exit(2);
}

function parse(argv) {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        count: { type: 'string', short: 'n', default: '10' },
        timeout: { type: 'string', short: 't', default: '60' },
        json: { type: 'boolean', default: false },
        'no-color': { type: 'boolean', default: false },
        version: { type: 'boolean', short: 'v', default: false },
        help: { type: 'boolean', short: 'h', default: false },
      },
    });
  } catch (err) {
    fail(err.message);
  }

  const { values, positionals } = parsed;
  if (positionals.length > 1) fail('expected a single URL');

  const count = Number(values.count);
  if (!Number.isInteger(count) || count < 1) fail(`--count must be a positive integer, got "${values.count}"`);

  const timeout = Number(values.timeout);
  if (!(timeout > 0)) fail(`--timeout must be a positive number, got "${values.timeout}"`);

  const rawUrl = positionals[0] ?? DEFAULT_URL;
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    fail(`invalid URL "${rawUrl}"`);
  }
  if (!['http:', 'https:'].includes(url.protocol)) fail(`only http(s) URLs are supported, got "${url.protocol}"`);

  return { ...values, url: url.href, count, timeoutMs: timeout * 1000 };
}

function toJson(report) {
  const s = report.summary;
  return {
    url: report.url,
    requested: report.requested,
    completed: report.completed,
    failed: report.failed,
    aborted: report.aborted,
    summary: s && {
      totalBytes: s.totalBytes,
      avgMs: round(s.avgMs),
      medianMs: round(s.medianMs),
      minMs: round(s.minMs),
      maxMs: round(s.maxMs),
      stdevMs: round(s.stdevMs),
      avgTtfbMs: round(s.avgTtfbMs),
      mbps: round(s.bitsPerSecond / 1e6),
    },
    requests: report.results.map((r) =>
      r.ok
        ? { ok: true, status: r.status, bytes: r.bytes, ms: round(r.durationMs), ttfbMs: round(r.ttfbMs) }
        : { ok: false, error: r.error },
    ),
  };
}

const round = (x) => Math.round(x * 100) / 100;

async function main() {
  const opts = parse(process.argv.slice(2));

  if (opts.help) return void process.stdout.write(HELP);
  if (opts.version) {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
    return void process.stdout.write(`${pkg.version}\n`);
  }

  const out = process.stdout;
  const c = createColors(!opts.json && shouldUseColor(out, opts['no-color']));
  const live = !opts.json && Boolean(out.isTTY);

  // First Ctrl+C stops the series and still prints a summary of what was
  // measured so far; a second one exits immediately.
  const controller = new AbortController();
  process.on('SIGINT', () => {
    if (controller.signal.aborted) process.exit(130);
    controller.abort();
  });

  const reporter = opts.json ? {} : createReporter({ out, c, count: opts.count, live });
  if (!opts.json) printHeader({ out, c, url: opts.url, count: opts.count });

  if (live) out.write('\x1b[?25l'); // hide cursor while redrawing
  let report;
  try {
    report = await runBenchmark(opts.url, {
      count: opts.count,
      timeoutMs: opts.timeoutMs,
      signal: controller.signal,
      reporter,
    });
  } finally {
    if (live) {
      reporter.clearLine?.();
      out.write('\x1b[?25h');
    }
  }

  if (opts.json) out.write(`${JSON.stringify(toJson(report), null, 2)}\n`);
  else printSummary({ out, c, report });

  if (report.aborted) process.exitCode = 130;
  else if (!report.summary) process.exitCode = 1;
}

main().catch((err) => {
  process.stdout.write('\x1b[?25h');
  process.stderr.write(`speedtest: ${err?.stack ?? err}\n`);
  process.exit(1);
});
