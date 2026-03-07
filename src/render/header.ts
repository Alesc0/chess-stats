import fs from "fs";
import PinoHttp from "pino-http";
import { resolveTheme } from "./themes";
import { esc } from "./utils";
import path from "path";

const HEADER_H = 52;
const FS_TITLE_BADGE = 12;
const FS_COUNTRY = 10;
const FS_PLATFORM = 12;
const FS_USERNAME = 19;

function computeUsernameDisplayWidth(name: string): number {
  const len = name ? esc(name).length : 0;
  const minChars = 5;
  const maxChars = 25;
  const minMul = 6;
  const maxMul = 9.8;
  if (len <= minChars) return Math.round(len * minMul);
  if (len >= maxChars) return Math.round(len * maxMul);
  const t = (len - minChars) / (maxChars - minChars);
  // stronger ease-out so multipliers ramp up faster around ~9-10 chars
  const eased = 1 - Math.pow(1 - t, 4);
  const mul = minMul + eased * (maxMul - minMul);
  return Math.round(len * mul);
}

function loadFlagInline(
  code: string,
  x: number,
  y: number,
  w = 18,
  h = 12,
): string {
  try {
    const codeLc = code.toLowerCase();
    const p = path.resolve(
      process.cwd(),
      "node_modules",
      "flag-icons",
      "flags",
      "4x3",
      `${codeLc}.svg`,
    );
    if (!fs.existsSync(p)) return "";
    let svg = fs.readFileSync(p, "utf8");
    svg = svg
      .replace(/<\?xml[\s\S]*?\?>\s*/g, "")
      .replace(/<!DOCTYPE[\s\S]*?>\s*/g, "");
    // remove explicit width/height attributes but avoid matching inside other names like "stroke-width"
    // keep the leading whitespace or '<' so tag spacing remains valid
    svg = svg.replace(
      /([\s<])(?:width|height)=("[^"]*"|'[^']*'|[^\s>]+)/gi,
      "$1",
    );
    svg = svg.replace(
      /<svg/,
      `<svg x="${x}" y="${y}" width="${w}" height="${h}"`,
    );
    return svg;
  } catch (err) {
    return "";
  }
}

export function renderHeader({
  username,
  title,
  country,
  platform,
  themeName,
  width,
  height,
}: {
  username: string;
  title: string | null;
  country: string | null;
  platform: string;
  themeName: string;
  width: number;
  height: number;
}): string {
  const { colors: C } = resolveTheme(themeName);
  const usernameDisplayW = computeUsernameDisplayWidth(username);
  const titleBadgeX = 30 + usernameDisplayW + FS_USERNAME;
  const titleBadgeW = title ? title.length * 7 + 11 : 0;
  const countryX = titleBadgeX + (title ? titleBadgeW + 8 : 0);

  const countryFlagMarkup = (() => {
    if (!country || typeof country !== "string") return "";
    const code = country.length === 2 ? country : null;
    if (!code) return "";
    let flagInline = loadFlagInline(code, countryX, 22, 18, 14);
    if (!flagInline) {
      PinoHttp().logger.warn(
        `Could not load flag for country code "${code}". Make sure "flag-icons" package is installed and the code is correct.`,
      );
      return "";
    }
    return flagInline;
  })();

  const countryMarkup = country
    ? countryFlagMarkup
      ? `${countryFlagMarkup}\n  <text x="${countryX + 22}" y="32" fill="${C.muted}" font-size="${FS_COUNTRY}" font-family="sans-serif">${esc(
          typeof country === "string" && country.length === 2
            ? country.toUpperCase()
            : country,
        )}</text>`
      : `\n  <text x="${countryX}" y="32" fill="${C.muted}" font-size="${FS_COUNTRY}" font-family="sans-serif">${esc(
          country,
        )}</text>`
    : "";
  return `
    <title>Chess Stats – ${esc(username)}</title>

    <defs>
      <linearGradient id="hdrGrad" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%"  stop-color="${C.accent}" stop-opacity="0.15"/>
        <stop offset="70%" stop-color="${C.accent}" stop-opacity="0"/>
      </linearGradient>
    </defs>
  
    <clipPath id="hdrClip"><rect width="${width}" height="${HEADER_H}" rx="12"/></clipPath>
  
    <rect clip-path="url(#hdrClip)" width="${width}" height="${HEADER_H}" fill="url(#hdrGrad)"/>
  
    <rect x="0" y="9" width="3" height="${HEADER_H - 18}" rx="1.5" fill="${C.accent}"/>
  
    <line x1="0" y1="${HEADER_H}" x2="${width}" y2="${HEADER_H}" stroke="${C.border}" stroke-width="1"/>
  
    <text x="22" y="35" fill="${C.text}" font-size="${FS_USERNAME}" font-family="monospace" font-weight="bold" letter-spacing="0.3">${esc(username)}</text>
  
    ${
      title
        ? `
    <rect x="${titleBadgeX}" y="19" width="${titleBadgeW}" height="18" rx="5"
          fill="${C.titleBadgeBg}" stroke="${C.titleBadgeBorder}" stroke-width="1"/>
    <text x="${titleBadgeX + titleBadgeW / 2}" y="32" text-anchor="middle"
          fill="${C.titleBadgeText}" font-size="${FS_TITLE_BADGE}" font-family="monospace" font-weight="bold">${esc(title)}</text>`
        : ""
    }
  
    ${
      country
        ? `
    <text x="${countryX}" y="33" fill="${C.muted}" font-size="${FS_COUNTRY}" font-family="sans-serif">${esc(country)}</text>`
        : ""
    }
  
    <rect x="${width - 92}" y="19" width="${platform.length * 8}" height="18" rx="9" fill="${C.platform}" stroke="${C.border}" stroke-width="1"/>
    <text x="${width - 55}" y="32" text-anchor="middle" fill="${C.muted}" font-size="${FS_PLATFORM}" font-family="sans-serif">${esc(platform)}</text>
  `;
}
