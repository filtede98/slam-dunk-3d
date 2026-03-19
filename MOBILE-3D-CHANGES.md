# Mobile 3D Changes Log

Questo file riepiloga tutte le modifiche principali fatte durante il lavoro di ottimizzazione del sito, soprattutto per mobile, iPhone e resa 3D.

## Obiettivi principali

- Migliorare le performance mobile del canvas 3D.
- Eliminare i lag durante lo scroll su iPhone.
- Alzare la qualita visiva delle palle su mobile fino a un look molto vicino al desktop.
- Stabilizzare posizione, rotazione e comportamento della palla tra hero, sezione prodotto e footer.
- Allineare il comportamento tra ambiente locale, GitHub e Vercel.

## Aree toccate

- `src/App.tsx`
- `src/components/Scene.tsx`
- `src/components/Basketball.tsx`
- `src/components/UIContent.tsx`
- `src/components/Navbar.tsx`
- `src/constants.ts`
- `src/index.css`
- `public/*.glb`
- `public/draco/*`

## Modifiche principali

### 1. Rendering mobile e frame loop

- Il rendering mobile e stato ristrutturato per evitare lunghi periodi senza redraw del canvas.
- E stato introdotto un sistema di rendering mobile a burst invece di lasciare il canvas sempre attivo inutilmente.
- E stato aggiunto `MobileFrameController` in `src/components/Scene.tsx` per:
  - attivare frame continui durante scroll, touchmove, resize, cambio variante e animazioni carrello
  - tornare a `frameloop="demand"` quando non serve piu renderizzare continuamente
- E stata migliorata la gestione della visibilita della tab per evitare lavoro inutile in background.

### 2. Scroll mobile e iPhone

- Lo scroll era inizialmente scattoso per una combinazione di:
  - aggiornamenti continui su `ScrollTrigger.onUpdate`
  - canvas fullscreen `fixed`
  - sezioni `sticky`
  - `backdrop-blur` e glow durante lo scroll
  - qualita renderer troppo aggressiva mentre il dito era ancora in movimento
- Sono stati fatti piu step di ottimizzazione:
  - rimosso il ritardo artificiale nella traslazione della palla su mobile in `src/components/Basketball.tsx`
  - reso il movimento mobile piu lineare in `src/App.tsx`
  - ridotte letture layout costose durante lo scroll in `src/App.tsx`
  - tolto `ScrollTrigger.normalizeScroll(true)` dopo aver verificato che su iPhone rendeva il gesto meno fluido
  - aggiunta una modalita dinamica in `src/components/Scene.tsx` che durante lo scroll abbassa temporaneamente il costo del renderer:
    - DPR ridotto temporaneamente
    - ombre disattivate temporaneamente
    - qualita piena ripristinata quando lo scroll si ferma

### 3. Qualita 3D mobile

- Sono stati corretti i profili di rendering mobile in `src/components/Scene.tsx`.
- I dispositivi Apple mobile Retina non vengono piu classificati in modo troppo conservativo.
- Per dispositivi mobili sufficientemente forti e stato introdotto un profilo premium con:
  - DPR piu alto
  - antialias attivo
  - environment attivo
  - illuminazione piu vicina al desktop
  - ombre abilitate sui device compatibili
- E stato aggiunto nel debug overlay un indicatore `desktop-assets: yes/no`.

### 4. Modelli 3D e asset desktop/mobile

- In `src/constants.ts` i variant model path sono stati separati in:
  - `model`
  - `desktopModel`
  - `mobileModel`
- In `src/components/Basketball.tsx` la scelta del modello e stata resa dinamica.
- I telefoni mobili piu forti usano i modelli desktop invece dei GLB semplificati.
- I dispositivi mobili piu deboli continuano a usare i modelli mobile ottimizzati.

### 5. Materiali, texture e nitidezza

- In `src/components/Basketball.tsx` sono state migliorate le texture con:
  - anisotropy piu alta
  - `envMapIntensity` piu alta per profili premium
  - `roughness` meglio tarata
  - `receiveShadow` attivato sulle mesh
  - filtri texture esplicitamente impostati:
    - `LinearMipmapLinearFilter`
    - `LinearFilter`
- Questo ha ridotto l'effetto di palla "pixelata" soprattutto su iPhone Retina.

### 6. Draco e caricamento modelli

- E stato spostato il decoder Draco su file locali in `public/draco/`.
- In `src/components/Basketball.tsx` il `DRACOLoader` usa `/draco/` invece di dipendere da decoder esterni remoti.
- Sono stati precaricati i modelli per rendere i cambi variante meno costosi.

