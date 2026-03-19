import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, PerspectiveCamera } from '@react-three/drei';
import Basketball, { BallState } from './Basketball';
import { Suspense, useRef, useMemo, useEffect, useState } from 'react';
import * as THREE from 'three';

interface SceneProps {
  ballState: React.RefObject<BallState>;
  scrollProgress?: React.RefObject<number>;
  activeVariant?: string;
  variantIndex?: number;
}

interface RendererProfile {
  isMobile: boolean;
  isLowEndMobile: boolean;
  preferDesktopAssetsOnMobile: boolean;
  antialias: boolean;
  shadows: boolean;
  dpr: number | [number, number];
  ambientIntensity: number;
  envIntensity: number;
  shadowMapSize: number;
  showParticles: boolean;
  showEnvironment: boolean;
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

function getRendererProfile(): RendererProfile {
  if (typeof window === 'undefined') {
    return {
      isMobile: false,
      isLowEndMobile: false,
      preferDesktopAssetsOnMobile: false,
      antialias: true,
      shadows: true,
      dpr: [1, 2],
      ambientIntensity: 0.15,
      envIntensity: 0.3,
      shadowMapSize: 1024,
      showParticles: true,
      showEnvironment: true,
    };
  }

  const isMobile = window.innerWidth < 768;
  const deviceMemory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  const hardwareConcurrency = navigator.hardwareConcurrency ?? 4;
  const devicePixelRatio = window.devicePixelRatio || 1;
  const isAppleMobile = isMobile && isAppleMobileDevice();
  const hasKnownLowMemory = typeof deviceMemory === 'number' && deviceMemory <= 3;
  const hasKnownStrongMemory = typeof deviceMemory === 'number' && deviceMemory >= 6;
  const hasLowCpu = hardwareConcurrency <= 4;
  const hasStrongCpu = hardwareConcurrency >= 6;
  const hasStrongDisplay = devicePixelRatio >= 3;
  const isLowEndMobile = isMobile && !isAppleMobile && (hasLowCpu || hasKnownLowMemory);
  const preferDesktopAssetsOnMobile = isMobile && (isAppleMobile ? hasStrongDisplay : (!isLowEndMobile && (hasStrongCpu || hasStrongDisplay || hasKnownStrongMemory)));

  return {
    isMobile,
    isLowEndMobile,
    preferDesktopAssetsOnMobile: preferDesktopAssetsOnMobile,
    antialias: !isMobile || preferDesktopAssetsOnMobile,
    shadows: !isMobile || preferDesktopAssetsOnMobile,
    dpr: isMobile
      ? (isLowEndMobile ? 1 : [isAppleMobile ? 1.25 : 1.0, Math.min(devicePixelRatio, preferDesktopAssetsOnMobile ? (isAppleMobile ? 2.5 : 2) : 1.25)])
      : [1, Math.min(devicePixelRatio, 2)],
    ambientIntensity: isMobile ? (isLowEndMobile ? 0.3 : (preferDesktopAssetsOnMobile ? 0.16 : 0.2)) : 0.15,
    envIntensity: isMobile ? (isLowEndMobile ? 0.08 : (preferDesktopAssetsOnMobile ? 0.3 : 0.22)) : 0.3,
    shadowMapSize: preferDesktopAssetsOnMobile ? 1024 : (isLowEndMobile ? 512 : 1024),
    showParticles: !isMobile,
    showEnvironment: true,
  };
}

function useRendererProfile() {
  const [profile, setProfile] = useState<RendererProfile>(() => getRendererProfile());

  useEffect(() => {
    const onResize = () => setProfile(getRendererProfile());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return profile;
}

function useMobileScrollActivity(isMobile: boolean) {
  const [isScrollActive, setIsScrollActive] = useState(false);

  useEffect(() => {
    if (!isMobile) {
      setIsScrollActive(false);
      return;
    }

    let settleTimer: number | null = null;

    const markActive = () => {
      setIsScrollActive(true);

      if (settleTimer !== null) {
        window.clearTimeout(settleTimer);
      }

      settleTimer = window.setTimeout(() => {
        settleTimer = null;
        setIsScrollActive(false);
      }, 140);
    };

    window.addEventListener('scroll', markActive, { passive: true });
    window.addEventListener('touchmove', markActive, { passive: true });

    return () => {
      window.removeEventListener('scroll', markActive);
      window.removeEventListener('touchmove', markActive);
      if (settleTimer !== null) {
        window.clearTimeout(settleTimer);
      }
    };
  }, [isMobile]);

  return isScrollActive;
}

function isMobileDebugEnabled() {
  if (typeof window === 'undefined') return false;
  return window.location.search.includes('mobileDebug=1') || window.localStorage.getItem('mobileDebug') === '1';
}

function MobileDebugOverlay({
  activeVariant,
  profile,
}: {
  activeVariant: string;
  profile: RendererProfile;
}) {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    setEnabled(isMobileDebugEnabled());
  }, []);

  if (!enabled || !profile.isMobile || typeof window === 'undefined') {
    return null;
  }

  const deviceMemory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 'n/a';
  const hardwareConcurrency = navigator.hardwareConcurrency ?? 'n/a';

  return (
    <div className="pointer-events-none fixed left-3 top-20 z-[120] rounded-md bg-black/70 px-3 py-2 text-[10px] leading-tight text-white backdrop-blur-sm">
      <div>mobile-debug</div>
      <div>variant: {activeVariant}</div>
      <div>dpr: {String(profile.dpr)}</div>
      <div>memory: {String(deviceMemory)}</div>
      <div>cores: {String(hardwareConcurrency)}</div>
      <div>low-end: {profile.isLowEndMobile ? 'yes' : 'no'}</div>
      <div>desktop-assets: {profile.preferDesktopAssetsOnMobile ? 'yes' : 'no'}</div>
    </div>
  );
}

// Floating particles for atmosphere
function Particles({ count = 80 }) {
  const ref = useRef<THREE.Points>(null);

  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count * 3; i += 3) {
      arr[i] = (Math.random() - 0.5) * 20;
      arr[i + 1] = (Math.random() - 0.5) * 20;
      arr[i + 2] = (Math.random() - 0.5) * 10 - 5;
    }
    return arr;
  }, [count]);

  useFrame((state) => {
    if (!ref.current) return;
    ref.current.rotation.y = state.clock.elapsedTime * 0.01;
    const positions = ref.current.geometry.attributes.position;
    for (let i = 0; i < count; i++) {
      const y = positions.getY(i);
      positions.setY(i, y + Math.sin(state.clock.elapsedTime * 0.5 + i) * 0.001);
    }
    positions.needsUpdate = true;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.03}
        color="#FF6B2C"
        transparent
        opacity={0.4}
        sizeAttenuation
      />
    </points>
  );
}

