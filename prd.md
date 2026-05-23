# Browser PBR Map Baker — Technical Spec v0.1

**Working name:** TBD (suggestions: `MapForge`, `Crustier`, `BakeStack`, `Bakery3D`)
**Target ship:** 90 days from kickoff to public v0.1
**Positioning:** “Bake PBR maps in your browser. Transfer any texture from highpoly to lowpoly — even diffuse, which Substance Painter can’t.”

-----

## 1. The Wedge (Read First)

The single feature that justifies the entire project:

> **Drag a textured highpoly + a UV-unwrapped lowpoly. Click bake. Get every map — including the highpoly’s *diffuse, roughness, metallic, opacity* — projected onto the lowpoly’s UV space.**

Substance Painter cannot do this. That’s the entire marketing line. Everything else (AO, curvature, normal) is table stakes that ship as a side-effect of having the same ray-cast pipeline running.

**Do not build a SP clone.** Build a *baker* that beats SP on one specific axis (texture transfer) and matches it on the rest. Painting, smart materials, and node graphs are out of scope for v0.1 and probably v1.0.

-----

## 2. v0.1 Scope (90-day MVP)

### Must-have features

|Feature                                                                                                |Why                                                                     |
|-------------------------------------------------------------------------------------------------------|------------------------------------------------------------------------|
|Drag-drop GLB / FBX / OBJ for low + high poly                                                          |Table stakes. R3F + three.js loaders.                                   |
|Auto cage generation (offset along normals)                                                            |Required for clean projection. Slider for distance.                     |
|Match-by-name OR match-by-mesh (single-pair mode)                                                      |SP’s match-by-name is essential for multi-part assets.                  |
|**Texture transfer bake** (diffuse, roughness, metallic, alpha — any UV-mapped channel on the highpoly)|**The wedge.**                                                          |
|Normal map bake (tangent space, mikktspace correct)                                                    |Table stakes for credibility.                                           |
|AO bake (hemispherical Monte Carlo)                                                                    |Table stakes.                                                           |
|World-space normal bake                                                                                |Cheap derivative of the same pipeline.                                  |
|Position bake                                                                                          |Free, comes from rasterization step.                                    |
|Curvature bake (Sobel from WSN)                                                                        |Free, post-process on WSN.                                              |
|Live R3F preview with cage visualization                                                               |Marmoset-style. Sets the product apart from xNormal/Painter immediately.|
|Export PBR pack (PNG / EXR)                                                                            |Table stakes.                                                           |
|Export packed GLB with embedded maps                                                                   |Modern wedge. SP doesn’t ship one-click GLB.                            |
|IndexedDB project save/load                                                                            |UX polish.                                                              |

### Explicitly out of scope for v0.1

- 3D painting on the model (that’s a separate Tier 3 build)
- Smart materials / smart masks
- Node graph editor
- Multi texture set workflow
- Resolution > 4K (cap at 4096²; we revisit at v0.2)
- Bent normals (add in v0.2)
- Thickness (add in v0.2)
- ID map from vertex color (add in v0.2)

-----

## 3. Tech Stack

### Frontend

- **Vite 5** + **React 19** + **TypeScript** strict mode
- **R3F** + **@react-three/drei** + **@react-three/postprocessing**
- **three-mesh-bvh** (Garrett Johnson) — accelerated raycasting against highpoly
- **Zustand** for app state
- **shadcn/ui** + **Tailwind v4** for chrome
- **Leva** for bake parameter inspectors

### Compute

- **WebGPU** primary path — compute shaders for ray casting, AO sampling, texture transfer
- **WebGL2 fallback** for AO via cube probes (slower, ~10× perf hit, but works on Firefox/old Safari)
- **mikktspace WASM** (`mmikkelsen3d/MikkTSpace` ported) for tangent reconstruction

### File I/O

- **three.js** loaders: `GLTFLoader`, `FBXLoader`, `OBJLoader`
- **GLTFExporter** for packed GLB output
- **tinyexr WASM** for EXR output
- **canvas.toBlob** for PNG output
- **idb-keyval** for project persistence

### Hosting & infra

