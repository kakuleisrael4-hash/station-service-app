import { useEffect, useState, type ReactNode } from 'react';
import { motion, useDragControls } from 'framer-motion';
import { ChevronRight, LayoutGrid, PanelLeftClose, PanelLeftOpen, X } from 'lucide-react';

export interface NavItem {
  id: string;
  label: string;
  icon: ReactNode;
  /** Libellé court pour la barre d'onglets basse (sinon : 1er mot du libellé). */
  short?: string;
}
export interface NavGroup {
  label: string; // ex: "⛽ Opérations"
  items: NavItem[];
}

interface Props {
  groups: NavGroup[];
  active: string;
  onSelect: (id: string) => void;
  /** Barre d'onglets basse (mobile) : 3 raccourcis + action centrale surélevée + « Plus ». */
  bottomBar?: { itemIds: string[]; centerId: string };
}

const shortLabel = (it: NavItem) => it.short ?? it.label.split(' ')[0];
/** Force des icônes 24 px dans la barre basse (les NavItem sont déclarés en 16 px). */
const BIG_ICON = '[&>svg]:h-6 [&>svg]:w-6';

/**
 * Titre de la section active.
 *  • Desktop : fil d'Ariane « Pôle / Onglet ».
 *  • Mobile  : grand titre façon application (icône + nom de l'écran).
 */
export function Breadcrumb({ groups, active }: { groups: NavGroup[]; active: string }) {
  const group = groups.find((g) => g.items.some((it) => it.id === active));
  const item = group?.items.find((it) => it.id === active);
  if (!group || !item) return null;
  return (
    <>
      <div className="mb-4 hidden items-center gap-1.5 text-sm lg:flex">
        <span className="text-slate-500">{group.label}</span>
        <ChevronRight className="h-3.5 w-3.5 text-slate-600" />
        <span className="flex items-center gap-1.5 font-semibold text-energy-300">{item.icon}{item.label}</span>
      </div>
      <h1 className="mb-4 flex items-center gap-2.5 text-2xl font-black tracking-tight lg:hidden">
        <span className={`grid h-9 w-9 place-items-center rounded-xl bg-energy-500/15 text-energy-400 ${'[&>svg]:h-5 [&>svg]:w-5'}`}>{item.icon}</span>
        {item.label}
      </h1>
    </>
  );
}