function CameraRig({ isMobile }: { isMobile: boolean }) {
  const { camera } = useThree();

  useFrame((state) => {
    if (isMobile) return;
    const { x, y } = state.pointer;
    camera.position.x = THREE.MathUtils.lerp(camera.position.x, x * 0.3, 0.02);
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, y * 0.2, 0.02);
    camera.lookAt(0, 0, 0);
  });

  return null;
}

function MobileFrameController({ scrollProgress }: { scrollProgress?: React.RefObject<number> }) {
  const { invalidate, setFrameloop } = useThree();

  useEffect(() => {
    let frameId: number | null = null;
    let settleTimer: number | null = null;
    let activeUntil = 0;

    const ensureLoop = () => {
      if (frameId !== null) {
        return;
      }

      const tick = () => {
        invalidate();

        if (document.visibilityState !== 'visible') {
          frameId = null;
          return;
        }

        const now = performance.now();

        if (now < activeUntil) {
          // During burst: render every frame (60fps)
          frameId = window.requestAnimationFrame(tick);
          return;
        }

        // Idle: render at ~20fps for idle rotation
        frameId = window.setTimeout(() => {
          invalidate();
          frameId = window.requestAnimationFrame(tick);
        }, 50) as unknown as number;
      };

      setFrameloop('always');
      frameId = window.requestAnimationFrame(tick);
    };

    const startBurst = (durationMs: number) => {
      activeUntil = Math.max(activeUntil, performance.now() + durationMs);
      ensureLoop();

      if (settleTimer !== null) {
        window.clearTimeout(settleTimer);
      }

      settleTimer = window.setTimeout(() => {
        settleTimer = null;
        invalidate();
      }, durationMs + 32);
    };

    const onScroll = () => startBurst(180);
    const onTouchMove = () => startBurst(180);
    const onResize = () => startBurst(240);
    const onVariantChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ durationMs?: number }>;
      startBurst(customEvent.detail?.durationMs ?? 500);
    };
    const onCartAnimation = () => startBurst(4000);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        startBurst(240);
      } else {
        if (frameId !== null) {
          window.cancelAnimationFrame(frameId);
          frameId = null;
        }
        setFrameloop('demand');
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('resize', onResize);
    window.addEventListener('variant-changed', onVariantChange);
    window.addEventListener('add-to-cart', onCartAnimation);
    window.addEventListener('fly-to-cart', onCartAnimation);
    document.addEventListener('visibilitychange', onVisibilityChange);

    startBurst(320);

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('variant-changed', onVariantChange);
      window.removeEventListener('add-to-cart', onCartAnimation);
      window.removeEventListener('fly-to-cart', onCartAnimation);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
        window.clearTimeout(frameId);
      }
      if (settleTimer !== null) {
        window.clearTimeout(settleTimer);
      }
      setFrameloop('demand');
    };
  }, [invalidate, scrollProgress, setFrameloop]);

  return null;
}