- **Vercel** (he’s already connected) for the web app
- **Cloudflare R2** for any large WASM blobs / sample assets
- **GoDaddy** for the domain (already connected, search for available name first)
- **Cowork scheduled task** for nightly perf regression bakes once we have a benchmark suite

-----

## 4. Repo Structure

```
mapforge/                                  # rename when domain is locked
├── packages/
│   ├── core/                              # Zero-React baking engine
│   │   ├── src/
│   │   │   ├── bvh/
│   │   │   │   └── index.ts               # three-mesh-bvh wrapper
│   │   │   ├── bakers/
│   │   │   │   ├── normal.ts              # Tangent-space normal from highpoly
│   │   │   │   ├── transfer.ts            # ⭐ Texture transfer (the wedge)
│   │   │   │   ├── ao.ts                  # Hemispherical sampling
│   │   │   │   ├── position.ts            # World position
│   │   │   │   ├── wsn.ts                 # World-space normal
│   │   │   │   ├── curvature.ts           # Sobel from WSN
│   │   │   │   └── index.ts               # Baker registry
│   │   │   ├── cage.ts                    # Offset cage generation
│   │   │   ├── tangent.ts                 # mikktspace WASM bindings
│   │   │   ├── rasterize.ts               # UV-space rasterization (low poly)
│   │   │   ├── webgpu/
│   │   │   │   ├── pipeline.ts
│   │   │   │   ├── bvh.wgsl               # BVH traversal
│   │   │   │   ├── ray.wgsl               # Ray-tri intersection
│   │   │   │   ├── transfer.wgsl          # ⭐ Texture transfer kernel
│   │   │   │   ├── ao.wgsl                # AO Monte Carlo kernel
│   │   │   │   └── normal.wgsl            # Normal projection kernel
│   │   │   └── webgl2/                    # Fallback path
│   │   │       └── ...
│   │   └── package.json
│   ├── ui/                                # React app
│   │   ├── src/
│   │   │   ├── viewport/
│   │   │   │   ├── Scene.tsx              # R3F canvas
│   │   │   │   ├── CageVisualizer.tsx
│   │   │   │   ├── BakePreview.tsx        # Live preview material
│   │   │   │   └── DropZone.tsx
│   │   │   ├── inspector/
│   │   │   │   ├── BakerSettings.tsx
│   │   │   │   ├── TransferChannelPicker.tsx   # ⭐ The killer UI
│   │   │   │   └── ExportPanel.tsx
│   │   │   ├── layers/
│   │   │   │   └── MapList.tsx            # Output map manager
│   │   │   ├── store/
│   │   │   │   └── bakeStore.ts           # Zustand
│   │   │   └── App.tsx
│   │   └── package.json
│   └── cli/                               # Headless Node baker (bonus)
│       └── src/
│           └── index.ts                   # `npx mapforge bake spec.json`
├── apps/
│   └── web/                               # Vite app shell
└── examples/
    ├── crate/                             # Test asset: simple crate (low + high)
    ├── pistol/                            # Test asset: hard-surface
    └── rock/                              # Test asset: organic
```

The `core` package must be 100% portable to Node (via `webgpu` Node bindings or wgpu-native) so the CLI ships for free.

-----

## 5. Core Algorithm (the part that matters)

