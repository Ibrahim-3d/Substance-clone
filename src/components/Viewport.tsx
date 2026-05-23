import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Grid } from "@react-three/drei";
import { useMemo, useRef, useEffect } from "react";
import * as THREE from "three";
import { useBakeStore } from "../store/bakeStore";
import type { BakedMap } from "../core/types";

function CameraFit() {
  const lowpoly = useBakeStore((s) => s.lowpoly);
  const highpoly = useBakeStore((s) => s.highpoly);
  useFrame(({ camera, controls }) => {
    if (!controls) return;
    const box = new THREE.Box3();
    if (lowpoly) box.union(lowpoly.bbox);
    if (highpoly) box.union(highpoly.bbox);
    if (box.isEmpty()) return;
    const center = box.getCenter(new THREE.Vector3());
    const c = controls as unknown as { target: THREE.Vector3 };
    c.target.lerp(center, 0.02);
  });
  return null;
}

function bakedToTexture(map: BakedMap): THREE.DataTexture {
  const buf = new Uint8Array(map.data.buffer as ArrayBuffer, map.data.byteOffset, map.data.byteLength);
  const tex = new THREE.DataTexture(buf, map.width, map.height, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.flipY = true;
  tex.needsUpdate = true;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function PreviewMesh() {
  const lowpoly = useBakeStore((s) => s.lowpoly);
  const highpoly = useBakeStore((s) => s.highpoly);
  const showHigh = useBakeStore((s) => s.showHighpoly);
  const showCage = useBakeStore((s) => s.showCage);
  const cageOffset = useBakeStore((s) => s.settings.cageOffset);
  const maps = useBakeStore((s) => s.maps);
  const apply = useBakeStore((s) => s.applyBakedPreview);

  const previewMaterial = useMemo(() => {
    const mat = new THREE.MeshStandardMaterial({ color: 0xd4d4d8, roughness: 0.7, metalness: 0.05 });
    if (!apply) return mat;
    const transfer = maps.find((m) => m.kind === "transfer");
    const normal = maps.find((m) => m.kind === "normal");
    const ao = maps.find((m) => m.kind === "ao");
    if (transfer) mat.map = bakedToTexture(transfer);
    if (normal) {
      const t = bakedToTexture(normal);
      t.colorSpace = THREE.NoColorSpace;
      mat.normalMap = t;
    }
    if (ao) {
      const t = bakedToTexture(ao);
      t.colorSpace = THREE.NoColorSpace;
      mat.aoMap = t;
    }
    return mat;
  }, [maps, apply]);

  useEffect(() => () => {
    previewMaterial.map?.dispose();
    previewMaterial.normalMap?.dispose();
    previewMaterial.aoMap?.dispose();
    previewMaterial.dispose();
  }, [previewMaterial]);

  return (
    <>
      {lowpoly && (
        <mesh geometry={lowpoly.geometry} material={previewMaterial} />
      )}
      {showHigh && highpoly && (
        <mesh
          geometry={highpoly.geometry}
          material={new THREE.MeshStandardMaterial({
            color: 0xf97316,
            roughness: 0.6,
            transparent: true,
            opacity: 0.35,
            wireframe: true,
          })}
        />
      )}
      {showCage && lowpoly && (
        <CageMesh geometry={lowpoly.geometry} offset={cageOffset} />
      )}
    </>
  );
}

function CageMesh({ geometry, offset }: { geometry: THREE.BufferGeometry; offset: number }) {
  const cageGeom = useMemo(() => {
    const g = geometry.clone();
    const pos = g.getAttribute("position") as THREE.BufferAttribute;
    const nrm = g.getAttribute("normal") as THREE.BufferAttribute;
    const out = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      out[i * 3] = pos.getX(i) + nrm.getX(i) * offset;
      out[i * 3 + 1] = pos.getY(i) + nrm.getY(i) * offset;
      out[i * 3 + 2] = pos.getZ(i) + nrm.getZ(i) * offset;
    }
    g.setAttribute("position", new THREE.BufferAttribute(out, 3));
    g.computeBoundingBox();
    g.computeBoundingSphere();
    return g;
  }, [geometry, offset]);

  const cageMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        wireframe: true,
        transparent: true,
        opacity: 0.6,
      }),
    [],
  );
  useEffect(() => () => {
    cageGeom.dispose();
    cageMat.dispose();
  }, [cageGeom, cageMat]);
  return <mesh geometry={cageGeom} material={cageMat} />;
}

function ResetView() {
  const lowpoly = useBakeStore((s) => s.lowpoly);
  const highpoly = useBakeStore((s) => s.highpoly);
  const ref = useRef(false);
  useFrame(({ camera, controls }) => {
    if (ref.current) return;
    if (!lowpoly && !highpoly) return;
    const box = new THREE.Box3();
    if (lowpoly) box.union(lowpoly.bbox);
    if (highpoly) box.union(highpoly.bbox);
    if (box.isEmpty()) return;
    const size = box.getSize(new THREE.Vector3()).length();
    const center = box.getCenter(new THREE.Vector3());
    camera.position.set(center.x + size * 0.8, center.y + size * 0.5, center.z + size * 0.8);
    camera.near = size / 100;
    camera.far = size * 100;
    camera.updateProjectionMatrix();
    if (controls) {
      (controls as unknown as { target: THREE.Vector3 }).target.copy(center);
    }
    ref.current = true;
  });
  return null;
}

export function Viewport() {
  return (
    <Canvas
      gl={{ antialias: true, preserveDrawingBuffer: false }}
      camera={{ position: [2, 2, 2], fov: 45 }}
      shadows
    >
      <color attach="background" args={["#0a0a0c"]} />
      <hemisphereLight args={[0xffffff, 0x222233, 0.9]} />
      <directionalLight position={[5, 8, 5]} intensity={1.0} castShadow />
      <directionalLight position={[-5, -3, -2]} intensity={0.35} />
      <directionalLight position={[0, 3, -8]} intensity={0.25} />
      <Grid
        infiniteGrid
        cellSize={0.2}
        cellThickness={0.5}
        sectionSize={1}
        sectionColor="#3f3f46"
        cellColor="#27272a"
        fadeDistance={20}
      />
      <PreviewMesh />
      <ResetView />
      <CameraFit />
      <OrbitControls makeDefault enableDamping dampingFactor={0.15} />
    </Canvas>
  );
}
