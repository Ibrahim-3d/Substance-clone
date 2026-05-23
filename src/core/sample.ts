import * as THREE from "three";
import type { AssetMesh } from "./types";

function makeProceduralTexture(size = 512): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d")!;
  // Gradient base.
  const g = ctx.createLinearGradient(0, 0, size, size);
  g.addColorStop(0, "#fde047");
  g.addColorStop(0.5, "#f97316");
  g.addColorStop(1, "#7c2d12");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  // Grid overlay so the transfer is visually obvious.
  ctx.globalAlpha = 0.5;
  ctx.strokeStyle = "#18181b";
  ctx.lineWidth = 2;
  const step = size / 16;
  for (let i = 0; i <= 16; i++) {
    ctx.beginPath();
    ctx.moveTo(i * step, 0);
    ctx.lineTo(i * step, size);
    ctx.moveTo(0, i * step);
    ctx.lineTo(size, i * step);
    ctx.stroke();
  }

  // Letter watermark — proves transfer fidelity.
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#0a0a0c";
  ctx.font = "bold 84px ui-sans-serif, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("BAKE", size / 2, size / 2);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function bboxOf(geom: THREE.BufferGeometry): THREE.Box3 {
  geom.computeBoundingBox();
  return geom.boundingBox!.clone();
}

function pseudoNoise(x: number, y: number, z: number): number {
  // Cheap deterministic noise, plenty for a demo highpoly.
  const s =
    Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453;
  return s - Math.floor(s);
}

function displace(
  geometry: THREE.BufferGeometry,
  strength: number,
  freq: number,
): void {
  const pos = geometry.getAttribute("position") as THREE.BufferAttribute;
  const nrm = geometry.getAttribute("normal") as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const n =
      pseudoNoise(x * freq, y * freq, z * freq) * 0.6 +
      pseudoNoise(x * freq * 3, y * freq * 3, z * freq * 3) * 0.3 +
      pseudoNoise(x * freq * 9, y * freq * 9, z * freq * 9) * 0.1;
    const d = (n - 0.5) * strength;
    pos.setXYZ(
      i,
      x + nrm.getX(i) * d,
      y + nrm.getY(i) * d,
      z + nrm.getZ(i) * d,
    );
  }
  pos.needsUpdate = true;
  geometry.computeVertexNormals();
}

export function buildSampleAssets(): {
  lowpoly: AssetMesh;
  highpoly: AssetMesh;
} {
  // Lowpoly: chunky sphere. Compute tangents while still indexed, then flatten.
  const lowGeom = new THREE.SphereGeometry(1, 24, 16);
  lowGeom.computeVertexNormals();
  try {
    lowGeom.computeTangents();
  } catch {
    /* fallback in rasterizer */
  }
  const lowNonIdx = lowGeom.toNonIndexed();
  lowGeom.dispose();

  const lowMat = new THREE.MeshStandardMaterial({ color: 0xd4d4d8, roughness: 0.7 });
  const lowMesh = new THREE.Mesh(lowNonIdx, lowMat);

  // Highpoly: dense sphere with displacement + a textured material.
  const highGeom = new THREE.SphereGeometry(1, 256, 128);
  highGeom.computeVertexNormals();
  displace(highGeom, 0.08, 6);
  const highNonIdx = highGeom.toNonIndexed();
  highGeom.dispose();

  const tex = makeProceduralTexture(512);
  const highMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 });
  const highMesh = new THREE.Mesh(highNonIdx, highMat);

  return {
    lowpoly: {
      mesh: lowMesh,
      geometry: lowNonIdx,
      triCount: lowNonIdx.getAttribute("position").count / 3,
      bbox: bboxOf(lowNonIdx),
      sourceTexture: null,
      name: "sample-lowpoly.sphere",
    },
    highpoly: {
      mesh: highMesh,
      geometry: highNonIdx,
      triCount: highNonIdx.getAttribute("position").count / 3,
      bbox: bboxOf(highNonIdx),
      sourceTexture: tex,
      name: "sample-highpoly.bumpy-sphere",
    },
  };
}
