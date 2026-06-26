import { Megaphone } from 'lucide-react';
import { Card, SectionTitle, EmptyState } from '@/components/ui';
import { useData } from '@/context/DataContext';
import { fullDate } from '@/lib/format';

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
                <span className="text-xs text-slate-500">{fullDate(a.created_at)}</span>
              </div>
              <p className="whitespace-pre-line text-sm text-slate-300">{a.body}</p>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
