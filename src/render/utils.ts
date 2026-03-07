/** Escape a value for safe SVG text / attribute insertion. */
export function esc(s: unknown): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Format a nullable number/string; returns an em-dash when absent. */
export function fmt(val: unknown): string {
  return val != null ? String(val) : "–";
}

/** Linear interpolation — maps val from [inMin,inMax] to [outMin,outMax]. */
export function lerp(val: number, inMin: number, inMax: number, outMin: number, outMax: number): number {
  if (inMin === inMax) return (outMin + outMax) / 2;
  return outMin + ((val - inMin) / (inMax - inMin)) * (outMax - outMin);
}

/**
 * Build a canonical profile URL for the given platform + username.
 */
export function platformUrl(platform: string, username: string): string {
  if (platform === "Lichess") return `https://lichess.org/@/${username}`;
  return `https://www.chess.com/member/${username}`;
}
