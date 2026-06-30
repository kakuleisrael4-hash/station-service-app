import { Megaphone, Paperclip } from 'lucide-react';
import { Card, SectionTitle, EmptyState } from '@/components/ui';
import { useData } from '@/context/DataContext';
import { fullDate } from '@/lib/format';
import AttachmentView from '@/components/AttachmentView';

/** Fil des communiqués de l'Admin — visible par tous les rôles. */
export default function AnnouncementsFeed() {
  const { announcements } = useData();
  return (
    <Card>
      <SectionTitle icon={<Megaphone className="h-5 w-5" />} title="Communiqués" subtitle="Notes de service de la direction" />
      {announcements.length === 0 ? (
        <EmptyState>Aucun communiqué pour le moment.</EmptyState>
      ) : (
        <div className="space-y-3">
          {announcements.map((a) => (
            <div key={a.id} className="rounded-xl bg-white/[0.03] p-4 ring-1 ring-white/10">
              <div className="mb-1 flex items-center justify-between gap-3">
                <h3 className="font-bold">{a.title}</h3>
                <div className="flex items-center gap-2">
                  {(a.attachments?.length ?? 0) > 0 && <span className="inline-flex items-center gap-1 text-xs text-slate-500"><Paperclip className="h-3 w-3" />{a.attachments.length}</span>}
                  <span className="text-xs text-slate-500">{fullDate(a.created_at)}</span>
                </div>
              </div>
              <p className="whitespace-pre-line text-sm text-slate-300">{a.body}</p>
              <AttachmentView attachments={a.attachments} />
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
