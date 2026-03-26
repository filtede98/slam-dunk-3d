import { useRef, useEffect, useMemo, useCallback } from 'react';
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

function isAppleMobileDevice() {
  if (typeof window === 'undefined') {
    return false;
  }

  const userAgent = navigator.userAgent;
  const platform = navigator.platform;
  const maxTouchPoints = navigator.maxTouchPoints ?? 0;

  return /iPhone|iPad|iPod/i.test(userAgent) || (platform === 'MacIntel' && maxTouchPoints > 1);
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
  const isAppleMobile = isAppleMobileDevice();
  const hasKnownLowMemory = typeof deviceMemory === 'number' && deviceMemory <= 3;
  const hasLowCpu = hardwareConcurrency <= 4;

  if (!isAppleMobile && (hasKnownLowMemory || hasLowCpu)) {
    return false;
  }

  if (isAppleMobile) {
    return devicePixelRatio >= 3;
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

// Fully dispose a GLTF scene's GPU resources
function disposeGltfScene(scene: THREE.Object3D) {
  scene.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      mesh.geometry?.dispose();
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      materials.forEach((mat) => {
        if (mat && 'dispose' in mat) {
          // Dispose all texture maps
          for (const key of Object.keys(mat)) {
            const value = (mat as Record<string, unknown>)[key];
            if (value instanceof THREE.Texture) {
              value.dispose();
            }
          }
          (mat as THREE.Material).dispose();
        }
      });
    }
  });
}

// Create a shared DRACOLoader instance to avoid re-creating it
const sharedDracoLoader = new DRACOLoader();
sharedDracoLoader.setDecoderPath('/draco/');

function makeDracoCallback(loader: GLTFLoader) {
  loader.setDRACOLoader(sharedDracoLoader);
}

