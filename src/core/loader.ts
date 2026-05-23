import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { AssetMesh } from "./types";

const gltf = new GLTFLoader();
const obj = new OBJLoader();
const fbx = new FBXLoader();

function findFirstTextureMesh(root: THREE.Object3D): THREE.Mesh | null {
  let candidate: THREE.Mesh | null = null;
  root.traverse((o) => {
    if (!candidate && (o as THREE.Mesh).isMesh) {
      candidate = o as THREE.Mesh;
    }
  });
  return candidate;
}

function gatherMeshes(root: THREE.Object3D): THREE.Mesh[] {
  const out: THREE.Mesh[] = [];
  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) out.push(o as THREE.Mesh);
  });
  return out;
}

function extractSourceTexture(mesh: THREE.Mesh): THREE.Texture | null {
  const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
  if (!mat) return null;
  const standard = mat as THREE.MeshStandardMaterial;
  if (standard.map) return standard.map;
  const basic = mat as THREE.MeshBasicMaterial;
  if (basic.map) return basic.map;
  return null;
}

/**
 * Merge every child mesh into one geometry in world space. We bake the world
 * transform into vertex positions so downstream code doesn't have to chase
 * scene-graph matrices. Returns the merged geometry plus the first encountered
 * material/texture for "transfer source" purposes.
 */
function mergeIntoSingleMesh(root: THREE.Object3D, name: string): AssetMesh {
  root.updateMatrixWorld(true);
  const meshes = gatherMeshes(root);
  if (meshes.length === 0) {
    throw new Error(`No mesh found in ${name}`);
  }

  const geoms: THREE.BufferGeometry[] = [];
  let sourceTexture: THREE.Texture | null = null;
  for (const m of meshes) {
    const g = m.geometry.clone();
    g.applyMatrix4(m.matrixWorld);
    if (!sourceTexture) {
      sourceTexture = extractSourceTexture(m);
    }
    geoms.push(g);
  }

  // Normalize attribute sets — all geometries need the same attributes for merging.
  const need = ["position", "normal", "uv"];
  for (const g of geoms) {
    if (!g.getAttribute("normal")) g.computeVertexNormals();
    if (!g.getAttribute("uv")) {
      const count = g.getAttribute("position").count;
      g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(count * 2), 2));
    }
    // mergeGeometries requires uniform attribute sets; drop extras.
    for (const key of Object.keys(g.attributes)) {
      if (!need.includes(key)) g.deleteAttribute(key);
    }
    // Compute tangents while geometry is still indexed (computeTangents needs it).
    if (!g.getAttribute("tangent") && g.getIndex()) {
      try {
        g.computeTangents();
      } catch {
        /* Fallback to default tangents in rasterizer. */
      }
    }
  }

  // mergeGeometries needs a uniform index state. If any are non-indexed,
  // convert them all to non-indexed; otherwise keep indexed.
  const anyNonIndexed = geoms.some((g) => !g.getIndex());
  let mergeInput = geoms;
  if (anyNonIndexed) {
    mergeInput = geoms.map((g) => (g.getIndex() ? g.toNonIndexed() : g));
  }

  const merged = BufferGeometryUtils.mergeGeometries(mergeInput, false);
  if (!merged) throw new Error(`Could not merge geometries from ${name}`);

  // Downstream rasterizer/bakers walk triangles linearly, so flatten to
  // non-indexed once at the end. Attributes (including tangent) are preserved.
  const finalGeom = merged.getIndex() ? merged.toNonIndexed() : merged;
  if (finalGeom !== merged) merged.dispose();
  finalGeom.computeBoundingBox();

  const material = new THREE.MeshStandardMaterial({
    color: 0xcccccc,
    metalness: 0.1,
    roughness: 0.7,
    map: sourceTexture ?? undefined,
  });
  const mesh = new THREE.Mesh(finalGeom, material);

  return {
    mesh,
    geometry: finalGeom,
    triCount: finalGeom.getAttribute("position").count / 3,
    bbox: finalGeom.boundingBox!.clone(),
    sourceTexture,
    name,
  };
}

export async function loadAssetFromFile(file: File): Promise<AssetMesh> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const ab = await file.arrayBuffer();

  if (ext === "glb" || ext === "gltf") {
    const result = await gltf.parseAsync(ab, "");
    return mergeIntoSingleMesh(result.scene, file.name);
  }
  if (ext === "obj") {
    const text = new TextDecoder().decode(ab);
    const group = obj.parse(text);
    return mergeIntoSingleMesh(group, file.name);
  }
  if (ext === "fbx") {
    const group = fbx.parse(ab, "");
    return mergeIntoSingleMesh(group, file.name);
  }

  throw new Error(`Unsupported file type: .${ext}`);
}
