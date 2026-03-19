const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

export const BALL_VARIANTS = [
  { id: 'classic', name: 'Arancione Classico', color: 'bg-accent', model: isMobile ? '/basketball-opt-mobile.glb' : '/basketball-opt.glb' },
  { id: 'midnight', name: 'Blu Notte', color: 'bg-blue-600', model: isMobile ? '/basketball-blu-mobile.glb' : '/basketball-blu.glb' },
  { id: 'shadow', name: 'Nero Ombra', color: 'bg-zinc-800', model: isMobile ? '/basketball-nera-mobile.glb' : '/basketball-nera.glb' },
  { id: 'forest', name: 'Verde Foresta', color: 'bg-emerald-700', model: isMobile ? '/basketball-verde-mobile.glb' : '/basketball-verde.glb' },
];
