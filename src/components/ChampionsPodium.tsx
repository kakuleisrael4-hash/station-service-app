import { motion } from 'framer-motion';
import { Trophy } from 'lucide-react';
import { useData } from '@/context/DataContext';
import { leaderboard } from '@/lib/selectors';
import { liters } from '@/lib/format';

const MEDALS = ['🥇', '🥈', '🥉'];
const ORDER = [1, 0, 2]; // colonne gauche=2e, centre=1er, droite=3e
const HEIGHTS = ['h-24', 'h-32', 'h-20'];

export default function ChampionsPodium() {
  const { reports, pompistes } = useData();
  const board = leaderboard(reports, pompistes).slice(0, 3);

  if (board.length === 0) {
    return null;
  }

  return (
    <div className="card overflow-hidden p-6">
      <div className="mb-5 flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-fuel-500/15 text-fuel-400">
          <Trophy className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-bold">Classement des Champions</h2>
          <p className="text-sm text-slate-400">Meilleurs pompistes du mois — volume vendu &amp; notation</p>
        </div>
        <span className="chip ml-auto bg-energy-500/15 text-energy-300">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-energy-400" /> Temps réel
        </span>
      </div>

      <div className="flex items-end justify-center gap-3 sm:gap-6">
        {ORDER.map((rank, col) => {
          const row = board[rank];
          if (!row) return <div key={col} className="w-24" />;
          return (
            <motion.div
              key={row.pompiste.id}
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: col * 0.08 }}
              className="flex w-24 flex-col items-center sm:w-32"
            >
              <div className="text-3xl">{MEDALS[rank]}</div>
              <p className="mt-1 line-clamp-1 text-center text-sm font-semibold">{row.pompiste.display_name}</p>
              <p className="text-xs text-slate-400">{liters(row.volume)}</p>
              <motion.div
                layout
                initial={{ height: 0 }}
                animate={{ height: 'auto' }}
                className={`mt-2 ${HEIGHTS[rank]} w-full rounded-t-xl bg-gradient-to-t ${
                  rank === 0
                    ? 'from-fuel-600/30 to-fuel-400/70 ring-1 ring-fuel-400/50'
                    : rank === 1
                      ? 'from-slate-600/30 to-slate-300/60 ring-1 ring-white/20'
                      : 'from-amber-900/30 to-amber-600/60 ring-1 ring-amber-500/40'
                } grid place-items-end justify-center pb-2`}
              >
                <span className="text-lg font-black tabular-nums text-night-950/90">{row.points}</span>
              </motion.div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
