import type { BakedMap } from "./types";

/** Convert a baked map to a PNG blob via an offscreen canvas. */
export async function bakedMapToPng(map: BakedMap): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = map.width;
  canvas.height = map.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get 2D context");
  const id = new ImageData(
    map.data as unknown as Uint8ClampedArray<ArrayBuffer>,
    map.width,
    map.height,
  );
  ctx.putImageData(id, 0, 0);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("PNG encode failed"))), "image/png");
  });
}

export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function downloadMap(map: BakedMap, prefix = "bake"): Promise<void> {
  const blob = await bakedMapToPng(map);
  triggerDownload(blob, `${prefix}_${map.kind}.png`);
}

export async function downloadAll(maps: BakedMap[], prefix = "bake"): Promise<void> {
  for (const m of maps) {
    await downloadMap(m, prefix);
  }
}
