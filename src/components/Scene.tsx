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
  antialias: boolean;
  shadows: boolean;
  dpr: number | [number, number];
  ambientIntensity: number;
  envIntensity: number;
  shadowMapSize: number;
  showParticles: boolean;
  showEnvironment: boolean;
}

function getRendererProfile(): RendererProfile {
  if (typeof window === 'undefined') {
    return {
      isMobile: false,
      isLowEndMobile: false,
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
  const deviceMemory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
  const hardwareConcurrency = navigator.hardwareConcurrency ?? 4;
  const devicePixelRatio = window.devicePixelRatio || 1;
  const isLowEndMobile = isMobile && (deviceMemory <= 4 || hardwareConcurrency <= 4);

  return {
    isMobile,
    isLowEndMobile,
    antialias: !isLowEndMobile,
    shadows: !isMobile,
    dpr: isMobile
      ? (isLowEndMobile ? 0.9 : [1, Math.min(devicePixelRatio, 1.25)])
      : [1, Math.min(devicePixelRatio, 2)],
    ambientIntensity: isMobile ? (isLowEndMobile ? 0.34 : 0.24) : 0.15,
    envIntensity: isMobile ? (isLowEndMobile ? 0 : 0.18) : 0.3,
    shadowMapSize: isLowEndMobile ? 512 : 1024,
    showParticles: !isMobile,
    showEnvironment: !isLowEndMobile,
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

export default function Scene({ ballState, scrollProgress, activeVariant = 'classic', variantIndex = 0 }: SceneProps) {
  const profile = useRendererProfile();

  return (
    <>
      <MobileDebugOverlay activeVariant={activeVariant} profile={profile} />
      <div className="canvas-container" aria-hidden="true">
        <Canvas
          shadows={profile.shadows}
          gl={{
            antialias: profile.antialias,
            alpha: true,
            powerPreference: 'high-performance',
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: profile.isMobile ? 1 : 0.9,
          }}
          dpr={profile.dpr}
            frameloop="always"
          performance={{ min: profile.isLowEndMobile ? 0.6 : 0.8 }}
          style={{ background: 'transparent' }}
        >
          <PerspectiveCamera makeDefault position={[0, 0, 5]} fov={45} />
          <CameraRig isMobile={profile.isMobile} />

          <Suspense fallback={null}>
            {profile.showEnvironment && <Environment preset="studio" environmentIntensity={profile.envIntensity} />}

            <ambientLight intensity={profile.ambientIntensity} />

            <directionalLight
              position={[4, 5, 4]}
              intensity={profile.isMobile ? (profile.isLowEndMobile ? 1.45 : 1.6) : 1.8}
              color="#FFAA66"
              castShadow={profile.shadows}
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

            <Basketball state={ballState} scrollProgress={scrollProgress} activeVariant={activeVariant} variantIndex={variantIndex} />
            {profile.showParticles && <Particles />}
          </Suspense>
        </Canvas>
      </div>
    </>
  );
}
