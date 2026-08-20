// Applies a church's chosen accent color to the CSS custom properties that
// drive buttons, links, focus rings, and the sidebar's active-item
// highlight. See src/index.css for the token definitions this overrides.

const PRIMARY_FOREGROUND_LIGHT = "oklch(0.98 0.005 90)";
const PRIMARY_FOREGROUND_DARK = "oklch(0.22 0.02 265)";

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!match) return null;
  return {
    r: parseInt(match[1], 16),
    g: parseInt(match[2], 16),
    b: parseInt(match[3], 16),
  };
}

function relativeLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 1;
  const [r, g, b] = [rgb.r, rgb.g, rgb.b].map((c) => {
    const channel = c / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function foregroundFor(hex: string): string {
  return relativeLuminance(hex) > 0.4 ? PRIMARY_FOREGROUND_DARK : PRIMARY_FOREGROUND_LIGHT;
}

export function applyBrandColor(hex: string) {
  const root = document.documentElement.style;
  const foreground = foregroundFor(hex);

  root.setProperty("--primary", hex);
  root.setProperty("--primary-foreground", foreground);
  root.setProperty("--ring", hex);
  root.setProperty("--sidebar-accent", hex);
  root.setProperty("--sidebar-accent-foreground", foreground);
}
