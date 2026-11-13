import {
  formatBytes,
  formatDuration,
  formatMBps,
  formatMbps,
  progressBar,
  sparkline,
} from './format.js';
import { speedBps } from './stats.js';

const BAR_WIDTH = 24;
const RENDER_INTERVAL_MS = 60;

/**
 * Pretty console reporter. On a TTY every request gets a live progress line
 * that is redrawn in place; otherwise only the final line is printed.
 */
export function createReporter({ out, c, count, live }) {
  const pad = String(count).length;
  const label = (i) => c.gray(`#${String(i + 1).padStart(pad, '0')}`);
  let lastRender = 0;

  const write = (s) => out.write(s);
  const replaceLine = (s) => write(`\r\x1b[2K${s}`);

  return {
    start(i) {
      lastRender = 0;
      if (live) replaceLine(`  ${label(i)}  ${c.gray(progressBar(0, BAR_WIDTH))}  ${c.dim('connecting…')}`);
    },

    progress(i, { bytes, total, elapsedMs }) {
      if (!live) return;
      const now = Date.now();
      if (now - lastRender < RENDER_INTERVAL_MS) return;
      lastRender = now;

      const speed = formatMbps(speedBps(bytes, elapsedMs));
      const bar = total ? progressBar(bytes / total, BAR_WIDTH) : spinnerBar(now);
      const size = total ? `${formatBytes(bytes)} / ${formatBytes(total)}` : formatBytes(bytes);
      replaceLine(`  ${label(i)}  ${c.cyan(bar)}  ${size.padEnd(19)} ${c.yellow(speed)}`);
    },

    done(i, r) {
      const line = [
        `  ${label(i)}  ${c.green('✓')} `,
        formatBytes(r.bytes).padStart(9),
        c.dim('in'),
        formatDuration(r.durationMs).padStart(7),
        c.gray('·'),
        c.dim('ttfb'),
        formatDuration(r.ttfbMs).padStart(6),
        c.gray('·'),
        c.bold(formatMbps(speedBps(r.bytes, r.durationMs)).padStart(13)),
      ].join(' ');
      live ? replaceLine(`${line}\n`) : write(`${line}\n`);
    },

    fail(i, r) {
      const line = `  ${label(i)}  ${c.red('✗')}  ${c.red(r.error)}`;
      live ? replaceLine(`${line}\n`) : write(`${line}\n`);
    },

    clearLine() {
      if (live) replaceLine('');
    },
  };
}

function spinnerBar(now) {
  // Indeterminate bar for responses without Content-Length.
  const pos = Math.floor(now / 80) % (BAR_WIDTH + 6);
  return Array.from({ length: BAR_WIDTH }, (_, k) => (k >= pos - 6 && k < pos ? '█' : '·')).join('');
}

export function printHeader({ out, c, url, count }) {
  out.write(`\n  ${c.bold(c.magenta('⚡ speedtest'))}  ${c.gray('→')}  ${c.cyan(url)}\n`);
  out.write(`  ${c.dim(`${count} sequential requests`)}\n\n`);
}

export function printSummary({ out, c, report }) {
  const { summary: s, failed, completed, requested, aborted } = report;
  const rule = c.gray('  ' + '─'.repeat(60));
  const row = (k, v) => out.write(`  ${c.dim(k.padEnd(12))} ${v}\n`);

  out.write(`\n${rule}\n`);

  const okCount = completed - failed;
  const reqLine = `${okCount}/${requested} ok` + (failed ? c.red(`  ·  ${failed} failed`) : '') +
    (aborted ? c.yellow('  ·  interrupted') : '');
  row('Requests', reqLine);

  if (!s) {
    out.write(`\n  ${c.red('No successful requests — nothing to measure.')}\n\n`);
    return;
  }

  const okRuns = report.results.filter((r) => r.ok);
  row('Downloaded', c.bold(formatBytes(s.totalBytes)));
  row(
    'Avg time',
    `${c.bold(formatDuration(s.avgMs))}  ${c.gray(
      `min ${formatDuration(s.minMs)} · median ${formatDuration(s.medianMs)} · max ${formatDuration(s.maxMs)} · σ ${formatDuration(s.stdevMs)}`,
    )}`,
  );
  row('Avg TTFB', formatDuration(s.avgTtfbMs));
  if (okRuns.length > 1) {
    row('Stability', c.cyan(sparkline(okRuns.map((r) => speedBps(r.bytes, r.durationMs)))));
  }

  out.write(`${rule}\n\n`);
  out.write(
    `  ${c.dim('Download speed')}   ${c.bold(c.green(formatMbps(s.bitsPerSecond)))}  ${c.gray(`(${formatMBps(s.bitsPerSecond)})`)}\n\n`,
  );
}
