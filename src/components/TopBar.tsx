import { useBakeStore } from "../store/bakeStore";
import { buildSampleAssets } from "../core/sample";
import { get, set } from "idb-keyval";

const PROJECT_KEY = "bakestack:last-project";

export function TopBar() {
  const store = useBakeStore();

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
      </div>
    </header>
  );
}