### 7. Riduzione complessita dei modelli mobile

- I GLB mobile sono stati rigenerati e alleggeriti rispetto ai file desktop.
- In particolare e stato creato un set di asset mobile piu leggeri in `public/` per ridurre carico GPU e tempi di decode.
- Questo lavoro e stato particolarmente importante per i dispositivi non premium.

### 8. UI e compositing mobile

- Per alleggerire i repaint durante lo scroll sono stati ridotti o rimossi su mobile:
  - glow blurati fissi in `src/App.tsx`
  - `backdrop-blur` nella navbar in `src/components/Navbar.tsx`
  - `backdrop-blur` e glow nella card prodotto in `src/components/UIContent.tsx`
- In `src/index.css` sono stati aggiunti accorgimenti CSS mirati ai layer mobili `fixed` e `sticky`.
- In `src/components/UIContent.tsx` e stato aggiunto `touchAction: 'pan-y'` alla hero per migliorare la risposta dello scroll verticale.

### 9. Posizione, rotazione e comportamento della palla

- Corretta la posizione iniziale della palla al caricamento.
- Migliorata la rotazione idle della palla.
- Corretta la traslazione mobile in modo che la palla segua meglio lo scroll.
- Evitato che su mobile la palla resti bloccata o insegua con troppo ritardo i valori di stato.

### 10. Sezione prodotto e pedana finale

- In `src/App.tsx` la palla segue la pedana della sezione prodotto usando una misura del pedestal anchor.
- La misura del punto di tracking e stata resa piu stabile con `data-pedestal-anchor="true"` in `src/components/UIContent.tsx`.
- E stato corretto il bug del footer in cui la palla "droppava" invece di restare sulla pedana finale.
- Ora il tratto finale usa il vero punto di unpin sticky (`stickyUnpin`) per far restare la palla ancorata alla pedana fino alla fine corretta della sezione prodotto.

## File modificati e ruolo

### `src/App.tsx`

- ScrollTrigger principale della pagina
- keyframes della traiettoria della palla
- gestione scroll progress
- ottimizzazioni del movimento mobile
- tracking del pedestal
- fix footer/pedana finale
- gestione add-to-cart

### `src/components/Scene.tsx`

- profilo renderer mobile/desktop
- euristiche Apple mobile premium
- gestione DPR/ombre/ambiente/luci
- `MobileFrameController`
- degradazione temporanea della qualita durante scroll
- debug overlay mobile

### `src/components/Basketball.tsx`

- selezione modello desktop/mobile
- preload asset
- loader Draco locale
- miglioramenti materiali e texture
- filtraggio texture
- ombre e anisotropy
- rimozione del lag di movimento mobile

### `src/components/UIContent.tsx`

- anchor esplicito per la pedana finale
- ottimizzazioni mobile di compositing
- `touchAction: 'pan-y'`

### `src/components/Navbar.tsx`

- rimozione blur costoso su mobile durante scroll

### `src/index.css`

- ottimizzazioni CSS per `canvas-container`, `sticky-content` e layer mobili

### `src/constants.ts`

- split esplicito tra asset desktop e mobile per ogni variante

### `public/`

- GLB mobile ottimizzati
- decoder Draco locale in `public/draco/`

## Commit principali

- `42f8e29` Stabilize mobile 3D experience
- `d55ac6b` Reduce iPhone scroll jank
- `febbf51` Improve mobile visual quality
- `42e564e` Further reduce mobile model complexity
- `71d14c3` Performance mobile: demand frameloop + throttled scroll rendering
- `2e83dfe` Improve mobile scroll responsiveness
- `fc62c32` Tune mobile frame scheduling
- `34f6b57` Remove mobile movement lag
- `8e93ac1` Optimize mobile scroll movement
- `feef15e` Reduce iPhone scroll repaint cost
- `21da5eb` Improve mobile 3D quality
- `3bd20c6` Refine premium mobile ball rendering
- `ef199ae` Fix iPhone ball pixelation
- `2860cea` Fix footer pedestal hold
- `879841b` Smooth iPhone scrolling

## Stato finale attuale

- Scroll iPhone molto piu fluido rispetto all'inizio.
- Qualita della palla su iPhone molto piu vicina al desktop.
- La palla non risulta piu chiaramente pixelata sui device Apple premium.
- La sezione prodotto e il footer hanno un comportamento piu stabile.
- Il renderer mobile ora bilancia meglio qualita a riposo e fluidita durante lo scroll.

## Nota

Questo file e un changelog tecnico del lavoro fatto durante questa fase di ottimizzazione. Se servirà, puo essere esteso con screenshot, benchmark o note per device specifici.