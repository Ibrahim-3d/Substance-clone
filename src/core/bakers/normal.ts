import * as THREE from "three";
import type { BakedMap, RasterizedSurface } from "../types";
import type { MeshBVH } from "three-mesh-bvh";
import { castRay, faceIndices, interpolateVec3, packNormal, yieldEveryMs } from "./shared";

const _origin = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _hitNormal = new THREE.Vector3();
const _T = new THREE.Vector3();
const _B = new THREE.Vector3();
const _N = new THREE.Vector3();

/**
 * Tangent-space normal map bake. The bake takes the highpoly's interpolated
 * world-space normal at the hit point and transforms it into the lowpoly's
 * tangent basis at the originating texel.
 *
 * Correctness hinges on the lowpoly tangents (mikktspace ideally). v0.1 uses
 * three.js's built-in tangents which are acceptable for most assets.
 */
export async function bakeNormal(
  surface: RasterizedSurface,
  highGeometry: THREE.BufferGeometry,
  highBVH: MeshBVH,
  cageOffset: number,
  maxDist: number,
  onProgress?: (pct: number) => void,
): Promise<BakedMap> {
  const { width, height, position, normal, tangent, mask } = surface;
  const out = new Uint8ClampedArray(width * height * 4);
  // Default neutral normal for unfilled pixels — 0.5,0.5,1.0 in [0,1] = (0,0,1).
  for (let i = 0; i < width * height; i++) {
    const o = i * 4;
    out[o] = 128; out[o + 1] = 128; out[o + 2] = 255; out[o + 3] = 0;
  }
  const highNormal = highGeometry.getAttribute("normal") as THREE.BufferAttribute;

  let nextReport = 0;
  const total = mask.length;
  let lastYield = performance.now();
  for (let i = 0; i < total; i++) {
    if (!mask[i]) continue;
    if (i % 8192 === 0 && performance.now() - lastYield > 200) {
      await yieldEveryMs();
      lastYield = performance.now();
    }
    const o = i * 4;

    _N.set(normal[o], normal[o + 1], normal[o + 2]);
    _origin.set(
      position[o] + _N.x * cageOffset,
      position[o + 1] + _N.y * cageOffset,
      position[o + 2] + _N.z * cageOffset,
    );
    _dir.copy(_N).multiplyScalar(-1);

    let hit = castRay(highBVH, highGeometry, _origin, _dir, maxDist * 2);
    if (!hit) {
      _origin.set(
        position[o] - _N.x * cageOffset,
        position[o + 1] - _N.y * cageOffset,
        position[o + 2] - _N.z * cageOffset,
      );
      _dir.copy(_N);
      hit = castRay(highBVH, highGeometry, _origin, _dir, maxDist * 2);
      if (!hit) {
        // Leave as default neutral normal.
        out[o + 3] = 255;
        continue;
      }
    }
    const [ia, ib, ic] = faceIndices(highGeometry, hit.faceIndex);
    interpolateVec3(highNormal, ia, ib, ic, hit.bary, _hitNormal).normalize();

    // Lowpoly tangent basis at this texel.
    _T.set(tangent[o], tangent[o + 1], tangent[o + 2]);
    const sign = tangent[o + 3] || 1;
    _B.crossVectors(_N, _T).multiplyScalar(sign);

    const nx = _hitNormal.dot(_T);
    const ny = _hitNormal.dot(_B);
    const nz = _hitNormal.dot(_N);
    packNormal(out, o, nx, ny, nz);

    if (onProgress && i >= nextReport) {
      onProgress(i / total);
      nextReport = i + Math.ceil(total / 25);
    }
  }
  onProgress?.(1);
  return { kind: "normal", width, height, data: out, label: "Normal" };
}
