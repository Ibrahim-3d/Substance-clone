import * as THREE from "three";
import type { AssetMesh, BakeSettings, BakedMap, BakeProgress, MapKind } from "./types";
import { rasterizeUV } from "./rasterize";
import { buildBVH } from "./bvh";
import { dilate } from "./dilate";
import { bakePosition } from "./bakers/position";
import { bakeWSN } from "./bakers/wsn";
import { bakeNormal } from "./bakers/normal";
import { bakeAO } from "./bakers/ao";
import { bakeTransfer } from "./bakers/transfer";
import { bakeCurvature } from "./bakers/curvature";

export interface BakeInputs {
  lowpoly: AssetMesh;
  highpoly: AssetMesh;
  settings: BakeSettings;
  /** Optional custom source texture override for the transfer baker. */
  transferSource?: THREE.Texture;
}

function suggestMaxRayDist(low: AssetMesh, high: AssetMesh): number {
  const combined = low.bbox.clone().union(high.bbox);
  const size = new THREE.Vector3();
  combined.getSize(size);
  return Math.max(size.x, size.y, size.z) || 1;
}

/** Sane cage offset default — roughly 2% of the bbox diagonal. */
export function suggestCageOffset(low: AssetMesh, high: AssetMesh): number {
  const combined = low.bbox.clone().union(high.bbox);
  const size = new THREE.Vector3();
  combined.getSize(size);
  return Math.max(0.001, size.length() * 0.02);
}

export async function runBake(
  inputs: BakeInputs,
  onProgress: (p: BakeProgress) => void,
): Promise<BakedMap[]> {
  const { lowpoly, highpoly, settings, transferSource } = inputs;
  const resolution = settings.resolution;
  const enabled = settings.enabled;

  const maxDist = settings.maxRayDist || suggestMaxRayDist(lowpoly, highpoly);
  const aoDist = settings.aoMaxDist || maxDist * 0.5;

  // 1. Rasterize lowpoly UV space.
  onProgress({ kind: "rasterize", pct: 0, message: "Rasterizing lowpoly UVs…" });
  const surface = rasterizeUV(lowpoly.geometry, resolution, (p) =>
    onProgress({ kind: "rasterize", pct: p }),
  );
  await tick();

  // 2. Build BVH on highpoly.
  onProgress({ kind: "rasterize", pct: 1, message: "Building highpoly BVH…" });
  await tick();
  const bvh = buildBVH(highpoly.geometry);

  const outputs: BakedMap[] = [];
  const padding = settings.dilatePadding;

  const order: MapKind[] = ["position", "wsn", "normal", "ao", "transfer", "curvature"];

  // Curvature depends on WSN; run-order keeps it last.
  let wsnMap: BakedMap | null = null;
  for (const kind of order) {
    if (!enabled[kind]) continue;
    if (kind === "curvature" && !wsnMap) {
      // Need WSN to derive curvature — silently bake one even if not requested.
      onProgress({ kind: "wsn", pct: 0, message: "Baking WSN (for curvature)…" });
      wsnMap = await bakeWSN(surface, highpoly.geometry, bvh, settings.cageOffset, maxDist, (p) =>
        onProgress({ kind: "wsn", pct: p }),
      );
      dilate(wsnMap.data, surface.mask, surface.width, surface.height, padding);
      await tick();
    }

    onProgress({ kind, pct: 0, message: `Baking ${kind}…` });
    await tick();
    let map: BakedMap | null = null;
    switch (kind) {
      case "position":
        map = bakePosition(surface, highpoly.bbox);
        break;
      case "wsn":
        if (!wsnMap) {
          wsnMap = await bakeWSN(surface, highpoly.geometry, bvh, settings.cageOffset, maxDist, (p) =>
            onProgress({ kind, pct: p }),
          );
        }
        map = wsnMap;
        break;
      case "normal":
        map = await bakeNormal(surface, highpoly.geometry, bvh, settings.cageOffset, maxDist, (p) =>
          onProgress({ kind, pct: p }),
        );
        break;
      case "ao":
        map = await bakeAO(
          surface,
          highpoly.geometry,
          bvh,
          settings.cageOffset,
          maxDist,
          settings.aoSamples,
          aoDist,
          settings.aoSpread,
          (p) => onProgress({ kind, pct: p }),
        );
        break;
      case "transfer": {
        const src = transferSource ?? highpoly.sourceTexture;
        if (!src) {
          throw new Error("Transfer bake requires a source texture on the highpoly.");
        }
        map = await bakeTransfer(
          surface,
          highpoly.geometry,
          bvh,
          src,
          settings.cageOffset,
          maxDist,
          settings.transferChannel,
          (p) => onProgress({ kind, pct: p }),
        );
        break;
      }
      case "curvature":
        if (!wsnMap) throw new Error("WSN required for curvature");
        map = bakeCurvature(wsnMap);
        break;
    }
    if (map) {
      dilate(map.data, surface.mask, surface.width, surface.height, padding);
      outputs.push(map);
    }
    await tick();
  }

  onProgress({ kind: "done", pct: 1, message: "Done" });
  return outputs;
}

/** Yield to the event loop so progress UI repaints. */
function tick(): Promise<void> {
  return new Promise((res) => setTimeout(res, 0));
}
