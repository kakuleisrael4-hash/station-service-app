import { useState } from 'react';
import { ArrowRightLeft, Repeat, Loader2, Trash2 } from 'lucide-react';
import { Card, SectionTitle, StatCard, EmptyState } from '@/components/ui';
import { useData } from '@/context/DataContext';
import { fc, usd, fullDate, todayISO } from '@/lib/format';
import type { ExchangeDirection } from '@/types';

export default function Exchange() {
  const { currencyExchanges, settings, addCurrencyExchange, deleteCurrencyExchange } = useData();
  const taux = settings.taux_journalier;

  const [direction, setDirection] = useState<ExchangeDirection>('usd_to_fc');
  const [amount, setAmount] = useState('');
  const [rate, setRate] = useState(String(taux));
  const [motif, setMotif] = useState('');
  const [date, setDate] = useState(todayISO());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const amountNum = parseFloat(amount);
  const rateNum = parseFloat(rate);
  const valid = Number.isFinite(amountNum) && amountNum > 0 && Number.isFinite(rateNum) && rateNum > 0;
  const resultAmount = valid ? (direction === 'usd_to_fc' ? amountNum * rateNum : amountNum / rateNum) : 0;

  function switchDirection(d: ExchangeDirection) {
    setDirection(d);
    setRate(String(taux)); // repart du taux du jour à chaque bascule
  }

  async function submit() {
    if (!valid) return;
    setBusy(true); setErr(null);
    try {
      await addCurrencyExchange({ direction, amount: amountNum, rate: rateNum, motif: motif.trim(), date });
      setAmount(''); setMotif(''); setRate(String(taux));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Échange impossible.');
    } finally { setBusy(false); }
  }

  async function remove(id: string) {
    if (!window.confirm("Annuler cet échange ? L'opération inverse sera appliquée à la caisse.")) return;
    await deleteCurrencyExchange(id);
  }

  const totalUsdToFc = currencyExchanges.filter((e) => e.direction === 'usd_to_fc').reduce((s, e) => s + e.amount, 0);
  const totalFcToUsd = currencyExchanges.filter((e) => e.direction === 'fc_to_usd').reduce((s, e) => s + e.amount, 0);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total échangé USD → FC" value={usd(totalUsdToFc)} icon={<ArrowRightLeft className="h-4 w-4" />} accent="text-fuel-400" />
        <StatCard label="Total échangé FC → USD" value={fc(totalFcToUsd)} icon={<ArrowRightLeft className="h-4 w-4" />} accent="text-sky-400" />
        <StatCard label="Taux du jour" value={`${taux.toLocaleString('fr-FR')} FC/$`} icon={<Repeat className="h-4 w-4" />} />
      </div>

      <Card>
        <SectionTitle icon={<Repeat className="h-5 w-5" />} title="Bureau de change" subtitle="Transfère de l'argent entre les compartiments FC et USD de la caisse — n'affecte pas le Capital total" />

        <div className="mb-4 flex gap-2">
          <button type="button" onClick={() => switchDirection('usd_to_fc')} className={`btn flex-1 ${direction === 'usd_to_fc' ? 'bg-energy-500 text-night-950 shadow-glow' : 'bg-white/5 text-slate-200 hover:bg-white/10'}`}>
            $ USD → FC
          </button>
          <button type="button" onClick={() => switchDirection('fc_to_usd')} className={`btn flex-1 ${direction === 'fc_to_usd' ? 'bg-sky-500 text-night-950 shadow-glow' : 'bg-white/5 text-slate-200 hover:bg-white/10'}`}>
            FC → $ USD
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-4">
          <div>
            <label className="label">Montant à échanger ({direction === 'usd_to_fc' ? 'USD' : 'FC'})</label>
            <input type="number" className="field" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
          </div>
          <div>
            <label className="label">Taux appliqué (FC pour 1 $)</label>
            <input type="number" className="field" value={rate} onChange={(e) => setRate(e.target.value)} />
          </div>
          <div>
            <label className="label">Motif (optionnel)</label>
            <input className="field" placeholder="Ex : besoin de petite monnaie" value={motif} onChange={(e) => setMotif(e.target.value)} />
          </div>
          <div>
            <label className="label">Date</label>
            <input type="date" className="field" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>

        {valid && (
          <p className="mt-3 rounded-lg bg-energy-500/10 px-3 py-2 text-sm text-energy-300 ring-1 ring-energy-500/20">
            {direction === 'usd_to_fc' ? usd(amountNum) : fc(amountNum)} → <span className="font-bold">{direction === 'usd_to_fc' ? fc(resultAmount) : usd(resultAmount)}</span> au taux de {rateNum.toLocaleString('fr-FR')} FC/$
          </p>
        )}
        {err && <p className="mt-2 text-sm text-rose-400">{err}</p>}

        <button onClick={submit} disabled={busy || !valid} className="btn-primary mt-4">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Repeat className="h-4 w-4" />} Effectuer l'échange
        </button>
      </Card>

      <Card>
        <SectionTitle title="Historique des échanges" subtitle="Registre du bureau de change" />
        {currencyExchanges.length === 0 ? <EmptyState>Aucun échange enregistré.</EmptyState> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="pb-2">Date</th><th className="pb-2">Sens</th><th className="pb-2 text-right">Montant source</th><th className="pb-2 text-right">Montant obtenu</th><th className="pb-2 text-right">Taux</th><th className="pb-2">Motif</th><th className="pb-2"></th>
              </tr></thead>
              <tbody className="divide-y divide-white/5">
                {currencyExchanges.map((e) => (
                  <tr key={e.id}>
                    <td className="py-2 text-slate-400">{fullDate(e.date)}</td>
                    <td className="py-2">
                      <span className={`chip ${e.direction === 'usd_to_fc' ? 'bg-energy-500/15 text-energy-300' : 'bg-sky-500/15 text-sky-300'}`}>
                        {e.direction === 'usd_to_fc' ? '$ → FC' : 'FC → $'}
                      </span>
                    </td>
                    <td className="py-2 text-right tabular-nums">{e.direction === 'usd_to_fc' ? usd(e.amount) : fc(e.amount)}</td>
                    <td className="py-2 text-right tabular-nums font-semibold text-energy-400">{e.direction === 'usd_to_fc' ? fc(e.amount_to) : usd(e.amount_to)}</td>
                    <td className="py-2 text-right tabular-nums text-slate-400">{e.rate.toLocaleString('fr-FR')}</td>
                    <td className="py-2 text-slate-300">{e.motif || '—'}</td>
                    <td className="py-2 text-right"><button onClick={() => remove(e.id)} className="text-slate-500 hover:text-rose-400" title="Annuler cet échange"><Trash2 className="h-4 w-4" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
