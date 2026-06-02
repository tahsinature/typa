/**
 * Light-weight image analysis for the inspector popover.
 *
 * - Downsamples to ~128px on the long edge before any per-pixel work.
 * - Computes mean color, a 6-color median-cut palette, and 256-bucket RGB histograms.
 * - Skips fully-transparent pixels so logos with alpha aren't dominated by their background.
 */

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface ImageAnalysis {
  /** Mean color across opaque pixels. */
  average: RGB;
  /** Dominant colors, sorted by approximate frequency (largest bucket first). */
  palette: RGB[];
  /** 256-bucket per-channel histograms. */
  histogram: { r: number[]; g: number[]; b: number[] };
  /** Fraction of pixels with alpha < 8/255. 0..1. */
  alphaFraction: number;
  /** True if the source image has any meaningfully transparent pixels. */
  hasAlpha: boolean;
}

const ANALYSIS_MAX_EDGE = 128;
const PALETTE_SIZE = 6;

function downsample(el: HTMLImageElement, maxEdge: number): ImageData | null {
  const w0 = el.naturalWidth;
  const h0 = el.naturalHeight;
  if (w0 === 0 || h0 === 0) return null;
  const scale = Math.min(1, maxEdge / Math.max(w0, h0));
  const w = Math.max(1, Math.round(w0 * scale));
  const h = Math.max(1, Math.round(h0 * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "medium";
  ctx.drawImage(el, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h);
}

interface Pixel {
  r: number;
  g: number;
  b: number;
}

function medianCut(pixels: Pixel[], target: number): Pixel[][] {
  let buckets: Pixel[][] = [pixels];
  while (buckets.length < target) {
    // Find the bucket with the widest single-channel range.
    let pickIdx = -1;
    let pickChannel: "r" | "g" | "b" = "r";
    let pickRange = -1;
    for (let i = 0; i < buckets.length; i++) {
      const b = buckets[i];
      if (b.length < 2) continue;
      let minR = 255, maxR = 0, minG = 255, maxG = 0, minB = 255, maxB = 0;
      for (const p of b) {
        if (p.r < minR) minR = p.r;
        if (p.r > maxR) maxR = p.r;
        if (p.g < minG) minG = p.g;
        if (p.g > maxG) maxG = p.g;
        if (p.b < minB) minB = p.b;
        if (p.b > maxB) maxB = p.b;
      }
      const rR = maxR - minR;
      const rG = maxG - minG;
      const rB = maxB - minB;
      const m = Math.max(rR, rG, rB);
      if (m > pickRange) {
        pickRange = m;
        pickIdx = i;
        pickChannel = rR === m ? "r" : rG === m ? "g" : "b";
      }
    }
    if (pickIdx === -1) break;
    const target = buckets[pickIdx]
      .slice()
      .sort((a, b) => a[pickChannel] - b[pickChannel]);
    const mid = Math.floor(target.length / 2);
    buckets.splice(pickIdx, 1, target.slice(0, mid), target.slice(mid));
  }
  return buckets;
}

function averageBucket(bucket: Pixel[]): Pixel {
  let r = 0, g = 0, b = 0;
  for (const p of bucket) { r += p.r; g += p.g; b += p.b; }
  const n = Math.max(1, bucket.length);
  return { r: Math.round(r / n), g: Math.round(g / n), b: Math.round(b / n) };
}

export function analyzeImage(el: HTMLImageElement): ImageAnalysis | null {
  const data = downsample(el, ANALYSIS_MAX_EDGE);
  if (!data) return null;
  const bytes = data.data;

  const pixels: Pixel[] = [];
  const histR = new Array(256).fill(0);
  const histG = new Array(256).fill(0);
  const histB = new Array(256).fill(0);
  let sumR = 0, sumG = 0, sumB = 0;
  let opaque = 0;
  let transparent = 0;

  for (let i = 0; i < bytes.length; i += 4) {
    const a = bytes[i + 3];
    if (a < 8) { transparent++; continue; }
    const r = bytes[i];
    const g = bytes[i + 1];
    const b = bytes[i + 2];
    pixels.push({ r, g, b });
    histR[r]++;
    histG[g]++;
    histB[b]++;
    sumR += r;
    sumG += g;
    sumB += b;
    opaque++;
  }

  if (opaque === 0) {
    return {
      average: { r: 0, g: 0, b: 0 },
      palette: [],
      histogram: { r: histR, g: histG, b: histB },
      alphaFraction: 1,
      hasAlpha: true,
    };
  }

  const average: RGB = {
    r: Math.round(sumR / opaque),
    g: Math.round(sumG / opaque),
    b: Math.round(sumB / opaque),
  };

  const buckets = medianCut(pixels, PALETTE_SIZE);
  // Sort by bucket size descending so dominant colors come first.
  buckets.sort((a, b) => b.length - a.length);
  const palette = buckets.map(averageBucket);

  const total = opaque + transparent;
  return {
    average,
    palette,
    histogram: { r: histR, g: histG, b: histB },
    alphaFraction: transparent / total,
    hasAlpha: transparent > 0,
  };
}
