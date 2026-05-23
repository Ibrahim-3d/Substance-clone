import type { BakedMap } from "../types";

/**
 * Curvature as Sobel of the world-space normal map. Cheap, looks great. Free
 * once WSN is computed. Output is centered at gray (128) with concave dark
 * and convex bright.
 */
export function bakeCurvature(wsn: BakedMap, strength = 4): BakedMap {
  const { width: w, height: h, data: src } = wsn;
  const out = new Uint8ClampedArray(w * h * 4);

  const get = (x: number, y: number, c: number) => {
    const cx = Math.max(0, Math.min(w - 1, x));
    const cy = Math.max(0, Math.min(h - 1, y));
    return src[(cy * w + cx) * 4 + c];
  };

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // Sobel on each normal channel; sum magnitudes for curvature signal.
      let dx = 0;
      let dy = 0;
      for (let c = 0; c < 3; c++) {
        const gx =
          -get(x - 1, y - 1, c) + get(x + 1, y - 1, c)
          - 2 * get(x - 1, y, c) + 2 * get(x + 1, y, c)
          - get(x - 1, y + 1, c) + get(x + 1, y + 1, c);
        const gy =
          -get(x - 1, y - 1, c) - 2 * get(x, y - 1, c) - get(x + 1, y - 1, c)
          + get(x - 1, y + 1, c) + 2 * get(x, y + 1, c) + get(x + 1, y + 1, c);
        dx += gx;
        dy += gy;
      }
      const mag = (dx + dy) * strength / 3 / 8;
      const v = Math.max(0, Math.min(255, 128 + mag));
      const o = (y * w + x) * 4;
      out[o] = v; out[o + 1] = v; out[o + 2] = v; out[o + 3] = 255;
    }
  }
  return { kind: "curvature", width: w, height: h, data: out, label: "Curvature" };
}
