import * as THREE from "three";
import type { BakedMap, RasterizedSurface } from "../types";

/**
 * Position bake. Maps world position into a 0..1 RGB image using the
 * highpoly's bounding box. Useful as a debug/utility map and proves the
 * rasterization pipeline end-to-end (no raycast required).
 */
export function bakePosition(
  surface: RasterizedSurface,
  bbox: THREE.Box3,
): BakedMap {
  const { width, height, position, mask } = surface;
  const out = new Uint8ClampedArray(width * height * 4);
  const size = new THREE.Vector3().subVectors(bbox.max, bbox.min);
  // Avoid div-by-zero for paper-thin axes.
  const sx = size.x || 1;
  const sy = size.y || 1;
  const sz = size.z || 1;

  for (let i = 0; i < mask.length; i++) {
    const o = i * 4;
    if (!mask[i]) {
      out[o] = 0; out[o + 1] = 0; out[o + 2] = 0; out[o + 3] = 0;
      continue;
    }
    const nx = (position[o] - bbox.min.x) / sx;
    const ny = (position[o + 1] - bbox.min.y) / sy;
    const nz = (position[o + 2] - bbox.min.z) / sz;
    out[o] = Math.round(nx * 255);
    out[o + 1] = Math.round(ny * 255);
    out[o + 2] = Math.round(nz * 255);
    out[o + 3] = 255;
  }
  return { kind: "position", width, height, data: out, label: "Position" };
}
