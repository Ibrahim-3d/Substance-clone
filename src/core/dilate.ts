/**
 * UV-island padding (edge bleed). For every empty texel within `radius` of a
 * filled texel, copy the nearest filled value out — this prevents black seams
 * when the GPU samples across UV-island borders with bilinear filtering.
 *
 * Operates in-place on `data` (RGBA8). `mask[idx] === 1` means filled.
 */
export function dilate(
  data: Uint8ClampedArray,
  mask: Uint8Array,
  width: number,
  height: number,
  radius: number,
): void {
  if (radius <= 0) return;
  const w = width;
  const h = height;
  let current = new Uint8Array(mask);
  let next = new Uint8Array(mask.length);

  for (let pass = 0; pass < radius; pass++) {
    next.set(current);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        if (current[idx]) continue;
        let r = 0, g = 0, b = 0, a = 0, n = 0;
        for (let dy = -1; dy <= 1; dy++) {
          const ny = y + dy;
          if (ny < 0 || ny >= h) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx;
            if (nx < 0 || nx >= w) continue;
            const nidx = ny * w + nx;
            if (!current[nidx]) continue;
            const o = nidx * 4;
            r += data[o];
            g += data[o + 1];
            b += data[o + 2];
            a += data[o + 3];
            n++;
          }
        }
        if (n > 0) {
          const o = idx * 4;
          data[o] = r / n;
          data[o + 1] = g / n;
          data[o + 2] = b / n;
          data[o + 3] = a / n;
          next[idx] = 1;
        }
      }
    }
    [current, next] = [next, current];
  }
}
