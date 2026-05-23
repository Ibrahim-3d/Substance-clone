import type * as THREE from "three";

export type MapKind =
  | "position"
  | "normal"
  | "wsn"
  | "ao"
  | "curvature"
  | "transfer";

export interface AssetMesh {
  mesh: THREE.Mesh;
  geometry: THREE.BufferGeometry;
  /** Triangle-count for diagnostics. */
  triCount: number;
  /** Bounding box for cage/scale heuristics. */
  bbox: THREE.Box3;
  /** Optional source texture for transfer bakes. */
  sourceTexture: THREE.Texture | null;
  /** File name shown in UI. */
  name: string;
}

export interface RasterizedSurface {
  width: number;
  height: number;
  /** RGBA32F — xyz = world position, w = mask (1 if covered). */
  position: Float32Array;
  /** RGBA32F — xyz = world normal, w = mask. */
  normal: Float32Array;
  /** RGBA32F — xyz = world tangent, w = bitangent sign. */
  tangent: Float32Array;
  /** RGBA32F — xy = highpoly UV proxy unused for lowpoly; here we store *lowpoly* UV for debug. */
  uv: Float32Array;
  /** Per-pixel mask Uint8 — 1 if pixel is on UV island. */
  mask: Uint8Array;
}

export interface BakeSettings {
  resolution: 512 | 1024 | 2048 | 4096;
  cageOffset: number;
  maxRayDist: number;
  aoSamples: number;
  aoMaxDist: number;
  aoSpread: number;
  transferChannel: "albedo" | "roughness" | "metallic" | "opacity" | "custom";
  dilatePadding: number;
  enabled: Record<MapKind, boolean>;
}

export interface BakedMap {
  kind: MapKind;
  width: number;
  height: number;
  /** RGBA8 image data ready for canvas/PNG export. */
  data: Uint8ClampedArray;
  /** Display label. */
  label: string;
}

export interface BakeProgress {
  kind: MapKind | "rasterize" | "done";
  pct: number;
  message?: string;
}
