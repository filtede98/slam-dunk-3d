import { useRef, useEffect, useMemo } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'meshoptimizer';
import * as THREE from 'three';
import { BALL_VARIANTS } from '../constants';

export interface BallState {
  x: number;
  y: number;
  z: number;
  scale: number;
  rotX: number;
  rotY: number;
  rotZ: number;
  visible: boolean;
  colorTint?: { r: number; g: number; b: number };
}

interface BasketballProps {
  state: React.RefObject<BallState>;
  scrollProgress?: React.RefObject<number>;
  activeVariant?: string;
  variantIndex?: number;
}

// Individual ball model — each has its own position offset, scale, opacity, and rotation
function BallModel({ url, xOffset, zOffset, scaleFactor, isActive, scrollProgress, rotationRef }: {
  url: string;
  xOffset: number;
  zOffset: number;
  scaleFactor: number;
  isActive: boolean;
  scrollProgress: React.RefObject<number>;
  rotationRef: React.RefObject<{ x: number; y: number; z: number }>;
}) {
  const wrapperRef = useRef<THREE.Group>(null);
  const spinRef = useRef<THREE.Group>(null);
  // Non-active balls start hidden to avoid flash on reload
  const currentX = useRef(isActive ? xOffset : 0);
  const currentZ = useRef(isActive ? zOffset : 0);
  const currentScale = useRef(isActive ? scaleFactor : 0);

  const gltf = useLoader(GLTFLoader, url, (loader) => {
    loader.setMeshoptDecoder(MeshoptDecoder);
  });

  const scene = useMemo(() => {
    const cloned = gltf.scene.clone(true);
    const box = new THREE.Box3().setFromObject(cloned);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = 2 / maxDim;

    cloned.position.sub(center);
    cloned.scale.setScalar(scale);

    cloned.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.castShadow = true;
        if (mesh.material instanceof THREE.MeshStandardMaterial) {
          mesh.material.roughness = Math.max(mesh.material.roughness, 0.6);
          mesh.material.envMapIntensity = 0.5;
          mesh.material.needsUpdate = true;
        }
      }
    });

    return cloned;
  }, [gltf]);

  useEffect(() => {
    if (!spinRef.current) return;
    while (spinRef.current.children.length > 0) {
      spinRef.current.remove(spinRef.current.children[0]);
    }
    spinRef.current.add(scene);
  }, [scene]);

  useFrame(() => {
    if (!wrapperRef.current || !spinRef.current) return;

    const lerpFactor = 0.08;
    const progress = scrollProgress?.current ?? 0;

    // Carousel visible in hero (progress < 0.05), collapses by ~8%
    // Hidden on mobile — only show active ball
    // Also collapse during add-to-cart animation
    const isAnimating = (window as any).__cartAnimating === true;
    const isMobileView = typeof window !== 'undefined' && window.innerWidth < 768;
    const carouselStrength = isActive ? 1 : (isMobileView || isAnimating ? 0 : Math.max(0, 1 - progress / 0.08));

    const targetX = xOffset * carouselStrength;
    const targetZ = zOffset * carouselStrength;
    const targetScale = isActive ? scaleFactor : scaleFactor * carouselStrength;

    currentX.current = THREE.MathUtils.lerp(currentX.current, targetX, lerpFactor);
    currentZ.current = THREE.MathUtils.lerp(currentZ.current, targetZ, lerpFactor);
    currentScale.current = THREE.MathUtils.lerp(currentScale.current, targetScale, lerpFactor);

    // Position offset (x + z for turntable) and individual scale
    wrapperRef.current.position.x = currentX.current;
    wrapperRef.current.position.z = currentZ.current;
    wrapperRef.current.scale.setScalar(currentScale.current);

    // Apply shared rotation to each ball individually
    if (rotationRef.current) {
      spinRef.current.rotation.x = rotationRef.current.x;
      spinRef.current.rotation.y = rotationRef.current.y;
      spinRef.current.rotation.z = rotationRef.current.z;
    }
  });

  return (
    <group ref={wrapperRef}>
      <group ref={spinRef} />
    </group>
  );
}

// Calculate circular distance between two indices
function circularDiff(from: number, to: number, total: number): number {
  let diff = to - from;
  if (diff > total / 2) diff -= total;
  if (diff < -total / 2) diff += total;
  return diff;
}

