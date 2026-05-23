import { useEffect, useRef } from "react";
import { useBakeStore } from "../store/bakeStore";

export function MapPreview() {
  const maps = useBakeStore((s) => s.maps);
  const selected = useBakeStore((s) => s.selectedMap);
  const ref = useRef<HTMLCanvasElement>(null);
  const map = maps.find((m) => m.kind === selected) ?? maps[0];

  useEffect(() => {
    const c = ref.current;
    if (!c || !map) return;
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

  if (!map) return null;
  return (
    <div className="pointer-events-none absolute bottom-4 right-4 w-40 overflow-hidden rounded-md border border-zinc-800 bg-zinc-950/80 shadow-xl">
      <div className="checker aspect-square w-full">
        <canvas
          ref={ref}
          className="h-full w-full"
          style={{ imageRendering: "pixelated" }}
        />
      </div>
      <div className="px-2 py-1 text-xs text-zinc-300">{map.label}</div>
    </div>
  );
}
