// =====================================================================
//  Adaptateur Supabase (Postgres + Realtime + RLS).
//  Activé quand VITE_SUPABASE_URL/ANON_KEY sont définis. La logique métier
//  (totaux, décrément/incrément citernes, cumul RH, capital) vit dans les
//  triggers SQL ; ici on orchestre les écritures.
// =====================================================================
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AppUser, PumpReading, Report } from '@/types';
import type { NewDebtInput, NewExpenseInput, NewOrderInput, StationDB, StationData } from './db';
import { getSupabase } from './supabaseClient';
import { DEFAULT_LANDING } from '@/constants';
import { fileToBlob } from './files';

const n = (v: unknown) => (v == null ? 0 : Number(v));

function mapReport(row: any, readings: any[], expenses: any[]): Report {
  return {
    id: row.id,
    pompiste_id: row.pompiste_id,
    author_id: row.author_id,
    report_date: row.report_date,
    pump_readings: readings
      .filter((r) => r.report_id === row.id)
      .map((r): PumpReading => ({
        pump_id: r.pump_id, fuel: r.fuel, cistern_id: r.cistern_id,
        index_open: n(r.index_open), index_close: n(r.index_close),
        litrage: n(r.litrage), unit_price: n(r.unit_price), montant: n(r.montant),
      })),
    manquant: n(row.manquant),
    taux_journalier: n(row.taux_journalier),
    total_usd: n(row.total_usd),
    billetage: row.billetage ?? {},
    expenses: expenses
      .filter((e) => e.report_id === row.id)
      .map((e) => ({ id: e.id, category_id: e.category_id, description: e.description, amount: n(e.amount), currency: e.currency ?? 'FC', amount_fc: n(e.amount_fc ?? e.amount), date: e.date, report_id: e.report_id })),
    auto_score: row.auto_score,
    final_stars: row.final_stars,
    admin_comment: row.admin_comment,
    essence_litrage: n(row.essence_litrage),
    essence_montant: n(row.essence_montant),
    gasoil_litrage: n(row.gasoil_litrage),
    gasoil_montant: n(row.gasoil_montant),
    total_depenses: n(row.total_depenses),
    total_a_remettre: n(row.total_a_remettre),
    total_billetage_fc: n(row.total_billetage_fc),
    total_usd_fc: n(row.total_usd_fc),
    total_encaisse: n(row.total_encaisse),
    ecart: n(row.ecart),
    montant_ecart: n(row.montant_ecart ?? row.ecart),
    decision_imputation: row.decision_imputation ?? 'aucun',
    benefice: n(row.benefice),
    status: row.status,
    closed: !!row.closed,
    closed_at: row.closed_at,
    validated_at: row.validated_at,
    created_at: row.created_at,
  };
}

