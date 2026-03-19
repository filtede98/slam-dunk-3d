import { useCallback, useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ArrowRight, Star, Zap, Shield, Trophy, ChevronDown } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

import { BALL_VARIANTS } from '../constants';

interface UIContentProps {
  onAddToCart: () => void;
  onVariantChange?: (variantId: string) => void;
  onSwipeVariant?: (direction: 'left' | 'right') => void;
  variantIndex?: number;
}

export default function UIContent({ onAddToCart, onVariantChange, onSwipeVariant, variantIndex = 0 }: UIContentProps) {
  const [activeVariant, setActiveVariant] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  // Sync local activeVariant with parent variantIndex
  useEffect(() => {
    setActiveVariant(variantIndex);
  }, [variantIndex]);

  // Swipe handlers for hero section
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    touchStart.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!touchStart.current) return;
    const deltaX = e.clientX - touchStart.current.x;
    const deltaY = e.clientY - touchStart.current.y;
    touchStart.current = null;

    // Must be primarily horizontal and exceed threshold
    if (Math.abs(deltaX) > 50 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
      onSwipeVariant?.(deltaX < 0 ? 'left' : 'right');
    }
  }, [onSwipeVariant]);

  // Trackpad horizontal swipe support
  const wheelAccum = useRef(0);
  const wheelTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wheelCooldown = useRef(false);
  useEffect(() => {
    const hero = document.getElementById('hero-section');
    if (!hero) return;

    const handleWheel = (e: WheelEvent) => {
      // Only trigger on clearly horizontal swipe, not vertical scroll
      if (Math.abs(e.deltaX) < Math.abs(e.deltaY) * 2) return;
      if (Math.abs(e.deltaX) < 5) return;
      // Cooldown active — ignore
      if (wheelCooldown.current) return;

      e.preventDefault();
      wheelAccum.current += e.deltaX;

      if (wheelTimeout.current) clearTimeout(wheelTimeout.current);

      // Higher threshold + cooldown to prevent rapid cycling
      if (Math.abs(wheelAccum.current) > 150) {
        onSwipeVariant?.(wheelAccum.current > 0 ? 'left' : 'right');
        wheelAccum.current = 0;
        // Block further changes for 600ms
        wheelCooldown.current = true;
        setTimeout(() => { wheelCooldown.current = false; }, 600);
      }

      wheelTimeout.current = setTimeout(() => {
        wheelAccum.current = 0;
      }, 300);
    };

    hero.addEventListener('wheel', handleWheel, { passive: false });
    return () => hero.removeEventListener('wheel', handleWheel);
  }, [onSwipeVariant]);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Hero — quick subtle fade-in
      gsap.fromTo('.hero-word',
        { y: 30, opacity: 0 },
        { y: 0, opacity: 1, stagger: 0.06, duration: 0.6, ease: 'power3.out', delay: 0.1 }
      );

      gsap.fromTo('.hero-subtitle',
        { opacity: 0 },
        { opacity: 1, duration: 0.5, ease: 'power2.out', delay: 0.3 }
      );

      gsap.fromTo('.hero-cta',
        { opacity: 0 },
        { opacity: 1, stagger: 0.08, duration: 0.4, ease: 'power2.out', delay: 0.4 }
      );

      // Scroll indicator
      gsap.to('.scroll-indicator', {
        y: 10,
        opacity: 0.3,
        duration: 1.5,
        ease: 'power1.inOut',
        yoyo: true,
        repeat: -1,
      });

      // Fade-up reveals for all sections
      gsap.utils.toArray<HTMLElement>('.reveal').forEach((el) => {
        gsap.fromTo(el,
          { y: 60, opacity: 0 },
          {
            y: 0, opacity: 1,
            duration: 1,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: el,
              start: 'top 85%',
              toggleActions: 'play none none none',
            },
          }
        );
      });

      // Staggered stat counters
      gsap.utils.toArray<HTMLElement>('.stat-number').forEach((el) => {
        const target = parseFloat(el.dataset.value || '0');
        const suffix = el.dataset.suffix || '';
        const obj = { val: 0 };

        gsap.to(obj, {
          val: target,
          duration: 2,
          ease: 'power1.out',
          scrollTrigger: {
            trigger: el,
            start: 'top 90%',
          },
          onUpdate: () => {
            el.textContent = (target % 1 === 0 ? Math.round(obj.val) : obj.val.toFixed(1)) + suffix;
          },
        });
      });

      // Parallax text movement
      gsap.utils.toArray<HTMLElement>('.parallax-text').forEach((el) => {
        gsap.to(el, {
          yPercent: -15,
          ease: 'none',
          scrollTrigger: {
            trigger: el.parentElement,
            start: 'top bottom',
            end: 'bottom top',
            scrub: true,
          },
        });
      });

      // Progress bar animation
      gsap.utils.toArray<HTMLElement>('.progress-fill').forEach((el) => {
        gsap.fromTo(el,
          { width: '0%' },
          {
            width: el.dataset.width || '0%',
            duration: 1.5,
            ease: 'power2.out',
            scrollTrigger: { trigger: el, start: 'top 85%' },
          }
        );
      });

      // Horizontal line reveals
      gsap.utils.toArray<HTMLElement>('.line-reveal').forEach((el) => {
        gsap.fromTo(el,
          { scaleX: 0 },
          {
            scaleX: 1,
            duration: 1,
            ease: 'power3.inOut',
            scrollTrigger: { trigger: el, start: 'top 85%' },
          }
        );
      });

    }, containerRef);

    return () => ctx.revert();
  }, []);

  const handleAddToCart = () => {
    onAddToCart();
  };

  return (
    <div ref={containerRef} className="relative">

      {/* ═══════════ SECTION 1: HERO ═══════════ */}
      <section
        id="hero-section"
        className="content-section text-center items-center justify-center"
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        style={{ touchAction: 'pan-y' }}
      >
        {/* Radial glow behind the ball */}
        <div className="hero-glow absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60vw] h-[60vh] bg-[#FF4D00]/[0.06] blur-[120px] rounded-full pointer-events-none z-0" />

        {/* Swipe arrows near ball — mobile only */}
        <div className="md:hidden absolute top-[30%] left-4 z-20 flex flex-col items-center gap-1 animate-[swipeLeft_1.5s_ease-in-out_infinite]">
          <svg className="w-6 h-6 text-white/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </div>
        <div className="md:hidden absolute top-[30%] right-4 z-20 flex flex-col items-center gap-1 animate-[swipeRight_1.5s_ease-in-out_infinite]">
          <svg className="w-6 h-6 text-white/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </div>

        <div className="relative z-10 max-w-5xl pt-32 md:pt-0">
          <div className="overflow-hidden mb-1">
            <h1 className="text-[clamp(3.5rem,11vw,9rem)] leading-[0.85] tracking-tighter">
              <span className="hero-word inline-block">SLAM</span>{' '}
              <span className="hero-word inline-block text-accent">DUNK</span>
            </h1>
          </div>
          <div className="overflow-hidden">
            <h2 className="text-[clamp(1.2rem,3vw,2.5rem)] leading-[0.9] tracking-tight text-white/40 font-display uppercase">
              <span className="hero-word inline-block">ELITE</span>{' '}
              <span className="hero-word inline-block">SERIES</span>
            </h2>
          </div>

          <p className="hero-subtitle text-base md:text-lg text-white/50 mt-5 mb-8 max-w-xl mx-auto leading-relaxed">
            Progettata per prestazioni d'elite. Tecnologia in pelle procedurale
            unita a un grip senza pari. Volo puro, zero compromessi.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button className="hero-cta group relative px-8 py-4 bg-accent hover:bg-accent-light text-white font-bold rounded-full transition-all duration-300 hover:scale-105 overflow-hidden">
              <span className="relative z-10 flex items-center gap-2">
                SCOPRI LA TECNOLOGIA
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </span>
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
            </button>
            <button
              onClick={handleAddToCart}
              className="hero-cta px-8 py-4 border border-white/15 hover:border-white/40 text-white font-bold rounded-full transition-all duration-300 hover:scale-105 hover:bg-white/5"
            >
              AGGIUNGI AL CARRELLO — 149,99€
            </button>
          </div>
        </div>

        {/* Variant dots + swipe hint */}
        <div className="hero-cta absolute bottom-20 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3">
          <span className="text-xs uppercase tracking-[0.3em] text-white/30 transition-all duration-500">
            {BALL_VARIANTS[variantIndex].name}
          </span>
          <div className="flex items-center gap-3">
            {/* Swipe hint — mobile only */}
            <span className="md:hidden text-white/40 text-2xl animate-[swipeLeft_1.5s_ease-in-out_infinite]">‹</span>
            <div className="flex gap-2">
              {BALL_VARIANTS.map((v, i) => (
                <button
                  key={v.id}
                  onClick={() => { setActiveVariant(i); onVariantChange?.(v.id); }}
                  className={`w-3 h-3 rounded-full transition-all duration-300 ${v.color} ${
                    i === variantIndex ? 'scale-150 ring-2 ring-white/50' : 'opacity-50 hover:opacity-75'
                  }`}
                />
              ))}
            </div>
            <span className="md:hidden text-white/40 text-2xl animate-[swipeRight_1.5s_ease-in-out_infinite]">›</span>
          </div>
          <span className="md:hidden text-[10px] uppercase tracking-[0.25em] text-white/30">Scorri per cambiare</span>
        </div>

        {/* Scroll indicator */}
        <div className="scroll-indicator absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-white/30">
          <span className="text-xs uppercase tracking-[0.3em]">Scorri</span>
          <ChevronDown className="w-5 h-5" />
        </div>
      </section>

      {/* ═══════════ SECTION 2: AERODYNAMICS ═══════════ */}
      <section id="aero-section" className="scroll-section" style={{ minHeight: '400vh' }}>
        <div className="sticky-content">
        <div className="grid md:grid-cols-2 gap-16 items-center w-full">
          <div className="max-w-xl">
            <div className="flex items-center gap-3 mb-6 reveal">
              <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
                <Zap className="w-5 h-5 text-accent" />
              </div>
              <span className="font-bold tracking-[0.2em] uppercase text-xs text-accent">
                Aerodinamica
              </span>
            </div>

            <h2 className="text-5xl md:text-7xl mb-8 reveal">
              PROGETTATA
              <br />
              PER IL <span className="text-accent">VOLO</span>
            </h2>

            <div className="line-reveal h-[1px] bg-white/10 mb-8 origin-left max-w-[60%] md:max-w-full" />

            <p className="text-lg text-white/50 mb-12 leading-relaxed reveal">
              La nostra tecnologia rivoluzionaria riduce la resistenza aerodinamica del 14%,
              garantendo traiettorie di tiro piu consistenti e passaggi piu veloci.
              La distribuzione interna della pressione assicura un rimbalzo perfetto ogni volta.
            </p>

            <div className="grid grid-cols-3 gap-8">
              <div className="reveal">
                <div className="text-4xl md:text-5xl font-display text-accent mb-2">
                  <span className="stat-number" data-value="94" data-suffix="%">0%</span>
                </div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-white/40">
                  Grip
                </div>
              </div>
              <div className="reveal">
                <div className="text-4xl md:text-5xl font-display text-accent mb-2">
                  <span className="stat-number" data-value="0.8" data-suffix="s">0s</span>
                </div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-white/40">
                  Tempo di Risposta
                </div>
              </div>
              <div className="reveal">
                <div className="text-4xl md:text-5xl font-display text-accent mb-2">
                  <span className="stat-number" data-value="360" data-suffix="°">0°</span>
                </div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-white/40">
                  Controllo Totale
                </div>
              </div>
            </div>
          </div>

          {/* Right side intentionally empty for ball positioning */}
          <div className="hidden md:block" />
        </div>
        </div>
      </section>

      {/* ═══════════ SECTION 3: GRIP / MATERIAL ═══════════ */}
      <section id="grip-section" className="scroll-section" style={{ minHeight: '400vh' }}>
        <div className="sticky-content">
        <div className="grid md:grid-cols-2 gap-16 items-center w-full">
          {/* Left side empty for ball */}
          <div className="hidden md:block" />

          <div className="max-w-xl ml-auto text-right md:text-left">
            <div className="flex items-center gap-3 mb-6 reveal justify-end md:justify-start">
              <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
                <Shield className="w-5 h-5 text-accent" />
              </div>
              <span className="font-bold tracking-[0.2em] uppercase text-xs text-accent">
                Scienza dei Materiali
              </span>
            </div>

            <h2 className="text-5xl md:text-7xl mb-8 reveal">
              SENTI LA
              <br />
              <span className="text-accent">PRESA</span>
            </h2>

            <div className="line-reveal h-[1px] bg-white/10 mb-8 origin-left max-w-[60%] md:max-w-full ml-auto md:ml-0" />

            <p className="text-lg text-white/50 mb-10 leading-relaxed reveal">
              La superficie in pelle micro-granulata offre una sensazione organica
              che migliora giocando. I canali anti-umidita mantengono le mani
              asciutte nei momenti piu intensi della partita.
            </p>

            <div className="space-y-5 reveal">
              <div className="bg-white/[0.03] p-5 rounded-2xl border border-white/[0.06]">
                <div className="flex justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-[0.15em] text-white/60">
                    Livello Trazione
                  </span>
                  <span className="text-accent font-bold text-xs tracking-wider">ELITE</span>
                </div>
                <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                  <div className="progress-fill h-full bg-gradient-to-r from-accent to-accent-light rounded-full" data-width="92%" style={{ width: '92%' }} />
                </div>
              </div>

              <div className="bg-white/[0.03] p-5 rounded-2xl border border-white/[0.06]">
                <div className="flex justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-[0.15em] text-white/60">
                    Durabilita
                  </span>
                  <span className="text-accent font-bold text-xs tracking-wider">PRO</span>
                </div>
                <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                  <div className="progress-fill h-full bg-gradient-to-r from-accent to-accent-light rounded-full" data-width="88%" style={{ width: '88%' }} />
                </div>
              </div>

              <div className="bg-white/[0.03] p-5 rounded-2xl border border-white/[0.06]">
                <div className="flex justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-[0.15em] text-white/60">
                    Controllo Umidita
                  </span>
                  <span className="text-accent font-bold text-xs tracking-wider">MAX</span>
                </div>
                <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                  <div className="progress-fill h-full bg-gradient-to-r from-accent to-accent-light rounded-full" data-width="96%" style={{ width: '96%' }} />
                </div>
              </div>
            </div>
          </div>
        </div>
        </div>
      </section>

      {/* ═══════════ SECTION 4: PRODUCT SHOWCASE ═══════════ */}
      <section id="product-section" className="scroll-section text-center bg-transparent" style={{ minHeight: '280vh' }}>
        <div className="sticky-content flex flex-col items-center justify-center">

          {/* Top: title & badge */}
          <div className="reveal mb-2">
            <div className="flex items-center gap-2 justify-center mb-2">
              <Trophy className="w-4 h-4 text-accent" />
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent">
                Edizione Limitata
              </span>
            </div>
            <h2 className="text-4xl md:text-6xl font-display leading-[0.9]">
              SERIE ELITE
            </h2>
          </div>

          {/* Ball pedestal area — transparent so 3D ball shows through */}
          <div data-pedestal-anchor="true" className="relative w-48 h-48 md:w-56 md:h-56 flex items-center justify-center my-2">
            {/* Pedestal base line only */}
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[70%] h-[2px] bg-gradient-to-r from-transparent via-accent/60 to-transparent" />
            <div className="absolute bottom-0 left-1/2 hidden h-16 w-[60%] -translate-x-1/2 rounded-full bg-accent/[0.06] blur-2xl md:block" />
          </div>

          {/* Variant name */}
          <div className="reveal mb-1">
            <span className="text-sm text-white/50 font-display tracking-widest uppercase transition-all duration-500">
              {BALL_VARIANTS[activeVariant].name}
            </span>
          </div>

          {/* Color variant selector */}
          <div className="flex justify-center gap-3 mb-4 reveal">
            {BALL_VARIANTS.map((variant, i) => (
              <button
                key={variant.id}
                onClick={() => {
                  setActiveVariant(i);
                  onVariantChange?.(variant.id);
                }}
                className={`w-9 h-9 rounded-full ${variant.color} border-2 transition-all duration-300 hover:scale-110 ${
                  i === activeVariant
                    ? 'border-white scale-110 shadow-lg shadow-white/10'
                    : 'border-transparent hover:border-white/30'
                }`}
              />
            ))}
          </div>

          {/* Bottom card: price, sizes, CTA */}
          <div className="product-card reveal max-w-sm w-full bg-black/85 md:bg-black/50 backdrop-blur-none md:backdrop-blur-xl p-5 rounded-[1.5rem] border border-white/[0.1]">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="flex gap-1 mb-1">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-3.5 h-3.5 fill-accent text-accent" />
                  ))}
                  <span className="ml-1.5 text-white/40 text-xs font-bold">4.9</span>
                </div>
                <span className="text-white/30 text-xs tracking-wider uppercase">247 recensioni</span>
              </div>
              <div className="text-3xl text-accent font-display">149,99€</div>
            </div>

            {/* Taglie */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              {['TAGLIA 7', 'TAGLIA 6', 'TAGLIA 5'].map((size) => (
                <button
                  key={size}
                  className="py-2.5 border border-white/[0.08] rounded-xl hover:border-accent text-xs font-bold tracking-wider transition-all duration-300 hover:bg-accent/5"
                >
                  {size}
                </button>
              ))}
            </div>

            <button
              onClick={handleAddToCart}
              className="group w-full py-4 bg-accent hover:bg-accent-light text-white font-bold rounded-2xl transition-all duration-300 hover:scale-[1.02] relative overflow-hidden"
            >
              <span className="relative z-10 text-sm tracking-wider">AGGIUNGI AL CARRELLO</span>
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
            </button>
          </div>

        </div>
      </section>

      {/* ═══════════ SECTION 5: FOOTER ═══════════ */}
      <footer id="footer-section" className="content-section items-center text-center pt-32 md:pt-48 pb-20">
        <div className="parallax-text">
          <h2 className="text-6xl md:text-[clamp(4rem,10vw,10rem)] leading-[0.9] mb-14 reveal">
            PRONTO A
            <br />
            <span className="text-accent">GIOCARE?</span>
          </h2>
        </div>

        <div className="w-full max-w-md mb-24 reveal">
          <div className="relative">
            <input
              type="email"
              placeholder="LA TUA EMAIL"
              className="w-full bg-white/[0.03] border border-white/[0.08] rounded-full py-5 px-8 text-sm tracking-wider focus:outline-none focus:border-accent/50 transition-colors placeholder:text-white/20"
            />
            <button className="absolute right-1.5 top-1.5 bottom-1.5 px-7 bg-white text-black font-bold text-sm tracking-wider rounded-full hover:bg-accent hover:text-white transition-all duration-300">
              ISCRIVITI
            </button>
          </div>
        </div>

        <div className="line-reveal h-[1px] bg-white/[0.06] w-full mb-16 origin-center" />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-12 text-left w-full mb-20 reveal">
          {[
            {
              title: 'PRODOTTI',
              links: ['Serie Elite', 'Pro Training', 'Accessori', 'Custom Shop'],
            },
            {
              title: 'TECNOLOGIA',
              links: ['Aerodinamica', 'Scienza del Grip', 'Laboratorio Materiali', 'Dati Prestazioni'],
            },
            {
              title: 'AZIENDA',
              links: ['La Nostra Storia', 'Atleti', 'Sostenibilita', 'Lavora con Noi'],
            },
            {
              title: 'SUPPORTO',
              links: ['Spedizioni', 'Resi', 'Guida Taglie', 'Contatti'],
            },
          ].map((col) => (
            <div key={col.title}>
              <h4 className="font-display text-sm tracking-[0.15em] mb-5 text-white/70">
                {col.title}
              </h4>
              <ul className="space-y-3">
                {col.links.map((link) => (
                  <li key={link}>
                    <a
                      href="#"
                      className="text-white/30 hover:text-white text-sm transition-colors duration-300"
                    >
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="text-white/20 text-[10px] uppercase tracking-[0.3em]">
          © 2026 SLAM DUNK ATHLETICS — TUTTI I DIRITTI RISERVATI
        </div>
      </footer>
    </div>
  );
}