### 5.1 Pipeline overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  1. PARSE: load lowpoly + highpoly meshes                                   │
│     → triangulate, compute mikktspace tangents, generate BVH for highpoly   │
├─────────────────────────────────────────────────────────────────────────────┤
│  2. RASTERIZE: render lowpoly into UV-space attribute textures              │
│     Output (per texel of lowpoly's UV space):                               │
│       → world position (rgb32f)                                             │
│       → world normal (rgb32f)                                               │
│       → tangent (rgba32f, w = bitangent sign)                               │
│     This is a single fragment shader that writes to a render target.        │
├─────────────────────────────────────────────────────────────────────────────┤
│  3. CAGE: offset world position along normal by user-controlled distance    │
│     → ray origin = pos + normal * cage_offset                               │
│     → ray direction = -normal                                               │
├─────────────────────────────────────────────────────────────────────────────┤
│  4. RAY CAST (compute): for each lowpoly texel, raycast to highpoly BVH     │
│     → output: hit position, hit triangle index, barycentric coords          │
├─────────────────────────────────────────────────────────────────────────────┤
│  5. SAMPLE: for each baker, sample at hit point                             │
│     → Normal: highpoly normal at hit, transformed into lowpoly tangent space│
│     → Transfer: highpoly UV at hit, sample its diffuse/whatever texture     │
│     → AO: hemisphere of N rays from hit point, count occluders              │
│     → Position: hit world pos                                               │
│     → WSN: highpoly world normal at hit                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│  6. POST: dilation/padding (UV island bleed), tonemap (curvature normalize) │
├─────────────────────────────────────────────────────────────────────────────┤
│  7. EXPORT: PNG / EXR / packed GLB                                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 The wedge kernel — texture transfer (WGSL)

```wgsl
// transfer.wgsl
// Input: lowpoly UV-space rasterized buffers + highpoly BVH + highpoly source texture
// Output: highpoly's textured channel reprojected into lowpoly's UV space

struct Hit {
    triIndex: u32,
    bary: vec3f,
    miss: u32,
};

@group(0) @binding(0) var<storage, read> low_pos:    array<vec4f>;   // [w*h]
@group(0) @binding(1) var<storage, read> low_norm:   array<vec4f>;   // [w*h]
@group(0) @binding(2) var<storage, read> bvh_nodes:  array<BVHNode>;
@group(0) @binding(3) var<storage, read> high_tris:  array<Triangle>;
@group(0) @binding(4) var<storage, read> high_uvs:   array<vec2f>;   // per vertex
@group(0) @binding(5) var high_src_tex: texture_2d<f32>;             // diffuse/whatever
@group(0) @binding(6) var high_src_smp: sampler;
@group(0) @binding(7) var output: texture_storage_2d<rgba8unorm, write>;

struct Params {
    cage_offset: f32,
    max_dist: f32,
    width: u32,
    height: u32,
};
@group(0) @binding(8) var<uniform> params: Params;

@compute @workgroup_size(8, 8, 1)
fn main(@builtin(global_invocation_id) gid: vec3u) {
    if (gid.x >= params.width || gid.y >= params.height) { return; }
    let idx = gid.y * params.width + gid.x;

    let p = low_pos[idx].xyz;
    let n = normalize(low_norm[idx].xyz);

    // Cage: shoot from above, look back along the normal
    let ro = p + n * params.cage_offset;
    let rd = -n;

    let hit = bvh_raycast(ro, rd, params.max_dist);
    if (hit.miss == 1u) {
        // Try second pass: ray from below, looking outward (catches concavities)
        let hit2 = bvh_raycast(p - n * params.cage_offset, n, params.max_dist);
        if (hit2.miss == 1u) {
            textureStore(output, vec2i(gid.xy), vec4f(0.0));
            return;
        }
        // ... use hit2
    }

    // Interpolate the highpoly's UV at the hit point
    let tri = high_tris[hit.triIndex];
    let uv = high_uvs[tri.a] * hit.bary.x
           + high_uvs[tri.b] * hit.bary.y
           + high_uvs[tri.c] * hit.bary.z;

    // Sample the highpoly's source texture at that UV
    let color = textureSampleLevel(high_src_tex, high_src_smp, uv, 0.0);
    textureStore(output, vec2i(gid.xy), color);
}
```

**Same kernel** with the source texture swapped handles diffuse, roughness, metallic, opacity, emissive, AO map, anything UV-mapped on the highpoly. We expose a UI dropdown: “Transfer channel: [albedo | roughness | metallic | opacity | custom upload]”.

### 5.3 Normal map kernel (key correctness gotcha)

The bake must be done in the **lowpoly’s tangent space**, not world space. Pseudocode:

```ts
// At hit point on highpoly:
const N_high_world = interpolate(high.normals, hit.bary);

// Lowpoly tangent basis at the texel:
const T = low.tangents[texel];                   // mikktspace tangent
const B = cross(low.normals[texel], T) * T.w;   // bitangent from sign
const N = low.normals[texel];

// Transform highpoly's world normal into lowpoly's tangent space:
const N_tangent = vec3(
    dot(N_high_world, T),
    dot(N_high_world, B),
    dot(N_high_world, N),
);

// Pack to [0,1] for storage
const N_packed = N_tangent * 0.5 + 0.5;
```

**Critical:** the lowpoly tangents must come from mikktspace, not whatever the loader emits. three.js’s GLTFLoader sometimes carries pre-computed tangents in `attributes.tangent` — those may or may not be mikktspace. Recompute with our WASM mikktspace to be safe. This is the #1 cause of “weird normal map seams” in homegrown bakers.

-----

## 6. UX Skeleton

```
┌───────────────────────────────────────────────────────────────────────────┐
│  [Logo]  Project: untitled.bake     [Save] [Export ▼]   [Github] [Docs]  │
├──────────────┬─────────────────────────────────────┬──────────────────────┤
│              │                                     │ INSPECTOR            │
│  ASSETS      │           R3F VIEWPORT              │ ┌──────────────────┐ │
│ ┌──────────┐ │                                     │ │ Output Resolution│ │
│ │ Lowpoly  │ │      [3D model with cage]           │ │  ○ 1K  ● 2K  ○ 4K│ │
│ │ ↓ drop   │ │                                     │ ├──────────────────┤ │
│ ├──────────┤ │      ◐ Show cage                    │ │ Cage Distance    │ │
│ │ Highpoly │ │      ◐ Show ray misses (red)        │ │ [───●─────] 0.05 │ │
│ │ ↓ drop   │ │      ◐ Show preview material        │ ├──────────────────┤ │
│ └──────────┘ │                                     │ │ MAPS TO BAKE     │ │
│              │                                     │ │ ☑ Normal         │ │
│  MAPS        │                                     │ │ ☑ AO   [16 spp ] │ │
│ ┌──────────┐ │                                     │ │ ☑ Curvature      │ │
│ │ normal   │ │                                     │ │ ☑ Position       │ │
│ │ ao       │ │                                     │ │ ☑ World Normal   │ │
│ │ transfer │ │                                     │ │ ☑ Transfer       │ │
│ │ curvature│ │                                     │ │   Channel: ▼     │ │
│ │ position │ │                                     │ │   [albedo      ▾]│ │
│ │ wsn      │ │                                     │ ├──────────────────┤ │
│ └──────────┘ │                                     │ │   [BAKE ALL ▶]  │ │
│              │                                     │ └──────────────────┘ │
└──────────────┴─────────────────────────────────────┴──────────────────────┘
```

UI tokens: dark theme, neutral grays, single accent. Don’t ship aurora/glassmorphism — this is a tool, not a portfolio piece. Audience is technical artists. Marmoset and SP set the convention: dark, restrained, function-first.

-----

## 7. 90-Day Execution Timeline

|Phase                        |Days |Deliverable                                                                                         |
|-----------------------------|-----|----------------------------------------------------------------------------------------------------|
|**P0 — Foundation**          |1-7  |Vite + R3F + TS scaffold. Drag-drop GLB. Display in viewport. three-mesh-bvh integrated.            |
|**P1 — Rasterization**       |8-14 |UV-space rasterization. Output position + normal as float textures. Visualize as preview.           |
|**P2 — First bake**          |15-21|Position bake working end-to-end (trivial baker, but proves the pipeline).                          |
|**P3 — Normal bake**         |22-35|mikktspace WASM. Cage. Normal projection kernel. Test against Blender Cycles bake — pixel diff < 1%.|
|**P4 — ⭐ Texture transfer**  |36-49|The wedge. Channel picker UI. Demo video for launch.                                                |
|**P5 — AO + curvature + WSN**|50-65|Hemispherical AO compute kernel. Sobel curvature. WSN.                                              |
|**P6 — Export + GLB**        |66-75|PNG, EXR, GLB packing. Project save/load via IndexedDB.                                             |
|**P7 — Polish + landing**    |76-85|Landing page. Demo video. Sample assets. Docs.                                                      |
|**P8 — Launch**              |86-90|Show HN, r/blender, r/gamedev, Twitter, Polycount, BlenderArtists.                                  |

Working solo, ~6 hr/day average, this is realistic-aggressive. If P3 (normal bake correctness) slips, kill AO+curvature scope and ship with just normal+transfer+position+WSN. Curvature can be a v0.2 that takes one weekend.

-----

## 8. Defensive Design / Risk Register

|Risk                                            |Likelihood|Mitigation                                                                                                |
|------------------------------------------------|----------|----------------------------------------------------------------------------------------------------------|
|WebGPU not supported (Firefox Linux, old Safari)|Medium    |WebGL2 fallback for AO/transfer (no compute, slower). Document: “Best in Chromium.”                       |
|100MB+ highpoly meshes crash browser            |High      |Stream parse, OPFS storage, progress UI. Cap free tier at 50MB, prompt for desktop CLI above that.        |
|mikktspace correctness                          |High      |Test suite vs Blender bake outputs from day 1. Pixel-diff CI.                                             |
|BVH build slow on 1M+ tri highpoly              |Medium    |three-mesh-bvh has SAH builder; build off main thread in Web Worker; show progress.                       |
|GPU memory exhaustion at 4K × 6 maps            |Medium    |Bake one map at a time, free GPU buffers between bakes. Don’t hold all maps in VRAM.                      |
|Adobe sends C&D for “Substance” mention         |Low       |Never use “Substance” in name, copy, or metadata. Compare to xNormal/Marmoset by name only.               |
|Free competitor lands first                     |Medium    |The transfer feature is the moat. Ship it loud. Domain + landing page reserved before any code is written.|

-----

## 9. Monetization Path (don’t think about this until v0.5, but plant the seeds)

The product must be free and OSS at the core to win mindshare. Premium tiers later:

- **Free / OSS:** Up to 2K resolution, all map types, browser-only.
- **Pro ($9/mo):** 4K + 8K, cloud bake (offload to a beefy server for 100MB+ meshes), batch CLI, project history, priority support.
- **Studio ($49/mo):** Team projects, shared cage presets, API for pipeline integration, headless render farm submission.

Revenue model is *not* the v0.1 question. The v0.1 question is: do 1,000 technical artists star the repo and use it weekly within 90 days of launch? If yes, monetization is trivial later. If no, no pricing tier saves us.

-----

## 10. Launch Checklist

- [ ] Domain bought (run GoDaddy availability check before any branding work)
- [ ] Logo + favicon (use logo-creator skill)
- [ ] Landing page with the wedge in the hero (`"Bake the diffuse map your highpoly already has — onto your lowpoly. In a browser."`)
- [ ] 60-second demo video — show the texture transfer from a textured ZBrush polypaint sculpt to a retopo’d lowpoly. This is the money shot.
- [ ] 3 sample bake projects pre-loaded so visitors can click “Try it” without uploading
- [ ] Documentation: 1 quickstart + 1 page per baker + 1 page on tangent-space gotchas
- [ ] Twitter/X post with side-by-side: “SP can’t do this. We can.” Bold positioning.
- [ ] Polycount, BlenderArtists, r/3Dmodeling, r/gamedev, Show HN
- [ ] DM 20 hand-picked technical artists with personalized “would love your feedback” messages

-----

## 11. First Commit Should Look Like This

```bash
mkdir mapforge && cd mapforge
pnpm init
pnpm add -D vite @vitejs/plugin-react typescript @types/react @types/node
pnpm add react react-dom three @react-three/fiber @react-three/drei
pnpm add three-mesh-bvh zustand
pnpm add -D tailwindcss@next @tailwindcss/vite

# Scaffolding
mkdir -p packages/{core,ui}/src apps/web/src
# Lay out the structure from §4

# First file to write: packages/core/src/rasterize.ts
# Goal: render a GLB lowpoly into a 1024² render target where each pixel
# stores world position. Display the output as a debug texture in R3F.
# When this works, the entire downstream pipeline is unblocked.
```

The first 200 lines of code go into `rasterize.ts`. Everything else depends on it.

-----

## Appendix A: Why this is winnable

- **Adobe will not build it.** It cannibalizes Painter’s seat licenses.
- **Marmoset will not build it.** They sell desktop binaries.
- **xNormal is dead.** Last release ~2020.
- **ArmorPaint is desktop and the dev (Lubos Lenco) has pivoted to AI-material-gen features instead of baking polish.**
- **Material Maker is Designer-shaped, not Painter-shaped, and not a baker.**
- **Browser-native + free + handles the one thing SP can’t = uncontested wedge.**

The technical artist Twitter community is small and tight. One viral demo video of the texture-transfer feature plays itself.
