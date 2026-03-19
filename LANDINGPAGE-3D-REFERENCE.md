# 3D Product Landing Page — Reference Guide

> Guida completa per creare landing page con modelli 3D scroll-driven, basata sul progetto Slam Dunk.

---

## 1. Stack Tecnologico

| Tecnologia | Ruolo |
|---|---|
| **React 19** + **TypeScript** | UI framework |
| **Three.js** + **@react-three/fiber** | Rendering 3D |
| **@react-three/drei** | Utility 3D (Environment, Camera, AdaptiveDpr) |
| **GSAP** + **ScrollTrigger** | Animazioni scroll-driven |
| **Tailwind CSS 4** | Styling utility-first |
| **Vite** | Build tool |
| **MeshoptDecoder** | Compressione modelli GLB |
| **Lucide React** | Icone |

---

## 2. Architettura dei Componenti

```
App.tsx (orchestratore)
├── Navbar.tsx                    # Nav + icona canestro (SVG custom)
├── Scene.tsx (fixed, z-10)       # Canvas Three.js
│   ├── Basketball.tsx            # Modello 3D + carousel turntable
│   ├── Particles                 # Particelle atmosferiche
│   ├── CameraRig                 # Parallax mouse
│   └── Lighting + Environment
└── UIContent.tsx (relative, z-20) # Contenuto HTML scrollabile
    ├── Hero section (swipe/trackpad/dot per varianti)
    ├── Sezione feature 1 (sticky, 280vh)
    ├── Sezione feature 2 (sticky, 280vh)
    ├── Sezione prodotto (sticky, 280vh, pedestal tracking)
    └── Footer
```

**Principio chiave**: Il canvas 3D e` `position: fixed` (z-10), il contenuto HTML scrolla sopra (z-20). L'oggetto 3D si muove in base allo scroll progress.

---

## 3. Sistema di Animazione Scroll-Driven

### 3.1 Setup ScrollTrigger

```typescript
ScrollTrigger.create({
  trigger: mainRef.current,
  start: 'top top',
  end: 'bottom bottom',
  scrub: 0.1,
  onUpdate: (self) => {
    scrollProgress.current = self.progress;
    const vals = lerpKeyframes(self.progress);
    ballState.current.visible = true; // prima volta rende visibile
    // Aggiorna stato oggetto 3D...
  }
});
```

### 3.2 Sistema a Keyframe Dinamici

I keyframe usano `s = pStart` come fattore proporzionale per adattarsi alla lunghezza reale delle sezioni:

```typescript
const scrollable = mainRef.current.scrollHeight - window.innerHeight;
const pStart = productEl.offsetTop / scrollable;       // ~0.60-0.65
const pEnd = (productEl.offsetTop + productEl.offsetHeight) / scrollable;
const s = pStart; // fattore scala per sezioni pre-prodotto
```

**Keyframe completi:**
```
at: 0.00      → x:0,    y:0,    z:-2,   scale:1.6  rotY:0        // Hero
at: s*0.19    → x:0,    y:0,    z:-1.5, scale:1.3  rotY:PI*0.3   // Leaving hero
at: s*0.36    → x:2.8,  y:0.2,  z:0.5,  scale:2.0  rotY:PI       // Aero: destra
at: s*0.55    → x:2.5,  y:0,    z:0.5,  scale:1.8  rotY:PI*1.5   // Mid aero
at: s*0.75    → x:-2.8, y:0.2,  z:0.5,  scale:2.2  rotY:PI*2     // Grip: sinistra
at: s*0.82    → x:-2.5, y:0,    z:0.5,  scale:2.0  rotY:PI*2.5   // Mid grip
at: s*0.90    → x:-1.5, y:0,    z:0,    scale:1.5  rotY:PI*2.65  // Uscita grip
at: s*0.96    → x:-0.5, y:0,    z:-0.5, scale:1.0  rotY:PI*2.8   // Avvicinamento
at: pStart    → x:0,    y:-0.5, z:-1,   scale:0.5  rotY:PI*3     // Pedestal (tracking)
at: pEnd-0.02 → x:0,    y:0,    z:-1,   scale:0.5  rotY:PI*3.6   // Segue pedestal
at: pEnd      → x:0,    y:10,   z:-1,   scale:0    rotY:PI*3.7   // Sparisce
at: 1.00      → x:0,    y:10,   z:-3,   scale:0    rotY:PI*4.5   // Nascosta
```

### 3.3 Interpolazione Smoothstep

```typescript
function lerpKeyframes(progress: number) {
  // Trova i due keyframe circostanti
  const smooth = t * t * (3 - 2 * t);  // Smoothstep cubico
  // Interpola tutte le proprieta con smooth
}
```

### 3.4 Anti-Flash al Reload

```typescript
// 1. Stato iniziale nascosto
ballState = { ...defaults, visible: false };

