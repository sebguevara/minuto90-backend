import { inflateSync } from 'zlib';
import { logWarn } from '../logging/logger';

export interface TeamColors {
  dark: string;
  light: string;
}

export const FALLBACK_COLORS: TeamColors = {
  dark: '#1a1a2e',
  light: '#e8e8f0',
};

function shadeHex(hex: string, amount: number): string {
  const cleaned = hex.startsWith('#') ? hex.slice(1) : hex;
  const num = parseInt(cleaned, 16);
  const r = Math.min(255, Math.max(0, (num >> 16) + amount));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + amount));
  const b = Math.min(255, Math.max(0, (num & 0xff) + amount));
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

function colorsFromRgb(r: number, g: number, b: number): TeamColors {
  const base = `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
  const isLight = (r * 299 + g * 587 + b * 114) / 1000 > 155;
  return {
    dark: isLight ? shadeHex(base, -60) : base,
    light: isLight ? base : shadeHex(base, 80),
  };
}

// ── PNG filter reconstruction ─────────────────────────────────────────────────

function paethPredictor(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

function reconstructPng(
  raw: Uint8Array,
  width: number,
  height: number,
  channels: number
): Uint8Array {
  const stride = 1 + width * channels;
  const out = new Uint8Array(width * height * channels);

  for (let row = 0; row < height; row++) {
    const filterByte = raw[row * stride];
    const inBase  = row * stride + 1;
    const outBase = row * width * channels;
    const prevBase = (row - 1) * width * channels;

    for (let i = 0; i < width * channels; i++) {
      const raw_val = raw[inBase + i];
      const a = i >= channels ? out[outBase + i - channels] : 0;
      const b = row > 0 ? out[prevBase + i] : 0;
      const c = row > 0 && i >= channels ? out[prevBase + i - channels] : 0;

      let v: number;
      switch (filterByte) {
        case 0: v = raw_val; break;
        case 1: v = (raw_val + a) & 0xff; break;
        case 2: v = (raw_val + b) & 0xff; break;
        case 3: v = (raw_val + Math.floor((a + b) / 2)) & 0xff; break;
        case 4: v = (raw_val + paethPredictor(a, b, c)) & 0xff; break;
        default: v = raw_val;
      }
      out[outBase + i] = v;
    }
  }
  return out;
}

// ── PNG-native color extractor (no canvas needed) ────────────────────────────

function readU32(buf: Uint8Array, off: number): number {
  return ((buf[off] << 24) | (buf[off + 1] << 16) | (buf[off + 2] << 8) | buf[off + 3]) >>> 0;
}

function extractColorsFromPng(bytes: Uint8Array): TeamColors | null {
  // PNG signature
  if (bytes[0] !== 137 || bytes[1] !== 80 || bytes[2] !== 78 || bytes[3] !== 71) return null;

  const width     = readU32(bytes, 16);
  const height    = readU32(bytes, 20);
  const bitDepth  = bytes[24];
  const colorType = bytes[25]; // 2=RGB, 3=indexed, 6=RGBA

  if (bitDepth !== 8) return null;
  if (colorType !== 2 && colorType !== 3 && colorType !== 6) return null;
  if (width === 0 || height === 0) return null;

  const idatParts: Uint8Array[] = [];
  const palR: number[] = [], palG: number[] = [], palB: number[] = [];

  let pos = 8;
  while (pos + 12 <= bytes.length) {
    const len  = readU32(bytes, pos);
    const type = String.fromCharCode(bytes[pos+4], bytes[pos+5], bytes[pos+6], bytes[pos+7]);
    const ds   = pos + 8;

    if (type === 'PLTE') {
      for (let i = 0; i < len / 3; i++) {
        palR.push(bytes[ds + i*3]);
        palG.push(bytes[ds + i*3 + 1]);
        palB.push(bytes[ds + i*3 + 2]);
      }
    } else if (type === 'IDAT') {
      idatParts.push(bytes.subarray(ds, ds + len));
    } else if (type === 'IEND') {
      break;
    }
    pos = ds + len + 4;
  }

  if (!idatParts.length) return null;

  // Concatenate IDAT and decompress
  let totalLen = 0;
  for (const p of idatParts) totalLen += p.length;
  const combined = new Uint8Array(totalLen);
  let off = 0;
  for (const p of idatParts) { combined.set(p, off); off += p.length; }

  let raw: Uint8Array;
  try {
    raw = inflateSync(combined);
  } catch (err) {
    return null;
  }

  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : 1;
  const expected = height * (1 + width * channels);
  if (raw.length < expected) return null;

  // Reconstruct filters → correct pixel values
  const pixels = reconstructPng(raw, width, height, channels);

  // Average non-transparent pixels (sampled)
  let rSum = 0, gSum = 0, bSum = 0, count = 0;
  const rowStep = Math.max(1, Math.floor(height / 16));
  const colStep = Math.max(1, Math.floor(width / 16));

  for (let row = 0; row < height; row += rowStep) {
    for (let col = 0; col < width; col += colStep) {
      const base = (row * width + col) * channels;
      let r: number, g: number, b: number, a: number;

      if (colorType === 2) {
        r = pixels[base]; g = pixels[base+1]; b = pixels[base+2]; a = 255;
      } else if (colorType === 6) {
        r = pixels[base]; g = pixels[base+1]; b = pixels[base+2]; a = pixels[base+3];
      } else {
        const idx = pixels[base];
        r = palR[idx] ?? 0; g = palG[idx] ?? 0; b = palB[idx] ?? 0; a = 255;
      }

      if (a < 32) continue;
      rSum += r; gSum += g; bSum += b; count++;
    }
  }

  if (count === 0) return null;
  return colorsFromRgb(Math.round(rSum / count), Math.round(gSum / count), Math.round(bSum / count));
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function extractTeamColors(logoUrl: string): Promise<TeamColors> {
  if (!logoUrl) return FALLBACK_COLORS;

  try {
    const res = await fetch(logoUrl, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) {
      logWarn('team_colors.extract.fetch_failed', { logoUrl, status: res.status });
      return FALLBACK_COLORS;
    }

    const contentType = res.headers.get('content-type') ?? '';
    const buffer = await res.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    // SVG has no meaningful dominant color
    if (
      contentType.includes('svg') ||
      bytes[0] === 60 // '<' — likely SVG/XML
    ) {
      logWarn('team_colors.extract.svg_skipped', { logoUrl, contentType });
      return FALLBACK_COLORS;
    }

    const colors = extractColorsFromPng(bytes);
    if (colors) return colors;

    logWarn('team_colors.extract.failed', {
      logoUrl,
      contentType,
      byteLength: bytes.length,
      isPng: bytes[0] === 137,
    });
    return FALLBACK_COLORS;
  } catch (err) {
    logWarn('team_colors.extract.error', {
      logoUrl,
      error: err instanceof Error ? err.message : String(err),
    });
    return FALLBACK_COLORS;
  }
}
