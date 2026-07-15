import { useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Menu, X } from 'lucide-react';

export interface NavItem {
  id: string;
  label: string;
  icon: ReactNode;
}
export interface NavGroup {
  label: string; // ex: "⛽ Opérations"
  items: NavItem[];
}

interface Props {
  groups: NavGroup[];
  active: string;
  onSelect: (id: string) => void;
}

function GroupList({ groups, active, onSelect }: Props) {
  return (
    <nav className="space-y-5">
      {groups.map((g) => (
        <div key={g.label}>
          <p className="mb-1.5 px-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">{g.label}</p>
          <ul className="space-y-0.5">
            {g.items.map((it) => {
              const isActive = it.id === active;
              return (
                <li key={it.id}>
                  <button onClick={() => onSelect(it.id)}
                    className={`relative flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                      isActive ? 'text-night-950' : 'text-slate-300 hover:bg-white/5 hover:text-white'
                    }`}>
                    {isActive && (
                      <motion.span layoutId="nav-active" transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                        className="absolute inset-0 rounded-xl bg-energy-500 shadow-glow" />
                    )}
                    <span className="relative z-10">{it.icon}</span>
                    <span className="relative z-10 truncate">{it.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

/**
 * Navigation par pôles : Sidebar sticky sur desktop (lg+), bouton + Drawer
 * coulissant sur mobile. État actif animé (framer-motion layoutId).
 */
export default function SideNav({ groups, active, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const activeItem = groups.flatMap((g) => g.items).find((it) => it.id === active);

  return (
    <>
      {/* ===== Desktop : sidebar sticky ===== */}
      <aside className="sticky top-20 hidden max-h-[calc(100vh-6rem)] w-56 shrink-0 self-start overflow-y-auto rounded-2xl border border-white/10 bg-white/[0.02] p-3 lg:block">
        <GroupList groups={groups} active={active} onSelect={onSelect} />
      </aside>

      {/* ===== Mobile : barre + drawer ===== */}
      <div className="mb-4 lg:hidden">
        <button onClick={() => setOpen(true)}
          className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-left">
          <Menu className="h-5 w-5 text-energy-400" />
          <span className="flex items-center gap-2 font-semibold">{activeItem?.icon}{activeItem?.label ?? 'Menu'}</span>
          <span className="ml-auto text-xs text-slate-500">Menu</span>
        </button>
      </div>
      {/* Drawer TOUJOURS monté, piloté par l'état (pas d'AnimatePresence : son
          démontage à la sortie est peu fiable sous StrictMode et laissait
          l'overlay bloquer les clics). Fermé = pointer-events-none + invisible. */}
      <motion.div
        initial={false}
        animate={{ opacity: open ? 1 : 0 }}
        transition={{ duration: 0.18 }}
        className={`fixed inset-0 z-40 bg-night-950/80 backdrop-blur-sm lg:hidden ${open ? '' : 'pointer-events-none'}`}
        aria-hidden={!open}
        onClick={() => setOpen(false)}
      />
      <motion.aside
        initial={false}
        animate={{ x: open ? 0 : '-105%' }}
        transition={{ type: 'spring', stiffness: 380, damping: 38 }}
        className={`fixed inset-y-0 left-0 z-50 w-72 overflow-y-auto border-r border-white/10 bg-night-950 p-4 lg:hidden ${open ? '' : 'pointer-events-none'}`}
        aria-hidden={!open}
      >
        <div className="mb-4 flex items-center justify-between">
          <p className="font-black text-energy-400">Navigation</p>
          <button onClick={() => setOpen(false)} className="btn-ghost !px-2" aria-label="Fermer"><X className="h-5 w-5" /></button>
        </div>
        <GroupList groups={groups} active={active} onSelect={(id) => { onSelect(id); setOpen(false); }} />
      </motion.aside>
    </>
  );
}
