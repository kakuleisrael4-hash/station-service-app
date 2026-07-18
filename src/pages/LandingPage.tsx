import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Fuel, Gauge, ShieldCheck, BarChart3, Users, Droplets, ArrowRight, Clock, MapPin, Phone,
  Facebook, Instagram, MessageCircle, Music2, Image as ImageIcon, Megaphone,
} from 'lucide-react';
import LoginModal from './LoginModal';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { STATION, normalizeLanding } from '@/constants';
import type { LandingContent, LandingSectionId } from '@/types';

const FEATURES = [
  { icon: <Gauge className="h-6 w-6" />, title: 'Suivi des cuves en temps réel', text: 'Niveaux essence & gasoil mis à jour à chaque rapport validé. Plus de rupture surprise.' },
  { icon: <BarChart3 className="h-6 w-6" />, title: 'Rapports & caisse précis', text: 'Calcul automatique des litrages, montants et du total à remettre. Billetage contrôlé au franc près.' },
  { icon: <Users className="h-6 w-6" />, title: 'Gestion RH intégrée', text: 'Salaires, manquants cumulés et fiches de paie. Chaque pompiste suit ses performances.' },
  { icon: <ShieldCheck className="h-6 w-6" />, title: 'Accès par rôles', text: 'Administrateur, pompiste et auditeur : chacun voit exactement ce qui le concerne.' },
];

/** Statut OUVERT/FERMÉ : override manuel prioritaire, sinon plage horaire (vide = 24h/24). */
export function stationOpenState(c: LandingContent): { open: boolean; reason?: string } {
  if (c.open_mode === 'force_closed') return { open: false, reason: c.closed_reason || 'Fermeture exceptionnelle' };
  if (!c.open_from || !c.open_to) return { open: true };
  const now = new Date();
  const cur = now.getHours() * 60 + now.getMinutes();
  const [fh, fm] = c.open_from.split(':').map(Number);
  const [th, tm] = c.open_to.split(':').map(Number);
  const from = (fh || 0) * 60 + (fm || 0);
  const to = (th || 0) * 60 + (tm || 0);
  // Plage passant minuit (ex: 18:00 -> 06:00)
  const open = from <= to ? cur >= from && cur < to : cur >= from || cur < to;
  return { open };
}

function StatusBadge({ c }: { c: LandingContent }) {
  const { open, reason } = stationOpenState(c);
  return (
    <span className={`chip ${open ? 'bg-emerald-500/15 text-emerald-300' : 'bg-rose-500/15 text-rose-300'}`}
      title={reason}>
      <span className={`h-2 w-2 rounded-full animate-pulse-neon ${open ? 'bg-emerald-400 text-emerald-400' : 'bg-rose-400 text-rose-400'}`} />
      {open ? 'STATION OUVERTE' : `FERMÉE${reason ? ` — ${reason}` : ''}`}
    </span>
  );
}

/** Particules orange flottantes du mode « Cyber-Neon » (CSS pur). */
function NeonParticles() {
  const parts = Array.from({ length: 18 }, (_, i) => ({
    left: `${(i * 53) % 100}%`,
    size: 2 + ((i * 7) % 5),
    dur: 9 + ((i * 3) % 9),
    delay: -((i * 1.7) % 12),
  }));
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div className="absolute inset-0 bg-[radial-gradient(45rem_30rem_at_20%_20%,rgba(249,115,22,0.16),transparent_60%),radial-gradient(40rem_28rem_at_85%_70%,rgba(251,146,60,0.12),transparent_60%)]" />
      {parts.map((p, i) => (
        <span key={i} className="absolute bottom-0 rounded-full bg-energy-400/70 animate-float-particle"
          style={{ left: p.left, width: p.size, height: p.size, animationDuration: `${p.dur}s`, animationDelay: `${p.delay}s`, boxShadow: '0 0 8px rgba(249,115,22,0.8)' }} />
      ))}
    </div>
  );
}

