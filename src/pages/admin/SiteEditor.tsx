import { useMemo, useState } from 'react';
import {
  LayoutTemplate, Type, ImagePlus, Phone, Eye, EyeOff, Save, Loader2, Trash2, Images, Share2, RotateCcw,
} from 'lucide-react';
import { Card, SectionTitle } from '@/components/ui';
import ImageDropzone from '@/components/ImageDropzone';
import LandingPage from '../LandingPage';
import { useData } from '@/context/DataContext';
import type { GalleryImage, LandingContent } from '@/types';

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'g-' + Math.random().toString(36).slice(2));

export default function SiteEditor() {
  const { landing, updateLanding } = useData();
  const [c, setC] = useState<LandingContent>(() => structuredClone(landing));
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const dirty = useMemo(() => JSON.stringify(c) !== JSON.stringify(landing), [c, landing]);
  const set = <K extends keyof LandingContent>(k: K, v: LandingContent[K]) => setC((p) => ({ ...p, [k]: v }));
  const setSocial = (k: keyof LandingContent['social'], v: string) => setC((p) => ({ ...p, social: { ...p.social, [k]: v } }));

  const addGallery = (url: string) => { if (url) set('gallery', [...c.gallery, { id: uid(), url, caption: '' }]); };
  const updateGallery = (id: string, patch: Partial<GalleryImage>) => set('gallery', c.gallery.map((g) => (g.id === id ? { ...g, ...patch } : g)));
  const removeGallery = (id: string) => set('gallery', c.gallery.filter((g) => g.id !== id));

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

  return (
    <div className="space-y-5">
      {/* Barre d'actions */}
      <Card className="sticky top-20 z-10 flex flex-wrap items-center gap-3">
        <SectionTitle icon={<LayoutTemplate className="h-5 w-5" />} title="Gestion du site vitrine" subtitle="Modifiez la page d'accueil publique sans toucher au code" />
        <div className="ml-auto flex items-center gap-2">
          {dirty && <span className="chip bg-fuel-500/15 text-fuel-300">Modifications non publiées</span>}
          <button onClick={() => setC(structuredClone(landing))} disabled={!dirty} className="btn-ghost !py-2"><RotateCcw className="h-4 w-4" /> Réinitialiser</button>
          <button onClick={() => setPreview((p) => !p)} className="btn-ghost !py-2">{preview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />} {preview ? 'Masquer' : 'Aperçu'}</button>
          <button onClick={publish} disabled={busy || !dirty} className={`btn !py-2 font-bold ${dirty ? 'bg-energy-500 text-night-950 hover:bg-energy-400 shadow-glow' : 'bg-white/5 text-slate-500'}`}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {saved ? 'Publié !' : 'Enregistrer et Publier'}
          </button>
        </div>
      </Card>
      {err && <div className="rounded-xl bg-rose-500/10 px-4 py-2 text-sm text-rose-300">{err}</div>}

      {/* APERÇU */}
      {preview && (
        <Card className="overflow-hidden p-0">
          <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2 text-xs text-slate-400"><Eye className="h-4 w-4" /> Aperçu en direct — non publié</div>
          <div className="max-h-[70vh] overflow-y-auto">
            <LandingPage contentOverride={c} preview />
          </div>
        </Card>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        {/* HERO */}
        <Card>
          <SectionTitle icon={<Type className="h-5 w-5" />} title="Section Hero" />
          <div className="space-y-3">
            <div><label className="label">Titre principal (H1)</label><input className="field" value={c.hero_title} onChange={(e) => set('hero_title', e.target.value)} /></div>
            <div><label className="label">Slogan</label><input className="field" value={c.hero_slogan} onChange={(e) => set('hero_slogan', e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-3">
              <ImageDropzone label="Logo" value={c.logo_url} onChange={(u) => set('logo_url', u)} aspect="1/1" rounded="full" />
              <ImageDropzone label="Image de fond (Hero)" value={c.hero_bg_url} onChange={(u) => set('hero_bg_url', u)} aspect="1/1" />
            </div>
          </div>
        </Card>

        {/* À PROPOS */}
        <Card>
          <SectionTitle icon={<Type className="h-5 w-5" />} title="À propos / Services" />
          <label className="label">Texte de présentation</label>
          <textarea className="field h-44 resize-none" value={c.about_text} onChange={(e) => set('about_text', e.target.value)} />
        </Card>
      </div>

      {/* GALERIE */}
      <Card>
        <SectionTitle icon={<Images className="h-5 w-5" />} title="Galerie de photos" subtitle="3 à 4 photos de la station — glisser-déposer pour ajouter" />
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
        {/* INFOS PRATIQUES */}
        <Card>
          <SectionTitle icon={<Phone className="h-5 w-5" />} title="Infos pratiques" />
          <div className="space-y-3">
            <div><label className="label">Horaires d'ouverture</label><input className="field" value={c.hours} onChange={(e) => set('hours', e.target.value)} placeholder="24h/24 — 7j/7" /></div>
            <div><label className="label">Téléphones</label><input className="field" value={c.phones} onChange={(e) => set('phones', e.target.value)} placeholder="+243 ..." /></div>
            <div><label className="label">Adresse physique</label><input className="field" value={c.address} onChange={(e) => set('address', e.target.value)} /></div>
          </div>
        </Card>

        {/* RÉSEAUX SOCIAUX */}
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
  );
}
