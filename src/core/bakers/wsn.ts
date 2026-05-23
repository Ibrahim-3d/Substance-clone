import * as THREE from "three";
import type { BakedMap, RasterizedSurface } from "../types";
import type { MeshBVH } from "three-mesh-bvh";
import { castRay, faceIndices, interpolateVec3, packNormal, yieldEveryMs } from "./shared";

const _origin = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _hitNormal = new THREE.Vector3();

/**
 * World-space normal bake. For each lowpoly texel: cast a ray from the cage
 * back through the surface toward the highpoly. On hit, interpolate the
 * highpoly's vertex normals at the impact point and store as a world-space
 * normal map.
 */
export async function bakeWSN(
  surface: RasterizedSurface,
  highGeometry: THREE.BufferGeometry,
  highBVH: MeshBVH,
  cageOffset: number,
  maxDist: number,
  onProgress?: (pct: number) => void,
): Promise<BakedMap> {
  const { width, height, position, normal, mask } = surface;
  const out = new Uint8ClampedArray(width * height * 4);
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
    _origin.set(
      position[o] + normal[o] * cageOffset,
      position[o + 1] + normal[o + 1] * cageOffset,
      position[o + 2] + normal[o + 2] * cageOffset,
    );
    _dir.set(-normal[o], -normal[o + 1], -normal[o + 2]);
    let hit = castRay(highBVH, highGeometry, _origin, _dir, maxDist * 2);
    if (!hit) {
      // Inverse pass for concavities.
      _origin.set(
        position[o] - normal[o] * cageOffset,
        position[o + 1] - normal[o + 1] * cageOffset,
        position[o + 2] - normal[o + 2] * cageOffset,
      );
      _dir.set(normal[o], normal[o + 1], normal[o + 2]);
      hit = castRay(highBVH, highGeometry, _origin, _dir, maxDist * 2);
      if (!hit) continue;
    }
    const [ia, ib, ic] = faceIndices(highGeometry, hit.faceIndex);
    interpolateVec3(highNormal, ia, ib, ic, hit.bary, _hitNormal).normalize();
    packNormal(out, o, _hitNormal.x, _hitNormal.y, _hitNormal.z);

    if (onProgress && i >= nextReport) {
      onProgress(i / total);
      nextReport = i + Math.ceil(total / 25);
    }
  }
  onProgress?.(1);
  return { kind: "wsn", width, height, data: out, label: "World Normal" };
}