export default function LandingPage({ contentOverride, preview = false }: { contentOverride?: LandingContent; preview?: boolean }) {
  const { user } = useAuth();
  const data = useData();
  const navigate = useNavigate();
  const [loginOpen, setLoginOpen] = useState(false);
  const c: LandingContent = normalizeLanding(contentOverride ?? data.landing);

  const cta = () => { if (preview) return; user ? navigate('/dashboard') : setLoginOpen(true); };
  const phones = c.phones.split(/[,;]/).map((p) => p.trim()).filter(Boolean);
  const socials = [
    { url: c.social.facebook, icon: <Facebook className="h-5 w-5" />, label: 'Facebook' },
    { url: c.social.instagram, icon: <Instagram className="h-5 w-5" />, label: 'Instagram' },
    { url: c.social.whatsapp, icon: <MessageCircle className="h-5 w-5" />, label: 'WhatsApp' },
    { url: c.social.tiktok, icon: <Music2 className="h-5 w-5" />, label: 'TikTok' },
  ].filter((s) => s.url);

  const Logo = () =>
    c.logo_url ? (
      <img src={c.logo_url} alt="logo" className="h-10 w-10 rounded-xl object-cover" />
    ) : (
      <div className="grid h-10 w-10 place-items-center rounded-xl bg-energy-500 text-night-950"><Fuel className="h-5 w-5" /></div>
    );

  // ============== SECTIONS (ordre + visibilité pilotés par le CMS) ==============
  const SECTIONS: Record<LandingSectionId, ReactNode> = {
    hero: (
      <section key="hero" className="relative overflow-hidden">
        {/* Arrière-plan selon le mode choisi par l'Admin */}
        {c.hero_mode === 'video' && c.hero_video_url ? (
          <div className="absolute inset-0">
            <video autoPlay muted loop playsInline className="h-full w-full object-cover" src={c.hero_video_url} />
            <div className="absolute inset-0 bg-black/60" />
          </div>
        ) : c.hero_mode === 'neon' ? (
          <NeonParticles />
        ) : c.hero_bg_url ? (
          <div className="absolute inset-0">
            <img src={c.hero_bg_url} alt="" className="h-full w-full object-cover opacity-30" />
            <div className="absolute inset-0 bg-gradient-to-b from-night-950/70 via-night-950/80 to-night-950" />
          </div>
        ) : null}
        <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-24">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge c={c} />
              <span className="chip bg-energy-500/15 text-energy-300"><MapPin className="h-3 w-3" /> {c.address}</span>
            </div>
            <h1 className="mt-4 text-4xl font-black leading-[1.05] sm:text-6xl">{c.hero_title}</h1>
            <p className="mt-5 max-w-xl text-lg text-slate-300">{c.hero_slogan}</p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button onClick={cta} className="btn-primary !px-6 !py-3 text-base">{user ? 'Accéder à mon espace' : 'Espace Personnel'} <ArrowRight className="h-5 w-5" /></button>
              <a href="#apropos" className="btn-ghost !px-6 !py-3 text-base">Découvrir</a>
            </div>
            <div className="mt-10 flex flex-wrap gap-6">
              <div><p className="text-2xl font-extrabold text-energy-400">{c.hours}</p><p className="text-xs text-slate-400">Service</p></div>
              <div><p className="text-2xl font-extrabold text-fuel-400">{data.settings.essence_price.toLocaleString('fr-FR')} FC</p><p className="text-xs text-slate-400">Le litre de Super</p></div>
              <div><p className="text-2xl font-extrabold text-energy-400">100%</p><p className="text-xs text-slate-400">Caisse contrôlée</p></div>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.7, delay: 0.1 }} className="relative">
            <div className="card relative overflow-hidden p-8">
              <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-energy-500/20 blur-3xl" />
              <div className="absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-fuel-500/20 blur-3xl" />
              <div className="relative space-y-4">
                {[
                  { icon: <Droplets className="h-5 w-5" />, label: 'Essence Super', note: 'Qualité garantie' },
                  { icon: <Fuel className="h-5 w-5" />, label: 'Gasoil', note: 'Pour tous moteurs' },
                  { icon: <Clock className="h-5 w-5" />, label: c.hours, note: 'Service continu' },
                ].map((s) => (
                  <div key={s.label} className="flex items-center gap-4 rounded-2xl bg-white/[0.03] p-4 ring-1 ring-white/10">
                    <div className="grid h-12 w-12 place-items-center rounded-xl bg-energy-500/15 text-energy-400">{s.icon}</div>
                    <div><p className="font-semibold">{s.label}</p><p className="text-sm text-slate-400">{s.note}</p></div>
                    <div className="ml-auto h-2 w-2 rounded-full bg-energy-400" />
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </section>
    ),

    tarifs: (
      <section key="tarifs" className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <AnimatePresence>
          {c.promo_text && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              className="mx-auto mb-5 w-fit rounded-full bg-gradient-to-r from-energy-500 to-rose-500 px-5 py-2 text-sm font-black text-white shadow-glow-soft">
              <Megaphone className="mr-1.5 inline h-4 w-4" /> {c.promo_text}
            </motion.div>
          )}
        </AnimatePresence>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="card relative overflow-hidden p-6 text-center">
            <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-energy-500/20 blur-2xl" />
            <p className="text-xs font-bold uppercase tracking-wider text-energy-300">Essence Super</p>
            <p className="mt-2 text-4xl font-black tabular-nums text-energy-400">{data.settings.essence_price.toLocaleString('fr-FR')} <span className="text-lg">FC/L</span></p>
            <p className="mt-1 text-xs text-slate-500">Tarif du jour — mis à jour en direct</p>
          </div>
          <div className="card relative overflow-hidden p-6 text-center">
            <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-fuel-500/20 blur-2xl" />
            <p className="text-xs font-bold uppercase tracking-wider text-fuel-300">Gasoil</p>
            <p className="mt-2 text-4xl font-black tabular-nums text-fuel-400">{data.settings.gasoil_price.toLocaleString('fr-FR')} <span className="text-lg">FC/L</span></p>
            <p className="mt-1 text-xs text-slate-500">Tarif du jour — mis à jour en direct</p>
          </div>
        </div>
      </section>
    ),

    features: (
      <section key="features" className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="mb-10 text-center">
          <h2 className="text-3xl font-extrabold sm:text-4xl">Une station pilotée au cordeau</h2>
          <p className="mt-3 text-slate-400">Tout ce qu'il faut pour gérer le carburant, la caisse et l'équipe.</p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f, i) => (
            <motion.div key={f.title} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.07 }} className="card p-6">
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-energy-500/15 text-energy-400">{f.icon}</div>
              <h3 className="mt-4 font-bold">{f.title}</h3>
              <p className="mt-2 text-sm text-slate-400">{f.text}</p>
            </motion.div>
          ))}
        </div>
      </section>
    ),

    apropos: (
      <section key="apropos" id="apropos" className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="card overflow-hidden p-8 lg:p-12">
          <div className="grid items-center gap-8 lg:grid-cols-2">
            <div>
              <span className="chip bg-fuel-500/15 text-fuel-300">À propos</span>
              <h2 className="mt-4 text-3xl font-extrabold">Au service de la mobilité</h2>
              <p className="mt-4 whitespace-pre-line text-slate-300">{c.about_text}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {c.gallery.length > 0
                ? c.gallery.slice(0, 4).map((g) => (
                    <figure key={g.id} className="relative overflow-hidden rounded-2xl ring-1 ring-white/10" style={{ aspectRatio: '4/3' }}>
                      <img src={g.url} alt={g.caption || 'station'} className="h-full w-full object-cover" />
                      {g.caption && <figcaption className="absolute bottom-0 w-full bg-night-950/70 px-2 py-1 text-xs text-slate-200">{g.caption}</figcaption>}
                    </figure>
                  ))
                : [0, 1, 2, 3].map((i) => (
                    <div key={i} className="grid place-items-center rounded-2xl bg-white/[0.03] text-slate-600 ring-1 ring-white/10" style={{ aspectRatio: '4/3' }}><ImageIcon className="h-7 w-7" /></div>
                  ))}
            </div>
          </div>
        </div>
      </section>
    ),

    infos: (
      <section key="infos" id="infos" className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="mb-8 text-center"><h2 className="text-3xl font-extrabold sm:text-4xl">Infos pratiques</h2></div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <div className="card p-6"><div className="grid h-11 w-11 place-items-center rounded-xl bg-energy-500/15 text-energy-400"><Clock className="h-5 w-5" /></div><h3 className="mt-3 font-bold">Horaires</h3><p className="mt-1 text-slate-300">{c.hours}</p><div className="mt-2"><StatusBadge c={c} /></div></div>
          <div className="card p-6"><div className="grid h-11 w-11 place-items-center rounded-xl bg-energy-500/15 text-energy-400"><Phone className="h-5 w-5" /></div><h3 className="mt-3 font-bold">Téléphone</h3>{phones.map((p) => <p key={p} className="mt-1 text-slate-300">{p}</p>)}</div>
          <div className="card p-6"><div className="grid h-11 w-11 place-items-center rounded-xl bg-energy-500/15 text-energy-400"><MapPin className="h-5 w-5" /></div><h3 className="mt-3 font-bold">Adresse</h3><p className="mt-1 text-slate-300">{c.address}</p></div>
        </div>
        {socials.length > 0 && (
          <div className="mt-6 flex justify-center gap-3">
            {socials.map((s) => (
              <a key={s.label} href={preview ? undefined : s.url} target="_blank" rel="noreferrer" className="grid h-11 w-11 place-items-center rounded-xl bg-white/5 text-slate-200 ring-1 ring-white/10 hover:bg-energy-500 hover:text-night-950" aria-label={s.label}>{s.icon}</a>
            ))}
          </div>
        )}
      </section>
    ),

    cta: (
      <section key="cta" className="mx-auto max-w-7xl px-4 pb-20 sm:px-6">
        <div className="card flex flex-col items-center gap-4 bg-gradient-to-r from-energy-500/10 to-fuel-500/10 p-10 text-center">
          <h2 className="text-2xl font-extrabold sm:text-3xl">Membre du personnel ?</h2>
          <p className="max-w-md text-slate-300">Connectez-vous à votre espace pour saisir vos rapports, suivre vos performances ou superviser la station.</p>
          <button onClick={cta} className="btn-primary !px-6 !py-3 text-base">{user ? 'Accéder à mon espace' : "Ouvrir l'Espace Personnel"} <ArrowRight className="h-5 w-5" /></button>
        </div>
      </section>
    ),
  };

  return (
    <div className="min-h-screen">
      {/* NAVBAR */}
      <nav className={`${preview ? '' : 'sticky top-0'} z-30 border-b border-white/10 bg-night-950/60 backdrop-blur-xl`}>
        <div className="mx-auto flex max-w-7xl items-center px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <Logo />
            <div className="leading-tight">
              <p className="text-sm font-extrabold">{STATION.name}</p>
              <p className="text-[11px] text-slate-400">Énergie de confiance</p>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden sm:block"><StatusBadge c={c} /></span>
            <button onClick={cta} className="btn-primary">{user ? 'Mon espace' : 'Espace Personnel'} <ArrowRight className="h-4 w-4" /></button>
          </div>
        </div>
      </nav>

      {/* Sections dans l'ordre choisi par l'Admin, sections masquées exclues */}
      {c.sections.filter((s) => s.visible).map((s) => SECTIONS[s.id])}

      {/* FOOTER */}
      <footer className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-slate-400 sm:flex-row sm:px-6">
          <div className="flex items-center gap-2"><Fuel className="h-4 w-4 text-energy-400" /> © {new Date().getFullYear()} {STATION.name}</div>
          <div className="flex flex-wrap items-center gap-5">
            <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4" /> {c.address}</span>
            {phones[0] && <span className="flex items-center gap-1.5"><Phone className="h-4 w-4" /> {phones[0]}</span>}
          </div>
        </div>
      </footer>

      {!preview && <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />}
    </div>
  );
}
