import * as THREE from "three";
import type { MeshBVH } from "three-mesh-bvh";

const _ray = new THREE.Ray();
const _v0 = new THREE.Vector3();
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _bary = new THREE.Vector3();

export interface BVHHit {
  point: THREE.Vector3;
  faceIndex: number;
  distance: number;
  /** Barycentric coords of hit relative to face triangle. */
  bary: THREE.Vector3;
}

/**
 * Single-ray cast. Returns null on miss.
 * `ray` is mutated for performance — callers should not retain references.
 */
export function castRay(
  bvh: MeshBVH,
  geometry: THREE.BufferGeometry,
  origin: THREE.Vector3,
  direction: THREE.Vector3,
  maxDist: number,
  side: THREE.Side = THREE.DoubleSide,
): BVHHit | null {
  _ray.origin.copy(origin);
  _ray.direction.copy(direction);
  const hit = bvh.raycastFirst(_ray, side);
  if (!hit) return null;
  if (hit.distance > maxDist) return null;

  // Compute barycentric of hit point relative to the face for downstream
  // attribute interpolation. faceIndex is the triangle index.
  const fi = hit.faceIndex ?? 0;
  const posAttr = geometry.getAttribute("position") as THREE.BufferAttribute;
  // Non-indexed geometries (our merged mesh) store triangle t at vertices 3t, 3t+1, 3t+2.
  const indexAttr = geometry.getIndex();
  let i0: number, i1: number, i2: number;
  if (indexAttr) {
    i0 = indexAttr.getX(fi * 3);
    i1 = indexAttr.getX(fi * 3 + 1);
    i2 = indexAttr.getX(fi * 3 + 2);
  } else {
    i0 = fi * 3;
    i1 = fi * 3 + 1;
    i2 = fi * 3 + 2;
  }
  _v0.fromBufferAttribute(posAttr, i0);
  _v1.fromBufferAttribute(posAttr, i1);
  _v2.fromBufferAttribute(posAttr, i2);
  THREE.Triangle.getBarycoord(hit.point, _v0, _v1, _v2, _bary);

  return {
    point: hit.point,
    faceIndex: fi,
    distance: hit.distance,
    bary: _bary.clone(),
  };
}

/** Lookup the (i0, i1, i2) vertex indices for face `fi` on any geometry. */
export function faceIndices(geometry: THREE.BufferGeometry, fi: number): [number, number, number] {
  const idx = geometry.getIndex();
  if (idx) {
    return [idx.getX(fi * 3), idx.getX(fi * 3 + 1), idx.getX(fi * 3 + 2)];
  }
  return [fi * 3, fi * 3 + 1, fi * 3 + 2];
}

export function interpolateVec3(
  attr: THREE.BufferAttribute,
  i0: number,
  i1: number,
  i2: number,
  b: THREE.Vector3,
  out: THREE.Vector3,
): THREE.Vector3 {
  out.set(
    attr.getX(i0) * b.x + attr.getX(i1) * b.y + attr.getX(i2) * b.z,
    attr.getY(i0) * b.x + attr.getY(i1) * b.y + attr.getY(i2) * b.z,
    attr.getZ(i0) * b.x + attr.getZ(i1) * b.y + attr.getZ(i2) * b.z,
  );
  return out;
}

export function interpolateVec2(
  attr: THREE.BufferAttribute,
  i0: number,
  i1: number,
  i2: number,
  b: THREE.Vector3,
  out: THREE.Vector2,
): THREE.Vector2 {
  out.set(
    attr.getX(i0) * b.x + attr.getX(i1) * b.y + attr.getX(i2) * b.z,
    attr.getY(i0) * b.x + attr.getY(i1) * b.y + attr.getY(i2) * b.z,
  );
  return out;
}

/**
 * Yield to the event loop so React can repaint progress UI between chunks of
 * synchronous baker work. Uses MessageChannel which (unlike setTimeout) is not
 * clamped or throttled, so unfocused/headless tabs still progress quickly.
 */
let _yieldChannel: MessageChannel | null = null;
let _yieldResolver: (() => void) | null = null;
export function yieldEveryMs(): Promise<void> {
  if (!_yieldChannel) {
    _yieldChannel = new MessageChannel();
    _yieldChannel.port1.onmessage = () => {
      const r = _yieldResolver;
      _yieldResolver = null;
      r?.();
    };
  }
  return new Promise<void>((res) => {
    _yieldResolver = res;
    _yieldChannel!.port2.postMessage(0);
  });
}

/** Pack a signed [-1,1] normal vector into RGB8 [0,255]. */
export function packNormal(out: Uint8ClampedArray, off: number, x: number, y: number, z: number) {
  out[off] = Math.max(0, Math.min(255, Math.round((x * 0.5 + 0.5) * 255)));
  out[off + 1] = Math.max(0, Math.min(255, Math.round((y * 0.5 + 0.5) * 255)));
  out[off + 2] = Math.max(0, Math.min(255, Math.round((z * 0.5 + 0.5) * 255)));
  out[off + 3] = 255;
}
