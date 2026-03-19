import { useRef, useEffect, useMemo } from 'react';
import { useFrame, useLoader, useThree } from '@react-three/fiber';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
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

function shouldPreferDesktopAssetsOnMobile() {
  if (typeof window === 'undefined') {
    return false;
  }

  const isMobile = window.innerWidth < 768;
  if (!isMobile) {
    return false;
  }

  const deviceMemory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  const hardwareConcurrency = navigator.hardwareConcurrency ?? 4;
  const devicePixelRatio = window.devicePixelRatio || 1;
  const hasKnownLowMemory = typeof deviceMemory === 'number' && deviceMemory <= 3;
  const hasLowCpu = hardwareConcurrency <= 4;

  if (hasKnownLowMemory || hasLowCpu) {
    return false;
  }

  return devicePixelRatio >= 3 || hardwareConcurrency >= 6 || (typeof deviceMemory === 'number' && deviceMemory >= 6);
}

function getVariantModel(variant: (typeof BALL_VARIANTS)[number], isMobile: boolean) {
  if (!isMobile) {
    return variant.desktopModel ?? variant.model;
  }

  return shouldPreferDesktopAssetsOnMobile()
    ? variant.desktopModel ?? variant.model
    : variant.mobileModel ?? variant.model;
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
  const { gl } = useThree();
  // Non-active balls start hidden to avoid flash on reload
  const currentX = useRef(isActive ? xOffset : 0);
  const currentZ = useRef(isActive ? zOffset : 0);
  const currentScale = useRef(isActive ? scaleFactor : 0);

  const gltf = useLoader(GLTFLoader, url, (loader) => {
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('/draco/');
    loader.setDRACOLoader(dracoLoader);
  });

  const scene = useMemo(() => {
    const cloned = gltf.scene.clone(true);
    const box = new THREE.Box3().setFromObject(cloned);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = 2 / maxDim;
    const prefersDesktopAssets = shouldPreferDesktopAssetsOnMobile();
    const anisotropy = Math.min(prefersDesktopAssets ? 16 : 12, gl.capabilities.getMaxAnisotropy());

    cloned.position.sub(center);
    cloned.scale.setScalar(scale);

    cloned.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.castShadow = true;
        if (mesh.material instanceof THREE.MeshStandardMaterial) {
          mesh.material.map && (mesh.material.map.anisotropy = anisotropy);
          mesh.material.normalMap && (mesh.material.normalMap.anisotropy = anisotropy);
          mesh.material.metalnessMap && (mesh.material.metalnessMap.anisotropy = anisotropy);
          mesh.material.roughnessMap && (mesh.material.roughnessMap.anisotropy = anisotropy);
          mesh.material.roughness = Math.max(mesh.material.roughness, prefersDesktopAssets ? 0.55 : 0.6);
          mesh.material.envMapIntensity = prefersDesktopAssets ? 0.75 : 0.6;
          mesh.material.needsUpdate = true;
        }
      }
    });

    return cloned;
  }, [gl, gltf]);

  useEffect(() => {
    if (!spinRef.current) return;
    while (spinRef.current.children.length > 0) {
      spinRef.current.remove(spinRef.current.children[0]);
    }
    spinRef.current.add(scene);
  }, [scene]);

  useEffect(() => {
    const isMobileView = typeof window !== 'undefined' && window.innerWidth < 768;
    if (!isMobileView) {
      return;
    }

    currentX.current = isActive ? xOffset : 0;
    currentZ.current = isActive ? zOffset : 0;
    currentScale.current = isActive ? scaleFactor : 0;
  }, [isActive, scaleFactor, xOffset, zOffset]);

  useFrame(() => {
    if (!wrapperRef.current || !spinRef.current) return;

    const lerpFactor = 0.08;
    const progress = scrollProgress?.current ?? 0;

    // Carousel visible in hero (progress < 0.05), collapses by ~8%
    // Hidden on mobile — only show active ball
    // Also collapse during add-to-cart animation
    const isAnimating = (window as any).__cartAnimating === true;
    const isMobileView = typeof window !== 'undefined' && window.innerWidth < 768;

    if (isMobileView && !isActive) {
      wrapperRef.current.visible = false;
      return;
    }

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
    wrapperRef.current.visible = !isMobileView || isActive || currentScale.current > 0.001;

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
  const isMobileDevice = typeof window !== 'undefined' && window.innerWidth < 768;

  const modelUrls = useMemo(() =>
    BALL_VARIANTS.map(v => getVariantModel(v, isMobileDevice)),
    [isMobileDevice]
  );

  useEffect(() => {
    modelUrls.forEach((url) => {
      useLoader.preload(GLTFLoader, url, (loader) => {
        const dracoLoader = new DRACOLoader();
        dracoLoader.setDecoderPath('/draco/');
        loader.setDRACOLoader(dracoLoader);
      });
    });
  }, [modelUrls]);

  useEffect(() => {
    if (!groupRef.current || !state.current) return;

    const s = state.current;
    groupRef.current.position.set(s.x, s.y, s.z);
    groupRef.current.scale.setScalar(s.scale || 1);
    groupRef.current.visible = s.visible !== false;
    sharedRotation.current.x = s.rotX;
    sharedRotation.current.y = s.rotY;
    sharedRotation.current.z = s.rotZ;
  }, [state]);

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
    const isMobileView = typeof window !== 'undefined' && window.innerWidth < 768;

    const progress = scrollProgress?.current ?? 0;
    const bobStrength = Math.max(0, 1 - progress / 0.15);
    const bobHero = isMobileView ? 0 : Math.sin(Date.now() * 0.002) * 0.12 * bobStrength;

    const bounceStrength = Math.max(0, (progress - 0.90) / 0.10);
    const bounceTime = Date.now() * 0.005;
    const rawBounce = Math.abs(Math.sin(bounceTime));
    const bounceBall = isMobileView ? 0 : rawBounce * rawBounce * 0.3 * bounceStrength;

    const bobY = bobHero + bounceBall;

    // Position & scale on the outer group (no rotation here)
    const g = groupRef.current;
    const targetScale = s.scale || 1;

    if (isMobileView) {
      g.position.set(s.x, s.y + bobY, s.z);
      g.scale.setScalar(targetScale);
    } else {
      g.position.x = THREE.MathUtils.lerp(g.position.x, s.x, lerp);
      g.position.y = THREE.MathUtils.lerp(g.position.y, s.y + bobY, lerp);
      g.position.z = THREE.MathUtils.lerp(g.position.z, s.z, lerp);
      g.scale.setScalar(THREE.MathUtils.lerp(g.scale.x, targetScale, lerp));
    }

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

  // On mobile, render only the active variant to minimize scroll-time GPU cost.
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
            url={modelUrls[i]}
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