// Individual ball model — each has its own position offset, scale, opacity, and rotation
function BallModel({ url, xOffset, zOffset, scaleFactor, isActive, scrollProgress, rotationRef, opacity }: {
  url: string;
  xOffset: number;
  zOffset: number;
  scaleFactor: number;
  isActive: boolean;
  scrollProgress: React.RefObject<number>;
  rotationRef: React.RefObject<{ x: number; y: number; z: number }>;
  opacity?: React.RefObject<number>;
}) {
  const wrapperRef = useRef<THREE.Group>(null);
  const spinRef = useRef<THREE.Group>(null);
  const { gl } = useThree();
  // Non-active balls start hidden to avoid flash on reload
  const currentX = useRef(isActive ? xOffset : 0);
  const currentZ = useRef(isActive ? zOffset : 0);
  const currentScale = useRef(isActive ? scaleFactor : 0);

  const gltf = useLoader(GLTFLoader, url, makeDracoCallback);

  const scene = useMemo(() => {
    const cloned = gltf.scene.clone(true);
    const box = new THREE.Box3().setFromObject(cloned);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = 2 / maxDim;
    const premiumQuality = typeof window === 'undefined' || window.innerWidth >= 768 || shouldPreferDesktopAssetsOnMobile();
    const anisotropy = premiumQuality ? Math.min(16, gl.capabilities.getMaxAnisotropy()) : 2;

    cloned.position.sub(center);
    cloned.scale.setScalar(scale);

    const isMobileView = typeof window !== 'undefined' && window.innerWidth < 768;

    cloned.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.castShadow = !isMobileView;
        mesh.receiveShadow = !isMobileView;
        if (mesh.material instanceof THREE.MeshStandardMaterial) {
          if (mesh.material.map) {
            mesh.material.map.anisotropy = anisotropy;
            mesh.material.map.minFilter = THREE.LinearMipmapLinearFilter;
            mesh.material.map.magFilter = THREE.LinearFilter;
          }
          if (mesh.material.normalMap) {
            mesh.material.normalMap.anisotropy = anisotropy;
            mesh.material.normalMap.minFilter = THREE.LinearMipmapLinearFilter;
            mesh.material.normalMap.magFilter = THREE.LinearFilter;
          }
          if (mesh.material.metalnessMap) {
            mesh.material.metalnessMap.anisotropy = anisotropy;
            mesh.material.metalnessMap.minFilter = THREE.LinearMipmapLinearFilter;
            mesh.material.metalnessMap.magFilter = THREE.LinearFilter;
          }
          if (mesh.material.roughnessMap) {
            mesh.material.roughnessMap.anisotropy = anisotropy;
            mesh.material.roughnessMap.minFilter = THREE.LinearMipmapLinearFilter;
            mesh.material.roughnessMap.magFilter = THREE.LinearFilter;
          }
          mesh.material.roughness = Math.max(mesh.material.roughness, premiumQuality ? 0.55 : 0.65);
          mesh.material.envMapIntensity = premiumQuality ? 0.9 : 0.4;
          // Enable transparency for fade transitions
          mesh.material.transparent = true;
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

  // Dispose cloned scene GPU resources on unmount
  useEffect(() => {
    return () => {
      disposeGltfScene(scene);
    };
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

    // Apply fade opacity on mobile
    if (isMobileView && opacity) {
      const targetOpacity = opacity.current ?? 1;
      scene.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          materials.forEach((mat) => {
            if (mat instanceof THREE.MeshStandardMaterial) {
              mat.opacity = THREE.MathUtils.lerp(mat.opacity, targetOpacity, 0.15);
            }
          });
        }
      });
    }

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

// Preloader: silently loads a GLB in background without rendering anything
function SilentPreloader({ url }: { url: string }) {
  useLoader(GLTFLoader, url, makeDracoCallback);
  return null;
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

  // Opacity ref for fade transition on mobile
  const ballOpacity = useRef(1);
  // Track previous variant to detect changes
  const prevVariantIndex = useRef(variantIndex);
  // Whether we're currently fading in (new ball just mounted)
  const isFadingIn = useRef(false);

  const modelUrls = useMemo(() =>
    BALL_VARIANTS.map(v => getVariantModel(v, isMobileDevice)),
    [isMobileDevice]
  );

  // Indices of adjacent balls to preload on mobile
  const preloadIndices = useMemo(() => {
    if (!isMobileDevice) return [];
    const total = BALL_VARIANTS.length;
    const prev = (variantIndex - 1 + total) % total;
    const next = (variantIndex + 1) % total;
    // Deduplicate and exclude active
    return [...new Set([prev, next])].filter(i => i !== variantIndex);
  }, [variantIndex, isMobileDevice]);

  // On variant change: start fade-in for new ball
  useEffect(() => {
    if (!isMobileDevice) return;
    if (prevVariantIndex.current !== variantIndex) {
      prevVariantIndex.current = variantIndex;
      // Start opacity at 0 and animate to 1
      ballOpacity.current = 0;
      isFadingIn.current = true;
    }
  }, [variantIndex, isMobileDevice]);

  // Animate opacity to 1 when fading in
  useEffect(() => {
    if (!isMobileDevice || !isFadingIn.current) return;
    let raf: number;
    const animate = () => {
      ballOpacity.current = Math.min(1, ballOpacity.current + 0.06);
      if (ballOpacity.current < 1) {
        raf = requestAnimationFrame(animate);
        // Trigger a render burst
        window.dispatchEvent(new CustomEvent('variant-changed', { detail: { durationMs: 800 } }));
      } else {
        isFadingIn.current = false;
      }
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [variantIndex, isMobileDevice]);

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

  // Preload all models on desktop; on mobile preload only active + adjacent
  useEffect(() => {
    if (isMobileDevice) {
      // Preload active + adjacent (prev/next) with a small delay to not block first render
      const timer = setTimeout(() => {
        [variantIndex, ...preloadIndices].forEach((i) => {
          useLoader.preload(GLTFLoader, modelUrls[i], makeDracoCallback);
        });
      }, 300);
      return () => clearTimeout(timer);
    }

    // Desktop: preload all immediately
    modelUrls.forEach((url) => {
      useLoader.preload(GLTFLoader, url, makeDracoCallback);
    });
  }, [modelUrls, isMobileDevice, variantIndex, preloadIndices]);

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
            opacity={isMobileDevice ? ballOpacity : undefined}
          />
        );
      })}
      {/* Silent preloaders for adjacent balls on mobile */}
      {isMobileDevice && preloadIndices.map((i) => (
        <SilentPreloader key={`preload-${i}`} url={modelUrls[i]} />
      ))}
    </group>
  );
}
