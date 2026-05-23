import * as THREE from "three";
import type { BakedMap, RasterizedSurface } from "../types";
import type { MeshBVH } from "three-mesh-bvh";
import { castRay, faceIndices, interpolateVec2 } from "./shared";

const _origin = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _N = new THREE.Vector3();
const _hitUV = new THREE.Vector2();

/**
 * Extract pixel data from a THREE.Texture by drawing its image to a canvas.
 * Returns null if the image can't be drawn (compressed format, video, etc.).
 */
export function readTexturePixels(
  texture: THREE.Texture,
): { data: Uint8ClampedArray; width: number; height: number } | null {
  const img = texture.image;
  if (!img) return null;
  const w = (img as { width?: number }).width ?? (img as { naturalWidth?: number }).naturalWidth ?? 0;
  const h = (img as { height?: number }).height ?? (img as { naturalHeight?: number }).naturalHeight ?? 0;
  if (!w || !h) return null;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  try {
    ctx.drawImage(img as CanvasImageSource, 0, 0);
  } catch {
    return null;
  }
  const id = ctx.getImageData(0, 0, w, h);
  return { data: id.data, width: w, height: h };
}

function wrap(t: number): number {
  // GL REPEAT semantics.
  const f = t - Math.floor(t);
  return f < 0 ? f + 1 : f;
}

function sampleBilinear(
  pixels: Uint8ClampedArray,
  w: number,
  h: number,
  u: number,
  v: number,
  out: [number, number, number, number],
): void {
  const x = wrap(u) * w - 0.5;
  // Flip V to match texture sampling convention (origin top-left in canvas).
  const y = (1 - wrap(v)) * h - 0.5;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = x0 + 1;
  const y1 = y0 + 1;
  const fx = x - x0;
  const fy = y - y0;

  const cx0 = ((x0 % w) + w) % w;
  const cx1 = ((x1 % w) + w) % w;
  const cy0 = ((y0 % h) + h) % h;
  const cy1 = ((y1 % h) + h) % h;

  const o00 = (cy0 * w + cx0) * 4;
  const o10 = (cy0 * w + cx1) * 4;
  const o01 = (cy1 * w + cx0) * 4;
  const o11 = (cy1 * w + cx1) * 4;

  for (let c = 0; c < 4; c++) {
    const a = pixels[o00 + c] * (1 - fx) + pixels[o10 + c] * fx;
    const b = pixels[o01 + c] * (1 - fx) + pixels[o11 + c] * fx;
    out[c] = a * (1 - fy) + b * fy;
  }
}

/**
 * THE WEDGE: re-project any UV-mapped channel from the highpoly onto the
 * lowpoly's UVs. Pass in whichever source texture the user picked.
 */
export function bakeTransfer(
  surface: RasterizedSurface,
  highGeometry: THREE.BufferGeometry,
  highBVH: MeshBVH,
  source: THREE.Texture,
  cageOffset: number,
  maxDist: number,
  label: string,
  onProgress?: (pct: number) => void,
): BakedMap {
  const { width, height, position, normal, mask } = surface;
  const out = new Uint8ClampedArray(width * height * 4);
  const highUV = highGeometry.getAttribute("uv") as THREE.BufferAttribute | undefined;
  if (!highUV) {
    throw new Error("Highpoly has no UV attribute — cannot transfer textures.");
  }
  const sourcePixels = readTexturePixels(source);
  if (!sourcePixels) {
    throw new Error("Source texture could not be read (unsupported format?)");
  }

  const tmp: [number, number, number, number] = [0, 0, 0, 0];
  let nextReport = 0;
  const total = mask.length;
  for (let i = 0; i < total; i++) {
    if (!mask[i]) continue;
    const o = i * 4;
    _N.set(normal[o], normal[o + 1], normal[o + 2]);
    _origin.set(
      position[o] + _N.x * cageOffset,
      position[o + 1] + _N.y * cageOffset,
      position[o + 2] + _N.z * cageOffset,
    );
    _dir.set(-_N.x, -_N.y, -_N.z);
    let hit = castRay(highBVH, highGeometry, _origin, _dir, maxDist * 2);
    if (!hit) {
      _origin.set(
        position[o] - _N.x * cageOffset,
        position[o + 1] - _N.y * cageOffset,
        position[o + 2] - _N.z * cageOffset,
      );
      _dir.copy(_N);
      hit = castRay(highBVH, highGeometry, _origin, _dir, maxDist * 2);
      if (!hit) continue;
    }
    const [ia, ib, ic] = faceIndices(highGeometry, hit.faceIndex);
    interpolateVec2(highUV, ia, ib, ic, hit.bary, _hitUV);
    sampleBilinear(sourcePixels.data, sourcePixels.width, sourcePixels.height, _hitUV.x, _hitUV.y, tmp);
    out[o] = tmp[0];
    out[o + 1] = tmp[1];
    out[o + 2] = tmp[2];
    out[o + 3] = 255;

    if (onProgress && i >= nextReport) {
      onProgress(i / total);
      nextReport = i + Math.ceil(total / 100);
    }
  }
  onProgress?.(1);
  return { kind: "transfer", width, height, data: out, label: `Transfer (${label})` };
}
