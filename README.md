# BakeStack

A browser-based PBR map baker. Drag in a textured highpoly mesh and a UV-unwrapped lowpoly, click Bake, and get every map projected onto the lowpoly's UV space — **including the highpoly's diffuse / roughness / metallic / opacity**, which Substance Painter can't.

> See `prd.md` for the full product spec.

## What ships in v0.1

- Drag-drop GLB / GLTF / OBJ / FBX for both lowpoly and highpoly.
- Six baked map types out of one ray-cast pipeline:
  - Normal map (tangent-space)
  - World-space normal
  - Position (in highpoly bbox)
  - Ambient occlusion (cosine-weighted Hammersley hemisphere)
  - Curvature (Sobel of world-space normal)
  - **Texture transfer** — the wedge. Project any UV-mapped channel from the highpoly's source texture onto the lowpoly's UVs.
- Configurable cage offset, AO sample count, edge-padding dilation, output resolution (512² → 4K).
- Live R3F preview with the baked maps applied to the lowpoly, plus toggleable cage and highpoly overlays.
- PNG download (single map / all maps).
- Packed GLB export with the bakes wired up to a `MeshStandardMaterial`.
- IndexedDB-persisted bake settings.

Try it without any uploads: click **Load Sample** in the top bar, then **Bake All**. The sample assets are a procedural bumpy sphere highpoly with a textured surface and a smooth lowpoly sphere.

## How it works

```
parse → rasterize lowpoly UVs → build BVH on highpoly → for each lowpoly texel:
  - cast a ray from cage back through the surface to the highpoly
  - sample the highpoly at the hit (normal / UV / source texture)
  - transform highpoly normal into lowpoly tangent space for normal map bake
→ dilate UV-island borders for clean bilinear sampling
→ export
```

The implementation is currently CPU-based (`three-mesh-bvh` accelerated raycasting). WebGPU compute shaders are the planned v0.2 fast path; they're documented in `prd.md` §5.

## Develop

```bash
pnpm install
pnpm dev          # http://localhost:5173
pnpm typecheck    # tsc -b --noEmit
pnpm build        # tsc -b && vite build
```

## v0.1 known limitations

- Tangents come from three.js's `computeTangents()`, not mikktspace. Acceptable for most assets, occasionally produces subtle seams on awkward UVs. Mikktspace WASM is on the v0.2 list.
- EXR export is not implemented (needs tinyexr WASM). PNG-only for now.
- All work runs on the main thread. A Web Worker / WebGPU port is the obvious next step for 4K bakes.
- Multi-mesh "match by name" mode is not implemented — single-pair bakes only. Multiple child meshes inside a single GLB are merged into one mesh.

## License

MIT
