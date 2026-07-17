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
  /** Bottom bar mobile « Fintech » : 4 raccourcis + bouton central surélevé. */
  bottomBar?: { itemIds: string[]; centerId: string };
}

function GroupList({ groups, active, onSelect }: Omit<Props, 'bottomBar'>) {
  return (
    <nav className="space-y-5">
      {groups.map((g) => (
        <div key={g.label}>
          <p className="mb-1.5 px-3 text-[11px] font-bold uppercase tracking-wider text-zinc-500">{g.label}</p>
          <ul className="space-y-0.5">
            {g.items.map((it) => {
              const isActive = it.id === active;
              return (
                <li key={it.id}>
                  <button onClick={() => onSelect(it.id)}
                    className={`relative flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                      isActive ? 'text-energy-300' : 'text-zinc-400 hover:bg-white/5 hover:text-white'
                    }`}>
                    {isActive && (
                      <motion.span layoutId="nav-active" transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                        className="absolute inset-0 rounded-xl bg-energy-500/10 ring-1 ring-energy-400/40 shadow-[0_0_20px_rgba(249,115,22,0.3)]" />
                    )}
                    {isActive && (
                      <motion.span layoutId="nav-line" transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                        className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-full bg-energy-400 shadow-[0_0_12px_rgba(249,115,22,0.9)]" />
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
 * Navigation « Dark Glass-Orange » :
 *  • Desktop : sidebar flottante détachée (verre dépoli, angles arrondis),
 *    pastille active lumineuse + ligne verticale orange néon coulissante.
 *  • Mobile : Bottom Bar type Fintech (bouton central rond surélevé orange)
 *    + drawer coulissant pour le menu complet.
 */
export default function SideNav({ groups, active, onSelect, bottomBar }: Props) {
  const [open, setOpen] = useState(false);
  const all = groups.flatMap((g) => g.items);
  const find = (id: string) => all.find((it) => it.id === id);
  const barItems = (bottomBar?.itemIds ?? []).map(find).filter(Boolean) as NavItem[];
  const center = bottomBar ? find(bottomBar.centerId) : undefined;

  return (
    <>
      {/* ===== Desktop : sidebar flottante « glass » ===== */}
      <aside className="sticky top-20 hidden max-h-[calc(100vh-6rem)] w-56 shrink-0 self-start overflow-y-auto rounded-2xl border border-white/5 bg-zinc-900/40 p-3 shadow-2xl backdrop-blur-md lg:block">
        <GroupList groups={groups} active={active} onSelect={onSelect} />
      </aside>

      {/* ===== Mobile : Bottom Bar Fintech ===== */}
      {bottomBar && center ? (
        <nav className="fixed inset-x-3 bottom-3 z-40 lg:hidden">
          <div className="relative flex items-end justify-between rounded-2xl border border-white/5 bg-zinc-900/70 px-2 pb-2 pt-2 shadow-2xl backdrop-blur-xl">
            {barItems.slice(0, 2).map((it) => <BarButton key={it.id} it={it} active={active} onSelect={onSelect} />)}
            {/* Bouton central rond surélevé — action critique */}
            <motion.button whileTap={{ scale: 0.9 }} onClick={() => onSelect(center.id)} aria-label={center.label}
              className="relative -mt-8 grid h-14 w-14 shrink-0 place-items-center rounded-full bg-energy-500 text-night-950 shadow-[0_0_24px_rgba(249,115,22,0.55)] ring-4 ring-night-950/80">
              {center.icon}
            </motion.button>
            {barItems.slice(2, 3).map((it) => <BarButton key={it.id} it={it} active={active} onSelect={onSelect} />)}
            <button onClick={() => setOpen(true)}
              className="flex flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 text-[10px] font-medium text-zinc-400">
              <Menu className="h-5 w-5" />
              Menu
            </button>
          </div>
        </nav>
      ) : (
        <div className="mb-4 lg:hidden">
          <button onClick={() => setOpen(true)}
            className="flex w-full items-center gap-3 rounded-xl border border-white/5 bg-zinc-900/40 px-4 py-2.5 text-left backdrop-blur-md">
            <Menu className="h-5 w-5 text-energy-400" />
            <span className="flex items-center gap-2 font-semibold">{find(active)?.icon}{find(active)?.label ?? 'Menu'}</span>
            <span className="ml-auto text-xs text-zinc-500">Menu</span>
          </button>
        </div>
      )}

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
        className={`fixed inset-y-0 left-0 z-50 w-72 overflow-y-auto border-r border-white/5 bg-zinc-950/95 p-4 backdrop-blur-xl lg:hidden ${open ? '' : 'pointer-events-none'}`}
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

function BarButton({ it, active, onSelect }: { it: NavItem; active: string; onSelect: (id: string) => void }) {
  const isActive = it.id === active;
  return (
    <motion.button whileTap={{ scale: 0.92 }} onClick={() => onSelect(it.id)}
      className={`flex flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 text-[10px] font-medium transition-colors ${
        isActive ? 'text-energy-400' : 'text-zinc-400'
      }`}>
      <span className={isActive ? 'drop-shadow-[0_0_8px_rgba(249,115,22,0.8)]' : ''}>{it.icon}</span>
      <span className="max-w-16 truncate">{it.label.split(' ')[0]}</span>
    </motion.button>
  );
}