function GroupList({ groups, active, onSelect, collapsed = false }: Omit<Props, 'bottomBar'> & { collapsed?: boolean }) {
  return (
    <nav className="space-y-5">
      {groups.map((g) => (
        <div key={g.label}>
          {collapsed
            ? <div className="mx-auto mb-1.5 h-px w-6 bg-white/10" />
            : <p className="mb-1.5 px-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">{g.label}</p>}
          <ul className="space-y-0.5">
            {g.items.map((it) => {
              const isActive = it.id === active;
              return (
                <li key={it.id}>
                  <button onClick={() => onSelect(it.id)} title={collapsed ? it.label : undefined}
                    className={`relative flex w-full items-center gap-2.5 rounded-xl py-2 text-sm font-medium transition-colors duration-200 ${
                      collapsed ? 'justify-center px-0' : 'px-3'
                    } ${isActive ? 'text-energy-300' : 'text-slate-400 hover:bg-white/5 hover:text-slate-100'}`}>
                    {isActive && (
                      <motion.span layoutId="nav-active" transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                        className="absolute inset-0 rounded-xl bg-energy-500/10 ring-1 ring-energy-400/40 shadow-[0_0_20px_rgba(249,115,22,0.3)]" />
                    )}
                    {isActive && (
                      <motion.span layoutId="nav-line" transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                        className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-full bg-energy-400 shadow-[0_0_12px_rgba(249,115,22,0.9)]" />
                    )}
                    <span className="relative z-10">{it.icon}</span>
                    {!collapsed && <span className="relative z-10 truncate">{it.label}</span>}
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

/** Vrai quand un champ de saisie a le focus (clavier ouvert) : on masque la barre basse. */
function useKeyboardOpen() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const isField = (t: EventTarget | null) => t instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) && (t as HTMLInputElement).type !== 'checkbox' && (t as HTMLInputElement).type !== 'radio';
    const on = (e: FocusEvent) => { if (isField(e.target)) setOpen(true); };
    const off = () => setOpen(false);
    document.addEventListener('focusin', on);
    document.addEventListener('focusout', off);
    return () => { document.removeEventListener('focusin', on); document.removeEventListener('focusout', off); };
  }, []);
  return open;
}

export interface TabBarItem { id: string; label: string; icon: ReactNode }

/**
 * Barre d'onglets BASSE type application (iOS / Android) — mobile uniquement.
 * Collée au bas de l'écran, respecte la zone sûre (encoche / barre de gestes),
 * cibles de 64 px, onglet actif mis en avant, action centrale optionnelle.
 */
export function MobileTabBar({ items, active, onSelect, center, onMore }: {
  items: TabBarItem[]; active: string; onSelect: (id: string) => void;
  center?: TabBarItem; onMore?: () => void;
}) {
  const kb = useKeyboardOpen();
  const left = center ? items.slice(0, Math.ceil(items.length / 2)) : items;
  const right = center ? items.slice(Math.ceil(items.length / 2)) : [];
  const Tab = (it: TabBarItem) => {
    const isActive = it.id === active;
    return (
      <button key={it.id} onClick={() => onSelect(it.id)} aria-label={it.label} aria-current={isActive ? 'page' : undefined}
        className={`relative flex h-full min-w-0 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition-colors ${isActive ? 'text-energy-400' : 'text-slate-400'}`}>
        {isActive && <motion.span layoutId="tab-indicator" transition={{ type: 'spring', stiffness: 500, damping: 40 }} className="absolute top-0 h-[3px] w-8 rounded-b-full bg-energy-400 shadow-[0_0_10px_rgba(249,115,22,0.8)]" />}
        <span className={BIG_ICON}>{it.icon}</span>
        <span className="max-w-full truncate px-1">{it.label}</span>
      </button>
    );
  };
  return (
    <nav aria-label="Navigation principale"
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-night-900/95 pb-[var(--safe-bottom)] pl-[var(--safe-left)] pr-[var(--safe-right)] backdrop-blur-xl transition-transform duration-200 lg:hidden ${kb ? 'translate-y-full' : ''}`}>
      <div className="flex h-[var(--tabbar-h)] items-stretch">
        {left.map(Tab)}
        {center && (
          <div className="relative flex min-w-0 flex-1 flex-col items-center justify-end pb-1.5">
            <motion.button whileTap={{ scale: 0.9 }} onClick={() => onSelect(center.id)} aria-label={center.label}
              className={`absolute -top-6 grid h-14 w-14 place-items-center rounded-full bg-energy-500 text-night-950 shadow-[0_0_24px_rgba(249,115,22,0.5)] ring-4 ring-night-950/90 ${BIG_ICON}`}>
              {center.icon}
            </motion.button>
            <span className={`text-[11px] font-semibold ${active === center.id ? 'text-energy-400' : 'text-slate-400'}`}>{center.label}</span>
          </div>
        )}
        {right.map(Tab)}
        {onMore && (
          <button onClick={onMore} aria-label="Toutes les sections"
            className="flex h-full min-w-0 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold text-slate-400">
            <LayoutGrid className="h-6 w-6" />
            <span>Plus</span>
          </button>
        )}
      </div>
    </nav>
  );
}

/** Feuille basse « Toutes les sections » : grille de grosses tuiles, glissable vers le bas pour fermer. */
function LauncherSheet({ open, onClose, groups, active, onSelect }: { open: boolean; onClose: () => void } & Omit<Props, 'bottomBar'>) {
  const controls = useDragControls();
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);
  // Toujours monté, piloté par l'état (AnimatePresence peu fiable sous StrictMode :
  // son démontage laissait l'overlay bloquer les clics). Fermé = invisible + pointer-events-none.
  return (
    <div className={`fixed inset-0 z-50 lg:hidden ${open ? '' : 'pointer-events-none'}`} aria-hidden={!open}>
      <motion.div initial={false} animate={{ opacity: open ? 1 : 0 }} transition={{ duration: 0.18 }}
        className="absolute inset-0 bg-night-950/80 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={false}
        animate={{ y: open ? 0 : '105%' }}
        transition={{ type: 'spring', stiffness: 380, damping: 38 }}
        drag="y" dragControls={controls} dragListener={false}
        dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0, bottom: 0.5 }}
        onDragEnd={(_, info) => { if (info.offset.y > 90 || info.velocity.y > 500) onClose(); }}
        className="absolute inset-x-0 bottom-0 flex max-h-[88dvh] flex-col rounded-t-3xl border-t border-white/10 bg-night-900 shadow-2xl"
      >
        <div className="shrink-0 cursor-grab touch-none px-4 pb-2 pt-3" onPointerDown={(e) => controls.start(e)}>
          <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-white/20" />
          <div className="flex items-center justify-between">
            <p className="text-lg font-black">Toutes les sections</p>
            <button onClick={onClose} className="btn-ghost !rounded-full !px-0 h-11 w-11" aria-label="Fermer"><X className="h-5 w-5" /></button>
          </div>
        </div>
        <div className="space-y-5 overflow-y-auto overscroll-contain px-4 pb-[calc(1.25rem+var(--safe-bottom))] pt-1">
          {groups.map((g) => (
            <section key={g.label}>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">{g.label}</p>
              <div className="grid grid-cols-3 gap-2.5">
                {g.items.map((it) => {
                  const isActive = it.id === active;
                  return (
                    <button key={it.id} onClick={() => { onSelect(it.id); onClose(); }}
                      className={`flex min-h-[5.5rem] flex-col items-center justify-center gap-2 rounded-2xl p-2 text-center text-xs font-semibold leading-tight transition active:scale-95 ${
                        isActive ? 'bg-energy-500/15 text-energy-300 ring-1 ring-energy-400/50' : 'bg-white/[0.04] text-slate-200 ring-1 ring-white/10'
                      }`}>
                      <span className={`grid h-10 w-10 place-items-center rounded-xl ${isActive ? 'bg-energy-500/20' : 'bg-white/5'} [&>svg]:h-5 [&>svg]:w-5`}>{it.icon}</span>
                      <span className="line-clamp-2">{it.label}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

/**
 * Navigation :
 *  • Desktop : sidebar rétractable (inchangée).
 *  • Mobile  : barre d'onglets basse type application + feuille « Plus »
 *    listant toutes les sections en grandes tuiles tactiles.
 */
export default function SideNav({ groups, active, onSelect, bottomBar }: Props) {
  const [sheet, setSheet] = useState(false);
  // Sidebar rétractable (mode icônes seules) — préférence mémorisée.
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('kkcoil.nav.collapsed') === '1');
  const toggleCollapsed = () => setCollapsed((c) => { localStorage.setItem('kkcoil.nav.collapsed', c ? '0' : '1'); return !c; });
  const all = groups.flatMap((g) => g.items);
  const find = (id: string) => all.find((it) => it.id === id);
  const barItems = (bottomBar?.itemIds ?? []).map(find).filter(Boolean) as NavItem[];
  const center = bottomBar ? find(bottomBar.centerId) : undefined;
  const asTab = (it: NavItem): TabBarItem => ({ id: it.id, label: shortLabel(it), icon: it.icon });

  return (
    <>
      {/* ===== Desktop : sidebar flottante, rétractable en icônes ===== */}
      <aside className={`sticky top-20 hidden max-h-[calc(100vh-6rem)] shrink-0 self-start overflow-y-auto rounded-2xl border border-white/5 bg-night-900 p-3 shadow-2xl transition-all duration-300 lg:block ${collapsed ? 'w-16' : 'w-56'}`}>
        <button onClick={toggleCollapsed} title={collapsed ? 'Déployer le menu' : 'Réduire en icônes'}
          className={`mb-3 flex w-full items-center gap-2 rounded-xl py-1.5 text-xs text-slate-500 transition-colors duration-200 hover:bg-white/5 hover:text-slate-100 ${collapsed ? 'justify-center px-0' : 'px-3'}`}>
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <><PanelLeftClose className="h-4 w-4" /> Réduire</>}
        </button>
        <GroupList groups={groups} active={active} onSelect={onSelect} collapsed={collapsed} />
      </aside>

      {/* ===== Mobile : barre d'onglets basse + feuille « Plus » ===== */}
      <MobileTabBar
        items={barItems.map(asTab)}
        center={center ? asTab(center) : undefined}
        active={active}
        onSelect={onSelect}
        onMore={() => setSheet(true)}
      />
      <LauncherSheet open={sheet} onClose={() => setSheet(false)} groups={groups} active={active} onSelect={onSelect} />
    </>
  );
}
