import { FastAverageColor } from 'fast-average-color';

export interface TeamColors {
  dark: string;
  light: string;
}

export const FALLBACK_COLORS: TeamColors = {
  dark: '#1a1a2e',
  light: '#e8e8f0',
};

const fac = new FastAverageColor();

function shadeHex(hex: string, amount: number): string {
  const cleaned = hex.startsWith('#') ? hex.slice(1) : hex;
  const num = parseInt(cleaned, 16);
  const r = Math.min(255, Math.max(0, (num >> 16) + amount));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + amount));
  const b = Math.min(255, Math.max(0, (num & 0xff) + amount));
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

/**
 * Extracts dominant dark + light color pair from a logo URL.
 * Uses fast-average-color + Bun's OffscreenCanvas.
 * Falls back to FALLBACK_COLORS on any error.
 */
export async function extractTeamColors(logoUrl: string): Promise<TeamColors> {
  if (!logoUrl) return FALLBACK_COLORS;

  try {
    const res = await fetch(logoUrl, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return FALLBACK_COLORS;

    const blob = await res.blob();
    const bitmap = await createImageBitmap(blob);

    const size = 32;
    const canvas = new OffscreenCanvas(size, size);
    const ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D | null;
    if (!ctx) {
      bitmap.close();
      return FALLBACK_COLORS;
    }

    ctx.drawImage(bitmap, 0, 0, size, size);
    bitmap.close();

    const { data } = ctx.getImageData(0, 0, size, size);
    const color = fac.getColorFromArray4(data);
    const [r, g, b] = color;
    const base = `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
    const isLight = (r * 299 + g * 587 + b * 114) / 1000 > 155;

    return {
      dark: isLight ? shadeHex(base, -60) : base,
      light: isLight ? base : shadeHex(base, 80),
    };
  } catch {
    return FALLBACK_COLORS;
  }
}
