import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, Fuel, LogOut, PartyPopper, AlertTriangle, Info } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { STATION } from '@/constants';
import type { NotifType } from '@/types';

const ROLE_LABEL: Record<string, string> = { admin: 'Administrateur', pompiste: 'Pompiste', viewer: 'Gérant / Auditeur' };
const NOTIF_ICON: Record<NotifType, ReactNode> = {
  augmentation_salaire: <PartyPopper className="h-4 w-4 text-fuel-400" />,
  manquant: <AlertTriangle className="h-4 w-4 text-rose-400" />,
  rapport_valide: <Info className="h-4 w-4 text-energy-400" />,
  info: <Info className="h-4 w-4 text-slate-400" />,
};

function NotificationsBell() {
  const { user } = useAuth();
  const { notifications, markNotificationRead } = useData();
  const [open, setOpen] = useState(false);
  const mine = notifications.filter((nf) => nf.user_id === user?.id);
  const unread = mine.filter((nf) => !nf.read).length;
  const hasParty = mine.some((nf) => !nf.read && nf.type === 'augmentation_salaire');

  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} className="btn-ghost relative !px-2.5" aria-label="Notifications">
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className={`absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full text-[10px] font-bold ${
              hasParty ? 'bg-fuel-400 text-night-950 animate-bounce' : 'bg-rose-500 text-white'
            }`}
          >
            {unread}
          </motion.span>
        )}
      </button>
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="card absolute right-0 z-40 mt-2 w-80 max-h-96 overflow-y-auto p-2"
            >
              <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Centre de notifications</p>
              {mine.length === 0 && <p className="px-3 py-6 text-center text-sm text-slate-500">Aucune notification.</p>}
              {mine.map((nf) => (
                <button
                  key={nf.id}
                  onClick={() => markNotificationRead(nf.id)}
                  className={`flex w-full gap-3 rounded-xl p-3 text-left transition hover:bg-white/5 ${
                    nf.read ? 'opacity-60' : nf.type === 'augmentation_salaire' ? 'bg-fuel-500/10' : 'bg-white/[0.03]'
                  }`}
                >
                  <span className="mt-0.5">{NOTIF_ICON[nf.type]}</span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">{nf.title}</span>
                    <span className="block text-xs text-slate-400">{nf.body}</span>
                  </span>
                  {!nf.read && <span className="ml-auto mt-1 h-2 w-2 shrink-0 rounded-full bg-energy-400" />}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function DashboardShell({ children, accent }: { children: ReactNode; accent?: string }) {
  const { user, signOut, isMock } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-night-950/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-energy-500 text-night-950">
            <Fuel className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-extrabold leading-tight">{STATION.name}</p>
            <p className="text-xs text-slate-400">{accent ?? ROLE_LABEL[user?.role ?? '']}</p>
          </div>

          {isMock && (
            <span className="chip ml-3 hidden bg-fuel-500/15 text-fuel-300 sm:inline-flex" title="Données locales de démonstration">
              Mode démo local
            </span>
          )}

          <div className="ml-auto flex items-center gap-2">
            <NotificationsBell />
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold leading-tight">{user?.full_name}</p>
              <p className="text-xs text-slate-400">{ROLE_LABEL[user?.role ?? '']}</p>
            </div>
            <button
              onClick={async () => {
                await signOut();
                navigate('/');
              }}
              className="btn-ghost !px-2.5"
              aria-label="Déconnexion"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
