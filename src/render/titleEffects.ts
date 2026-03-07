export interface TitleColorPalette {
  primary: string;
  secondary: string;
  glow: string;
}

export const TITLE_COLORS: Record<string, TitleColorPalette> = {
  GM:  { primary: "#FFD700", secondary: "#FFF8DC", glow: "#FFD700" },
  IM:  { primary: "#C0C0C0", secondary: "#E8E8E8", glow: "#C0C0C0" },
  FM:  { primary: "#CD853F", secondary: "#DEB887", glow: "#CD853F" },
  CM:  { primary: "#20B2AA", secondary: "#7FFFD4", glow: "#20B2AA" },
  NM:  { primary: "#4FC3F7", secondary: "#B3E5FC", glow: "#4FC3F7" },
  WGM: { primary: "#FFB6C1", secondary: "#FFE4E1", glow: "#FFB6C1" },
  WIM: { primary: "#D8BFD8", secondary: "#E6E6FA", glow: "#D8BFD8" },
  WFM: { primary: "#FFDAB9", secondary: "#FFE4C4", glow: "#FFDAB9" },
  WCM: { primary: "#98FB98", secondary: "#F0FFF0", glow: "#98FB98" },
  BOT: { primary: "#78909C", secondary: "#B0BEC5", glow: "#78909C" },
};

export function getTitleColors(title?: string | null): TitleColorPalette | null {
  if (!title) return null;
  return TITLE_COLORS[title.toUpperCase()] ?? TITLE_COLORS.NM;
}

function makeRng(title: string) {
  let seed = 0;
  for (let i = 0; i < title.length; i++) seed += title.charCodeAt(i) * 31;
  return function rand() {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function starPath(outerR: number, innerR: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 4; i++) {
    const aOuter = (Math.PI / 2) * i - Math.PI / 2;
    const aInner = aOuter + Math.PI / 4;
    pts.push(`${(Math.cos(aOuter) * outerR).toFixed(2)},${(Math.sin(aOuter) * outerR).toFixed(2)}`);
    pts.push(`${(Math.cos(aInner) * innerR).toFixed(2)},${(Math.sin(aInner) * innerR).toFixed(2)}`);
  }
  return `M${pts.join("L")}Z`;
}

export function renderStarEffect(opts: {
  title?: string | null;
  width: number;
  height: number;
  count?: number;
  clipId?: string;
}): { defs: string; markup: string } {
  const { title, width, height, count = 14, clipId = "starClip" } = opts;
  const tc = getTitleColors(title);
  if (!tc) return { defs: "", markup: "" };

  const rand = makeRng(title!);
  const MARGIN = 16;
  const stars: string[] = [];

  for (let i = 0; i < count; i++) {
    const cx = MARGIN + rand() * (width - MARGIN * 2);
    const cy = MARGIN + rand() * (height - MARGIN * 2);
    const size = 3.5 + rand() * 4;
    const inner = size * (0.28 + rand() * 0.12);
    const peakOpacity = 0.45 + rand() * 0.45;
    const dur = 2.5 + rand() * 3.5;
    const delay = rand() * 6;
    const color = rand() > 0.45 ? tc.primary : tc.secondary;
    const rotation = Math.floor(rand() * 45);
    const d = starPath(size, inner);

    stars.push(
      `<g transform="translate(${cx.toFixed(1)},${cy.toFixed(1)}) rotate(${rotation})" opacity="0">` +
      `<path d="${d}" fill="${color}"/>` +
      `<animateTransform attributeName="transform" type="scale" additive="sum" ` +
      `values="0.3;1;0.3" dur="${dur.toFixed(1)}s" begin="${delay.toFixed(1)}s" ` +
      `calcMode="spline" keySplines="0.4 0 0.2 1; 0.4 0 0.2 1" keyTimes="0;0.5;1" ` +
      `repeatCount="indefinite"/>` +
      `<animate attributeName="opacity" ` +
      `values="0;${peakOpacity.toFixed(2)};0" ` +
      `dur="${dur.toFixed(1)}s" begin="${delay.toFixed(1)}s" ` +
      `calcMode="spline" keySplines="0.4 0 0.2 1; 0.4 0 0.2 1" keyTimes="0;0.5;1" ` +
      `repeatCount="indefinite"/>` +
      `</g>`,
    );
  }

  const defs = `
    <clipPath id="${clipId}">
      <rect width="${width}" height="${height}" rx="12"/>
    </clipPath>`;

  const markup = `
    <!-- ── Title star sparkle (${title}) ── -->
    <g clip-path="url(#${clipId})" pointer-events="none">
      ${stars.join("\n      ")}
    </g>`;

  return { defs, markup };
}

export function renderTitleGlow(opts: {
  title?: string | null;
  width: number;
  height: number;
}): { defs: string; markup: string } {
  const { title, width, height } = opts;
  const tc = getTitleColors(title);
  if (!tc) return { defs: "", markup: "" };

  const filterId = "titleGlow";
  const defs = `
    <filter id="${filterId}" x="-10%" y="-10%" width="120%" height="120%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur"/>
      <feColorMatrix in="blur" type="matrix"
        values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.45 0"/>
    </filter>`;

  const markup = `
    <!-- ── Title glow border ── -->
    <rect width="${width}" height="${height}" rx="12" fill="none"
          stroke="${tc.glow}" stroke-width="2" opacity="0.45"
          filter="url(#${filterId})"/>
    <rect width="${width}" height="${height}" rx="12" fill="none"
          stroke="${tc.glow}" stroke-width="1" opacity="0.3">
      <animate attributeName="opacity" values="0.15;0.45;0.15" dur="4s"
               calcMode="spline" keySplines="0.4 0 0.6 1; 0.4 0 0.6 1" keyTimes="0;0.5;1"
               repeatCount="indefinite"/>
    </rect>`;

  return { defs, markup };
}
