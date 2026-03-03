/**
 * Shared utilities used across all SVG renderers.
 */

/** Escape a value for safe SVG text / attribute insertion. */
function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Format a nullable number/string; returns an em-dash when absent. */
function fmt(val) {
  return val != null ? String(val) : "–";
}

/** Linear interpolation — maps val from [inMin,inMax] to [outMin,outMax]. */
function lerp(val, inMin, inMax, outMin, outMax) {
  if (inMin === inMax) return (outMin + outMax) / 2;
  return outMin + ((val - inMin) / (inMax - inMin)) * (outMax - outMin);
}

/**
 * Build a canonical profile URL for the given platform + username.
 * @param {"Chess.com"|"Lichess"} platform
 * @param {string} username
 */
function platformUrl(platform, username) {
  if (platform === "Lichess") return `https://lichess.org/@/${username}`;
  return `https://www.chess.com/member/${username}`;
}

module.exports = { esc, fmt, lerp, platformUrl };
