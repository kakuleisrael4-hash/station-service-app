import { useState } from 'react';
import { Megaphone, Send, Trash2, Loader2 } from 'lucide-react';
import { Card, SectionTitle, EmptyState } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { fullDate } from '@/lib/format';

export default function Communiques() {
  const { user } = useAuth();
  const { announcements, addAnnouncement, deleteAnnouncement } = useData();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);

  async function publish() {
    if (!title.trim() || !body.trim() || !user) return;
    setBusy(true);
    try {
      await addAnnouncement(title.trim(), body.trim(), user);
      setTitle(''); setBody('');
    } finally { setBusy(false); }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card>
        <SectionTitle icon={<Megaphone className="h-5 w-5" />} title="Rédiger un communiqué" subtitle="Note de service / message général à tout le personnel" />
        <label className="label">Titre</label>
        <input className="field" placeholder="Ex: Réunion mensuelle" value={title} onChange={(e) => setTitle(e.target.value)} />
        <label className="label mt-3">Message</label>
        <textarea className="field h-40 resize-none" placeholder="Votre message…" value={body} onChange={(e) => setBody(e.target.value)} />
        <button onClick={publish} disabled={busy} className="btn-primary mt-4">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Publier
        </button>
      </Card>

      <Card>
        <SectionTitle title="Communiqués publiés" subtitle="Visibles par tous les rôles" />
        {announcements.length === 0 ? <EmptyState>Aucun communiqué.</EmptyState> : (
          <div className="space-y-3">
            {announcements.map((a) => (
              <div key={a.id} className="rounded-xl bg-white/[0.03] p-4 ring-1 ring-white/10">
                <div className="mb-1 flex items-center justify-between gap-3">
                  <h3 className="font-bold">{a.title}</h3>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">{fullDate(a.created_at)}</span>
                    <button onClick={() => deleteAnnouncement(a.id)} className="text-rose-400 hover:text-rose-300" aria-label="Supprimer"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
                <p className="whitespace-pre-line text-sm text-slate-300">{a.body}</p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
