import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import type { AssetMesh, BakedMap } from "./types";
import { triggerDownload } from "./export";

function bakedToTexture(map: BakedMap): THREE.DataTexture {
  // Three's DataTexture takes Uint8Array; ImageData uses Uint8ClampedArray.
  // Buffer-share is safe here since we own the bake data.
  const buf = new Uint8Array(map.data.buffer as ArrayBuffer, map.data.byteOffset, map.data.byteLength);
  const tex = new THREE.DataTexture(buf, map.width, map.height, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.needsUpdate = true;
  tex.flipY = true; // ImageData is top-left origin; GL textures are bottom-left.
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Build a lowpoly mesh wired up with the baked maps and export as binary GLB.
 * The transfer map (if present) becomes the base color; normal/ao/curvature
 * get attached to the right material slots when applicable.
 */
export async function exportPackedGLB(lowpoly: AssetMesh, maps: BakedMap[]): Promise<void> {
  const material = new THREE.MeshStandardMaterial({ color: 0xffffff });
  const byKind = new Map(maps.map((m) => [m.kind, m]));

  const transfer = byKind.get("transfer");
  if (transfer) material.map = bakedToTexture(transfer);

  const normal = byKind.get("normal");
  if (normal) {
    const t = bakedToTexture(normal);
    t.colorSpace = THREE.NoColorSpace;
    material.normalMap = t;
  }

  const ao = byKind.get("ao");
  if (ao) {
    const t = bakedToTexture(ao);
    t.colorSpace = THREE.NoColorSpace;
    material.aoMap = t;
  }

  // GLTF requires uv2 for aoMap; reuse uv0 if not present.
  const geom = lowpoly.geometry.clone();
  if (!geom.getAttribute("uv2") && geom.getAttribute("uv")) {
    geom.setAttribute("uv2", geom.getAttribute("uv"));
  }
  const exportMesh = new THREE.Mesh(geom, material);

  const exporter = new GLTFExporter();
  const result = await exporter.parseAsync(exportMesh, { binary: true });
  const blob = result instanceof ArrayBuffer
    ? new Blob([result], { type: "model/gltf-binary" })
    : new Blob([JSON.stringify(result)], { type: "model/gltf+json" });
  triggerDownload(blob, "baked.glb");
}
