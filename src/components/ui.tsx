import { type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Star, X } from 'lucide-react';

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
          className={`transition ${readOnly ? 'cursor-default' : 'hover:scale-110'} `}
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

export function Gauge({ label, current, capacity, unit = 'L', color = 'energy', criticalPct = 15 }: { label: string; current: number; capacity: number; unit?: string; color?: 'energy' | 'fuel'; criticalPct?: number }) {
  const pct = capacity > 0 ? Math.max(0, Math.min(100, (current / capacity) * 100)) : 0;
  const low = pct < criticalPct;
  const bar = low ? 'from-rose-500 to-rose-400' : color === 'fuel' ? 'from-fuel-600 to-fuel-400' : 'from-energy-600 to-energy-400';
  return (
    <div className="card p-4">
      <div className="flex items-baseline justify-between">
        <p className="font-semibold">{label}</p>
        <p className={`text-sm font-bold tabular-nums ${low ? 'text-rose-400' : 'text-slate-300'}`}>{pct.toFixed(0)}%</p>
      </div>
      <div className="mt-3 h-4 w-full overflow-hidden rounded-full bg-night-900 ring-1 ring-white/10">
        <motion.div
          className={`h-full rounded-full bg-gradient-to-r ${bar}`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ type: 'spring', stiffness: 60, damping: 18 }}
        />
      </div>
      <p className="mt-2 text-xs text-slate-400 tabular-nums">
        {Math.round(current).toLocaleString('fr-FR')} / {Math.round(capacity).toLocaleString('fr-FR')} {unit}
        {low && <span className="ml-2 text-rose-400 font-semibold">• Niveau bas</span>}
      </p>
    </div>
  );
}

export function Modal({ open, onClose, children, title }: { open: boolean; onClose: () => void; children: ReactNode; title?: string }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 grid place-items-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-night-950/80 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            className="card relative z-10 w-full max-w-md p-6"
            initial={{ scale: 0.95, y: 14, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.95, y: 14, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 22 }}
          >
            <button onClick={onClose} className="absolute right-4 top-4 text-slate-400 hover:text-white" aria-label="Fermer">
              <X className="h-5 w-5" />
            </button>
            {title && <h3 className="mb-4 text-xl font-bold">{title}</h3>}
            {children}
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
          className={`fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-2xl px-5 py-3 text-sm font-semibold shadow-2xl ${
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
