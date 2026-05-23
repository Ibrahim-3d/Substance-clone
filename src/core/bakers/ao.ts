import * as THREE from "three";
import type { BakedMap, RasterizedSurface } from "../types";
import type { MeshBVH } from "three-mesh-bvh";
import { castRay } from "./shared";

const _origin = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _T = new THREE.Vector3();
const _B = new THREE.Vector3();
const _N = new THREE.Vector3();

/**
 * Deterministic Hammersley low-discrepancy sequence — gives clean AO without
 * stochastic noise at low sample counts.
 */
function hammersley(i: number, n: number): [number, number] {
  let bits = (i << 16) | (i >>> 16);
  bits = ((bits & 0x55555555) << 1) | ((bits & 0xaaaaaaaa) >>> 1);
  bits = ((bits & 0x33333333) << 2) | ((bits & 0xcccccccc) >>> 2);
  bits = ((bits & 0x0f0f0f0f) << 4) | ((bits & 0xf0f0f0f0) >>> 4);
  bits = ((bits & 0x00ff00ff) << 8) | ((bits & 0xff00ff00) >>> 8);
  const radical = (bits >>> 0) * 2.3283064365386963e-10;
  return [i / n, radical];
}

/** Cosine-weighted hemisphere sample from a 2D uniform. */
function cosineHemisphere(u: number, v: number, out: THREE.Vector3) {
  const r = Math.sqrt(u);
  const theta = 2 * Math.PI * v;
  out.x = r * Math.cos(theta);
  out.y = r * Math.sin(theta);
  out.z = Math.sqrt(Math.max(0, 1 - u));
  return out;
}

/**
 * Ambient occlusion bake. Per texel, cast `samples` cosine-weighted rays from
 * the highpoly hit point into the hemisphere around the lowpoly normal. AO =
 * fraction of rays blocked within `aoMaxDist`.
 *
 * `spread` lerps the basis from pure-tangent (1) toward pure-up (0) to soften
 * AO contact — matches the "spread" slider in xNormal/Marmoset.
 */
export function bakeAO(
  surface: RasterizedSurface,
  highGeometry: THREE.BufferGeometry,
  highBVH: MeshBVH,
  cageOffset: number,
  maxDist: number,
  samples: number,
  aoMaxDist: number,
  _spread: number,
  onProgress?: (pct: number) => void,
): BakedMap {
  const { width, height, position, normal, tangent, mask } = surface;
  const out = new Uint8ClampedArray(width * height * 4);
  // Pre-compute sample directions in tangent-up space.
  const sampleDirs: Float32Array = new Float32Array(samples * 3);
  const tmp = new THREE.Vector3();
  for (let s = 0; s < samples; s++) {
    const [u, v] = hammersley(s, samples);
    cosineHemisphere(u, v, tmp);
    sampleDirs[s * 3] = tmp.x;
    sampleDirs[s * 3 + 1] = tmp.y;
    sampleDirs[s * 3 + 2] = tmp.z;
  }

  // Slight bias to skip self-intersections at the surface.
  const epsilon = aoMaxDist * 1e-4 + 1e-5;

  let nextReport = 0;
  const total = mask.length;
  for (let i = 0; i < total; i++) {
    if (!mask[i]) continue;
    const o = i * 4;
    _N.set(normal[o], normal[o + 1], normal[o + 2]);
    _T.set(tangent[o], tangent[o + 1], tangent[o + 2]);
    const sign = tangent[o + 3] || 1;
    _B.crossVectors(_N, _T).multiplyScalar(sign);

    // First: hit the highpoly to choose the AO origin (so AO is measured on
    // the *highpoly* surface, like SP/Marmoset). Fallback to lowpoly position.
    let ox = position[o];
    let oy = position[o + 1];
    let oz = position[o + 2];
    _origin.set(ox + _N.x * cageOffset, oy + _N.y * cageOffset, oz + _N.z * cageOffset);
    _dir.set(-_N.x, -_N.y, -_N.z);
    const hit = castRay(highBVH, highGeometry, _origin, _dir, maxDist * 2);
    if (hit) {
      ox = hit.point.x;
      oy = hit.point.y;
      oz = hit.point.z;
    }

    let blocked = 0;
    for (let s = 0; s < samples; s++) {
      const dx = sampleDirs[s * 3];
      const dy = sampleDirs[s * 3 + 1];
      const dz = sampleDirs[s * 3 + 2];
      // Transform from tangent-up to world space.
      const wx = _T.x * dx + _B.x * dy + _N.x * dz;
      const wy = _T.y * dx + _B.y * dy + _N.y * dz;
      const wz = _T.z * dx + _B.z * dy + _N.z * dz;

      _origin.set(ox + _N.x * epsilon, oy + _N.y * epsilon, oz + _N.z * epsilon);
      _dir.set(wx, wy, wz);
      const aoHit = castRay(highBVH, highGeometry, _origin, _dir, aoMaxDist);
      if (aoHit) blocked++;
    }
    const visibility = 1 - blocked / samples;
    const v = Math.round(visibility * 255);
    out[o] = v; out[o + 1] = v; out[o + 2] = v; out[o + 3] = 255;

    if (onProgress && i >= nextReport) {
      onProgress(i / total);
      nextReport = i + Math.ceil(total / 100);
    }
  }
  onProgress?.(1);
  return { kind: "ao", width, height, data: out, label: "AO" };
}
