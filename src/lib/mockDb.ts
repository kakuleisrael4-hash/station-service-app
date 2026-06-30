// =====================================================================
//  Magasin local TEMPS RÉEL (par défaut, sans Supabase).
//  Persisté dans localStorage, re-semé si absent. Réplique des triggers SQL.
//  SEED DE PRODUCTION : départ PROPRE (aucune donnée de démo). Seules
//  l'infrastructure (3 citernes / 4 pompes), les catégories de dépenses et
//  les comptes de connexion sont créés. L'admin saisit le reste.
// =====================================================================
import type {
  AppUser, CapitalPoint, Cistern, LandingContent, Notification, PompisteProfile,
  Report, Role, Settings,
} from '@/types';
import { computeReport, expenseFC } from './calc';
import { computeCapital } from './selectors';
import { fileToDataUrl } from './files';
import { currentPeriod, todayISO } from './format';
import { CISTERNS_DEF, DEFAULT_EXPENSE_CATEGORIES, DEFAULT_LANDING, DEFAULT_SETTINGS, PUMPS } from '@/constants';
import type { NewCashInput, NewDebtInput, NewExpenseInput, NewOrderInput, NewPompisteInput, StationDB, StationData } from './db';

const STORE_KEY = 'kkcoil.store.v11';
const SESSION_KEY = 'kkcoil.session.v11';
const PW_KEY = 'kkcoil.pw.v11';
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Math.random().toString(36).slice(2));
const DEMO_PASSWORD = '1234';

// Mots de passe des comptes créés par l'admin (mode démo local uniquement).
const loadPw = (): Record<string, string> => { try { return JSON.parse(localStorage.getItem(PW_KEY) || '{}'); } catch { return {}; } };
const savePw = (m: Record<string, string>) => localStorage.setItem(PW_KEY, JSON.stringify(m));

// --------------------------- SEED DE PRODUCTION ----------------------
function seed(): StationData {
  const now = new Date().toISOString();
  const adminId = 'u-admin', jeanUserId = 'u-jean', viewerId = 'u-viewer';
  const pJean = 'pp-jean';

  // Comptes de connexion (en mode local ; en prod Supabase = vrais comptes Auth).
  const users: AppUser[] = [
    { id: adminId, email: 'admin@kkc.cd', full_name: 'Administrateur', role: 'admin' },
    { id: jeanUserId, email: 'jean@kkc.cd', full_name: 'Pompiste', role: 'pompiste', pompiste_id: pJean },
    { id: viewerId, email: 'audit@kkc.cd', full_name: 'Gérant / Auditeur', role: 'viewer' },
  ];

  // Roster minimal : un pompiste relié au compte de connexion. L'admin ajoute
  // les autres dans Paramètres → Fiches employés (bouton « Ajouter un pompiste »).
  const pompistes: PompisteProfile[] = [
    { id: pJean, user_id: jeanUserId, display_name: 'Pompiste 1', phone: '', photo_url: null, base_salary: 0, base_salary_usd: 0, cumul_manquants_mois: 0, current_period: currentPeriod(), active: true },
  ];

  const pumps = PUMPS.map((p) => ({ ...p }));
  // Citernes VIDES au départ : l'admin enregistre le niveau réel (relevé physique
  // avec « ajuster », ou première livraison fournisseur). Capacités dans Paramètres.
  const cisterns: Cistern[] = CISTERNS_DEF.map((c) => ({ ...c, current_l: 0, updated_at: now }));

  const expenseCategories = DEFAULT_EXPENSE_CATEGORIES.map((c) => ({ ...c }));
  const settings: Settings = { ...DEFAULT_SETTINGS, updated_at: now };
  const landing: LandingContent = { ...DEFAULT_LANDING, gallery: [], updated_at: now };
  const notifications: Notification[] = [];

  return {
    users, pompistes, reports: [], cisterns, pumps, fuelMovements: [],
    expenseCategories, expenses: [], debts: [], debtPayments: [], supplierOrders: [],
    cashEntries: [], dailyClosings: [], capitalHistory: [], stockLogs: [], announcements: [], settings, landing,
    notifications, salaryHistory: [],
  };
}

