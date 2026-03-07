export interface ThemeColors {
  bg: string; bgAlt: string; border: string; text: string; muted: string;
  grid: string; accent: string; bullet: string; blitz: string; rapid: string;
  puzzle: string; win: string; loss: string; draw: string; platform: string;
  titleBadgeBg: string; titleBadgeBorder: string; titleBadgeText: string;
}

export const THEMES: Record<string, ThemeColors> = {
  dark: {
    bg: "#0d1117", bgAlt: "#161b22", border: "#30363d", text: "#e6edf3", muted: "#8b949e",
    grid: "#21262d", accent: "#58a6ff", bullet: "#f78166", blitz: "#ffa657", rapid: "#3fb950",
    puzzle: "#a371f7", win: "#3fb950", loss: "#f85149", draw: "#58a6ff", platform: "#21262d",
    titleBadgeBg: "#b7950b22", titleBadgeBorder: "#b7950b", titleBadgeText: "#e3b341",
  },
  light: {
    bg: "#ffffff", bgAlt: "#f6f8fa", border: "#d0d7de", text: "#1f2328", muted: "#656d76",
    grid: "#eaeef2", accent: "#0969da", bullet: "#cf222e", blitz: "#9a6700", rapid: "#1a7f37",
    puzzle: "#8250df", win: "#1a7f37", loss: "#cf222e", draw: "#0969da", platform: "#f6f8fa",
    titleBadgeBg: "#f0e68c44", titleBadgeBorder: "#9a6700", titleBadgeText: "#9a6700",
  },
  monokai: {
    bg: "#272822", bgAlt: "#3e3d32", border: "#75715e", text: "#f8f8f2", muted: "#75715e",
    grid: "#3e3d32", accent: "#66d9e8", bullet: "#f92672", blitz: "#fd971f", rapid: "#a6e22e",
    puzzle: "#ae81ff", win: "#a6e22e", loss: "#f92672", draw: "#66d9e8", platform: "#3e3d32",
    titleBadgeBg: "#fd971f22", titleBadgeBorder: "#fd971f", titleBadgeText: "#fd971f",
  },
  nord: {
    bg: "#2e3440", bgAlt: "#3b4252", border: "#4c566a", text: "#eceff4", muted: "#9099a8",
    grid: "#3b4252", accent: "#88c0d0", bullet: "#bf616a", blitz: "#d08770", rapid: "#a3be8c",
    puzzle: "#b48ead", win: "#a3be8c", loss: "#bf616a", draw: "#88c0d0", platform: "#3b4252",
    titleBadgeBg: "#ebcb8b22", titleBadgeBorder: "#ebcb8b", titleBadgeText: "#ebcb8b",
  },
  solarized: {
    bg: "#002b36", bgAlt: "#073642", border: "#586e75", text: "#fdf6e3", muted: "#657b83",
    grid: "#073642", accent: "#268bd2", bullet: "#dc322f", blitz: "#cb4b16", rapid: "#859900",
    puzzle: "#6c71c4", win: "#859900", loss: "#dc322f", draw: "#268bd2", platform: "#073642",
    titleBadgeBg: "#b5890022", titleBadgeBorder: "#b58900", titleBadgeText: "#b58900",
  },
  dracula: {
    bg: "#282a36", bgAlt: "#44475a", border: "#6272a4", text: "#f8f8f2", muted: "#6272a4",
    grid: "#44475a", accent: "#8be9fd", bullet: "#ff5555", blitz: "#ffb86c", rapid: "#50fa7b",
    puzzle: "#bd93f9", win: "#50fa7b", loss: "#ff5555", draw: "#8be9fd", platform: "#44475a",
    titleBadgeBg: "#f1fa8c22", titleBadgeBorder: "#f1fa8c", titleBadgeText: "#f1fa8c",
  },
};

export const DEFAULT_THEME = "dark";

export function resolveTheme(name?: string) {
  const key = (name ?? DEFAULT_THEME).toLowerCase();
  return {
    name: key in THEMES ? key : DEFAULT_THEME,
    colors: THEMES[key] ?? THEMES[DEFAULT_THEME],
  };
}
