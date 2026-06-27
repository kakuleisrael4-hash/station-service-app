import { useState } from 'react';
import { Settings as SettingsIcon, Fuel, GitBranch, Users, Tag, Save, Plus, Loader2, Shield, Database } from 'lucide-react';
import { Card, SectionTitle } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { liters } from '@/lib/format';
import type { Cistern, Role } from '@/types';

const ROLES: Role[] = ['admin', 'pompiste', 'viewer'];

export default function SettingsPanel() {
  const { user } = useAuth();
  const {
    settings, pumps, cisterns, pompistes, users, expenseCategories,
    updateSettings, updatePump, updateCisternCapacity, addPompiste, updatePompiste, updateSalary, updateUserRole, addExpenseCategory,
  } = useData();

  // --- Ajout d'un pompiste (avec création du compte de connexion) ---
  const blankP = { display_name: '', phone: '', base_salary: '', base_salary_usd: '', email: '', password: '' };
  const [newP, setNewP] = useState(blankP);
  const [addingP, setAddingP] = useState(false);
  const [addErr, setAddErr] = useState<string | null>(null);
  const canAddP = newP.display_name.trim() && newP.email.trim() && newP.password.length >= 6;
  async function addNewPompiste() {
    if (!canAddP) return;
    setAddingP(true); setAddErr(null);
    try {
      await addPompiste({
        display_name: newP.display_name.trim(), phone: newP.phone.trim(),
        base_salary: parseFloat(newP.base_salary) || 0, base_salary_usd: parseFloat(newP.base_salary_usd) || 0,
        email: newP.email.trim(), password: newP.password,
      });
      setNewP(blankP);
    } catch (e) {
      setAddErr(e instanceof Error ? e.message : "Échec de la création.");
    } finally { setAddingP(false); }
  }

  // --- Prix (achat/vente) & taux ---
  const [prices, setPrices] = useState({
    essence: String(settings.essence_price), gasoil: String(settings.gasoil_price),
    essenceBuy: String(settings.essence_buy_price), gasoilBuy: String(settings.gasoil_buy_price),
    taux: String(settings.taux_journalier),
  });
  const [savingPrices, setSavingPrices] = useState(false);
  const num = (v: string) => parseFloat(v) || 0;
  const margeSuper = num(prices.essence) - num(prices.essenceBuy);
  const margeGasoil = num(prices.gasoil) - num(prices.gasoilBuy);
  async function savePrices() {
    setSavingPrices(true);
    try {
      await updateSettings({
        essence_price: num(prices.essence), gasoil_price: num(prices.gasoil),
        essence_buy_price: num(prices.essenceBuy), gasoil_buy_price: num(prices.gasoilBuy),
        taux_journalier: num(prices.taux),
      });
    } finally { setSavingPrices(false); }
  }

  // --- Catégories ---
  const [cat, setCat] = useState({ name: '', color: '#10b981' });

  return (
    <div className="space-y-5">
      <Card>
        <SectionTitle icon={<SettingsIcon className="h-5 w-5" />} title="Paramètres global" subtitle="Panneau de configuration maître — modifiez toutes les informations de l'application" />
      </Card>

      {/* PRIX & TAUX */}
      <Card>
        <SectionTitle icon={<Fuel className="h-5 w-5" />} title="Prix d'achat / vente & marges" subtitle="La marge (Vente − Achat) alimente le calcul des bénéfices à chaque rapport" />
        <div className="grid gap-4 sm:grid-cols-2">
          {/* SUPER */}
          <div className="rounded-xl bg-energy-500/[0.06] p-3 ring-1 ring-energy-400/20">
            <p className="mb-2 text-sm font-semibold text-energy-300">SUPER</p>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="label">Achat (FC/L)</label><input type="number" className="field !py-2" value={prices.essenceBuy} onChange={(e) => setPrices({ ...prices, essenceBuy: e.target.value })} /></div>
              <div><label className="label">Vente (FC/L)</label><input type="number" className="field !py-2" value={prices.essence} onChange={(e) => setPrices({ ...prices, essence: e.target.value })} /></div>
            </div>
            <p className="mt-2 text-xs text-slate-400">Marge unitaire : <span className={`font-bold tabular-nums ${margeSuper < 0 ? 'text-rose-400' : 'text-energy-400'}`}>{margeSuper.toLocaleString('fr-FR')} FC/L</span></p>
          </div>
          {/* GASOIL */}
          <div className="rounded-xl bg-fuel-500/[0.06] p-3 ring-1 ring-fuel-400/20">
            <p className="mb-2 text-sm font-semibold text-fuel-300">GASOIL</p>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="label">Achat (FC/L)</label><input type="number" className="field !py-2" value={prices.gasoilBuy} onChange={(e) => setPrices({ ...prices, gasoilBuy: e.target.value })} /></div>
              <div><label className="label">Vente (FC/L)</label><input type="number" className="field !py-2" value={prices.gasoil} onChange={(e) => setPrices({ ...prices, gasoil: e.target.value })} /></div>
            </div>
            <p className="mt-2 text-xs text-slate-400">Marge unitaire : <span className={`font-bold tabular-nums ${margeGasoil < 0 ? 'text-rose-400' : 'text-fuel-400'}`}>{margeGasoil.toLocaleString('fr-FR')} FC/L</span></p>
          </div>
        </div>
        <div className="mt-3 max-w-xs"><label className="label">Taux USD du jour</label><input type="number" className="field" value={prices.taux} onChange={(e) => setPrices({ ...prices, taux: e.target.value })} /></div>
        <button onClick={savePrices} disabled={savingPrices} className="btn-primary mt-4">{savingPrices ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Enregistrer les prix</button>
      </Card>

      {/* LIAISONS POMPES / CITERNES */}
      <Card>
        <SectionTitle icon={<GitBranch className="h-5 w-5" />} title="Configuration pompes ↔ citernes" subtitle="Reliez chaque pompe à sa citerne d'alimentation" />
        <div className="grid gap-3 sm:grid-cols-2">
          {pumps.map((p) => (
            <div key={p.id} className="flex items-center gap-3 rounded-xl bg-white/[0.03] p-3 ring-1 ring-white/10">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{p.label}</p>
                <p className="text-xs text-slate-500">Carburant : {p.fuel === 'gasoil' ? 'Gasoil' : 'Super'}</p>
              </div>
              <select className="field !py-2 w-44" value={p.cistern_id} onChange={(e) => updatePump(p.id, { cistern_id: e.target.value })}>
                {cisterns.filter((c) => c.fuel === p.fuel).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          ))}
        </div>
      </Card>

      {/* CAPACITÉS DES CITERNES */}
      <Card>
        <SectionTitle icon={<Database className="h-5 w-5" />} title="Capacités maximales des citernes" subtitle="Borne les jauges et bloque toute livraison qui dépasserait la citerne" />
        <div className="space-y-2">
          {cisterns.map((c) => <CisternRow key={c.id} cistern={c} onSave={updateCisternCapacity} />)}
        </div>
      </Card>

      {/* FICHES EMPLOYÉS */}
      <Card>
        <SectionTitle icon={<Users className="h-5 w-5" />} title="Fiches employés" subtitle="Ajouter, renommer, salaires de base, statut" />
        {/* Ajout d'un pompiste */}
        <div className="mb-4 rounded-xl bg-energy-500/[0.06] p-3 ring-1 ring-energy-400/20">
          <p className="mb-2 text-sm font-semibold text-energy-300">Ajouter un pompiste (crée son compte de connexion)</p>
          <div className="grid gap-2 sm:grid-cols-3">
            <input className="field !py-2" placeholder="Nom complet *" value={newP.display_name} onChange={(e) => setNewP({ ...newP, display_name: e.target.value })} />
            <input className="field !py-2" type="email" placeholder="E-mail de connexion *" value={newP.email} onChange={(e) => setNewP({ ...newP, email: e.target.value })} />
            <input className="field !py-2" type="text" placeholder="Mot de passe initial * (6+ car.)" value={newP.password} onChange={(e) => setNewP({ ...newP, password: e.target.value })} />
            <input className="field !py-2" placeholder="Téléphone" value={newP.phone} onChange={(e) => setNewP({ ...newP, phone: e.target.value })} />
            <input type="number" className="field !py-2" placeholder="Salaire FC" value={newP.base_salary} onChange={(e) => setNewP({ ...newP, base_salary: e.target.value })} />
            <input type="number" className="field !py-2" placeholder="Salaire USD" value={newP.base_salary_usd} onChange={(e) => setNewP({ ...newP, base_salary_usd: e.target.value })} />
          </div>
          {addErr && <p className="mt-2 text-xs text-rose-400">{addErr}</p>}
          <button onClick={addNewPompiste} disabled={!canAddP || addingP} className="btn-primary mt-3 !py-2">
            {addingP ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Créer le pompiste + son compte
          </button>
        </div>
        <div className="space-y-2">
          {pompistes.map((p) => <EmployeeRow key={p.id} pompiste={p} onSavePatch={updatePompiste} onSaveSalary={(id, salary) => user && updateSalary(id, salary, user)} />)}
        </div>
      </Card>

      {/* RÔLES UTILISATEURS */}
      <Card>
        <SectionTitle icon={<Shield className="h-5 w-5" />} title="Rôles & accès" subtitle="Attribuez les rôles des comptes" />
        <div className="space-y-2">
          {users.map((u) => (
            <div key={u.id} className="flex items-center gap-3 rounded-xl bg-white/[0.03] p-3 ring-1 ring-white/10">
              <div className="min-w-0 flex-1"><p className="truncate font-semibold">{u.full_name}</p><p className="text-xs text-slate-500">{u.email}</p></div>
              <select className="field !py-2 w-40" value={u.role} onChange={(e) => updateUserRole(u.id, e.target.value as Role)}>
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          ))}
        </div>
      </Card>

      {/* CATÉGORIES DE DÉPENSES */}
      <Card>
        <SectionTitle icon={<Tag className="h-5 w-5" />} title="Catégories de dépenses" />
        <div className="mb-3 flex flex-wrap gap-2">
          {expenseCategories.map((c) => <span key={c.id} className="chip" style={{ background: `${c.color}22`, color: c.color }}><span className="h-2 w-2 rounded-full" style={{ background: c.color }} />{c.name}</span>)}
        </div>
        <div className="flex gap-2">
          <input className="field flex-1" placeholder="Nouvelle catégorie" value={cat.name} onChange={(e) => setCat({ ...cat, name: e.target.value })} />
          <input type="color" className="h-10 w-12 rounded-lg bg-night-900 ring-1 ring-white/10" value={cat.color} onChange={(e) => setCat({ ...cat, color: e.target.value })} />
          <button onClick={() => { if (cat.name.trim()) { addExpenseCategory(cat.name.trim(), cat.color); setCat({ name: '', color: '#10b981' }); } }} className="btn-ghost !px-3"><Plus className="h-4 w-4" /></button>
        </div>
      </Card>
    </div>
  );
}

function CisternRow({ cistern, onSave }: { cistern: Cistern; onSave: (id: string, cap: number) => void }) {
  const [cap, setCap] = useState(String(cistern.capacity_l));
  const pct = cistern.capacity_l > 0 ? Math.round((cistern.current_l / cistern.capacity_l) * 100) : 0;
  const changed = parseFloat(cap) !== cistern.capacity_l;
  return (
    <div className="grid items-center gap-3 rounded-xl bg-white/[0.03] p-3 ring-1 ring-white/10 sm:grid-cols-[1.2fr_1fr_auto_auto]">
      <div>
        <p className="font-semibold">{cistern.name}</p>
        <p className="text-xs text-slate-500">Niveau actuel : {liters(cistern.current_l)} ({pct}%)</p>
      </div>
      <div className="flex items-center gap-2">
        <input type="number" className="field !py-2" value={cap} onChange={(e) => setCap(e.target.value)} />
        <span className="text-xs text-slate-500">L</span>
      </div>
      <span className="text-xs text-slate-500">{changed ? 'modifié' : ''}</span>
      <button onClick={() => { const v = parseFloat(cap); if (Number.isFinite(v) && v >= cistern.current_l) onSave(cistern.id, v); }} disabled={!changed} className="btn-ghost !py-1.5 !px-3"><Save className="h-4 w-4" /></button>
    </div>
  );
}

function EmployeeRow({ pompiste, onSavePatch, onSaveSalary }: { pompiste: any; onSavePatch: (id: string, patch: any) => void; onSaveSalary: (id: string, salary: { base_salary: number; base_salary_usd: number }) => void }) {
  const [name, setName] = useState(pompiste.display_name);
  const [phone, setPhone] = useState(pompiste.phone ?? '');
  const [salFc, setSalFc] = useState(String(pompiste.base_salary));
  const [salUsd, setSalUsd] = useState(String(pompiste.base_salary_usd));
  const [active, setActive] = useState(pompiste.active);

  function save() {
    onSavePatch(pompiste.id, { display_name: name, phone, active });
    const fcv = parseFloat(salFc) || 0, usdv = parseFloat(salUsd) || 0;
    if (fcv !== pompiste.base_salary || usdv !== pompiste.base_salary_usd) onSaveSalary(pompiste.id, { base_salary: fcv, base_salary_usd: usdv });
  }

  return (
    <div className="grid items-center gap-2 rounded-xl bg-white/[0.03] p-3 ring-1 ring-white/10 sm:grid-cols-[1.3fr_1fr_0.9fr_0.9fr_auto_auto]">
      <input className="field !py-2" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom" />
      <input className="field !py-2" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Téléphone" />
      <input type="number" className="field !py-2" value={salFc} onChange={(e) => setSalFc(e.target.value)} placeholder="Salaire FC" title="Part FC" />
      <input type="number" className="field !py-2" value={salUsd} onChange={(e) => setSalUsd(e.target.value)} placeholder="Salaire USD" title="Part USD" />
      <label className="flex items-center gap-2 text-xs text-slate-300"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-4 w-4 accent-energy-500" /> Actif</label>
      <button onClick={save} className="btn-ghost !py-1.5 !px-3"><Save className="h-4 w-4" /></button>
    </div>
  );
}
