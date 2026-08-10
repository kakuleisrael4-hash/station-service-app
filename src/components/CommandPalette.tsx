import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Search, CornerDownLeft } from 'lucide-react';

export interface CommandEntry {
  id: string; // id d'onglet cible (transmis à onSelect)
  label: string; // ex: « Payer un pompiste »
  group: string; // ex: « 👥 Ressources humaines »
  icon?: ReactNode;
  keywords?: string; // termes de recherche additionnels
}

interface Props {
  entries: CommandEntry[];
  onSelect: (id: string) => void;
}

/** Normalise pour une recherche insensible aux accents/majuscules. */
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Recherche globale « Cmd+K / Ctrl+K » : saute instantanément vers n'importe
 * quel module (« Aller au stock », « Payer un pompiste », « Ajouter une
 * dépense », « Voir le capital »…). Navigation clavier ↑ ↓ ⏎, Échap pour fermer.
 */
export default function CommandPalette({ entries, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
        setQ('');
        setIdx(0);
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 30); }, [open]);

  const results = useMemo(() => {
    const term = norm(q.trim());
    if (!term) return entries;
    return entries.filter((e) => norm(`${e.label} ${e.group} ${e.keywords ?? ''}`).includes(term));
  }, [entries, q]);

  const pick = (id: string) => { setOpen(false); onSelect(id); };

  const onInputKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => Math.min(i + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && results[idx]) { e.preventDefault(); pick(results[idx].id); }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center bg-night-950/80 p-4 pt-[12vh] backdrop-blur-sm" onClick={() => setOpen(false)}>
      <motion.div initial={{ scale: 0.96, opacity: 0, y: -8 }} animate={{ scale: 1, opacity: 1, y: 0 }} transition={{ duration: 0.15 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/90 shadow-2xl shadow-glow-soft backdrop-blur-xl">
        <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
          <Search className="h-5 w-5 text-energy-400" />
          <input ref={inputRef} value={q} onKeyDown={onInputKey}
            onChange={(e) => { setQ(e.target.value); setIdx(0); }}
            className="flex-1 bg-transparent text-base text-white outline-none placeholder:text-zinc-500"
            placeholder="Aller à… (stock, paie, dépense, capital…)" />
          <kbd className="rounded-md bg-white/5 px-2 py-0.5 text-[10px] text-zinc-500 ring-1 ring-white/10">Échap</kbd>
        </div>
        <div className="max-h-[46vh] overflow-y-auto p-2">
          {results.length === 0 && <p className="px-3 py-6 text-center text-sm text-zinc-500">Aucun module ne correspond.</p>}
          {results.map((e, i) => (
            <button key={`${e.id}-${e.label}`} onClick={() => pick(e.id)} onMouseEnter={() => setIdx(i)}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${
                i === idx ? 'bg-energy-500/15 text-energy-300 ring-1 ring-energy-400/30' : 'text-zinc-300'
              }`}>
              <span className="text-zinc-500">{e.icon}</span>
              <span className="flex-1 font-medium">{e.label}</span>
              <span className="text-[11px] text-zinc-600">{e.group}</span>
              {i === idx && <CornerDownLeft className="h-3.5 w-3.5 text-energy-400" />}
            </button>
          ))}
        </div>
        <div className="border-t border-white/10 px-4 py-2 text-[11px] text-zinc-600">↑↓ naviguer · ⏎ ouvrir · Ctrl+K fermer</div>
      </motion.div>
    </div>
  );
}
