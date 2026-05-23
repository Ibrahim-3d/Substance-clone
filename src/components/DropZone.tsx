import { useCallback, useRef, useState } from "react";
import * as THREE from "three";
import { loadAssetFromFile } from "../core/loader";
import { useBakeStore } from "../store/bakeStore";

type Slot = "lowpoly" | "highpoly" | "texture";

interface Props {
  slot: Slot;
  title: string;
  hint: string;
}

const accept = {
  lowpoly: ".glb,.gltf,.obj,.fbx",
  highpoly: ".glb,.gltf,.obj,.fbx",
  texture: "image/*",
};

export function DropZone({ slot, title, hint }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const setLow = useBakeStore((s) => s.setLowpoly);
  const setHigh = useBakeStore((s) => s.setHighpoly);
  const setTex = useBakeStore((s) => s.setTransferSource);
  const setError = useBakeStore((s) => s.setError);
  const lowpoly = useBakeStore((s) => s.lowpoly);
  const highpoly = useBakeStore((s) => s.highpoly);
  const transferSourceName = useBakeStore((s) => s.transferSourceName);

  const handleFile = useCallback(
    async (file: File) => {
      setBusy(true);
      setError(null);
      try {
        if (slot === "texture") {
          const url = URL.createObjectURL(file);
          const img = await new Promise<HTMLImageElement>((res, rej) => {
            const i = new Image();
            i.crossOrigin = "anonymous";
            i.onload = () => res(i);
            i.onerror = () => rej(new Error("Image decode failed"));
            i.src = url;
          });
          const tex = new THREE.Texture(img);
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.needsUpdate = true;
          setTex(tex, file.name);
        } else {
          const asset = await loadAssetFromFile(file);
          if (slot === "lowpoly") setLow(asset);
          else setHigh(asset);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
      }
    },
    [slot, setLow, setHigh, setTex, setError],
  );

  const current = slot === "lowpoly" ? lowpoly?.name : slot === "highpoly" ? highpoly?.name : transferSourceName;

  return (
    <div
      className={`rounded-md border border-zinc-800 bg-zinc-900/60 p-3 transition ${
        over ? "dropzone-active" : ""
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const file = e.dataTransfer.files[0];
        if (file) void handleFile(file);
      }}
      onClick={() => inputRef.current?.click()}
      role="button"
    >
      <div className="flex items-center justify-between text-xs uppercase tracking-wide text-zinc-400">
        <span>{title}</span>
        {busy && <span className="text-orange-400">loading…</span>}
      </div>
      <div className="mt-1 text-sm text-zinc-200 truncate">
        {current ?? <span className="text-zinc-500">{hint}</span>}
      </div>
      {slot !== "texture" && current && (
        <div className="mt-1 text-[10px] text-zinc-500">
          {slot === "lowpoly" ? `${lowpoly?.triCount.toLocaleString()} tris` : `${highpoly?.triCount.toLocaleString()} tris`}
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={accept[slot]}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}