export function createSupabaseDb(url: string, key: string): StationDB {
  const sb: SupabaseClient = getSupabase(url, key);

  async function fetchProfile(id: string, email: string): Promise<AppUser> {
    const { data } = await sb.from('users').select('*').eq('id', id).single();
    const { data: pp } = await sb.from('pompiste_profiles').select('id').eq('user_id', id).maybeSingle();
    return { id, email: data?.email ?? email, full_name: data?.full_name ?? email, role: data?.role ?? 'viewer', avatar_url: data?.avatar_url, pompiste_id: pp?.id ?? null };
  }

  return {
    isMock: false,

    async getSession() {
      const { data } = await sb.auth.getUser();
      return data.user ? fetchProfile(data.user.id, data.user.email ?? '') : null;
    },
    async signIn(email, password) {
      const { data, error } = await sb.auth.signInWithPassword({ email, password });
      if (error || !data.user) throw new Error(error?.message ?? 'Connexion impossible.');
      return fetchProfile(data.user.id, data.user.email ?? email);
    },
    async signOut() { await sb.auth.signOut(); },

    async loadAll(): Promise<StationData> {
      const [users, pompistes, reports, readings, expenses, cisterns, pumps, movements, cats, debts, payments, orders, cash, closings, capital, stockLogs, announcements, settingsRow, notifs, salary, salaryPays, landingRow] =
        await Promise.all([
          sb.from('users').select('*'),
          sb.from('pompiste_profiles').select('*').order('display_name'),
          sb.from('reports').select('*').order('report_date', { ascending: false }),
          sb.from('report_pump_readings').select('*'),
          sb.from('expenses').select('*').order('date', { ascending: false }),
          sb.from('cisterns').select('*').order('name'),
          sb.from('pumps').select('*').order('label'),
          sb.from('fuel_movements').select('*').order('created_at', { ascending: false }),
          sb.from('expense_categories').select('*').order('name'),
          sb.from('debts').select('*').order('date', { ascending: false }),
          sb.from('debt_payments').select('*'),
          sb.from('supplier_orders').select('*').order('order_date', { ascending: false }),
          sb.from('cash_entries').select('*').order('date', { ascending: false }),
          sb.from('daily_closings').select('*').order('closed_at', { ascending: false }),
          sb.from('capital_history').select('*').order('date'),
          sb.from('stock_logs').select('*').order('created_at', { ascending: false }),
          sb.from('announcements').select('*').order('created_at', { ascending: false }),
          sb.from('settings').select('*').limit(1).maybeSingle(),
          sb.from('notifications').select('*').order('created_at', { ascending: false }),
          sb.from('salary_history').select('*').order('changed_at', { ascending: false }),
          sb.from('salary_payments').select('*').order('date_paiement', { ascending: false }),
          sb.from('landing_page_content').select('*').limit(1).maybeSingle(),
        ]);
      const s = settingsRow.data as any;
      const l = landingRow.data as any;
      return {
        users: (users.data ?? []) as any,
        pompistes: (pompistes.data ?? []).map((p: any) => ({ ...p, base_salary: n(p.base_salary), base_salary_usd: n(p.base_salary_usd), cumul_manquants_mois: n(p.cumul_manquants_mois) })) as any,
        reports: (reports.data ?? []).map((r: any) => mapReport(r, readings.data ?? [], expenses.data ?? [])),
        cisterns: (cisterns.data ?? []).map((c: any) => ({ ...c, capacity_l: n(c.capacity_l), current_l: n(c.current_l), sale_price_fc: n(c.sale_price_fc) })) as any,
        pumps: (pumps.data ?? []) as any,
        fuelMovements: (movements.data ?? []).map((m: any) => ({ ...m, volume_l: n(m.volume_l) })) as any,
        expenseCategories: (cats.data ?? []) as any,
        expenses: (expenses.data ?? []).map((e: any) => ({ ...e, amount: n(e.amount), amount_fc: n(e.amount_fc ?? e.amount), currency: e.currency ?? 'FC' })) as any,
        debts: (debts.data ?? []).map((d: any) => ({ ...d, liters: n(d.liters), total_amount: n(d.total_amount), currency: d.currency ?? 'FC' })) as any,
        debtPayments: (payments.data ?? []).map((p: any) => ({ ...p, amount: n(p.amount), currency: p.currency ?? 'FC' })) as any,
        supplierOrders: (orders.data ?? []).map((o: any) => ({ ...o, volume_l: n(o.volume_l), purchase_price: n(o.purchase_price), deposit: n(o.deposit) })) as any,
        cashEntries: (cash.data ?? []).map((c: any) => ({ ...c, amount: n(c.amount) })) as any,
        dailyClosings: (closings.data ?? []).map((d: any) => ({ ...d, report_ids: d.report_ids ?? [], report_count: n(d.report_count), total_super_l: n(d.total_super_l), total_gasoil_l: n(d.total_gasoil_l), total_volume_l: n(d.total_volume_l), total_encaisse: n(d.total_encaisse), total_benefice: n(d.total_benefice) })) as any,
        capitalHistory: (capital.data ?? []).map((c: any) => ({ ...c, caisse: n(c.caisse), stock_value: n(c.stock_value), debts: n(c.debts), orders_value: n(c.orders_value), capital: n(c.capital) })) as any,
        stockLogs: (stockLogs.data ?? []).map((l: any) => ({ ...l, theoretical_l: n(l.theoretical_l), physical_l: n(l.physical_l), ecart: n(l.ecart) })) as any,
        announcements: (announcements.data ?? []) as any,
        settings: {
          essence_price: n(s?.essence_price) || 2440,
          gasoil_price: n(s?.gasoil_price) || 2430,
          essence_buy_price: n(s?.essence_buy_price) || 2200,
          gasoil_buy_price: n(s?.gasoil_buy_price) || 2200,
          taux_journalier: n(s?.taux_journalier) || 2850,
          updated_at: s?.updated_at ?? new Date().toISOString(),
        },
        landing: l ? {
          hero_title: l.hero_title ?? DEFAULT_LANDING.hero_title,
          hero_slogan: l.hero_slogan ?? DEFAULT_LANDING.hero_slogan,
          hero_bg_url: l.hero_bg_url ?? '',
          logo_url: l.logo_url ?? '',
          about_text: l.about_text ?? DEFAULT_LANDING.about_text,
          gallery: l.gallery ?? [],
          hours: l.hours ?? DEFAULT_LANDING.hours,
          phones: l.phones ?? DEFAULT_LANDING.phones,
          address: l.address ?? DEFAULT_LANDING.address,
          social: l.social ?? {},
          updated_at: l.updated_at ?? new Date().toISOString(),
        } : DEFAULT_LANDING,
        notifications: (notifs.data ?? []) as any,
        salaryHistory: (salary.data ?? []) as any,
        salaryPayments: (salaryPays.data ?? []).map((p: any) => ({ ...p, temps_travail: n(p.temps_travail), montant_paye_fc: n(p.montant_paye_fc), montant_paye_usd: n(p.montant_paye_usd) })) as any,
      };
    },

    async createReport(draft, author): Promise<Report> {
      const { data: ins, error } = await sb.from('reports').insert({
        pompiste_id: draft.pompiste_id, author_id: author.id, report_date: draft.report_date,
        manquant: draft.manquant, taux_journalier: draft.taux_journalier, total_usd: draft.total_usd,
        billetage: draft.billetage, status: 'brouillon',
      }).select().single();
      if (error || !ins) throw new Error(error?.message ?? 'Création du rapport impossible.');

      await sb.from('report_pump_readings').insert(
        draft.pumps.map((p) => ({ report_id: ins.id, pump_id: p.pump_id, index_open: p.index_open, index_close: p.index_close })),
      );
      if (draft.expenses.length) {
        await sb.from('expenses').insert(draft.expenses.map((e) => ({ report_id: ins.id, category_id: e.category_id, description: e.description, amount: e.amount, currency: e.currency, date: draft.report_date })));
      }
      const { data: upd, error: upErr } = await sb.from('reports')
        .update({
          status: 'valide', final_stars: draft.final_stars, admin_comment: draft.admin_comment,
          montant_ecart: draft.montant_ecart ?? 0, decision_imputation: draft.decision_imputation ?? 'aucun',
        })
        .eq('id', ins.id).select().single();
      if (upErr || !upd) throw new Error(upErr?.message ?? 'Validation refusée (billetage ≠ total ?).');

      const { data: readings } = await sb.from('report_pump_readings').select('*').eq('report_id', ins.id);
      const { data: exps } = await sb.from('expenses').select('*').eq('report_id', ins.id);
      return mapReport(upd, readings ?? [], exps ?? []);
    },

    async closeDay(reportIds) {
      if (!reportIds.length) return;
      // Totaux des rapports sélectionnés (avant clôture)
      const { data: rows } = await sb.from('reports').select('*').in('id', reportIds).eq('closed', false);
      const sel = rows ?? [];
      if (!sel.length) return;
      const t = sel.reduce((a: any, r: any) => ({
        sup: a.sup + n(r.essence_litrage), gas: a.gas + n(r.gasoil_litrage),
        enc: a.enc + n(r.total_encaisse), ben: a.ben + n(r.benefice),
      }), { sup: 0, gas: 0, enc: 0, ben: 0 });
      // Clôture -> le trigger applique stock/RH/closed_at par rapport
      const { error } = await sb.from('reports').update({ closed: true }).in('id', sel.map((r: any) => r.id)).eq('closed', false);
      if (error) throw new Error(error.message);
      await sb.from('daily_closings').insert({
        report_ids: sel.map((r: any) => r.id), report_count: sel.length,
        total_super_l: t.sup, total_gasoil_l: t.gas, total_volume_l: t.sup + t.gas,
        total_encaisse: t.enc, total_benefice: t.ben,
      });
    },
    async deleteReport(reportId) {
      // Fonction SQL transactionnelle : rollback stock + manquant RH + clôtures + capital.
      const { error } = await sb.rpc('delete_report', { p_report_id: reportId });
      if (error) throw new Error(error.message);
    },
    async deleteClosing(closingId) {
      const { error } = await sb.rpc('delete_closing', { p_closing_id: closingId });
      if (error) throw new Error(error.message);
    },
    async updateSalary(pompisteId, salary) {
      const { error } = await sb.from('pompiste_profiles').update({ base_salary: salary.base_salary, base_salary_usd: salary.base_salary_usd }).eq('id', pompisteId);
      if (error) throw new Error(error.message);
    },
    async paySalary(input) {
      // Fonction SQL transactionnelle : insert paie + reset cumul manquants + notif + snapshot capital.
      const { error } = await sb.rpc('pay_salary', {
        p_pompiste_id: input.pompiste_id, p_mois: input.mois_concerne, p_date: input.date_paiement,
        p_temps: input.temps_travail, p_unite: input.temps_unite,
        p_fc: input.montant_paye_fc, p_usd: input.montant_paye_usd,
      });
      if (error) throw new Error(error.message);
    },
    async addExpenseCategory(name, color) {
      const { error } = await sb.from('expense_categories').insert({ name, color });
      if (error) throw new Error(error.message);
    },
    async addExpense(input: NewExpenseInput) {
      const { error } = await sb.from('expenses').insert({ category_id: input.category_id, description: input.description, amount: input.amount, currency: input.currency, date: input.date });
      if (error) throw new Error(error.message);
    },
    async addCashEntry(input) {
      const { error } = await sb.from('cash_entries').insert({ currency: input.currency, amount: input.amount, motif: input.motif, date: input.date });
      if (error) throw new Error(error.message);
    },
    async addDebt(input: NewDebtInput) {
      const { error } = await sb.from('debts').insert({ ...input, status: 'en_attente' });
      if (error) throw new Error(error.message);
    },
    async addDebtPayment(debtId, amount, date) {
      const { data: d } = await sb.from('debts').select('currency').eq('id', debtId).single();
      const { error } = await sb.from('debt_payments').insert({ debt_id: debtId, amount, currency: d?.currency ?? 'FC', date });
      if (error) throw new Error(error.message);
    },
    async createSupplierOrder(input: NewOrderInput) {
      const { error } = await sb.from('supplier_orders').insert({ ...input, status: 'en_cours' });
      if (error) throw new Error(error.message);
    },
    async setOrderStatus(orderId, status) {
      const { error } = await sb.from('supplier_orders').update({ status }).eq('id', orderId);
      if (error) throw new Error(error.message);
    },
    async addStockLog(cisternId, physicalL, note, adjust) {
      const { data: cit } = await sb.from('cisterns').select('current_l').eq('id', cisternId).single();
      const theoretical = n(cit?.current_l);
      const ecart = physicalL - theoretical;
      await sb.from('stock_logs').insert({ cistern_id: cisternId, theoretical_l: theoretical, physical_l: physicalL, ecart, note });
      if (adjust && ecart !== 0) {
        await sb.from('cisterns').update({ current_l: physicalL, updated_at: new Date().toISOString() }).eq('id', cisternId);
        await sb.from('fuel_movements').insert({ cistern_id: cisternId, kind: ecart > 0 ? 'entree' : 'sortie', volume_l: Math.abs(ecart), source: 'ajustement', label: 'Ajustement au relevé physique' });
      }
    },
    async addAnnouncement(title, body, author, attachments = []) {
      const { error } = await sb.from('announcements').insert({ title, body, author_id: author.id, attachments });
      if (error) throw new Error(error.message);
    },
    async deleteAnnouncement(id) {
      await sb.from('announcements').delete().eq('id', id);
    },
    async updateSettings(patch) {
      const { data: cur } = await sb.from('settings').select('id').limit(1).maybeSingle();
      if (cur?.id) await sb.from('settings').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', cur.id);
      else await sb.from('settings').insert({ ...patch });
      // synchronise les prix de vente des citernes
      if (patch.gasoil_price != null) await sb.from('cisterns').update({ sale_price_fc: patch.gasoil_price }).eq('fuel', 'gasoil');
      if (patch.essence_price != null) await sb.from('cisterns').update({ sale_price_fc: patch.essence_price }).eq('fuel', 'super');
    },
    async updatePump(pumpId, patch) {
      await sb.from('pumps').update(patch).eq('id', pumpId);
    },
    async updateCisternCapacity(cisternId, capacityL) {
      const { error } = await sb.from('cisterns').update({ capacity_l: capacityL, updated_at: new Date().toISOString() }).eq('id', cisternId);
      if (error) throw new Error(error.message);
    },
    async addPompiste(input) {
      // Création du compte via la fonction backend sécurisée (auth.admin.createUser
      // côté serveur, clé service_role) : l'admin garde sa session, pas de signUp client.
      const { data: { session } } = await sb.auth.getSession();
      const res = await fetch('/.netlify/functions/create-pompiste', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
        body: JSON.stringify({
          email: input.email, password: input.password, display_name: input.display_name,
          phone: input.phone, base_salary: input.base_salary, base_salary_usd: input.base_salary_usd,
        }),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok || (out as any)?.error) {
        throw new Error((out as any)?.error || `Création du compte impossible (HTTP ${res.status}). La variable SUPABASE_SERVICE_ROLE_KEY est-elle définie sur Netlify ?`);
      }
    },
    async deletePompiste(pompisteId) {
      const { data: { session } } = await sb.auth.getSession();
      const res = await fetch('/.netlify/functions/delete-pompiste', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
        body: JSON.stringify({ pompiste_id: pompisteId }),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok || (out as any)?.error) throw new Error((out as any)?.error || `Suppression impossible (HTTP ${res.status}).`);
    },
    async updatePompiste(id, patch) {
      await sb.from('pompiste_profiles').update(patch).eq('id', id);
    },
    async updateUserRole(userId, role) {
      await sb.from('users').update({ role }).eq('id', userId);
    },
    async updateLanding(content) {
      // Singleton (id=true). En prod, les images sont d'abord téléversées vers
      // Storage et `content` ne contient que des URLs publiques.
      const { data: cur } = await sb.from('landing_page_content').select('id').limit(1).maybeSingle();
      const payload = { ...content, updated_at: new Date().toISOString() };
      if (cur?.id != null) await sb.from('landing_page_content').update(payload).eq('id', cur.id);
      else await sb.from('landing_page_content').insert({ ...payload, id: true });
    },
    async uploadImage(file) {
      // Compresse puis téléverse vers le bucket Storage public « landing ».
      const blob = await fileToBlob(file);
      const ext = blob.type === 'image/png' ? 'png' : 'jpg';
      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await sb.storage.from('landing').upload(path, blob, { contentType: blob.type, upsert: false });
      if (error) throw new Error("Upload impossible. Le bucket « landing » existe-t-il ? Exécutez supabase/storage.sql. (" + error.message + ')');
      return sb.storage.from('landing').getPublicUrl(path).data.publicUrl;
    },

    async uploadAttachment(file) {
      // Téléverse le fichier BRUT (images non recompressées, vidéos/docs tels quels)
      // vers le bucket « station-media-attachments », en préservant le nom & le type.
      const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '');
      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const contentType = file.type || 'application/octet-stream';
      const { error } = await sb.storage.from('station-media-attachments').upload(path, file, { contentType, upsert: false });
      if (error) throw new Error("Téléversement impossible. Le bucket « station-media-attachments » existe-t-il ? Exécutez supabase/migration_announcements_media.sql. (" + error.message + ')');
      const file_url = sb.storage.from('station-media-attachments').getPublicUrl(path).data.publicUrl;
      return { file_url, file_name: file.name, file_type: contentType };
    },

    async markNotificationRead(id) {
      await sb.from('notifications').update({ read: true }).eq('id', id);
    },

    subscribe(cb) {
      const channel = sb.channel('station-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'reports' }, cb)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'cisterns' }, cb)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'pompiste_profiles' }, cb)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'debts' }, cb)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'supplier_orders' }, cb)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'capital_history' }, cb)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'salary_payments' }, cb)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, cb)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'landing_page_content' }, cb)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'stock_logs' }, cb)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, cb)
        .subscribe();
      return () => { sb.removeChannel(channel); };
    },
  };
}
