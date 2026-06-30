import { FileText, FileSpreadsheet, FileImage, FileVideo, File as FileIcon, Download, ExternalLink } from 'lucide-react';
import type { Attachment } from '@/types';

type Kind = 'image' | 'video' | 'pdf' | 'word' | 'excel' | 'text' | 'other';

/** Déduit la catégorie d'affichage depuis le type MIME (puis l'extension en repli). */
export function categorize(a: Attachment): Kind {
  const t = (a.file_type || '').toLowerCase();
  const n = (a.file_name || '').toLowerCase();
  if (t.startsWith('image/')) return 'image';
  if (t.startsWith('video/')) return 'video';
  if (t.includes('pdf') || n.endsWith('.pdf')) return 'pdf';
  if (t.includes('word') || t.includes('document') || /\.(docx?|odt|rtf)$/.test(n)) return 'word';
  if (t.includes('sheet') || t.includes('excel') || t.includes('csv') || /\.(xlsx?|csv|ods)$/.test(n)) return 'excel';
  if (t.startsWith('text/') || /\.txt$/.test(n)) return 'text';
  return 'other';
}

const DOC_META: Record<Exclude<Kind, 'image' | 'video'>, { icon: typeof FileIcon; color: string; label: string }> = {
  pdf: { icon: FileText, color: '#fb7185', label: 'Document PDF' },
  word: { icon: FileText, color: '#38bdf8', label: 'Document Word' },
  excel: { icon: FileSpreadsheet, color: '#34d399', label: 'Tableur Excel' },
  text: { icon: FileText, color: '#a78bfa', label: 'Fichier texte' },
  other: { icon: FileIcon, color: '#94a3b8', label: 'Fichier' },
};

/** Affichage adaptatif d'UNE pièce jointe selon son type. */
export function AttachmentItem({ a }: { a: Attachment }) {
  const kind = categorize(a);

  if (kind === 'image') {
    return (
      <a href={a.file_url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl ring-1 ring-white/10">
        <img src={a.file_url} alt={a.file_name} className="max-h-80 w-full object-contain bg-black/30" loading="lazy" />
      </a>
    );
  }

  if (kind === 'video') {
    return (
      <video controls preload="metadata" className="max-h-96 w-full rounded-xl bg-black ring-1 ring-white/10">
        <source src={a.file_url} type={a.file_type || undefined} />
        Votre navigateur ne peut pas lire cette vidéo. <a href={a.file_url} className="underline">Télécharger</a>
      </video>
    );
  }

  const meta = DOC_META[kind];
  const Icon = meta.icon;
  return (
    <div className="flex items-center gap-3 rounded-xl bg-white/[0.03] p-3 ring-1 ring-white/10">
      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg" style={{ background: `${meta.color}1f`, color: meta.color }}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-200" title={a.file_name}>{a.file_name}</p>
        <p className="text-xs text-slate-500">{meta.label}</p>
      </div>
      <a href={a.file_url} download={a.file_name} target="_blank" rel="noreferrer"
        className="btn-ghost !px-3 !py-2 shrink-0" title="Télécharger / Ouvrir">
        <Download className="h-4 w-4" /> <span className="hidden sm:inline">Ouvrir</span>
      </a>
    </div>
  );
}

/** Liste des pièces jointes d'un communiqué (vide -> ne rend rien). */
export default function AttachmentView({ attachments }: { attachments?: Attachment[] }) {
  const list = attachments ?? [];
  if (list.length === 0) return null;
  return (
    <div className="mt-3 space-y-2">
      {list.map((a, i) => <AttachmentItem key={`${a.file_url}-${i}`} a={a} />)}
    </div>
  );
}

/** Petit badge "type de fichier" (icône) pour les miniatures de pré-publication. */
export function AttachmentChipIcon({ a }: { a: Attachment }) {
  const kind = categorize(a);
  if (kind === 'image') return <FileImage className="h-4 w-4 text-energy-400" />;
  if (kind === 'video') return <FileVideo className="h-4 w-4 text-fuel-400" />;
  const Icon = DOC_META[kind].icon;
  return <Icon className="h-4 w-4" style={{ color: DOC_META[kind].color }} />;
}

export const ExternalLinkIcon = ExternalLink;
