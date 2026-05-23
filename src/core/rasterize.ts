import type * as THREE from "three";
import type { RasterizedSurface } from "./types";

/**
 * UV-space rasterization of a lowpoly mesh.
 *
 * For each triangle, walk every pixel in its UV bounding box and — for those
 * inside the UV triangle — store the interpolated world-space attributes.
 * Output buffers are addressable as buf[(y * width + x) * 4 + c].
 *
 * NOTE: Geometry must already be in world space (the loader merges with the
 * world matrix baked in).
 */
export function rasterizeUV(
  geometry: THREE.BufferGeometry,
  resolution: number,
  onProgress?: (pct: number) => void,
): RasterizedSurface {
  const w = resolution;
  const h = resolution;
  const pos = new Float32Array(w * h * 4);
  const nrm = new Float32Array(w * h * 4);
  const tan = new Float32Array(w * h * 4);
  const uv = new Float32Array(w * h * 4);
  const mask = new Uint8Array(w * h);

  const posAttr = geometry.getAttribute("position") as THREE.BufferAttribute;
  const nrmAttr = geometry.getAttribute("normal") as THREE.BufferAttribute;
  const uvAttr = geometry.getAttribute("uv") as THREE.BufferAttribute;
  const tanAttr = geometry.getAttribute("tangent") as THREE.BufferAttribute | undefined;

  const triCount = posAttr.count / 3;
  let nextReport = 0;

  for (let t = 0; t < triCount; t++) {
    const i0 = t * 3;
    const i1 = t * 3 + 1;
    const i2 = t * 3 + 2;

    const u0 = uvAttr.getX(i0);
    const v0 = uvAttr.getY(i0);
    const u1 = uvAttr.getX(i1);
    const v1 = uvAttr.getY(i1);
    const u2 = uvAttr.getX(i2);
    const v2 = uvAttr.getY(i2);

    // Skip degenerate UVs (saves cycles + avoids divide-by-zero).
    const denom = (v1 - v2) * (u0 - u2) + (u2 - u1) * (v0 - v2);
    if (denom === 0) continue;
    const invDenom = 1 / denom;

    // Pixel-space bounds of the UV triangle. UVs are wrapped into the [0,1)
    // tile — anything outside is ignored (we don't currently tile bakes).
    const minU = Math.min(u0, u1, u2);
    const maxU = Math.max(u0, u1, u2);
    const minV = Math.min(v0, v1, v2);
    const maxV = Math.max(v0, v1, v2);

    const minX = Math.max(0, Math.floor(minU * w));
    const maxX = Math.min(w - 1, Math.ceil(maxU * w));
    const minY = Math.max(0, Math.floor(minV * h));
    const maxY = Math.min(h - 1, Math.ceil(maxV * h));

    const px0 = posAttr.getX(i0), py0 = posAttr.getY(i0), pz0 = posAttr.getZ(i0);
    const px1 = posAttr.getX(i1), py1 = posAttr.getY(i1), pz1 = posAttr.getZ(i1);
    const px2 = posAttr.getX(i2), py2 = posAttr.getY(i2), pz2 = posAttr.getZ(i2);

    const nx0 = nrmAttr.getX(i0), ny0 = nrmAttr.getY(i0), nz0 = nrmAttr.getZ(i0);
    const nx1 = nrmAttr.getX(i1), ny1 = nrmAttr.getY(i1), nz1 = nrmAttr.getZ(i1);
    const nx2 = nrmAttr.getX(i2), ny2 = nrmAttr.getY(i2), nz2 = nrmAttr.getZ(i2);

    let tx0 = 1, ty0 = 0, tz0 = 0, ts0 = 1;
    let tx1 = 1, ty1 = 0, tz1 = 0, ts1 = 1;
    let tx2 = 1, ty2 = 0, tz2 = 0, ts2 = 1;
    if (tanAttr) {
      tx0 = tanAttr.getX(i0); ty0 = tanAttr.getY(i0); tz0 = tanAttr.getZ(i0); ts0 = tanAttr.getW(i0);
      tx1 = tanAttr.getX(i1); ty1 = tanAttr.getY(i1); tz1 = tanAttr.getZ(i1); ts1 = tanAttr.getW(i1);
      tx2 = tanAttr.getX(i2); ty2 = tanAttr.getY(i2); tz2 = tanAttr.getZ(i2); ts2 = tanAttr.getW(i2);
    }

    for (let py = minY; py <= maxY; py++) {
      for (let px = minX; px <= maxX; px++) {
        // Sample at pixel center → UV.
        const su = (px + 0.5) / w;
        const sv = (py + 0.5) / h;

        // Barycentric coordinates relative to the UV triangle.
        const b0 = ((v1 - v2) * (su - u2) + (u2 - u1) * (sv - v2)) * invDenom;
        const b1 = ((v2 - v0) * (su - u2) + (u0 - u2) * (sv - v2)) * invDenom;
        const b2 = 1 - b0 - b1;

        // Small epsilon catches edge texels — important for solid coverage at seams.
        const eps = -1e-5;
        if (b0 < eps || b1 < eps || b2 < eps) continue;

        const idx = py * w + px;
        const o4 = idx * 4;

        pos[o4] = b0 * px0 + b1 * px1 + b2 * px2;
        pos[o4 + 1] = b0 * py0 + b1 * py1 + b2 * py2;
        pos[o4 + 2] = b0 * pz0 + b1 * pz1 + b2 * pz2;
        pos[o4 + 3] = 1;

        let nxw = b0 * nx0 + b1 * nx1 + b2 * nx2;
        let nyw = b0 * ny0 + b1 * ny1 + b2 * ny2;
        let nzw = b0 * nz0 + b1 * nz1 + b2 * nz2;
        const nlen = Math.hypot(nxw, nyw, nzw) || 1;
        nxw /= nlen; nyw /= nlen; nzw /= nlen;
        nrm[o4] = nxw; nrm[o4 + 1] = nyw; nrm[o4 + 2] = nzw; nrm[o4 + 3] = 1;

        let txw = b0 * tx0 + b1 * tx1 + b2 * tx2;
        let tyw = b0 * ty0 + b1 * ty1 + b2 * ty2;
        let tzw = b0 * tz0 + b1 * tz1 + b2 * tz2;
        const tlen = Math.hypot(txw, tyw, tzw) || 1;
        txw /= tlen; tyw /= tlen; tzw /= tlen;
        tan[o4] = txw;
        tan[o4 + 1] = tyw;
        tan[o4 + 2] = tzw;
        // Bitangent sign: take the mean and snap to ±1.
        const meanSign = b0 * ts0 + b1 * ts1 + b2 * ts2;
        tan[o4 + 3] = meanSign >= 0 ? 1 : -1;

        uv[o4] = su; uv[o4 + 1] = sv; uv[o4 + 2] = 0; uv[o4 + 3] = 1;
        mask[idx] = 1;
      }
    }

    if (onProgress && t >= nextReport) {
      onProgress(t / triCount);
      nextReport = t + Math.ceil(triCount / 100);
    }
  }

  onProgress?.(1);
  return { width: w, height: h, position: pos, normal: nrm, tangent: tan, uv, mask };
}