export default function Scene({ ballState, scrollProgress, activeVariant = 'classic', variantIndex = 0 }: SceneProps) {
  const profile = useRendererProfile();
  const isScrollActive = useMobileScrollActivity(profile.isMobile);
  const activeDpr = profile.dpr;
  const activeShadows = profile.shadows; // No degradation during scroll — too visible

  return (
    <>
      <MobileDebugOverlay activeVariant={activeVariant} profile={profile} />
      <div className="canvas-container" aria-hidden="true">
        <Canvas
          shadows={activeShadows}
          gl={{
            antialias: profile.antialias,
            alpha: true,
            powerPreference: 'high-performance',
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: profile.isMobile ? (profile.preferDesktopAssetsOnMobile ? 0.92 : 1) : 0.9,
          }}
          dpr={activeDpr}
          frameloop={profile.isMobile ? 'demand' : 'always'}
          performance={{ min: profile.isLowEndMobile ? 0.6 : 0.8 }}
          style={{ background: 'transparent' }}
        >
          <PerspectiveCamera makeDefault position={[0, 0, 5]} fov={45} />
          <CameraRig isMobile={profile.isMobile} />
          {profile.isMobile && <MobileFrameController scrollProgress={scrollProgress} />}

          <Suspense fallback={null}>
            {profile.showEnvironment && <Environment preset="studio" environmentIntensity={profile.envIntensity} />}

            <ambientLight intensity={profile.ambientIntensity} />

            <directionalLight
              position={[4, 5, 4]}
              intensity={profile.isMobile ? (profile.isLowEndMobile ? 1.5 : (profile.preferDesktopAssetsOnMobile ? 1.8 : 1.75)) : 1.8}
              color="#FFAA66"
              castShadow={activeShadows}
              shadow-mapSize-width={profile.shadowMapSize}
              shadow-mapSize-height={profile.shadowMapSize}
            />

            {!profile.isLowEndMobile && (
              <directionalLight
                position={[-4, 1, 2]}
                intensity={0.4}
                color="#FF9955"
              />
            )}

            {!profile.isLowEndMobile && (
              <pointLight position={[-2, 3, -5]} intensity={profile.isMobile ? 2.6 : 3} color="#FF4400" />
            )}

            {profile.preferDesktopAssetsOnMobile && (
              <pointLight position={[2.5, -1.5, 3]} intensity={1.2} color="#fff1d9" />
            )}

            <Basketball state={ballState} scrollProgress={scrollProgress} activeVariant={activeVariant} variantIndex={variantIndex} />
            {profile.showParticles && <Particles />}
          </Suspense>
        </Canvas>
      </div>
    </>
  );
}