// 2. Dopo ScrollTrigger, calcola posizione iniziale immediatamente
requestAnimationFrame(() => {
  const initialProgress = window.scrollY / scrollable;
  const vals = lerpKeyframes(initialProgress);
  Object.assign(ballState.current, vals);
  ballState.current.visible = true;
});

// 3. Varianti non attive partono con scala 0
const currentScale = useRef(isActive ? scaleFactor : 0);
```

---

## 4. Carousel Turntable 3D

### 4.1 Layout Circolare (piatto rotante)

Le varianti sono disposte su un cerchio nel piano XZ. Quella attiva sta davanti, le altre dietro lo schermo:

```typescript
const radius = 3.5;
const angle = (circularDiff / total) * PI * 2;

const xOffset = Math.sin(angle) * radius;                    // Sinistra/destra
const zOffset = Math.cos(angle) * radius - radius;           // Davanti=0, dietro=-7

const depthFactor = (1 + Math.cos(angle)) / 2;               // 1=davanti, 0=dietro
const scaleFactor = 0.45 + depthFactor * 0.55;               // Scala 0.45-1.0
```

### 4.2 Collapse con Scroll + Cart Animation

```typescript
const isAnimating = (window as any).__cartAnimating === true;
const carouselStrength = isActive
  ? 1
  : (isAnimating ? 0 : Math.max(0, 1 - progress / 0.08));

// Offsets moltiplicati per carouselStrength
targetX = xOffset * carouselStrength;
targetZ = zOffset * carouselStrength;
targetScale = scaleFactor * carouselStrength;
```

- **progress 0-8%**: carousel visibile (hero section)
- **progress > 8%**: varianti non attive collassano a scala 0
- **`__cartAnimating = true`**: forza collapse immediato durante animazione add-to-cart

### 4.3 Input per Cambio Variante

**3 metodi supportati:**

1. **Click sui dot** colorati (hero + sezione prodotto)
2. **Drag orizzontale** — PointerEvent, soglia 50px, deltaX > deltaY * 1.5
3. **Trackpad swipe** — WheelEvent:
   - Soglia: 150px accumulati
   - Filtro: deltaX deve essere > deltaY * 2
   - Cooldown: 600ms tra cambi
   - Reset accumulator: 300ms timeout

```typescript
// Trackpad handler
hero.addEventListener('wheel', (e) => {
  if (Math.abs(e.deltaX) < Math.abs(e.deltaY) * 2) return;
  if (wheelCooldown.current) return;
  wheelAccum.current += e.deltaX;
  if (Math.abs(wheelAccum.current) > 150) {
    onSwipeVariant(wheelAccum.current > 0 ? 'left' : 'right');
    wheelCooldown.current = true;
    setTimeout(() => wheelCooldown.current = false, 600);
  }
}, { passive: false });
```

---

## 5. Animazione Add-to-Cart (Slam Dunk)

### 5.1 Setup

```typescript
// 1. Forza navbar visibile (evento 'add-to-cart' → setHidden(false) nel Navbar)
window.dispatchEvent(new CustomEvent('add-to-cart'));

