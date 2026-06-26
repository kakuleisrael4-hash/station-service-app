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
    updateSettings, updatePump, updateCisternCapacity, updatePompiste, updateSalary, updateUserRole, addExpenseCategory,
  } = useData();

  // --- Prix & taux ---
  const [prices, setPrices] = useState({ essence: String(settings.essence_price), gasoil: String(settings.gasoil_price), taux: String(settings.taux_journalier) });
  const [savingPrices, setSavingPrices] = useState(false);
  async function savePrices() {
    setSavingPrices(true);
    try {
      await updateSettings({ essence_price: parseFloat(prices.essence) || 0, gasoil_price: parseFloat(prices.gasoil) || 0, taux_journalier: parseFloat(prices.taux) || 0 });
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
        <SectionTitle icon={<Fuel className="h-5 w-5" />} title="Prix & taux du jour" subtitle="Appliqués aux nouveaux rapports et à la valeur du stock" />
        <div className="grid gap-4 sm:grid-cols-3">
          <div><label className="label">Prix Super (FC/L)</label><input type="number" className="field" value={prices.essence} onChange={(e) => setPrices({ ...prices, essence: e.target.value })} /></div>
          <div><label className="label">Prix Gasoil (FC/L)</label><input type="number" className="field" value={prices.gasoil} onChange={(e) => setPrices({ ...prices, gasoil: e.target.value })} /></div>
          <div><label className="label">Taux USD du jour</label><input type="number" className="field" value={prices.taux} onChange={(e) => setPrices({ ...prices, taux: e.target.value })} /></div>
        </div>
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
        <SectionTitle icon={<Users className="h-5 w-5" />} title="Fiches employés" subtitle="Salaires de base, coordonnées, statut" />
        <div className="space-y-2">
          {pompistes.map((p) => <EmployeeRow key={p.id} pompiste={p} onSavePatch={updatePompiste} onSaveSalary={(id, s) => user && updateSalary(id, s, user)} />)}
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

function EmployeeRow({ pompiste, onSavePatch, onSaveSalary }: { pompiste: any; onSavePatch: (id: string, patch: any) => void; onSaveSalary: (id: string, s: number) => void }) {
  const [name, setName] = useState(pompiste.display_name);
  const [phone, setPhone] = useState(pompiste.phone ?? '');
  const [salary, setSalary] = useState(String(pompiste.base_salary));
  const [active, setActive] = useState(pompiste.active);

  function save() {
    onSavePatch(pompiste.id, { display_name: name, phone, active });
    const s = parseFloat(salary);
    if (Number.isFinite(s) && s !== pompiste.base_salary) onSaveSalary(pompiste.id, s);
  }

  return (
    <div className="grid items-center gap-2 rounded-xl bg-white/[0.03] p-3 ring-1 ring-white/10 sm:grid-cols-[1.4fr_1fr_1fr_auto_auto]">
      <input className="field !py-2" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom" />
      <input className="field !py-2" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Téléphone" />
      <input type="number" className="field !py-2" value={salary} onChange={(e) => setSalary(e.target.value)} placeholder="Salaire" />
      <label className="flex items-center gap-2 text-xs text-slate-300"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-4 w-4 accent-energy-500" /> Actif</label>
      <button onClick={save} className="btn-ghost !py-1.5 !px-3"><Save className="h-4 w-4" /></button>
    </div>
  );
}