// ----------------------------- ÉTAT ---------------------------------
// Champs requis : si un store persisté (ex: HMR partiel) en manque, on re-sème.
const REQUIRED_KEYS: (keyof StationData)[] = [
  'users', 'pompistes', 'reports', 'cisterns', 'pumps', 'fuelMovements',
  'expenseCategories', 'expenses', 'debts', 'debtPayments', 'supplierOrders',
  'cashEntries', 'dailyClosings', 'capitalHistory', 'stockLogs', 'announcements', 'settings', 'landing', 'notifications', 'salaryHistory',
];

function load(): StationData {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as StationData;
      const complete = REQUIRED_KEYS.every((k) => parsed[k] != null);
      if (complete) return parsed;
    }
  } catch { /* ignore */ }
  const fresh = seed();
  localStorage.setItem(STORE_KEY, JSON.stringify(fresh));
  return fresh;
}

let store: StationData = load();
const listeners = new Set<() => void>();
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
function emit() { localStorage.setItem(STORE_KEY, JSON.stringify(store)); listeners.forEach((l) => l()); }

/**
 * Annule les impacts d'un rapport CLÔTURÉ (rollback) :
 *   1. ré-injecte le carburant faussement sorti dans les citernes,
 *   2. supprime les mouvements de sortie liés au rapport,
 *   3. décrémente le cumul des manquants du pompiste (si imputé).
 * (La caisse/capital se recalculent ensuite via snapshotCapital, car le rapport
 *  supprimé/ré-ouvert ne compte plus dans computeCaisse.)
 */
function rollbackReportImpacts(r: Report) {
  const now = new Date().toISOString();
  const byCistern = new Map<string, number>();
  r.pump_readings.forEach((pr) => byCistern.set(pr.cistern_id, (byCistern.get(pr.cistern_id) ?? 0) + pr.litrage));
  byCistern.forEach((vol, cid) => {
    const cit = store.cisterns.find((c) => c.id === cid);
    if (cit && vol > 0) { cit.current_l = Math.min(cit.capacity_l, cit.current_l + vol); cit.updated_at = now; }
  });
  store.fuelMovements = store.fuelMovements.filter((m) => !(m.ref_id === r.id && m.source === 'rapport'));
  if (r.manquant > 0) {
    const pp = store.pompistes.find((p) => p.id === r.pompiste_id);
    if (pp) pp.cumul_manquants_mois = Math.max(0, pp.cumul_manquants_mois - r.manquant);
  }
}

/** Recalcule et upsert le point de capital du jour. */
function snapshotCapital() {
  const b = computeCapital(store.reports, store.cisterns, store.expenses, store.debts, store.debtPayments, store.supplierOrders, store.settings.taux_journalier, store.cashEntries);
  const date = todayISO();
  const point: CapitalPoint = { date, ...b };
  const idx = store.capitalHistory.findIndex((p) => p.date === date);
  if (idx >= 0) store.capitalHistory[idx] = point;
  else store.capitalHistory = [...store.capitalHistory, point];
}