// 2. Aspetta un frame per la navbar
requestAnimationFrame(() => {
  // 3. Alza canvas sopra navbar
  canvas.style.zIndex = '60';   // navbar e' z-50
  (window as any).__cartAnimating = true;

  // 4. Converti posizione icona canestro in coordinate 3D
  const dist = cameraZ - 3;
  const visH = 2 * Math.tan((fov/2) * PI/180) * dist;
  const visW = visH * (vw / vh);
  targetX = ((cartRect.centerX) / vw - 0.5) * visW;
  targetY = (0.5 - (cartRect.centerY) / vh) * visH;
});
```

### 5.2 Fasi Animazione

| Fase | Durata | Azione | Ease |
|---|---|---|---|
| 1. Wind-up | 0.12s | y: -0.3, scale: 85% | power2.in |
| 2. Launch UP | 0.35s | y: +1.5, spin 3 giri | power3.out |
| 3. Arc | 0.25s | midpoint verso cart | none |
| 4. Slam | 0.20s | entra nel canestro, scale 0.08 | power3.in |
| 5. Impact | 0.08s | scale 0, burst 80px, shake canestro | power4.in |
| 6. Respawn | 0.6s delay + 0.9s | elastic bounce da scale 0 | elastic.out(1.2, 0.35) |

### 5.3 Z-Index Lifecycle

```
Inizio animazione → canvas z-index: 60 (palla SOPRA navbar)
Impatto nel canestro → canvas z-index: 10 (palla DIETRO contenuto)
Respawn elastico → gia' dietro il testo, nessun flash
Fine animazione → __cartAnimating = false
```

---

## 6. Pedestal Tracking (Oggetto 3D segue elemento HTML)

### 6.1 Conversione Coordinate

```typescript
function screenYToThreeY(screenY: number, threeZ: number) {
  const fov = 45;
  const cameraZ = 5;
  const dist = cameraZ - threeZ;
  const visibleHeight = 2 * Math.tan((fov/2) * PI/180) * dist;
  const normalized = 0.5 - screenY / window.innerHeight;
  return normalized * visibleHeight;
}
```

### 6.2 Tracking con Blend-in

```typescript
if (progress >= pStart && progress <= pEnd && pedestalEl) {
  const rect = pedestalEl.getBoundingClientRect();
  const isMobileView = window.innerWidth < 768;
  const pedestalCenterY = rect.top + rect.height * (isMobileView ? 0.40 : 0.38);
  const trackedY = screenYToThreeY(pedestalCenterY, vals.z);

  // Blend-in graduale sui primi 25%
  const blendIn = Math.min(1, (progress - pStart) / ((pEnd - pStart) * 0.25));
  const smooth = blendIn * blendIn * (3 - 2 * blendIn);
  vals.y = vals.y * (1 - smooth) + trackedY * smooth;
}
```

---

## 7. Pattern CSS Fondamentali

### 7.1 Canvas Fisso + Contenuto Scrollabile

```css
.canvas-container {
  position: fixed;
  inset: 0;
  z-index: 10;          /* z-60 durante add-to-cart */
  pointer-events: none;
}

.content-section {
  position: relative;
  z-index: 20;
  min-height: 100vh;
}
```

### 7.2 Sezioni Sticky

```css
.scroll-section {
  min-height: 180vh;    /* override a 280vh per sezioni lunghe */
}

.scroll-section > .sticky-content {
  position: sticky;
  top: 0;
  min-height: 100vh;
  display: flex;
  align-items: center;
}
```

### 7.3 Glassmorphism (Product Card)

```html
<div class="bg-black/50 backdrop-blur-xl p-5 rounded-[1.5rem] border border-white/[0.1]">
```

GPU optimization:
```css
.product-card {
  transform: translateZ(0);
  -webkit-backface-visibility: hidden;
}
```

### 7.4 Ambient Glow

```html
<div class="absolute w-[60vw] h-[60vh] bg-[#FF4D00]/[0.04] blur-[120px] rounded-full" />
```

### 7.5 Leggibilita` testo su 3D

```css
h1-h4 { text-shadow: 0 2px 30px rgba(0,0,0,0.9), 0 0 80px rgba(0,0,0,0.7); }
p { text-shadow: 0 1px 20px rgba(0,0,0,0.8); }
```

