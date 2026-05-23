import * as THREE from "three";
import {
  MeshBVH,
  acceleratedRaycast,
  computeBoundsTree,
  disposeBoundsTree,
} from "three-mesh-bvh";

// Register accelerated raycast on Mesh prototype.
(THREE.Mesh.prototype as unknown as { raycast: typeof acceleratedRaycast }).raycast =
  acceleratedRaycast;
(THREE.BufferGeometry.prototype as unknown as { computeBoundsTree: typeof computeBoundsTree }).computeBoundsTree =
  computeBoundsTree;
(THREE.BufferGeometry.prototype as unknown as { disposeBoundsTree: typeof disposeBoundsTree }).disposeBoundsTree =
  disposeBoundsTree;

export function buildBVH(geometry: THREE.BufferGeometry): MeshBVH {
  const bvh = new MeshBVH(geometry, {
    strategy: 0, // CENTER — fast build, good enough for our cases.
    maxLeafTris: 10,
  });
  (geometry as unknown as { boundsTree: MeshBVH }).boundsTree = bvh;
  return bvh;
}

export { MeshBVH };
