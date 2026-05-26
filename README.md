<div align="center">

# 🔥 BakeStack

### A free, browser-based PBR map baker — the open-source Substance Painter alternative for baking.

**Drag in a highpoly + lowpoly, click Bake, download your maps.** No install, no account, no GPU farm — it runs entirely in your browser.

[**▶ Try the Live Demo**](https://ibrahim-3d.github.io/Substance-clone/) · [Features](#-features) · [How it works](#-how-it-works) · [Run locally](#-run-locally) · [Roadmap](#-roadmap)

[![Live Demo](https://img.shields.io/badge/demo-live-22c55e?style=flat-square)](https://ibrahim-3d.github.io/Substance-clone/)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](#-license)
[![Built with React Three Fiber](https://img.shields.io/badge/built%20with-React%20Three%20Fiber-000?style=flat-square)](https://github.com/pmndrs/react-three-fiber)
[![Runs in browser](https://img.shields.io/badge/runs%20in-browser-f97316?style=flat-square)](https://ibrahim-3d.github.io/Substance-clone/)

</div>

---

## What is BakeStack?

**BakeStack** is a free, open-source **PBR texture baker that runs 100% in your web browser**. It's a lightweight **Substance Painter / Marmoset Toolbag alternative** focused on one job done well: **baking maps from a highpoly mesh onto a UV-unwrapped lowpoly**.

Upload a textured highpoly and a lowpoly, hit **Bake**, and get every map projected into the lowpoly's UV space — including the highpoly's **diffuse / roughness / metallic / opacity texture transfer**, something Substance Painter's baker can't do out of the box.

No downloads. No license key. No cloud upload — your meshes never leave your machine.

> 💡 **New here?** Skip the uploads entirely: open the [live demo](https://ibrahim-3d.github.io/Substance-clone/), click **Load Sample**, then **Bake All**.

## ✨ Features

- **Six bake types from one ray-cast pipeline:**
  - 🟪 **Normal map** (tangent-space)
  - 🌐 **World-space normal**
  - 📍 **Position** (within highpoly bounding box)
  - 🌑 **Ambient Occlusion** (cosine-weighted Hammersley hemisphere)
  - 🪨 **Curvature** (Sobel of world-space normal)
  - 🎨 **Texture transfer** — *the killer feature.* Project any UV-mapped channel (diffuse / roughness / metallic / opacity) from the highpoly's source texture onto the lowpoly's UVs.
- **Any common format in:** drag-drop `GLB` / `GLTF` / `OBJ` / `FBX` for both meshes.
- **Full control:** configurable cage offset, AO sample count, edge-padding dilation, and output resolution from **512² up to 4K**.
- **Live 3D preview** (React Three Fiber) with baked maps applied to the lowpoly, plus toggleable cage and highpoly overlays.
- **Export your way:** download single maps or all maps as PNG, or a **packed GLB** with the bakes wired into a `MeshStandardMaterial`.
- **Remembers your setup** — bake settings persist via IndexedDB.

## 🚀 Live Demo

👉 **[ibrahim-3d.github.io/Substance-clone](https://ibrahim-3d.github.io/Substance-clone/)**

The demo ships with procedural sample assets (a bumpy textured highpoly sphere + a smooth lowpoly sphere) so you can bake your first map in two clicks.

## 🧠 How it works

```
parse → rasterize lowpoly UVs → build BVH on highpoly → for each lowpoly texel:
  • cast a ray from the cage back through the surface to the highpoly
  • sample the highpoly at the hit (normal / UV / source texture)
  • transform highpoly normal into lowpoly tangent space for the normal bake
→ dilate UV-island borders for clean bilinear sampling
→ export
```

The pipeline is currently CPU-based, accelerated with [`three-mesh-bvh`](https://github.com/gkjohnson/three-mesh-bvh). WebGPU compute shaders are the planned v0.2 fast path (see `prd.md` §5).

## 🛠 Run locally

```sh
pnpm install
pnpm dev          # http://localhost:5173
pnpm typecheck    # tsc -b --noEmit
pnpm build        # tsc -b && vite build
```

**Stack:** React 18 · TypeScript · Vite · Tailwind CSS · three.js · React Three Fiber · three-mesh-bvh · Zustand.

## 🗺 Roadmap

v0.1 is intentionally scoped. Known limitations and what's next:

- **Tangents** use three.js `computeTangents()`, not mikktspace — fine for most assets, occasionally subtle seams on awkward UVs. Mikktspace WASM is on the v0.2 list.
- **EXR export** not yet implemented (needs tinyexr WASM) — PNG-only for now.
- **Threading:** all work runs on the main thread today. A Web Worker / WebGPU port is the obvious next step for fast 4K bakes.
- **Multi-mesh "match by name"** isn't implemented — single-pair bakes only (multiple child meshes in one GLB are merged).

See [`prd.md`](./prd.md) for the full product spec.

## ❓ FAQ

**Is BakeStack really free?** Yes — MIT licensed and free forever.

**Do my models get uploaded anywhere?** No. All parsing and baking happens locally in your browser; nothing is sent to a server.

**How is this different from Substance Painter?** BakeStack is a focused, zero-install *baker*. It doesn't paint — but it does something Substance's baker can't: transfer the highpoly's existing texture channels (diffuse/roughness/metallic/opacity) onto the lowpoly UVs.

**What browsers are supported?** Any modern desktop browser with WebGL2 (Chrome, Edge, Firefox, Safari).

## 🤝 Contributing

Issues and PRs welcome. Run `pnpm typecheck` before opening a PR.

## 📄 License

[MIT](./LICENSE) © Ibrahim Elsayed
