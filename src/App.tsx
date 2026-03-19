import { useEffect, useRef, useCallback, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Navbar from './components/Navbar';
import Scene from './components/Scene';
import UIContent from './components/UIContent';
import { BallState } from './components/Basketball';
import { BALL_VARIANTS } from './constants';

gsap.registerPlugin(ScrollTrigger);

export default function App() {
  const mainRef = useRef<HTMLDivElement>(null);
  const ballState = useRef<BallState>({
    x: 0,
    y: 0,
    z: -2,
    scale: 1.6,
    rotX: 0.15,
    rotY: 0,
    rotZ: 0,
    visible: false,
  });
  const scrollProgress = useRef(0);
  const [variantIndex, setVariantIndex] = useState(0);
  const activeVariant = BALL_VARIANTS[variantIndex].id;

  const cartIconRef = useRef<HTMLDivElement>(null);

  const handleVariantChange = useCallback((variantId: string) => {
    const idx = BALL_VARIANTS.findIndex(v => v.id === variantId);
    if (idx >= 0) setVariantIndex(idx);
  }, []);

  const handleSwipeVariant = useCallback((direction: 'left' | 'right') => {
    setVariantIndex(prev => {
      if (direction === 'left') return (prev + 1) % BALL_VARIANTS.length;
      return (prev - 1 + BALL_VARIANTS.length) % BALL_VARIANTS.length;
    });
  }, []);

  // Add-to-cart: ball flies to navbar hoop (top right)
  const handleAddToCart = useCallback(() => {
    if (!cartIconRef.current) return;

    playAddToCartSound();
    // Force navbar visible first, then animate
    window.dispatchEvent(new CustomEvent('add-to-cart'));

    // Wait a frame for navbar to appear
    requestAnimationFrame(() => {
      const cartRect = cartIconRef.current!.getBoundingClientRect();
      const vh = window.innerHeight;
      const vw = window.innerWidth;
      const fov = 45;
      const cameraZ = 5;

      const orig = { ...ballState.current };
      const startRotY = orig.rotY;

      // Raise canvas above navbar so ball flies over it
      const canvas = document.querySelector('.canvas-container') as HTMLElement;
      if (canvas) canvas.style.zIndex = '60';
      // Hide non-active carousel balls during animation
      (window as any).__cartAnimating = true;

      // Convert cart icon position to 3D coords
      const dist = cameraZ - 3;
      const visH = 2 * Math.tan((fov / 2) * Math.PI / 180) * dist;
      const visW = visH * (vw / vh);
      const targetX = ((cartRect.left + cartRect.width / 2) / vw - 0.5) * visW;
      const targetY = (0.5 - (cartRect.top + cartRect.height / 2) / vh) * visH;

      const tl = gsap.timeline();

      // Phase 1: Wind-up — ball dips down
      tl.to(ballState.current, {
        y: orig.y - 0.3,
        scale: orig.scale * 0.85,
        duration: 0.12,
        ease: 'power2.in',
      })
      // Phase 2: Launch UP with spin
      .to(ballState.current, {
        y: orig.y + 1.5,
        z: orig.z + 1,
        scale: orig.scale * 0.6,
        rotY: startRotY + Math.PI * 3,
        duration: 0.35,
        ease: 'power3.out',
      })
      // Phase 3: Arc toward cart — midpoint
      .to(ballState.current, {
        x: targetX * 0.4,
        y: targetY * 0.5 + orig.y * 0.5,
        z: 2,
        scale: 0.25,
        rotY: startRotY + Math.PI * 5,
        duration: 0.25,
        ease: 'none',
      })
      // Phase 4: Slam into cart hoop
      .to(ballState.current, {
        x: targetX,
        y: targetY,
        z: 3,
        scale: 0.08,
        rotY: startRotY + Math.PI * 8,
        duration: 0.2,
        ease: 'power3.in',
      })
      // Phase 5: Impact
      .to(ballState.current, {
        scale: 0,
        duration: 0.08,
        onComplete: () => {
          // Burst at cart
          const burst = document.createElement('div');
          burst.style.cssText = `position:fixed;top:${cartRect.top + cartRect.height / 2}px;left:${cartRect.left + cartRect.width / 2}px;width:0;height:0;border-radius:50%;background:radial-gradient(circle,rgba(255,77,0,0.6),transparent);z-index:200;pointer-events:none;transform:translate(-50%,-50%);`;
          document.body.appendChild(burst);
          gsap.to(burst, {
            width: 80, height: 80, opacity: 0,
            duration: 0.5, ease: 'power2.out',
            onComplete: () => burst.remove(),
          });
          // Shake hoop
          if (cartIconRef.current) {
            gsap.fromTo(cartIconRef.current,
              { rotation: 0 },
              { rotation: 12, duration: 0.06, yoyo: true, repeat: 5, ease: 'power1.inOut',
                onComplete: () => gsap.set(cartIconRef.current, { rotation: 0 }) }
            );
          }
        },
      })
      .to(ballState.current, {
        visible: false,
        duration: 0,
        onComplete: () => {
          // Restore canvas z-index BEFORE respawn so ball stays behind content
          if (canvas) canvas.style.zIndex = '10';
        },
      })
      // Phase 6: Respawn
      .to(ballState.current, {
        ...orig,
        scale: 0,
        visible: true,
        duration: 0,
        delay: 0.6,
      })
      .to(ballState.current, {
        scale: orig.scale,
        duration: 0.9,
        ease: 'elastic.out(1.2, 0.35)',
        onComplete: () => {
          (window as any).__cartAnimating = false;
        },
      });
    });
  }, []);

  // Expose add-to-cart handler
  useEffect(() => {
    const handler = () => handleAddToCart();
    window.addEventListener('fly-to-cart', handler);
    return () => window.removeEventListener('fly-to-cart', handler);
  }, [handleAddToCart]);

  useEffect(() => {
    if (!mainRef.current) return;

    // Calculate section positions dynamically for accurate keyframes
    const scrollable = mainRef.current.scrollHeight - window.innerHeight;
    const productEl = document.getElementById('product-section');
    const footerEl = document.querySelector('footer');
    const pStart = productEl ? productEl.offsetTop / scrollable : 0.65;
    const pEnd = productEl ? (productEl.offsetTop + productEl.offsetHeight) / scrollable : 0.85;
    const fStart = footerEl ? footerEl.offsetTop / scrollable : 0.9;
    const productHeight = productEl ? productEl.offsetHeight : 0;
    const stickyUnpin = productEl
      ? (productEl.offsetTop + productHeight - window.innerHeight) / scrollable
      : pEnd;

    // Pre-product keyframes are proportional to pStart
    const s = pStart; // scale factor for pre-product sections
    // Mobile scale factor — shrink ball on narrow screens
    const isMobile = window.innerWidth < 768;
    const m = isMobile ? 0.5 : 1; // 50% size on mobile
    const keyframes = [
      { at: 0.00,          x: 0,    y: isMobile ? 0.8 : 0,    z: -2,  scale: 1.6 * m,  rotX: 0.15, rotY: 0,             rotZ: 0 },   // Hero
      { at: s * 0.19,      x: 0,    y: isMobile ? 0.5 : 0,    z: -1.5,scale: 1.3 * m,  rotX: 0.1,  rotY: Math.PI * 0.3,  rotZ: 0 },  // Leaving hero
      { at: s * 0.36,      x: 2.8*m,  y: 0.2,  z: 0.5, scale: 2.0*m,  rotX: 0.2,  rotY: Math.PI,        rotZ: 0 },  // Aero: far RIGHT
      { at: s * 0.55,      x: 2.5*m,  y: 0,    z: 0.5, scale: 1.8*m,  rotX: 0.25, rotY: Math.PI * 1.5,  rotZ: 0 },  // Mid aero
      { at: s * 0.75,      x: -2.8*m, y: 0.2,  z: 0.5, scale: 2.2*m,  rotX: 0,    rotY: Math.PI * 2,    rotZ: 0 },  // Grip: far LEFT
      { at: s * 0.82,      x: -2.5*m, y: 0,    z: 0.5, scale: 2.0*m,  rotX:-0.1,  rotY: Math.PI * 2.5,  rotZ: 0 },  // Mid grip
      { at: s * 0.90,      x: -1.5*m, y: 0,    z: 0,   scale: 1.5*m,  rotX: 0,    rotY: Math.PI * 2.65, rotZ: 0 },  // Leaving grip: moving center
      { at: s * 0.96,      x: -0.5*m, y: 0,    z: -0.5,scale: 1.0*m,  rotX: 0,    rotY: Math.PI * 2.8,  rotZ: 0 },  // Approaching: shrinking, staying level
      { at: pStart,                          x: 0, y: 0.2, z: -1, scale: isMobile ? 0.45 : 0.5,  rotX: 0.05, rotY: Math.PI * 3,   rotZ: 0 },  // Arrives near pedestal
      { at: pEnd - 0.02,                    x: 0, y: 0,   z: -1, scale: isMobile ? 0.45 : 0.5,  rotX: 0,    rotY: Math.PI * 3.6, rotZ: 0 },  // Ball follows pedestal up
      { at: pEnd,                           x: 0, y: 10,  z: -1, scale: 0,    rotX: 0,    rotY: Math.PI * 3.7, rotZ: 0 },  // Gone — hidden before footer
      { at: 1.00,                           x: 0, y: 10,  z: -3, scale: 0,    rotX: 0,    rotY: Math.PI * 4.5, rotZ: 0 },  // Stay hidden
    ];

    function lerpKeyframes(progress: number) {
      // Clamp progress
      const p = Math.max(0, Math.min(1, progress));

      // Find the two keyframes we're between
      let a = keyframes[0];
      let b = keyframes[keyframes.length - 1];

      for (let i = 0; i < keyframes.length - 1; i++) {
        if (p >= keyframes[i].at && p <= keyframes[i + 1].at) {
          a = keyframes[i];
          b = keyframes[i + 1];
          break;
        }
      }

      // Local progress between these two keyframes
      const range = b.at - a.at;
      const t = range > 0 ? (p - a.at) / range : 0;

      // Smooth step for nicer transitions
      const smooth = t * t * (3 - 2 * t);

      return {
        x: a.x + (b.x - a.x) * smooth,
        y: a.y + (b.y - a.y) * smooth,
        z: a.z + (b.z - a.z) * smooth,
        scale: a.scale + (b.scale - a.scale) * smooth,
        rotX: a.rotX + (b.rotX - a.rotX) * smooth,
        rotY: a.rotY + (b.rotY - a.rotY) * smooth,
        rotZ: a.rotZ + (b.rotZ - a.rotZ) * smooth,
      };
    }

    // Reference to the actual pedestal div for dynamic tracking
    const pedestalEl = document.querySelector('#product-section .relative.w-64') || document.querySelector('#product-section .sticky-content');

    // Convert screen Y position to Three.js Y coordinate
    // Camera is at z=5, fov=45 degrees
    function screenYToThreeY(screenY: number, threeZ: number) {
      const vh = window.innerHeight;
      const fov = 45;
      const cameraZ = 5;
      const dist = cameraZ - threeZ;
      const visibleHeight = 2 * Math.tan((fov / 2) * Math.PI / 180) * dist;
      // screenY=0 is top (positive Three.js Y), screenY=vh is bottom (negative Three.js Y)
      const normalized = 0.5 - screenY / vh;
      return normalized * visibleHeight;
    }

    const ctx = gsap.context(() => {
      // Single ScrollTrigger for the whole page
      ScrollTrigger.create({
        trigger: mainRef.current,
        start: 'top top',
        end: 'bottom bottom',
        scrub: window.innerWidth < 768 ? 0.3 : 0.1,
        onUpdate: (self) => {
          scrollProgress.current = self.progress;
          const vals = lerpKeyframes(self.progress);

          // During product section, track pedestal position (ball follows pedestal up)
          if (self.progress >= pStart && self.progress <= pEnd && pedestalEl) {
            const rect = pedestalEl.getBoundingClientRect();
            // Use the center of the pedestal div
            const isMobileView = window.innerWidth < 768;
            const pedestalCenterY = rect.top + rect.height * (isMobileView ? 0.40 : 0.38);
            const trackedY = screenYToThreeY(pedestalCenterY, vals.z);
            // Blend in tracking over first 25% of product section for smooth entry from below
            const blendIn = Math.min(1, (self.progress - pStart) / ((pEnd - pStart) * 0.25));
            const smoothBlend = blendIn * blendIn * (3 - 2 * blendIn); // smooth step
            vals.y = vals.y * (1 - smoothBlend) + trackedY * smoothBlend;
          }

          ballState.current.x = vals.x;
          ballState.current.y = vals.y;
          ballState.current.z = vals.z;
          ballState.current.scale = vals.scale;
          ballState.current.rotX = vals.rotX;
          ballState.current.rotY = vals.rotY;
          ballState.current.rotZ = vals.rotZ;
          // Show ball only after first ScrollTrigger update (avoids flash on reload)
          ballState.current.visible = true;
        },
      });

      // Immediately set correct position based on current scroll (avoids invisible ball on load)
      requestAnimationFrame(() => {
        const scrollable = mainRef.current!.scrollHeight - window.innerHeight;
        const initialProgress = scrollable > 0 ? window.scrollY / scrollable : 0;
        scrollProgress.current = initialProgress;
        const vals = lerpKeyframes(initialProgress);
        ballState.current.x = vals.x;
        ballState.current.y = vals.y;
        ballState.current.z = vals.z;
        ballState.current.scale = vals.scale;
        ballState.current.rotX = vals.rotX;
        ballState.current.rotY = vals.rotY;
        ballState.current.rotZ = vals.rotZ;
        ballState.current.visible = true;
      });
    }, mainRef);

    return () => ctx.revert();
  }, []);

  return (
    <div ref={mainRef} className="relative bg-black text-white">
      <Navbar cartIconRef={cartIconRef} />

      {/* 3D Scene — fixed behind content */}
      <Scene ballState={ballState} scrollProgress={scrollProgress} activeVariant={activeVariant} variantIndex={variantIndex} />

      {/* Scrolling HTML content on top */}
      <div className="relative z-20">
        <UIContent
          onAddToCart={handleAddToCart}
          onVariantChange={handleVariantChange}
          onSwipeVariant={handleSwipeVariant}
          variantIndex={variantIndex}
        />
      </div>

      {/* Ambient background glow */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60vw] h-[60vh] bg-[#FF4D00]/[0.04] blur-[120px] rounded-full" />
        <div className="absolute bottom-1/4 right-1/4 w-[30vw] h-[30vh] bg-[#FF4D00]/[0.02] blur-[100px] rounded-full" />
      </div>
    </div>
  );
}

// Web Audio API sound synthesis
function playAddToCartSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();

    // Swoosh sound
    const swoosh = ctx.createOscillator();
    const swooshGain = ctx.createGain();
    swoosh.type = 'sine';
    swoosh.connect(swooshGain);
    swooshGain.connect(ctx.destination);

    swoosh.frequency.setValueAtTime(600, ctx.currentTime);
    swoosh.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.25);
    swooshGain.gain.setValueAtTime(0.2, ctx.currentTime);
    swooshGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);

    swoosh.start(ctx.currentTime);
    swoosh.stop(ctx.currentTime + 0.25);

    // Impact/thud
    const impact = ctx.createOscillator();
    const impactGain = ctx.createGain();
    impact.type = 'triangle';
    impact.connect(impactGain);
    impactGain.connect(ctx.destination);

    impact.frequency.setValueAtTime(120, ctx.currentTime + 0.2);
    impact.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.4);
    impactGain.gain.setValueAtTime(0, ctx.currentTime);
    impactGain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.22);
    impactGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);

    impact.start(ctx.currentTime + 0.2);
    impact.stop(ctx.currentTime + 0.5);

    // Success chime
    const chime = ctx.createOscillator();
    const chimeGain = ctx.createGain();
    chime.type = 'sine';
    chime.connect(chimeGain);
    chimeGain.connect(ctx.destination);

    chime.frequency.setValueAtTime(880, ctx.currentTime + 0.35);
    chime.frequency.setValueAtTime(1100, ctx.currentTime + 0.45);
    chimeGain.gain.setValueAtTime(0, ctx.currentTime + 0.35);
    chimeGain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.37);
    chimeGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.7);

    chime.start(ctx.currentTime + 0.35);
    chime.stop(ctx.currentTime + 0.7);
  } catch (e) {
    // Audio not available
  }
}