---

## 8. Valori Chiave di Riferimento

### Camera e Scena
| Parametro | Valore |
|---|---|
| Camera position | [0, 0, 5] |
| Camera FOV | 45 gradi |
| Parallax mouse X/Y | pointer * 0.3/0.2, lerp 0.02 |

### Illuminazione (Moody/Premium)
| Luce | Posizione | Intensita` | Colore |
|---|---|---|---|
| Ambient | - | 0.15 | bianca |
| Key (directional) | [4, 5, 4] | 1.8 | #FFAA66 |
| Fill (directional) | [-4, 1, 2] | 0.4 | #FF9955 |
| Rim (point) | [-2, 3, -5] | 3.0 | #FF4400 |
| Environment | studio | 0.3 | - |

### Lerp Factors
| Contesto | Valore |
|---|---|
| Posizione oggetto principale | 0.25 |
| Camera parallax | 0.02 |
| Carousel turntable offset | 0.08 |
| Idle spin | +0.35 rad/sec |

### Materiali 3D
| Proprieta` | Valore |
|---|---|
| roughness | >= 0.6 |
| envMapIntensity | 0.5 |
| Normalizzazione modello | 2 unita` diametro |

### Carousel Turntable
| Parametro | Desktop | Mobile |
|---|---|---|
| Raggio cerchio | 3.5 | 7 (varianti fuori schermo) |
| Scala davanti | 1.0 | 1.0 |
| Scala dietro | 0.45 | 0 (nascosto) |
| Profondita` (z) davanti | 0 | 0 |
| Profondita` (z) dietro | -7 | -14 |
| Collapse a progress | 0.08 (8%) | sempre (solo palla attiva) |

### Sezioni
| Sezione | min-height |
|---|---|
| Hero | 100vh |
| Aerodynamics | 280vh |
| Grip/Material | 280vh |
| Product | 280vh |

---

## 9. Icona Canestro (Navbar)

SVG custom che sostituisce l'icona carrello standard:

```xml
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
  <rect x="4" y="2" width="16" height="10" rx="1" />
  <ellipse cx="12" cy="14" rx="5" ry="1.5" />
  <path d="M7 14 L9 20" />
  <path d="M10 15.4 L10.5 20" />
  <path d="M14 15.4 L13.5 20" />
  <path d="M17 14 L15 20" />
  <path d="M9 20 Q12 22 15 20" />
</svg>
```

La navbar si forza visibile (`setHidden(false)`) su evento `add-to-cart` per garantire che il canestro sia visibile come target dell'animazione.

---

## 10. Animazioni GSAP Consigliate

### Entrata Testi (caricamento iniziale)
```typescript
gsap.fromTo('.hero-word',
  { y: 30, opacity: 0 },
  { y: 0, opacity: 1, stagger: 0.06, duration: 0.6, ease: 'power3.out', delay: 0.1 }
);
```

### Reveal su Scroll
```typescript
gsap.fromTo('.reveal',
  { y: 60, opacity: 0 },
  { y: 0, opacity: 1, duration: 1, ease: 'power3.out',
    scrollTrigger: { trigger: el, start: 'top 85%' }
  }
);
```

### Counter Animati
```typescript
gsap.fromTo(counterRef, { val: 0 }, {
  val: targetValue,
  duration: 2,
  ease: 'power1.out',
  onUpdate: () => { el.textContent = Math.round(counterRef.val) + suffix; },
  scrollTrigger: { trigger: el, start: 'top 90%' }
});
```

---

## 11. Responsive Mobile (<768px)

### Fattore scala globale
```typescript
const isMobile = window.innerWidth < 768;
const m = isMobile ? 0.5 : 1; // 50% size on mobile
// Applicato a tutti i keyframe: scale * m, x * m
```

### Keyframe specifici mobile
| Parametro | Desktop | Mobile |
|---|---|---|
| Hero scale | 1.6 | 0.8 (1.6*0.5) |
| Hero y | 0 | 0.8 (palla piu` alta) |
| Aero/Grip x offset | +-2.8 | +-1.4 |
| Pedestal scale | 0.5 | 0.45 |
| Pedestal tracking offset | 0.38 | 0.40 |