export default function Basketball({ state, scrollProgress, activeVariant = 'classic', variantIndex = 0 }: BasketballProps) {
  const groupRef = useRef<THREE.Group>(null);
  const idleRotY = useRef(0);
  // Shared rotation target — each BallModel reads from this
  const sharedRotation = useRef({ x: 0, y: 0, z: 0 });

  const modelUrls = useMemo(() =>
    BALL_VARIANTS.map(v => v.model),
    []
  );

  // Calculate turntable carousel offsets — balls on a circle in XZ plane
  const carouselData = useMemo(() => {
    const total = BALL_VARIANTS.length;
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const radius = isMobile ? 7 : 3.5; // much wider on mobile to push variants off screen

    return BALL_VARIANTS.map((_, i) => {
      const diff = circularDiff(variantIndex, i, total);
      // Map diff to angle: active = front (angle 0), others spread around
      const angle = (diff / total) * Math.PI * 2;

      // X = sin(angle) for left/right spread, Z = cos(angle) for depth
      // angle=0 → front center (x=0, z=0), back → z=-2*radius (behind screen)
      const xOffset = Math.sin(angle) * radius;
      const zOffset = Math.cos(angle) * radius - radius; // front = z:0, back = z:-2*radius

      // Scale: front is full size, sides smaller, back smallest
      const depthFactor = (1 + Math.cos(angle)) / 2; // 1 at front, 0 at back
      const scaleFactor = 0.45 + depthFactor * 0.55;  // range: 0.45 (back) to 1.0 (front)

      return { xOffset, zOffset, scaleFactor };
    });
  }, [variantIndex]);

  useFrame((_, delta) => {
    if (!groupRef.current || !state.current) return;

    const s = state.current;
    const lerp = 0.25;

    const progress = scrollProgress?.current ?? 0;
    const bobStrength = Math.max(0, 1 - progress / 0.15);
    const bobHero = Math.sin(Date.now() * 0.002) * 0.12 * bobStrength;

    const bounceStrength = Math.max(0, (progress - 0.90) / 0.10);
    const bounceTime = Date.now() * 0.005;
    const rawBounce = Math.abs(Math.sin(bounceTime));
    const bounceBall = rawBounce * rawBounce * 0.3 * bounceStrength;

    const bobY = bobHero + bounceBall;

    // Position & scale on the outer group (no rotation here)
    const g = groupRef.current;
    g.position.x = THREE.MathUtils.lerp(g.position.x, s.x, lerp);
    g.position.y = THREE.MathUtils.lerp(g.position.y, s.y + bobY, lerp);
    g.position.z = THREE.MathUtils.lerp(g.position.z, s.z, lerp);

    const targetScale = s.scale || 1;
    g.scale.setScalar(THREE.MathUtils.lerp(g.scale.x, targetScale, lerp));

    g.visible = s.visible !== false;

    // Accumulate idle spin
    idleRotY.current += delta * 0.35;

    // Update shared rotation ref (each BallModel reads this)
    const targetRotX = s.rotX;
    const targetRotY = s.rotY + idleRotY.current;
    const targetRotZ = s.rotZ;

    sharedRotation.current.x = THREE.MathUtils.lerp(sharedRotation.current.x, targetRotX, lerp);
    sharedRotation.current.y = THREE.MathUtils.lerp(sharedRotation.current.y, targetRotY, lerp);
    sharedRotation.current.z = THREE.MathUtils.lerp(sharedRotation.current.z, targetRotZ, lerp);
  });

  // On mobile, only render the active ball (saves ~15MB of model loading)
  const isMobileDevice = typeof window !== 'undefined' && window.innerWidth < 768;
  const variantsToRender = isMobileDevice
    ? BALL_VARIANTS.filter((_, i) => i === variantIndex)
    : BALL_VARIANTS;

  return (
    <group ref={groupRef}>
      {variantsToRender.map((variant) => {
        const i = BALL_VARIANTS.indexOf(variant);
        return (
          <BallModel
            key={variant.id}
            url={variant.model}
            xOffset={carouselData[i].xOffset}
            zOffset={carouselData[i].zOffset}
            scaleFactor={carouselData[i].scaleFactor}
            isActive={i === variantIndex}
            scrollProgress={scrollProgress!}
            rotationRef={sharedRotation}
          />
        );
      })}
    </group>
  );
}
