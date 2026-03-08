import { MODE } from "../types";
import { ThemeColors } from "./themes";

const VALID_MODES = new Set(["bullet", "blitz", "rapid", "puzzle"]);

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
export function lerp(
  val: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number,
): number {
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

export function errorSvg(message: string, ec: ThemeColors): string {
  const escaped = esc(message);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="80" viewBox="0 0 420 80">
      <rect width="420" height="80" rx="10" fill="${ec.bg}" stroke="${ec.loss}33" stroke-width="1"/>
      <text x="20" y="30" fill="${ec.loss}" font-size="13" font-family="monospace" font-weight="bold">Error</text>
      <text x="20" y="52" fill="${ec.muted}" font-size="11" font-family="monospace">${escaped}</text>
    </svg>`;
}

export function getModes(modes: any): MODE[] | null {
  return modes
    ? (modes as string)
        .split(",")
        .map((m) => m.trim().toLowerCase())
        .filter((m) => VALID_MODES.has(m))
        .map((m) => m as MODE)
    : [MODE.bullet, MODE.blitz, MODE.rapid];
}
