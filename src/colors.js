/**
 * Minimal ANSI styling without dependencies.
 * Respects NO_COLOR (https://no-color.org), FORCE_COLOR and non-TTY output.
 */
export function createColors(enabled) {
  const wrap = (open, close) => (s) => (enabled ? `\x1b[${open}m${s}\x1b[${close}m` : String(s));
  return {
    enabled,
    bold: wrap(1, 22),
    dim: wrap(2, 22),
    red: wrap(31, 39),
    green: wrap(32, 39),
    yellow: wrap(33, 39),
    blue: wrap(34, 39),
    magenta: wrap(35, 39),
    cyan: wrap(36, 39),
    gray: wrap(90, 39),
  };
}

export function shouldUseColor(stream, flagNoColor) {
  if (flagNoColor || 'NO_COLOR' in process.env) return false;
  if ('FORCE_COLOR' in process.env) return process.env.FORCE_COLOR !== '0';
  return Boolean(stream.isTTY);
}
