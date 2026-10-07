import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion, useDragControls } from 'framer-motion';
import { Star, X } from 'lucide-react';

/**
 * Compteur digital : anime le nombre de 0 jusqu'à sa valeur réelle (1,5 s,
 * easing easeOut) au montage puis à chaque changement de valeur.
 */
export function AnimatedNumber({ value, format, duration = 1500 }: { value: number; format: (n: number) => string; duration?: number }) {
  const [display, setDisplay] = useState(0);
  const fromRef = useRef(0);
  useEffect(() => {
    const from = fromRef.current;
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      setDisplay(from + (value - from) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <span className="tabular-nums">{format(display)}</span>;
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`card p-5 ${className}`}>{children}</div>;
}

export function SectionTitle({ icon, title, subtitle, right }: { icon?: ReactNode; title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 mb-4">
      <div className="flex items-center gap-3">
        {icon && <div className="grid h-10 w-10 place-items-center rounded-xl bg-energy-500/15 text-energy-400">{icon}</div>}
        <div>
          <h2 className="text-lg font-bold leading-tight">{title}</h2>
          {subtitle && <p className="text-sm text-slate-400">{subtitle}</p>}
        </div>
      </div>
      {right}
    </div>
  );
}

export function StatCard({ label, value, icon, accent = 'text-slate-100', hint }: { label: string; value: ReactNode; icon?: ReactNode; accent?: string; hint?: string }) {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
        {icon && <span className="text-slate-500">{icon}</span>}
      </div>
      <p className={`mt-2 text-2xl font-extrabold tabular-nums ${accent}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export function StarRating({ value, onChange, readOnly = false, size = 22 }: { value: number; onChange?: (v: number) => void; readOnly?: boolean; size?: number }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          disabled={readOnly}
          onClick={() => onChange?.(i)}
          className={`p-2.5 -m-1 transition ${readOnly ? 'cursor-default' : 'hover:scale-110'} `}
          aria-label={`${i} étoile${i > 1 ? 's' : ''}`}
        >
          <Star
            style={{ width: size, height: size }}
            className={i <= value ? 'fill-fuel-400 text-fuel-400' : 'text-slate-600'}
          />
        </button>
      ))}
    </div>
  );
}

/** Jauge « carburant liquide » : anneau en dégradé conique jaune-orangé →
 *  rouge-orangé, brillant dans le noir (lueur), pourcentage au centre. */
export function Gauge({ label, current, capacity, unit = 'L', color = 'energy', criticalPct = 15 }: { label: string; current: number; capacity: number; unit?: string; color?: 'energy' | 'fuel'; criticalPct?: number }) {
  const pct = capacity > 0 ? Math.max(0, Math.min(100, (current / capacity) * 100)) : 0;
  const low = pct < criticalPct;
  const deg = pct * 3.6;
  // Dégradé conique : jaune-orangé -> orange -> rouge-orangé sur la portion remplie.
  const liquid = low
    ? `conic-gradient(#f43f5e 0deg, #fb7185 ${deg}deg, rgba(255,255,255,0.05) ${deg}deg)`
    : `conic-gradient(#fbbf24 0deg, ${color === 'fuel' ? '#f59e0b' : '#f97316'} ${Math.max(deg - 40, 0)}deg, #ea580c ${deg}deg, rgba(255,255,255,0.05) ${deg}deg)`;
  return (
    <div className="card flex items-center gap-4 p-4">
      <div className="relative grid h-24 w-24 shrink-0 place-items-center">
        <div
          className="absolute inset-0 rounded-full transition-all duration-700"
          style={{ background: liquid, filter: low ? 'drop-shadow(0 0 8px rgba(244,63,94,0.5))' : 'drop-shadow(0 0 10px rgba(249,115,22,0.45))' }}
        />
        {/* trou central -> anneau */}
        <div className="absolute inset-[9px] rounded-full bg-night-950/95 ring-1 ring-white/5" />
        <p className={`relative z-10 text-lg font-black tabular-nums ${low ? 'text-rose-400' : 'text-energy-400'}`}>{pct.toFixed(0)}%</p>
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="truncate font-semibold">{label}</p>
          <span className={`chip !px-2 !py-0.5 text-[10px] ${color === 'fuel' ? 'bg-fuel-500/15 text-fuel-300' : 'bg-energy-500/15 text-energy-300'}`}>
            {color === 'fuel' ? 'GASOIL' : 'SUPER'}
          </span>
        </div>
        <p className="mt-1 text-lg font-extrabold tabular-nums text-white">
          {Math.round(current).toLocaleString('fr-FR')} <span className="text-xs font-normal text-slate-400">/ {Math.round(capacity).toLocaleString('fr-FR')} {unit}</span>
        </p>
        {low && <p className="mt-1 text-xs font-semibold text-rose-400 animate-pulse-neon">• Niveau bas</p>}
      </div>
    </div>
  );
}

/**
 * Modale : carte centrée sur ordinateur, FEUILLE BASSE sur téléphone
 * (monte du bas, poignée, glissable vers le bas pour fermer, zone sûre respectée).
 */
export function Modal({ open, onClose, children, title }: { open: boolean; onClose: () => void; children: ReactNode; title?: string }) {
  const controls = useDragControls();
  const sheet = typeof window !== 'undefined' && window.matchMedia('(max-width: 639px)').matches;
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-night-950/80 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            className="card relative z-10 flex max-h-[92dvh] w-full flex-col !rounded-b-none !p-0 sm:max-w-md sm:!rounded-2xl"
            initial={sheet ? { y: '100%' } : { scale: 0.95, y: 14, opacity: 0 }}
            animate={sheet ? { y: 0 } : { scale: 1, y: 0, opacity: 1 }}
            exit={sheet ? { y: '100%' } : { scale: 0.95, y: 14, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            drag={sheet ? 'y' : false} dragControls={controls} dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0, bottom: 0.5 }}
            onDragEnd={(_, info) => { if (info.offset.y > 90 || info.velocity.y > 500) onClose(); }}
          >
            <div className="shrink-0 touch-none px-5 pt-3 sm:pt-5" onPointerDown={(e) => sheet && controls.start(e)}>
              <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-white/20 sm:hidden" />
              <div className="flex items-start justify-between gap-3">
                {title ? <h3 className="text-xl font-bold">{title}</h3> : <span />}
                <button onClick={onClose} className="-mr-2 -mt-1 grid h-11 w-11 shrink-0 place-items-center rounded-full text-slate-400" aria-label="Fermer">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="overflow-y-auto overscroll-contain px-5 pb-[calc(1.25rem+var(--safe-bottom))] pt-3 sm:pb-6">
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function FloatingAlert({ show, kind = 'error', children }: { show: boolean; kind?: 'error' | 'success'; children: ReactNode }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.96 }}
          className={`fixed bottom-[calc(var(--tabbar-h)+var(--safe-bottom)+1.25rem)] inset-x-0 mx-auto z-50 w-max max-w-[calc(100vw-2rem)] rounded-2xl px-5 py-3 text-center text-sm font-semibold shadow-2xl lg:bottom-6 ${
            kind === 'error' ? 'bg-rose-500 text-white' : 'bg-energy-500 text-night-950'
          }`}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="card grid place-items-center p-10 text-center text-sm text-slate-400">{children}</div>;
}
