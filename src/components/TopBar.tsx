import { useState } from "react";
import { useBakeStore } from "../store/bakeStore";
import { buildSampleAssets } from "../core/sample";
import { get, set } from "idb-keyval";

const PROJECT_KEY = "bakestack:last-project";

export function TopBar() {
  const store = useBakeStore();
  const [helpOpen, setHelpOpen] = useState(false);

  const loadSample = () => {
    const { lowpoly, highpoly } = buildSampleAssets();
    store.setLowpoly(lowpoly);
    store.setHighpoly(highpoly);
    store.setError(null);
  };

  const saveProject = async () => {
    try {
      await set(PROJECT_KEY, {
        settings: store.settings,
        showCage: store.showCage,
        showHighpoly: store.showHighpoly,
        applyBakedPreview: store.applyBakedPreview,
      });
    } catch (e) {
      store.setError(e instanceof Error ? e.message : "Save failed");
    }
  };

  const loadProject = async () => {
    try {
      const data = (await get(PROJECT_KEY)) as
        | { settings: typeof store.settings; showCage: boolean; showHighpoly: boolean; applyBakedPreview: boolean }
        | undefined;
      if (!data) {
        store.setError("No saved project found.");
        return;
      }
      store.setSettings(data.settings);
      store.setShowCage(data.showCage);
      store.setShowHighpoly(data.showHighpoly);
      store.setApplyBakedPreview(data.applyBakedPreview);
    } catch (e) {
      store.setError(e instanceof Error ? e.message : "Load failed");
    }
  };

  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-zinc-800 bg-zinc-950 px-4">
      <div className="flex items-center gap-3">
        <div className="flex h-7 w-7 items-center justify-center rounded bg-orange-500 font-bold text-zinc-950">
          B
        </div>
        <h1 className="text-sm font-semibold tracking-tight">
          BakeStack <span className="text-zinc-500 font-normal">— Browser PBR Map Baker</span>
        </h1>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={loadSample}
          className="rounded bg-zinc-800 px-3 py-1 text-xs hover:bg-zinc-700"
        >
          Load Sample
        </button>
        <button
          onClick={saveProject}
          className="rounded bg-zinc-800 px-3 py-1 text-xs hover:bg-zinc-700"
        >
          Save settings
        </button>
        <button
          onClick={loadProject}
          className="rounded bg-zinc-800 px-3 py-1 text-xs hover:bg-zinc-700"
        >
          Load settings
        </button>
        <button
          onClick={() => setHelpOpen(true)}
          className="ml-1 flex h-6 w-6 items-center justify-center rounded-full bg-zinc-800 text-xs hover:bg-zinc-700"
          aria-label="Help"
        >
          ?
        </button>
      </div>
      {helpOpen && <HelpModal onClose={() => setHelpOpen(false)} />}
    </header>
  );
}

function HelpModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 p-4"
      onClick={onClose}
    >
      <div
        className="w-[640px] max-w-full rounded-lg border border-zinc-800 bg-zinc-900 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold text-zinc-100">BakeStack — how it works</h2>
        <ol className="mt-3 space-y-2 text-sm text-zinc-300">
          <li>
            <span className="text-orange-400">1.</span> Drop a UV-unwrapped <b>lowpoly</b> mesh on the
            right panel. GLB, OBJ and FBX are accepted.
          </li>
          <li>
            <span className="text-orange-400">2.</span> Drop the matching textured <b>highpoly</b>
            (more detail, the same shape). For texture transfer the highpoly's base color is read
            directly — or upload a custom <b>Transfer Source</b> image.
          </li>
          <li>
            <span className="text-orange-400">3.</span> Pick a resolution, tweak the cage offset if
            you see misses (toggle "Show cage" to visualize), pick which maps you want, hit Bake.
          </li>
          <li>
            <span className="text-orange-400">4.</span> Download PNGs individually, all at once, or
            export a packed GLB with the baked textures already attached to a PBR material.
          </li>
        </ol>
        <div className="mt-4 rounded bg-zinc-800/50 p-3 text-xs text-zinc-400">
          <b className="text-orange-400">The wedge.</b> Most bakers stop at normal / AO / curvature.
          BakeStack also <b>transfers any UV-mapped channel</b> from the highpoly — diffuse,
          roughness, metallic, opacity — onto the lowpoly's UVs. Try it: hit Load Sample, then
          Bake.
        </div>
        <button
          onClick={onClose}
          className="mt-4 w-full rounded bg-orange-500 px-3 py-2 text-sm font-semibold text-zinc-950 hover:bg-orange-400"
        >
          Close
        </button>
      </div>
    </div>
  );
}