// --------------------------- IMPLÉMENTATION --------------------------
export const mockDb: StationDB = {
  isMock: true,

  async getSession() {
    const id = localStorage.getItem(SESSION_KEY);
    return id ? store.users.find((u) => u.id === id) ?? null : null;
  },
  async signIn(email, password) {
    const acc = store.users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
    const custom = acc ? loadPw()[acc.id] : undefined;
    const ok = acc && (password === DEMO_PASSWORD || password === custom);
    if (!ok) throw new Error('Identifiants incorrects. (Comptes de démo : mot de passe « 1234 »)');
    localStorage.setItem(SESSION_KEY, acc!.id);
    return acc!;
  },
  async signInDemo(role: Role) {
    const u = store.users.find((x) => x.role === role);
    if (!u) throw new Error('Compte de démo introuvable.');
    localStorage.setItem(SESSION_KEY, u.id);
    return u;
  },
  async signOut() { localStorage.removeItem(SESSION_KEY); },

  async loadAll() { return clone(store); },

  async createReport(draft, author) {
    const c = computeReport(draft, {
      pumps: store.pumps,
      prices: { super: store.settings.essence_price, gasoil: store.settings.gasoil_price },
      buyPrices: { super: store.settings.essence_buy_price, gasoil: store.settings.gasoil_buy_price },
    });
    const report: Report = {
      id: uid(), pompiste_id: draft.pompiste_id, author_id: author.id, report_date: draft.report_date,
      pump_readings: c.pumps, manquant: draft.manquant, taux_journalier: draft.taux_journalier,
      total_usd: draft.total_usd, billetage: draft.billetage,
      expenses: draft.expenses.map((e) => ({ ...e, amount_fc: expenseFC(e, draft.taux_journalier) })),
      auto_score: c.auto_score, final_stars: draft.final_stars, admin_comment: draft.admin_comment,
      essence_litrage: c.essence_litrage, essence_montant: c.essence_montant,
      gasoil_litrage: c.gasoil_litrage, gasoil_montant: c.gasoil_montant,
      total_depenses: c.total_depenses, total_a_remettre: c.total_a_remettre,
      total_billetage_fc: c.total_billetage_fc, total_usd_fc: c.total_usd_fc,
      total_encaisse: c.total_encaisse, ecart: c.ecart,
      montant_ecart: draft.montant_ecart ?? c.ecart, decision_imputation: draft.decision_imputation ?? 'aucun',
      benefice: c.benefice,
      status: 'valide', closed: false, closed_at: null, validated_at: new Date().toISOString(), created_at: new Date().toISOString(),
    };
    store.reports = [report, ...store.reports];

    // Dépenses du rapport -> journal central (avec report_id)
    if (draft.expenses.length) {
      store.expenses = [
        ...draft.expenses.map((e) => ({ ...e, amount_fc: expenseFC(e, draft.taux_journalier), report_id: report.id, created_at: new Date().toISOString() })),
        ...store.expenses,
      ];
    }
    // ENREGISTREMENT SEUL : aucun impact stock/RH/caisse/capital ici.
    // Tout est consolidé à la CLÔTURE journalière (closeDay).
    emit();
    return clone(report);
  },

  async closeDay(reportIds) {
    const ids = new Set(reportIds);
    const targets = store.reports.filter((r) => ids.has(r.id) && r.status === 'valide' && !r.closed);
    if (targets.length === 0) return;
    const now = new Date().toISOString();
    let superL = 0, gasL = 0, encaisse = 0, benef = 0;
    for (const report of targets) {
      // Décrément des citernes par pompe + mouvements de sortie
      const sortieByCistern = new Map<string, number>();
      report.pump_readings.forEach((pr) => sortieByCistern.set(pr.cistern_id, (sortieByCistern.get(pr.cistern_id) ?? 0) + pr.litrage));
      sortieByCistern.forEach((vol, cistern_id) => {
        const cit = store.cisterns.find((x) => x.id === cistern_id);
        if (cit && vol > 0) {
          cit.current_l = Math.max(cit.current_l - vol, 0);
          cit.updated_at = now;
          store.fuelMovements = [{ id: uid(), cistern_id, kind: 'sortie', volume_l: Math.round(vol), source: 'rapport', ref_id: report.id, label: `Clôture — rapport ${report.report_date}`, created_at: now }, ...store.fuelMovements];
        }
      });
      // Impact RH (manquant)
      if (report.manquant > 0) {
        const pp = store.pompistes.find((p) => p.id === report.pompiste_id);
        if (pp) {
          pp.cumul_manquants_mois += report.manquant;
          if (pp.user_id) store.notifications = [{ id: uid(), user_id: pp.user_id, type: 'manquant', title: 'Manquant imputé', body: `Un manquant de ${report.manquant.toLocaleString('fr-FR')} FC a été enregistré sur votre rapport du ${report.report_date}.`, meta: { amount: report.manquant }, read: false, created_at: now }, ...store.notifications];
        }
      }
      report.closed = true;
      report.closed_at = now;
      superL += report.essence_litrage; gasL += report.gasoil_litrage;
      encaisse += report.total_encaisse; benef += report.benefice;
    }
    store.dailyClosings = [{
      id: uid(), date: todayISO(), report_ids: targets.map((r) => r.id), report_count: targets.length,
      total_super_l: superL, total_gasoil_l: gasL, total_volume_l: superL + gasL,
      total_encaisse: encaisse, total_benefice: benef, closed_by: 'u-admin', closed_at: now,
    }, ...store.dailyClosings];
    snapshotCapital();
    emit();
  },

  async deleteReport(reportId) {
    const r = store.reports.find((x) => x.id === reportId);
    if (!r) return;
    if (r.closed) rollbackReportImpacts(r); // ré-injecte stock + annule manquant RH
    // Détache le rapport des clôtures qui le contenaient (recalcule leurs totaux).
    store.dailyClosings = store.dailyClosings
      .map((d) => {
        if (!d.report_ids.includes(reportId)) return d;
        const ids = d.report_ids.filter((x) => x !== reportId);
        if (ids.length === 0) return null; // clôture vide -> supprimée
        const reps = store.reports.filter((x) => ids.includes(x.id));
        const superL = reps.reduce((s, x) => s + x.essence_litrage, 0);
        const gasL = reps.reduce((s, x) => s + x.gasoil_litrage, 0);
        return {
          ...d, report_ids: ids, report_count: ids.length,
          total_super_l: superL, total_gasoil_l: gasL, total_volume_l: superL + gasL,
          total_encaisse: reps.reduce((s, x) => s + x.total_encaisse, 0),
          total_benefice: reps.reduce((s, x) => s + x.benefice, 0),
        };
      })
      .filter(Boolean) as typeof store.dailyClosings;
    store.expenses = store.expenses.filter((e) => e.report_id !== reportId); // dépenses du rapport
    store.reports = store.reports.filter((x) => x.id !== reportId);
    snapshotCapital();
    emit();
  },

  async deleteClosing(closingId) {
    const d = store.dailyClosings.find((x) => x.id === closingId);
    if (!d) return;
    // Ré-ouvre chaque rapport de la clôture et annule ses impacts (stock + manquant RH).
    d.report_ids.forEach((rid) => {
      const r = store.reports.find((x) => x.id === rid);
      if (r && r.closed) { rollbackReportImpacts(r); r.closed = false; r.closed_at = null; }
    });
    store.dailyClosings = store.dailyClosings.filter((x) => x.id !== closingId);
    snapshotCapital();
    emit();
  },

  async updateSalary(pompisteId, salary, changedBy) {
    const pp = store.pompistes.find((p) => p.id === pompisteId);
    if (!pp) return;
    const oldFc = pp.base_salary, oldUsd = pp.base_salary_usd;
    if (oldFc === salary.base_salary && oldUsd === salary.base_salary_usd) return;
    store.salaryHistory = [{ id: uid(), pompiste_id: pompisteId, old_salary: oldFc, new_salary: salary.base_salary, old_salary_usd: oldUsd, new_salary_usd: salary.base_salary_usd, changed_by: changedBy.id, changed_at: new Date().toISOString() }, ...store.salaryHistory];
    pp.base_salary = salary.base_salary;
    pp.base_salary_usd = salary.base_salary_usd;
    const increased = salary.base_salary > oldFc || salary.base_salary_usd > oldUsd;
    if (increased && pp.user_id) store.notifications = [{ id: uid(), user_id: pp.user_id, type: 'augmentation_salaire', title: '🎉 Salaire augmenté !', body: `Votre salaire de base est mis à jour : ${salary.base_salary.toLocaleString('fr-FR')} FC + ${salary.base_salary_usd.toLocaleString('fr-FR')} USD. Félicitations !`, meta: { oldFc, oldUsd, newFc: salary.base_salary, newUsd: salary.base_salary_usd }, read: false, created_at: new Date().toISOString() }, ...store.notifications];
    emit();
  },

  async addExpenseCategory(name, color) {
    store.expenseCategories = [...store.expenseCategories, { id: uid(), name, color }];
    emit();
  },
  async addExpense(input: NewExpenseInput) {
    const amount_fc = input.currency === 'USD' ? input.amount * store.settings.taux_journalier : input.amount;
    store.expenses = [{ id: uid(), category_id: input.category_id, description: input.description, amount: input.amount, currency: input.currency, amount_fc, date: input.date, report_id: null, created_at: new Date().toISOString() }, ...store.expenses];
    snapshotCapital();
    emit();
  },
  async addCashEntry(input: NewCashInput) {
    store.cashEntries = [{ id: uid(), currency: input.currency, amount: input.amount, motif: input.motif, date: input.date, created_by: 'u-admin', created_at: new Date().toISOString() }, ...store.cashEntries];
    snapshotCapital();
    emit();
  },
  async addDebt(input: NewDebtInput) {
    store.debts = [{ id: uid(), client_name: input.client_name, phone: input.phone, fuel: input.fuel, liters: input.liters, total_amount: input.total_amount, currency: input.currency, date: input.date, status: 'en_attente', created_at: new Date().toISOString() }, ...store.debts];
    snapshotCapital();
    emit();
  },
  async addDebtPayment(debtId, amount, date) {
    const debt = store.debts.find((d) => d.id === debtId);
    const currency = debt?.currency ?? 'FC';
    store.debtPayments = [{ id: uid(), debt_id: debtId, amount, currency, date }, ...store.debtPayments];
    if (debt) {
      const paid = store.debtPayments.filter((p) => p.debt_id === debtId).reduce((s, p) => s + p.amount, 0);
      if (paid >= debt.total_amount) debt.status = 'soldee';
    }
    snapshotCapital();
    emit();
  },
  async createSupplierOrder(input: NewOrderInput) {
    store.supplierOrders = [{ id: uid(), supplier_name: input.supplier_name, fuel: input.fuel, cistern_id: input.cistern_id, volume_l: input.volume_l, purchase_price: input.purchase_price, deposit: input.deposit, status: 'en_cours', order_date: input.order_date, delivered_at: null }, ...store.supplierOrders];
    snapshotCapital();
    emit();
  },
  async setOrderStatus(orderId, status) {
    const o = store.supplierOrders.find((x) => x.id === orderId);
    if (!o || o.status === status) return;
    if (status === 'livre') {
      const cit = store.cisterns.find((x) => x.id === o.cistern_id);
      // Empêche une livraison qui dépasserait la capacité physique de la citerne.
      if (cit && cit.current_l + o.volume_l > cit.capacity_l) {
        const dispo = Math.max(cit.capacity_l - cit.current_l, 0);
        throw new Error(`Livraison impossible : dépasse la capacité de ${cit.name}. Espace disponible : ${Math.round(dispo).toLocaleString('fr-FR')} L (commande : ${o.volume_l.toLocaleString('fr-FR')} L).`);
      }
      o.status = status;
      o.delivered_at = new Date().toISOString();
      if (cit) {
        cit.current_l = cit.current_l + o.volume_l;
        cit.updated_at = new Date().toISOString();
        store.fuelMovements = [{ id: uid(), cistern_id: o.cistern_id, kind: 'entree', volume_l: o.volume_l, source: 'livraison', ref_id: o.id, label: `Livraison ${o.supplier_name}`, created_at: new Date().toISOString() }, ...store.fuelMovements];
      }
    } else {
      o.status = status;
    }
    snapshotCapital();
    emit();
  },

  async addStockLog(cisternId, physicalL, note, adjust) {
    const cit = store.cisterns.find((c) => c.id === cisternId);
    if (!cit) return;
    const theoretical = cit.current_l;
    const ecart = physicalL - theoretical;
    store.stockLogs = [
      { id: uid(), cistern_id: cisternId, theoretical_l: theoretical, physical_l: physicalL, ecart, note: note || null, created_by: 'u-admin', created_at: new Date().toISOString() },
      ...store.stockLogs,
    ];
    if (adjust && ecart !== 0) {
      cit.current_l = physicalL;
      cit.updated_at = new Date().toISOString();
      store.fuelMovements = [
        { id: uid(), cistern_id: cisternId, kind: ecart > 0 ? 'entree' : 'sortie', volume_l: Math.abs(ecart), source: 'ajustement', label: `Ajustement au relevé physique (${ecart > 0 ? '+' : ''}${ecart} L)`, created_at: new Date().toISOString() },
        ...store.fuelMovements,
      ];
      snapshotCapital();
    }
    emit();
  },

  async addAnnouncement(title, body, author) {
    store.announcements = [{ id: uid(), title, body, author_id: author.id, created_at: new Date().toISOString() }, ...store.announcements];
    emit();
  },
  async deleteAnnouncement(id) {
    store.announcements = store.announcements.filter((a) => a.id !== id);
    emit();
  },
  async updateSettings(patch) {
    store.settings = { ...store.settings, ...patch, updated_at: new Date().toISOString() };
    // Synchronise les prix de vente des citernes (utilisés pour la valeur du stock)
    store.cisterns.forEach((c) => {
      c.sale_price_fc = c.fuel === 'gasoil' ? store.settings.gasoil_price : store.settings.essence_price;
    });
    snapshotCapital();
    emit();
  },
  async updatePump(pumpId, patch) {
    const p = store.pumps.find((x) => x.id === pumpId);
    if (p) { Object.assign(p, patch); emit(); }
  },
  async updateCisternCapacity(cisternId, capacityL) {
    const cit = store.cisterns.find((c) => c.id === cisternId);
    if (cit && capacityL > 0) {
      cit.capacity_l = capacityL;
      if (cit.current_l > capacityL) cit.current_l = capacityL; // borne le niveau
      cit.updated_at = new Date().toISOString();
      snapshotCapital();
      emit();
    }
  },
  async addPompiste(input: NewPompisteInput) {
    const email = (input.email || '').trim().toLowerCase();
    // Crée un vrai compte de connexion + sa fiche RH liée (équiv. de l'Edge Function en prod).
    if (email) {
      if (store.users.some((u) => u.email.toLowerCase() === email)) throw new Error('Cet e-mail est déjà utilisé.');
      const userId = uid(), profileId = uid();
      store.users = [...store.users, { id: userId, email, full_name: input.display_name, role: 'pompiste', pompiste_id: profileId }];
      store.pompistes = [...store.pompistes, {
        id: profileId, user_id: userId, display_name: input.display_name, phone: input.phone || null,
        photo_url: null, base_salary: input.base_salary || 0, base_salary_usd: input.base_salary_usd || 0,
        cumul_manquants_mois: 0, current_period: currentPeriod(), active: true,
      }];
      const pw = loadPw(); pw[userId] = input.password || DEMO_PASSWORD; savePw(pw);
    } else {
      // Pas d'e-mail : simple fiche RH sans compte de connexion.
      store.pompistes = [...store.pompistes, {
        id: uid(), user_id: null, display_name: input.display_name, phone: input.phone || null,
        photo_url: null, base_salary: input.base_salary || 0, base_salary_usd: input.base_salary_usd || 0,
        cumul_manquants_mois: 0, current_period: currentPeriod(), active: true,
      }];
    }
    emit();
  },
  async deletePompiste(pompisteId) {
    const p = store.pompistes.find((x) => x.id === pompisteId);
    if (!p) return;
    // Conserve l'historique des ventes/capital : on délie les rapports (pompiste_id null).
    store.reports = store.reports.map((r) => (r.pompiste_id === pompisteId ? { ...r, pompiste_id: null as any } : r));
    store.salaryHistory = store.salaryHistory.filter((h) => h.pompiste_id !== pompisteId);
    store.pompistes = store.pompistes.filter((x) => x.id !== pompisteId);
    // Supprime le compte de connexion lié + son mot de passe.
    if (p.user_id) {
      store.users = store.users.filter((u) => u.id !== p.user_id);
      const pw = loadPw(); delete pw[p.user_id]; savePw(pw);
    }
    emit();
  },
  async updatePompiste(id, patch: Partial<PompisteProfile>) {
    const p = store.pompistes.find((x) => x.id === id);
    if (p) { Object.assign(p, patch); emit(); }
  },
  async updateUserRole(userId, role) {
    const u = store.users.find((x) => x.id === userId);
    if (u) { u.role = role; emit(); }
  },

  async updateLanding(content) {
    store.landing = { ...content, updated_at: new Date().toISOString() };
    try {
      emit();
    } catch {
      throw new Error("Stockage local saturé : réduisez le nombre/poids des images de la galerie.");
    }
  },

  async uploadImage(file) {
    // Mode démo : image compressée stockée en data-URL dans le contenu.
    return fileToDataUrl(file);
  },

  async markNotificationRead(id) {
    const n = store.notifications.find((x) => x.id === id);
    if (n && !n.read) { n.read = true; emit(); }
  },

  subscribe(cb) { listeners.add(cb); return () => listeners.delete(cb); },
};
