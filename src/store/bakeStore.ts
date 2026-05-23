import { create } from "zustand";
import * as THREE from "three";
import type { AssetMesh, BakeProgress, BakeSettings, BakedMap, MapKind } from "../core/types";
import { suggestCageOffset } from "../core/bake";

const defaultEnabled: Record<MapKind, boolean> = {
  position: false,
  normal: true,
  wsn: false,
  ao: true,
  curvature: true,
  transfer: true,
};

export interface BakeStore {
  lowpoly: AssetMesh | null;
  highpoly: AssetMesh | null;
  /** Optional override texture for the transfer baker. */
  transferSource: THREE.Texture | null;
  transferSourceName: string | null;

  maps: BakedMap[];
  baking: boolean;
  progress: BakeProgress | null;
  error: string | null;

  settings: BakeSettings;

  showCage: boolean;
  showHighpoly: boolean;
  applyBakedPreview: boolean;
  selectedMap: MapKind | null;

  cageUserModified: boolean;
  setLowpoly: (m: AssetMesh | null) => void;
  setHighpoly: (m: AssetMesh | null) => void;
  setTransferSource: (tex: THREE.Texture | null, name: string | null) => void;
  setSettings: (patch: Partial<BakeSettings>) => void;
  setEnabled: (kind: MapKind, on: boolean) => void;
  setMaps: (maps: BakedMap[]) => void;
  setBaking: (b: boolean) => void;
  setProgress: (p: BakeProgress | null) => void;
  setError: (e: string | null) => void;
  setShowCage: (b: boolean) => void;
  setShowHighpoly: (b: boolean) => void;
  setApplyBakedPreview: (b: boolean) => void;
  setSelectedMap: (k: MapKind | null) => void;
}

export const useBakeStore = create<BakeStore>((set) => ({
  lowpoly: null,
  highpoly: null,
  transferSource: null,
  transferSourceName: null,
  maps: [],
  baking: false,
  progress: null,
  error: null,
  settings: {
    resolution: 1024,
    cageOffset: 0.05,
    maxRayDist: 0,
    aoSamples: 16,
    aoMaxDist: 0,
    aoSpread: 1,
    transferChannel: "albedo",
    dilatePadding: 4,
    enabled: { ...defaultEnabled },
  },
  showCage: false,
  showHighpoly: false,
  applyBakedPreview: true,
  selectedMap: null,
  cageUserModified: false,

  setLowpoly: (m) =>
    set((s) => {
      const next: Partial<BakeStore> = { lowpoly: m };
      if (m && s.highpoly && !s.cageUserModified) {
        next.settings = { ...s.settings, cageOffset: suggestCageOffset(m, s.highpoly) };
      }
      return next as BakeStore;
    }),
  setHighpoly: (m) =>
    set((s) => {
      const next: Partial<BakeStore> = { highpoly: m };
      if (m && s.lowpoly && !s.cageUserModified) {
        next.settings = { ...s.settings, cageOffset: suggestCageOffset(s.lowpoly, m) };
      }
      return next as BakeStore;
    }),
  setTransferSource: (tex, name) => set({ transferSource: tex, transferSourceName: name }),
  setSettings: (patch) =>
    set((s) => ({
      settings: { ...s.settings, ...patch },
      cageUserModified: patch.cageOffset !== undefined ? true : s.cageUserModified,
    })),
  setEnabled: (kind, on) =>
    set((s) => ({
      settings: { ...s.settings, enabled: { ...s.settings.enabled, [kind]: on } },
    })),
  setMaps: (maps) => set({ maps, selectedMap: maps[0]?.kind ?? null }),
  setBaking: (baking) => set({ baking }),
  setProgress: (progress) => set({ progress }),
  setError: (error) => set({ error }),
  setShowCage: (showCage) => set({ showCage }),
  setShowHighpoly: (showHighpoly) => set({ showHighpoly }),
  setApplyBakedPreview: (applyBakedPreview) => set({ applyBakedPreview }),
  setSelectedMap: (selectedMap) => set({ selectedMap }),
}));
