import { useRef, useState } from 'react';
import { Megaphone, Send, Trash2, Loader2, Paperclip, X, UploadCloud } from 'lucide-react';
import { Card, SectionTitle, EmptyState } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { fullDate } from '@/lib/format';
import AttachmentView, { AttachmentChipIcon } from '@/components/AttachmentView';
import type { Attachment } from '@/types';

const MB = 1024 * 1024;
const MAX_VIDEO = 50 * MB;   // vidéos ≤ 50 Mo
const MAX_OTHER = 10 * MB;   // images & documents ≤ 10 Mo
const ACCEPT = 'image/*,video/*,.pdf,.txt,.doc,.docx,.xls,.xlsx,.csv';

function humanSize(b: number) { return b < MB ? `${Math.round(b / 1024)} Ko` : `${(b / MB).toFixed(1)} Mo`; }

export default function Communiques() {
  const { user } = useAuth();
  const { announcements, addAnnouncement, deleteAnnouncement, uploadAttachment } = useData();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [files, setFiles] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const chosen = Array.from(e.target.files ?? []);
    e.target.value = ''; // permet de re-sélectionner le même fichier
    if (!chosen.length) return;
    setErr('');
    setUploading(true);
    try {
      for (const file of chosen) {
        const isVideo = file.type.startsWith('video/');
        const limit = isVideo ? MAX_VIDEO : MAX_OTHER;
        if (file.size > limit) {
          setErr(`« ${file.name} » (${humanSize(file.size)}) dépasse la limite de ${isVideo ? '50 Mo (vidéo)' : '10 Mo'}.`);
          continue;
        }
        const att = await uploadAttachment(file);
        setFiles((prev) => [...prev, att]);
      }
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'Téléversement impossible.');
    } finally { setUploading(false); }
  }

  const removeFile = (i: number) => setFiles((prev) => prev.filter((_, idx) => idx !== i));

  async function publish() {
    if (!title.trim() || !body.trim() || !user) return;
    setBusy(true);
    try {
      await addAnnouncement(title.trim(), body.trim(), user, files);
      setTitle(''); setBody(''); setFiles([]); setErr('');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Publication impossible.');
    } finally { setBusy(false); }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card>
        <SectionTitle icon={<Megaphone className="h-5 w-5" />} title="Rédiger un communiqué" subtitle="Note de service + pièces jointes (images, vidéos, PDF, Word, Excel…)" />
        <label className="label">Titre</label>
        <input className="field" placeholder="Ex: Réunion mensuelle" value={title} onChange={(e) => setTitle(e.target.value)} />
        <label className="label mt-3">Message</label>
        <textarea className="field h-32 resize-none" placeholder="Votre message…" value={body} onChange={(e) => setBody(e.target.value)} />

        {/* Uploader universel multi-formats */}
        <div className="mt-3">
          <label className="label">Pièces jointes</label>
          <input ref={inputRef} type="file" accept={ACCEPT} multiple className="hidden" onChange={onPick} />
          <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 bg-white/[0.02] py-4 text-sm text-slate-300 transition hover:border-energy-400/40 hover:bg-white/[0.04]">
            {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <UploadCloud className="h-5 w-5 text-energy-400" />}
            {uploading ? 'Téléversement…' : 'Ajouter des fichiers (image, vidéo, PDF, Word, Excel)'}
          </button>
          <p className="mt-1 text-[11px] text-slate-500">Vidéos ≤ 50 Mo · images & documents ≤ 10 Mo.</p>
          {err && <p className="mt-2 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{err}</p>}

          {files.length > 0 && (
            <div className="mt-3 space-y-2">
              {files.map((a, i) => (
                <div key={`${a.file_url}-${i}`} className="flex items-center gap-2 rounded-lg bg-white/[0.03] px-3 py-2 ring-1 ring-white/10">
                  <AttachmentChipIcon a={a} />
                  <span className="min-w-0 flex-1 truncate text-sm text-slate-200" title={a.file_name}>{a.file_name}</span>
                  <span className="chip bg-white/5 text-[10px] text-slate-400">{a.file_type || 'fichier'}</span>
                  <button onClick={() => removeFile(i)} className="text-slate-400 hover:text-rose-400" aria-label="Retirer"><X className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
          )}
        </div>

        <button onClick={publish} disabled={busy || uploading} className="btn-primary mt-4">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Publier{files.length ? ` (${files.length} pièce${files.length > 1 ? 's' : ''})` : ''}
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
                    {(a.attachments?.length ?? 0) > 0 && <span className="inline-flex items-center gap-1 text-xs text-slate-500"><Paperclip className="h-3 w-3" />{a.attachments.length}</span>}
                    <span className="text-xs text-slate-500">{fullDate(a.created_at)}</span>
                    <button onClick={() => deleteAnnouncement(a.id)} className="text-rose-400 hover:text-rose-300" aria-label="Supprimer"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
                <p className="whitespace-pre-line text-sm text-slate-300">{a.body}</p>
                <AttachmentView attachments={a.attachments} />
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
