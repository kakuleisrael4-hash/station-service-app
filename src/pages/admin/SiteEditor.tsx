import { useMemo, useRef, useState } from 'react';
import {
  LayoutTemplate, Type, Phone, Save, Loader2, Trash2, Images, Share2, RotateCcw,
  Eye, EyeOff, ArrowUp, ArrowDown, Megaphone, Clock, Siren, Film, Image as ImageIcon, Sparkles,
  Monitor, Smartphone, UploadCloud,
} from 'lucide-react';
import { Card, SectionTitle } from '@/components/ui';
import ImageDropzone from '@/components/ImageDropzone';
import LandingPage from '../LandingPage';
import { useData } from '@/context/DataContext';
import { SECTION_LABELS, normalizeLanding } from '@/constants';
import type { GalleryImage, HeroMode, LandingContent } from '@/types';

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'g-' + Math.random().toString(36).slice(2));
const MAX_VIDEO = 50 * 1024 * 1024;

export default function SiteEditor() {
  const { landing, settings, updateLanding, uploadAttachment } = useData();
  const [c, setC] = useState<LandingContent>(() => normalizeLanding(structuredClone(landing)));
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [vidBusy, setVidBusy] = useState(false);
  const vidRef = useRef<HTMLInputElement>(null);

  const dirty = useMemo(() => JSON.stringify(c) !== JSON.stringify(normalizeLanding(landing)), [c, landing]);
  const set = <K extends keyof LandingContent>(k: K, v: LandingContent[K]) => setC((p) => ({ ...p, [k]: v }));
  const setSocial = (k: keyof LandingContent['social'], v: string) => setC((p) => ({ ...p, social: { ...p.social, [k]: v } }));

  const addGallery = (url: string) => { if (url) set('gallery', [...c.gallery, { id: uid(), url, caption: '' }]); };
  const updateGallery = (id: string, patch: Partial<GalleryImage>) => set('gallery', c.gallery.map((g) => (g.id === id ? { ...g, ...patch } : g)));
  const removeGallery = (id: string) => set('gallery', c.gallery.filter((g) => g.id !== id));

  // --- Agencement des sections : visibilité + ordre (monter/descendre) ---
  const toggleSection = (id: string) => set('sections', c.sections.map((s) => (s.id === id ? { ...s, visible: !s.visible } : s)));
  const moveSection = (idx: number, dir: -1 | 1) => {
    const to = idx + dir;
    if (to < 0 || to >= c.sections.length) return;
    const next = [...c.sections];
    [next[idx], next[to]] = [next[to], next[idx]];
    set('sections', next);
  };

  async function onPickVideo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('video/')) { setErr('Choisissez un fichier vidéo (MP4/WEBM).'); return; }
    if (file.size > MAX_VIDEO) { setErr(`Vidéo trop lourde (${(file.size / 1048576).toFixed(0)} Mo) — maximum 50 Mo.`); return; }
    setVidBusy(true); setErr(null);
    try {
      const att = await uploadAttachment(file);
      set('hero_video_url', att.file_url);
    } catch (e2) { setErr(e2 instanceof Error ? e2.message : 'Téléversement vidéo impossible.'); }
    finally { setVidBusy(false); }
  }

  async function publish() {
    setBusy(true); setErr(null);
    try {
      await updateLanding(c);
      setSaved(true);
      setTimeout(() => setSaved(false), 2200);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Échec de la publication.');
    } finally { setBusy(false); }
  }

  // Cadre du Live Preview : rendu réel de LandingPage, mis à l'échelle.
  const frameW = device === 'desktop' ? 1180 : 390;
  const scale = device === 'desktop' ? 0.36 : 0.78;

  return (
    <div className="space-y-5">
      {/* Barre d'actions */}
      <Card className="sticky top-20 z-10 flex flex-wrap items-center gap-3">
        <SectionTitle icon={<LayoutTemplate className="h-5 w-5" />} title="CMS — Site vitrine" subtitle="Aperçu en direct : le rendu à droite se met à jour à chaque frappe" />
        <div className="ml-auto flex items-center gap-2">
          {dirty && <span className="chip bg-fuel-500/15 text-fuel-300">Modifications non publiées</span>}
          <button onClick={() => setC(normalizeLanding(structuredClone(landing)))} disabled={!dirty} className="btn-ghost !py-2"><RotateCcw className="h-4 w-4" /> Réinitialiser</button>
          <button onClick={publish} disabled={busy || !dirty} className={`btn !py-2 font-bold ${dirty ? 'bg-energy-500 text-night-950 hover:bg-energy-400 shadow-glow' : 'bg-white/5 text-slate-500'}`}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {saved ? 'Publié !' : 'Enregistrer les modifications'}
          </button>
        </div>
      </Card>
      {err && <div className="rounded-xl bg-rose-500/10 px-4 py-2 text-sm text-rose-300">{err}</div>}

      {/* ===== SPLIT-SCREEN : formulaire à gauche · Live Preview à droite ===== */}
      <div className="grid gap-5 xl:grid-cols-[1fr_460px]">
        {/* ---------------- Colonne formulaire ---------------- */}
        <div className="min-w-0 space-y-5">
          {/* STATUT DE LA STATION */}
          <Card className={c.open_mode === 'force_closed' ? 'ring-1 ring-rose-500/40' : ''}>
            <SectionTitle icon={<Siren className="h-5 w-5" />} title="Statut de la station" subtitle="Automatique selon les horaires, ou fermeture forcée d'urgence" />
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="label flex items-center gap-1"><Clock className="h-3 w-3" /> Ouvre à</label>
                <input type="time" className="field" value={c.open_from} onChange={(e) => set('open_from', e.target.value)} />
              </div>
              <div>
                <label className="label">Ferme à</label>
                <input type="time" className="field" value={c.open_to} onChange={(e) => set('open_to', e.target.value)} />
              </div>
              <div className="flex items-end">
                <p className="text-xs text-slate-500">Laisser vide = ouvert 24h/24. Badge vert/rouge néon sur le site public (mise à jour en direct).</p>
              </div>
            </div>
            <div className="mt-4 rounded-xl bg-white/[0.03] p-3 ring-1 ring-white/10">
              {c.open_mode === 'auto' ? (
                <div className="flex flex-wrap items-center gap-3">
                  <span className="chip bg-emerald-500/15 text-emerald-300">Mode automatique actif</span>
                  <button onClick={() => set('open_mode', 'force_closed')} className="btn-danger !py-2 ml-auto"><Siren className="h-4 w-4" /> FERMER EXCEPTIONNELLEMENT</button>
                </div>
              ) : (
                <div className="space-y-2">
                  <span className="chip bg-rose-500/15 text-rose-300 animate-pulse-neon">⛔ Fermeture exceptionnelle FORCÉE</span>
                  <input className="field" placeholder="Motif court (ex: Maintenance technique, Rupture temporaire)" value={c.closed_reason} onChange={(e) => set('closed_reason', e.target.value)} />
                  <button onClick={() => { set('open_mode', 'auto'); set('closed_reason', ''); }} className="btn-primary !py-2">Rouvrir la station (mode auto)</button>
                </div>
              )}
            </div>
          </Card>

          {/* AGENCEMENT DES SECTIONS */}
          <Card>
            <SectionTitle icon={<LayoutTemplate className="h-5 w-5" />} title="Agencement de la page" subtitle="Afficher/masquer chaque section et réorganiser l'ordre vertical" />
            <ul className="space-y-1.5">
              {c.sections.map((s, i) => (
                <li key={s.id} className={`flex items-center gap-2 rounded-xl px-3 py-2 ring-1 ring-white/10 ${s.visible ? 'bg-white/[0.03]' : 'bg-white/[0.01] opacity-60'}`}>
                  <span className="w-6 text-center text-xs font-bold text-slate-500">{i + 1}</span>
                  <span className="flex-1 text-sm font-medium">{SECTION_LABELS[s.id]}</span>
                  <button onClick={() => moveSection(i, -1)} disabled={i === 0} className="btn-ghost !p-1.5 disabled:opacity-30" title="Monter"><ArrowUp className="h-4 w-4" /></button>
                  <button onClick={() => moveSection(i, 1)} disabled={i === c.sections.length - 1} className="btn-ghost !p-1.5 disabled:opacity-30" title="Descendre"><ArrowDown className="h-4 w-4" /></button>
                  <button onClick={() => toggleSection(s.id)}
                    className={`relative ml-1 h-6 w-11 rounded-full transition-colors ${s.visible ? 'bg-energy-500' : 'bg-white/10'}`}
                    title={s.visible ? 'Masquer' : 'Afficher'} aria-label={`Basculer ${SECTION_LABELS[s.id]}`}>
                    <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${s.visible ? 'left-[22px]' : 'left-0.5'}`} />
                  </button>
                </li>
              ))}
            </ul>
          </Card>

          {/* TARIFS & PROMO */}
          <Card>
            <SectionTitle icon={<Megaphone className="h-5 w-5" />} title="Tarifs du jour & encart promo" subtitle="Les prix sont synchronisés automatiquement depuis Paramètres" />
            <div className="mb-3 grid grid-cols-2 gap-3 text-center">
              <div className="rounded-xl bg-energy-500/10 p-3 ring-1 ring-energy-500/20"><p className="text-xs text-energy-300">SUPER</p><p className="text-xl font-black tabular-nums">{settings.essence_price.toLocaleString('fr-FR')} FC/L</p></div>
              <div className="rounded-xl bg-fuel-500/10 p-3 ring-1 ring-fuel-500/20"><p className="text-xs text-fuel-300">GASOIL</p><p className="text-xl font-black tabular-nums">{settings.gasoil_price.toLocaleString('fr-FR')} FC/L</p></div>
            </div>
            <label className="label">Badge promotionnel (vide = masqué)</label>
            <input className="field" placeholder='Ex: "PROMO WEEK-END : -5% sur le plein"' value={c.promo_text} onChange={(e) => set('promo_text', e.target.value)} />
          </Card>

          {/* HERO */}
          <Card>
            <SectionTitle icon={<Type className="h-5 w-5" />} title="Bannière Hero" subtitle="Choisissez l'expérience visuelle d'ouverture du site" />
            <div className="mb-3 grid grid-cols-3 gap-2">
              {([['image', 'Image', <ImageIcon key="i" className="h-4 w-4" />], ['video', 'Boucle vidéo', <Film key="v" className="h-4 w-4" />], ['neon', 'Cyber-Neon', <Sparkles key="n" className="h-4 w-4" />]] as [HeroMode, string, React.ReactNode][]).map(([m, label, ic]) => (
                <button key={m} onClick={() => set('hero_mode', m)}
                  className={`btn !py-2 text-xs ${c.hero_mode === m ? 'bg-energy-500 text-night-950 shadow-glow' : 'bg-white/5 text-slate-300'}`}>{ic} {label}</button>
              ))}
            </div>
            <div className="space-y-3">
              <div><label className="label">Titre principal (H1)</label><input className="field" value={c.hero_title} onChange={(e) => set('hero_title', e.target.value)} /></div>
              <div><label className="label">Slogan</label><input className="field" value={c.hero_slogan} onChange={(e) => set('hero_slogan', e.target.value)} /></div>
              <div className="grid grid-cols-2 gap-3">
                <ImageDropzone label="Logo" value={c.logo_url} onChange={(u) => set('logo_url', u)} aspect="1/1" rounded="full" />
                {c.hero_mode === 'image' && <ImageDropzone label="Image de fond (Hero)" value={c.hero_bg_url} onChange={(u) => set('hero_bg_url', u)} aspect="1/1" />}
                {c.hero_mode === 'video' && (
                  <div>
                    <label className="label">Vidéo d'ambiance (MP4 ≤ 50 Mo)</label>
                    <input ref={vidRef} type="file" accept="video/mp4,video/webm" className="hidden" onChange={onPickVideo} />
                    <button onClick={() => vidRef.current?.click()} disabled={vidBusy}
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 bg-white/[0.02] py-6 text-sm text-slate-300 hover:border-energy-400/40">
                      {vidBusy ? <Loader2 className="h-5 w-5 animate-spin" /> : <UploadCloud className="h-5 w-5 text-energy-400" />}
                      {c.hero_video_url ? 'Remplacer la vidéo' : 'Téléverser la vidéo'}
                    </button>
                    {c.hero_video_url && <p className="mt-1 truncate text-[11px] text-emerald-300">✓ Vidéo en place</p>}
                  </div>
                )}
                {c.hero_mode === 'neon' && <p className="self-center text-xs text-slate-500">Fond dégradé animé + particules orange flottantes — aucun média requis.</p>}
              </div>
            </div>
          </Card>

          {/* À PROPOS */}
          <Card>
            <SectionTitle icon={<Type className="h-5 w-5" />} title="À propos / Services" />
            <label className="label">Texte de présentation</label>
            <textarea className="field h-36 resize-none" value={c.about_text} onChange={(e) => set('about_text', e.target.value)} />
          </Card>

          {/* GALERIE */}
          <Card>
            <SectionTitle icon={<Images className="h-5 w-5" />} title="Galerie de photos" subtitle="3 à 4 photos de la station" />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {c.gallery.map((g) => (
                <div key={g.id} className="space-y-2">
                  <div className="relative overflow-hidden rounded-xl ring-1 ring-white/10" style={{ aspectRatio: '4/3' }}>
                    <img src={g.url} alt={g.caption || 'photo'} className="h-full w-full object-cover" />
                    <button onClick={() => removeGallery(g.id)} className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-night-950/70 text-rose-300 hover:bg-rose-500 hover:text-white" aria-label="Supprimer"><Trash2 className="h-4 w-4" /></button>
                  </div>
                  <input className="field !py-1.5 text-xs" placeholder="Légende (optionnel)" value={g.caption ?? ''} onChange={(e) => updateGallery(g.id, { caption: e.target.value })} />
                </div>
              ))}
              {c.gallery.length < 6 && (
                <div className="self-start"><ImageDropzone label="Ajouter" value="" onChange={addGallery} aspect="4/3" /></div>
              )}
            </div>
          </Card>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <SectionTitle icon={<Phone className="h-5 w-5" />} title="Infos pratiques" />
              <div className="space-y-3">
                <div><label className="label">Horaires (texte affiché)</label><input className="field" value={c.hours} onChange={(e) => set('hours', e.target.value)} placeholder="24h/24 — 7j/7" /></div>
                <div><label className="label">Téléphones</label><input className="field" value={c.phones} onChange={(e) => set('phones', e.target.value)} placeholder="+243 ..." /></div>
                <div><label className="label">Adresse physique</label><input className="field" value={c.address} onChange={(e) => set('address', e.target.value)} /></div>
              </div>
            </Card>
            <Card>
              <SectionTitle icon={<Share2 className="h-5 w-5" />} title="Réseaux sociaux" />
              <div className="grid gap-3 sm:grid-cols-2">
                <div><label className="label">Facebook</label><input className="field" value={c.social.facebook ?? ''} onChange={(e) => setSocial('facebook', e.target.value)} placeholder="https://facebook.com/…" /></div>
                <div><label className="label">Instagram</label><input className="field" value={c.social.instagram ?? ''} onChange={(e) => setSocial('instagram', e.target.value)} placeholder="https://instagram.com/…" /></div>
                <div><label className="label">WhatsApp</label><input className="field" value={c.social.whatsapp ?? ''} onChange={(e) => setSocial('whatsapp', e.target.value)} placeholder="https://wa.me/…" /></div>
                <div><label className="label">TikTok</label><input className="field" value={c.social.tiktok ?? ''} onChange={(e) => setSocial('tiktok', e.target.value)} placeholder="https://tiktok.com/@…" /></div>
              </div>
            </Card>
          </div>
        </div>

        {/* ---------------- Colonne LIVE PREVIEW ---------------- */}
        <div className="hidden xl:block">
          <div className="sticky top-36">
            <Card className="overflow-hidden p-0">
              <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2 text-xs text-slate-400">
                <Eye className="h-4 w-4 text-energy-400" /> Live Preview — rendu en temps réel
                <span className="ml-auto flex gap-1">
                  <button onClick={() => setDevice('desktop')} className={`btn !p-1.5 ${device === 'desktop' ? 'bg-energy-500 text-night-950' : 'bg-white/5 text-slate-400'}`} title="Bureau"><Monitor className="h-3.5 w-3.5" /></button>
                  <button onClick={() => setDevice('mobile')} className={`btn !p-1.5 ${device === 'mobile' ? 'bg-energy-500 text-night-950' : 'bg-white/5 text-slate-400'}`} title="Mobile"><Smartphone className="h-3.5 w-3.5" /></button>
                </span>
              </div>
              <div className="overflow-hidden bg-night-950" style={{ height: '68vh' }}>
                <div className="pointer-events-none origin-top-left overflow-y-auto"
                  style={{ width: frameW, transform: `scale(${scale})`, height: `${68 / scale}vh` }}>
                  <LandingPage contentOverride={c} preview />
                </div>
              </div>
            </Card>
            <p className="mt-2 text-center text-[11px] text-slate-500"><EyeOff className="mr-1 inline h-3 w-3" /> Aperçu non publié — cliquez « Enregistrer les modifications » pour mettre en ligne.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
