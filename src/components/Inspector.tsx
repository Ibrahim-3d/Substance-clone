import { useBakeStore } from "../store/bakeStore";
import type { MapKind } from "../core/types";
import { runBake } from "../core/bake";
import { DropZone } from "./DropZone";

const RESOLUTIONS: Array<512 | 1024 | 2048 | 4096> = [512, 1024, 2048, 4096];

const MAP_LIST: Array<{ key: MapKind; label: string; hint?: string }> = [
  { key: "normal", label: "Normal", hint: "tangent-space" },
  { key: "ao", label: "AO" },
  { key: "curvature", label: "Curvature", hint: "from WSN" },
  { key: "transfer", label: "Transfer", hint: "the wedge" },
  { key: "wsn", label: "World Normal" },
  { key: "position", label: "Position" },
];

export function Inspector() {
  // Granular selectors so progress updates during a bake (which only touch
  // `progress`) don't re-render this panel.
  const settings = useBakeStore((s) => s.settings);
  const baking = useBakeStore((s) => s.baking);
  const lowpoly = useBakeStore((s) => s.lowpoly);
  const highpoly = useBakeStore((s) => s.highpoly);
  const showCage = useBakeStore((s) => s.showCage);
  const showHighpoly = useBakeStore((s) => s.showHighpoly);
  const setSettings = useBakeStore((s) => s.setSettings);
  const setEnabled = useBakeStore((s) => s.setEnabled);
  const setShowCage = useBakeStore((s) => s.setShowCage);
  const setShowHighpoly = useBakeStore((s) => s.setShowHighpoly);

  const canBake = !!lowpoly && !!highpoly && !baking;

  const bake = async () => {
    const s = useBakeStore.getState();
    if (!s.lowpoly || !s.highpoly) return;
    s.setError(null);
    s.setBaking(true);
    s.setMaps([]);
    try {
      const maps = await runBake(
        {
          lowpoly: s.lowpoly,
          highpoly: s.highpoly,
          settings: s.settings,
          transferSource: s.transferSource ?? undefined,
        },
        (p) => useBakeStore.getState().setProgress(p),
      );
      useBakeStore.getState().setMaps(maps);
    } catch (e) {
      useBakeStore.getState().setError(e instanceof Error ? e.message : String(e));
    } finally {
      useBakeStore.getState().setBaking(false);
      useBakeStore.getState().setProgress(null);
    }
  };

  return (
    <div className="flex h-full w-80 shrink-0 flex-col gap-4 overflow-y-auto border-l border-zinc-800 bg-zinc-950/80 p-4">
      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">Assets</h3>
        <div className="space-y-2">
          <DropZone slot="lowpoly" title="Lowpoly" hint="drop GLB / OBJ / FBX" />
          <DropZone slot="highpoly" title="Highpoly" hint="drop GLB / OBJ / FBX" />
          <DropZone slot="texture" title="Transfer Source" hint="optional override image" />
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">Resolution</h3>
        <div className="grid grid-cols-4 gap-1">
          {RESOLUTIONS.map((r) => (
            <button
              key={r}
              className={`rounded px-2 py-1 text-sm transition ${
                settings.resolution === r
                  ? "bg-orange-500 text-zinc-950"
                  : "bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
              }`}
              onClick={() => setSettings({ resolution: r })}
            >
              {r >= 1024 ? `${r / 1024}K` : r}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">Cage</h3>
        <Slider
          label="Offset"
          value={settings.cageOffset}
          min={0}
          max={1}
          step={0.005}
          onChange={(v) => setSettings({ cageOffset: v })}
        />
        <div className="mt-2 flex items-center justify-between text-xs text-zinc-400">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={showCage}
              onChange={(e) => setShowCage(e.target.checked)}
            />
            Show cage
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={showHighpoly}
              onChange={(e) => setShowHighpoly(e.target.checked)}
            />
            Show highpoly
          </label>
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">Maps to bake</h3>
        <ul className="space-y-1">
          {MAP_LIST.map(({ key, label, hint }) => (
            <li key={key}>
              <label className="flex items-center justify-between gap-2 rounded px-2 py-1 hover:bg-zinc-900">
                <span className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={settings.enabled[key]}
                    onChange={(e) => setEnabled(key, e.target.checked)}
                  />
                  {label}
                </span>
                {hint && <span className="text-[10px] text-zinc-500">{hint}</span>}
              </label>
            </li>
          ))}
        </ul>
      </section>

      {settings.enabled.ao && (
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">AO</h3>
          <Slider
            label="Samples"
            value={settings.aoSamples}
            min={4}
            max={128}
            step={4}
            onChange={(v) => setSettings({ aoSamples: v })}
            format={(v) => `${v} spp`}
          />
          <Slider
            label="Max distance"
            value={settings.aoMaxDist}
            min={0}
            max={5}
            step={0.05}
            onChange={(v) => setSettings({ aoMaxDist: v })}
            format={(v) => (v === 0 ? "auto" : v.toFixed(2))}
          />
        </section>
      )}

      {settings.enabled.transfer && (
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">Transfer</h3>
          <label className="block text-xs text-zinc-400">Channel label</label>
          <select
            className="mt-1 w-full rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-sm"
            value={settings.transferChannel}
            onChange={(e) =>
              setSettings({
                transferChannel: e.target.value as typeof settings.transferChannel,
              })
            }
          >
            <option value="albedo">albedo</option>
            <option value="roughness">roughness</option>
            <option value="metallic">metallic</option>
            <option value="opacity">opacity</option>
            <option value="custom">custom</option>
          </select>
          <p className="mt-2 text-[10px] leading-tight text-zinc-500">
            Source = override file (if uploaded) or highpoly's base color map. Channel name is
            cosmetic — sampling is always full RGBA.
          </p>
        </section>
      )}

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">Edge padding</h3>
        <Slider
          label="Dilation px"
          value={settings.dilatePadding}
          min={0}
          max={16}
          step={1}
          onChange={(v) => setSettings({ dilatePadding: v })}
        />
      </section>

      <button
        data-testid="bake-button"
        className="mt-auto rounded-md bg-orange-500 px-3 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-40"
        disabled={!canBake}
        onClick={() => void bake()}
      >
        {baking ? "Baking…" : "Bake All ▶"}
      </button>
      {!lowpoly && <p className="text-xs text-zinc-500">Drop a lowpoly to begin.</p>}
      {lowpoly && !highpoly && (
        <p className="text-xs text-zinc-500">Drop a highpoly to enable baking.</p>
      )}
    </div>
  );
}

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}

function Slider({ label, value, min, max, step, onChange, format }: SliderProps) {
  return (
    <div className="my-1">
      <div className="flex items-center justify-between text-xs text-zinc-400">
        <span>{label}</span>
        <span className="text-zinc-300">{format ? format(value) : value}</span>
      </div>
      <input
        type="range"
        className="w-full"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
    </div>
  );
}