### Carousel su mobile
- Varianti non attive **sempre nascoste** (`carouselStrength = 0`)
- Solo la palla selezionata visibile
- Swipe hint con frecce SVG animate ai lati della palla (`md:hidden`)
- Testo "Scorri per cambiare" sotto i dot

### Layout mobile
- Hero testo: `pt-32 md:pt-0` (spinge testo sotto la palla)
- Sezione "Senti la Presa": `ml-auto text-right md:text-left` (allineata a destra)
- Linee decorative: `max-w-[60%] md:max-w-full` (non attraversano tutto lo schermo)
- Navbar: solo logo + icona canestro (no link di navigazione, scoperta via scroll)

### Swipe hint arrows (CSS)
```css
@keyframes swipeLeft {
  0%, 100% { transform: translateX(0); opacity: 0.3; }
  50% { transform: translateX(-6px); opacity: 0.7; }
}
@keyframes swipeRight {
  0%, 100% { transform: translateX(0); opacity: 0.3; }
  50% { transform: translateX(6px); opacity: 0.7; }
}
```

---

## 12. Localizzazione (i18n)

Il sito e` attualmente in **italiano**. Testi da tradurre per altre lingue:

### File da modificare
| File | Contenuto |
|---|---|
| `index.html` | `lang="it"`, `<title>` |
| `src/constants.ts` | Nomi varianti (Arancione Classico, Blu Notte...) |
| `src/components/UIContent.tsx` | Tutti i testi UI, CTA, footer, stats |
| `src/components/Navbar.tsx` | Logo (SLAM DUNK — invariato) |

### Stringhe principali
- Hero: titolo, sottotitolo, descrizione, CTA
- Sezioni: titoli, descrizioni, label statistiche
- Prodotto: badge, prezzo (formato locale), taglie, bottone
- Footer: heading, placeholder email, link colonne, copyright

---

## 13. Checklist per Nuove Landing Page

- [ ] Setup: Vite + React + Three.js + GSAP + Tailwind
- [ ] Canvas fisso (z-10) + contenuto scrollabile (z-20)
- [ ] Modelli 3D ottimizzati con MeshoptDecoder
- [ ] Keyframe scroll-driven con posizioni proporzionali (`s = pStart`)
- [ ] Sezioni sticky con `min-height: 280vh`
- [ ] Illuminazione moody (ambient basso, key calda, rim colorata)
- [ ] Parallax camera con mouse
- [ ] Glassmorphism sulle card (backdrop-blur + bg semi-trasparente)
- [ ] Ambient glow (div enormi, bassa opacita`, blur alto)
- [ ] Text shadow per leggibilita` su 3D
- [ ] Anti-flash: `visible: false` + `requestAnimationFrame` + posizione iniziale
- [ ] Carousel turntable per varianti prodotto (cerchio XZ, collapse con scroll)
- [ ] Swipe gesture (pointer + trackpad wheel con cooldown 600ms)
- [ ] Animazione add-to-cart (z-index swap, slam dunk, burst, shake, elastic respawn)
- [ ] `__cartAnimating` flag per nascondere varianti durante animazione
- [ ] Pedestal tracking (`screenYToThreeY`, blend-in 25%, offset desktop 0.38 / mobile 0.40)
- [ ] Navbar force-show su add-to-cart
- [ ] Typography fluida con clamp()
- [ ] Font: display (Bebas Neue) + body (DM Sans)
- [ ] Icona canestro SVG custom nella navbar
- [ ] Navbar senza link (scroll-discovery UX)
- [ ] Responsive mobile: fattore scala 0.5, carousel nascosto, swipe hints
- [ ] Hero mobile: palla piu` alta (y: 0.8), testo piu` basso (pt-32)
- [ ] Grip section allineata a destra su mobile
- [ ] Linee decorative accorciate su mobile (max-w-[60%])
- [ ] Localizzazione: tutti i testi in italiano
