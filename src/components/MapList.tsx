import { useEffect, useRef } from "react";
import { useBakeStore } from "../store/bakeStore";
import type { BakedMap } from "../core/types";
import { downloadAll, downloadMap } from "../core/export";
import { exportPackedGLB } from "../core/glbExport";

function MapThumb({ map, selected, onSelect }: { map: BakedMap; selected: boolean; onSelect: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    c.width = map.width;
    c.height = map.height;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.putImageData(
      new ImageData(map.data as unknown as Uint8ClampedArray<ArrayBuffer>, map.width, map.height),
      0,
      0,
    );
  }, [map]);
  return (
    <button
      onClick={onSelect}
      className={`group relative w-full overflow-hidden rounded-md border text-left transition ${
        selected ? "border-orange-500" : "border-zinc-800 hover:border-zinc-600"
      }`}
    >
      <div className="checker aspect-square w-full">
        <canvas ref={ref} className="h-full w-full" style={{ imageRendering: "pixelated" }} />
      </div>
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-zinc-950/80 px-2 py-1 text-xs">
        <span>{map.label}</span>
        <span className="text-zinc-500">{map.width}²</span>
      </div>
    </button>
  );
}

export function MapList() {
  const maps = useBakeStore((s) => s.maps);
  const lowpoly = useBakeStore((s) => s.lowpoly);
  const selected = useBakeStore((s) => s.selectedMap);
  const setSelected = useBakeStore((s) => s.setSelectedMap);
  const apply = useBakeStore((s) => s.applyBakedPreview);
  const setApply = useBakeStore((s) => s.setApplyBakedPreview);
  const progress = useBakeStore((s) => s.progress);
  const baking = useBakeStore((s) => s.baking);
  const error = useBakeStore((s) => s.error);

  const selectedMap = maps.find((m) => m.kind === selected) ?? maps[0];

  return (
    <div className="flex h-full w-72 shrink-0 flex-col gap-3 overflow-y-auto border-r border-zinc-800 bg-zinc-950/80 p-4">
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">Output Maps</h3>
        {maps.length === 0 ? (
          <p className="text-xs text-zinc-500">No bakes yet. Configure on the right and click Bake All.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {maps.map((m) => (
              <MapThumb
                key={m.kind}
                map={m}
                selected={selectedMap?.kind === m.kind}
                onSelect={() => setSelected(m.kind)}
              />
            ))}
          </div>
        )}
      </div>

      {(progress || baking) && (
        <div className="rounded-md border border-zinc-800 bg-zinc-900 p-2">
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="text-zinc-300">{progress?.message ?? `Working on ${progress?.kind ?? "…"}`}</span>
            <span className="text-zinc-500">{progress ? Math.round(progress.pct * 100) : 0}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded bg-zinc-800">
            <div
              className="h-full bg-orange-500 transition-all"
              style={{ width: `${(progress?.pct ?? 0) * 100}%` }}
            />
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-md border border-red-800 bg-red-950/40 p-2 text-xs text-red-300">
          {error}
        </div>
      )}

      <label className="flex items-center gap-2 text-xs text-zinc-400">
        <input type="checkbox" checked={apply} onChange={(e) => setApply(e.target.checked)} />
        Apply baked maps to viewport preview
      </label>

      {maps.length > 0 && (
        <div className="mt-auto space-y-2">
          <button
            className="w-full rounded-md bg-zinc-800 px-3 py-2 text-sm hover:bg-zinc-700"
            onClick={() => selectedMap && void downloadMap(selectedMap)}
          >
            Download selected PNG
          </button>
          <button
            className="w-full rounded-md bg-zinc-800 px-3 py-2 text-sm hover:bg-zinc-700"
            onClick={() => void downloadAll(maps)}
          >
            Download all PNGs
          </button>
          <button
            className="w-full rounded-md bg-orange-500/90 px-3 py-2 text-sm font-semibold text-zinc-950 hover:bg-orange-400"
            disabled={!lowpoly}
            onClick={() => lowpoly && void exportPackedGLB(lowpoly, maps)}
          >
            Export packed GLB
          </button>
        </div>
      )}
    </div>
  );
}
