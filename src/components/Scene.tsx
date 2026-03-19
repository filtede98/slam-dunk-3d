import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { AdaptiveDpr, Environment, PerspectiveCamera } from '@react-three/drei';
import Basketball, { BallState } from './Basketball';
import { Suspense, useRef, useMemo, useEffect } from 'react';
import * as THREE from 'three';

interface SceneProps {
  ballState: React.RefObject<BallState>;
  scrollProgress?: React.RefObject<number>;
  activeVariant?: string;
  variantIndex?: number;
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

// Dynamic camera rig with mouse tracking (desktop only)
function CameraRig() {
  const { camera } = useThree();

  useFrame((state) => {
    if (isMobileCheck) return; // Skip on mobile — no mouse, saves CPU
    const { x, y } = state.pointer;
    camera.position.x = THREE.MathUtils.lerp(camera.position.x, x * 0.3, 0.02);
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, y * 0.2, 0.02);
    camera.lookAt(0, 0, 0);
  });

  return null;
}

// Invalidate canvas on scroll so demand mode re-renders
function ScrollInvalidator() {
  const { invalidate } = useThree();
  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(() => {
          invalidate();
          ticking = false;
        });
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    // Also invalidate periodically for idle spin
    const interval = setInterval(() => invalidate(), isMobileCheck ? 50 : 16);
    return () => {
      window.removeEventListener('scroll', onScroll);
      clearInterval(interval);
    };
  }, [invalidate]);
  return null;
}

const isMobileCheck = typeof window !== 'undefined' && window.innerWidth < 768;

export default function Scene({ ballState, scrollProgress, activeVariant = 'classic', variantIndex = 0 }: SceneProps) {
  return (
    <div className="canvas-container" aria-hidden="true">
      <Canvas
        shadows={!isMobileCheck}
        gl={{
          antialias: !isMobileCheck,
          alpha: true,
          powerPreference: 'high-performance',
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 0.9,
        }}
        dpr={isMobileCheck ? [1, 1] : [1, 2]}
        frameloop={isMobileCheck ? 'demand' : 'always'}
        style={{ background: 'transparent' }}
      >
        <PerspectiveCamera makeDefault position={[0, 0, 5]} fov={45} />
        <CameraRig />
        {isMobileCheck && <ScrollInvalidator />}

        <Suspense fallback={null}>
          {/* Environment map for PBR reflections — skip on mobile for performance */}
          {!isMobileCheck && <Environment preset="studio" environmentIntensity={0.3} />}

          {/* Ambient — slightly stronger on mobile to compensate no env map */}
          <ambientLight intensity={isMobileCheck ? 0.35 : 0.15} />

          {/* Key light — warm, from front-right, not too strong */}
          <directionalLight
            position={[4, 5, 4]}
            intensity={1.8}
            color="#FFAA66"
            castShadow={!isMobileCheck}
            shadow-mapSize-width={isMobileCheck ? 512 : 1024}
            shadow-mapSize-height={isMobileCheck ? 512 : 1024}
          />

          {/* Fill light — very subtle, from the left */}
          <directionalLight
            position={[-4, 1, 2]}
            intensity={0.4}
            color="#FF9955"
          />

          {/* Rim/back light — orange edge glow for premium look */}
          <pointLight position={[-2, 3, -5]} intensity={3} color="#FF4400" />

          <Basketball state={ballState} scrollProgress={scrollProgress} activeVariant={activeVariant} variantIndex={variantIndex} />
          {!isMobileCheck && <Particles />}

          <AdaptiveDpr pixelated />
        </Suspense>
      </Canvas>
    </div>
  );
}
