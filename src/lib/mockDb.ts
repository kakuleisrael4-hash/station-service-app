// =====================================================================
//  Magasin local TEMPS RÉEL (par défaut, sans Supabase).
//  Persisté dans localStorage, re-semé si absent. Réplique des triggers SQL.
// =====================================================================
import type {
  Announcement, AppUser, CapitalPoint, Cistern, Debt, DebtPayment, Expense, FuelMovement,
  LandingContent, Notification, PompisteProfile, Report, ReportDraft, Role, Settings, StockLog,
} from '@/types';
import { computeReport, expenseFC } from './calc';
import { computeCapital, pendingOrdersValue } from './selectors';
import { currentPeriod, todayISO } from './format';
import { BILLETS_FC, CISTERNS_DEF, DEFAULT_EXPENSE_CATEGORIES, DEFAULT_LANDING, DEFAULT_SETTINGS, PUMPS } from '@/constants';
import type { NewDebtInput, NewExpenseInput, NewOrderInput, StationDB, StationData } from './db';

const STORE_KEY = 'kkcoil.store.v6';
const SESSION_KEY = 'kkcoil.session.v6';
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Math.random().toString(36).slice(2));
const DEMO_PASSWORD = '1234';

function decompose(amount: number): Record<string, number> {
  let rest = Math.round(amount);
  const b: Record<string, number> = {};
  for (const c of BILLETS_FC) {
    const q = Math.floor(rest / c);
    if (q > 0) { b[String(c)] = q; rest -= q * c; }
  }
  return b;
}

// --------------------------- GÉNÉRATION DU SEED ----------------------
function seed(): StationData {
  const adminId = 'u-admin';
  const jeanUserId = 'u-jean';
  const viewerId = 'u-viewer';
  const pJean = 'pp-jean', pEsther = 'pp-esther', pPatrick = 'pp-patrick';

  const users: AppUser[] = [
    { id: adminId, email: 'admin@kkc.cd', full_name: 'Direction KKC', role: 'admin' },
    { id: jeanUserId, email: 'jean@kkc.cd', full_name: 'Jean Mbayo', role: 'pompiste', pompiste_id: pJean },
    { id: viewerId, email: 'audit@kkc.cd', full_name: 'Auditeur Délégué', role: 'viewer' },
  ];
  const pompistes = [
    { id: pJean, user_id: jeanUserId, display_name: 'Jean Mbayo', phone: '+243 970 000 001', photo_url: null, base_salary: 450000, cumul_manquants_mois: 0, current_period: currentPeriod(), active: true },
    { id: pEsther, user_id: null, display_name: 'Esther Kalala', phone: '+243 970 000 002', photo_url: null, base_salary: 450000, cumul_manquants_mois: 0, current_period: currentPeriod(), active: true },
    { id: pPatrick, user_id: null, display_name: 'Patrick Ilunga', phone: '+243 970 000 003', photo_url: null, base_salary: 420000, cumul_manquants_mois: 0, current_period: currentPeriod(), active: true },
  ];

  const pumps = PUMPS.map((p) => ({ ...p }));
  const cisterns: Cistern[] = CISTERNS_DEF.map((c, i) => ({
    ...c, current_l: Math.round(c.capacity_l * [0.6, 0.45, 0.72][i]), updated_at: new Date().toISOString(),
  }));

  // Index cumulés par (pompiste, pompe)
  const pumpIdx: Record<string, number> = {};
  const startIdx: Record<string, number> = { p1: 84000, p2: 73000, p3: 61000, p4: 52000 };
  const next = (pompiste: string, pumpId: string, vol: number) => {
    const k = `${pompiste}:${pumpId}`;
    const open = pumpIdx[k] ?? startIdx[pumpId];
    pumpIdx[k] = open + vol;
    return { open, close: open + vol };
  };

  const reports: Report[] = [];
  const now = new Date();
  const profile = [
    { id: pJean, range: { p1: [200, 300], p2: [180, 240], p3: [150, 210], p4: [160, 230] }, manqOdds: 0.12 },
    { id: pEsther, range: { p1: [150, 240], p2: [140, 210], p3: [120, 180], p4: [130, 200] }, manqOdds: 0.22 },
    { id: pPatrick, range: { p1: [130, 220], p2: [120, 190], p3: [100, 170], p4: [110, 180] }, manqOdds: 0.18 },
  ];
  const r = (a: number, b: number) => Math.round(a + Math.random() * (b - a));

  for (let d = 21; d >= 0; d--) {
    const day = new Date(now); day.setDate(now.getDate() - d);
    const date = day.toISOString().slice(0, 10);
    for (const p of profile) {
      if (Math.random() < 0.18) continue;
      const draftPumps = pumps.map((pump) => {
        const [lo, hi] = (p.range as any)[pump.id];
        const { open, close } = next(p.id, pump.id, r(lo, hi));
        return { pump_id: pump.id, index_open: open, index_close: close };
      });
      const hasManq = Math.random() < p.manqOdds;
      const manquant = hasManq ? [2000, 4500, 6000, 12000][Math.floor(Math.random() * 4)] : 0;
      const score = manquant <= 0 ? 10 : manquant < 5000 ? 9 : manquant < 10000 ? 7 : 0;
      const stars = Math.max(1, Math.min(5, Math.round(score / 2)));
      const draft: ReportDraft = {
        pompiste_id: p.id, report_date: date, pumps: draftPumps, manquant, taux_journalier: 2850,
        total_usd: 0, billetage: {}, expenses: [], final_stars: stars,
        admin_comment: manquant > 0 ? 'Attention au comptage en fin de journée.' : 'Très bonne tenue de caisse, continuez !',
      };
      const c = computeReport(draft);
      reports.push({
        id: uid(), pompiste_id: p.id, author_id: adminId, report_date: date,
        pump_readings: c.pumps, manquant, taux_journalier: 2850, total_usd: 0,
        billetage: decompose(c.total_a_remettre), expenses: [],
        auto_score: c.auto_score, final_stars: stars, admin_comment: draft.admin_comment,
        essence_litrage: c.essence_litrage, essence_montant: c.essence_montant,
        gasoil_litrage: c.gasoil_litrage, gasoil_montant: c.gasoil_montant,
        total_depenses: 0, total_a_remettre: c.total_a_remettre,
        total_billetage_fc: c.total_a_remettre, total_usd_fc: 0,
        total_encaisse: c.total_a_remettre, ecart: 0,
        status: 'valide', validated_at: date + 'T18:30:00.000Z', created_at: date + 'T18:25:00.000Z',
      });
    }
  }

  // Cumul manquants du mois
  const period = currentPeriod();
  for (const pp of pompistes) {
    pp.cumul_manquants_mois = reports
      .filter((x) => x.pompiste_id === pp.id && x.report_date.startsWith(period))
      .reduce((s, x) => s + x.manquant, 0);
  }

  // Mouvements : sortie quotidienne agrégée par citerne (10 derniers jours) + livraisons
  const fuelMovements: FuelMovement[] = [];
  const byDayCistern = new Map<string, number>();
  reports.forEach((rep) => rep.pump_readings.forEach((pr) => {
    const k = `${rep.report_date}|${pr.cistern_id}`;
    byDayCistern.set(k, (byDayCistern.get(k) ?? 0) + pr.litrage);
  }));
  [...byDayCistern.entries()].slice(-30).forEach(([k, vol]) => {
    const [date, cistern_id] = k.split('|');
    fuelMovements.push({ id: uid(), cistern_id, kind: 'sortie', volume_l: Math.round(vol), source: 'rapport', label: 'Ventes du jour', created_at: date + 'T18:30:00.000Z' });
  });
  // 3 livraisons d'exemple
  ['cit-gasoil', 'cit-super1', 'cit-super2'].forEach((cistern_id, i) => {
    const day = new Date(now); day.setDate(now.getDate() - (12 - i * 4));
    fuelMovements.push({ id: uid(), cistern_id, kind: 'entree', volume_l: [12000, 10000, 9000][i], source: 'livraison', label: 'Livraison fournisseur', created_at: day.toISOString() });
  });
  fuelMovements.sort((a, b) => b.created_at.localeCompare(a.created_at));

  // Catégories + dépenses hors-rapport
  const expenseCategories = DEFAULT_EXPENSE_CATEGORIES.map((c) => ({ ...c }));
  const mkDate = (back: number) => { const dd = new Date(now); dd.setDate(now.getDate() - back); return dd.toISOString().slice(0, 10); };
  const fcExp = (category_id: string, description: string, amount: number, back: number): Expense =>
    ({ id: uid(), category_id, description, amount, currency: 'FC', amount_fc: amount, date: mkDate(back), report_id: null, created_at: mkDate(back) });
  const expenses: Expense[] = [
    fcExp('cat-elec', 'Facture SNEL', 380000, 3),
    fcExp('cat-maint', 'Réparation Pompe 3', 220000, 6),
    fcExp('cat-taxes', 'Taxe communale', 150000, 9),
    fcExp('cat-rh', 'Prime de rendement', 100000, 12),
    // Dépense en USD (convertie au taux du jour)
    { id: uid(), category_id: 'cat-maint', description: 'Pièce importée (USD)', amount: 120, currency: 'USD', amount_fc: 120 * 2850, date: mkDate(7), report_id: null, created_at: mkDate(7) },
  ];

  // Dettes clients (FC + une dette en USD suivie en dollars)
  const debts: Debt[] = [
    { id: 'debt-1', client_name: 'Transport Kivu SARL', phone: '+243 991 111 222', fuel: 'gasoil', liters: 800, total_amount: 1944000, currency: 'FC', date: mkDate(8), status: 'en_attente', created_at: mkDate(8) },
    { id: 'debt-2', client_name: 'M. Kabongo (taxi-bus)', phone: '+243 993 333 444', fuel: 'super', liters: 120, total_amount: 292800, currency: 'FC', date: mkDate(5), status: 'en_attente', created_at: mkDate(5) },
    { id: 'debt-3', client_name: 'Hôtel Lubum', phone: '+243 995 555 666', fuel: 'gasoil', liters: 300, total_amount: 729000, currency: 'FC', date: mkDate(14), status: 'soldee', created_at: mkDate(14) },
    { id: 'debt-4', client_name: 'Mining Corp (USD)', phone: '+243 998 777 666', fuel: 'gasoil', liters: 500, total_amount: 420, currency: 'USD', date: mkDate(6), status: 'en_attente', created_at: mkDate(6) },
  ];
  const debtPayments: DebtPayment[] = [
    { id: uid(), debt_id: 'debt-1', amount: 944000, currency: 'FC', date: mkDate(3) },
    { id: uid(), debt_id: 'debt-3', amount: 729000, currency: 'FC', date: mkDate(10) },
    { id: uid(), debt_id: 'debt-4', amount: 120, currency: 'USD', date: mkDate(2) },
  ];

  // Commandes fournisseurs
  const supplierOrders = [
    { id: uid(), supplier_name: 'SEP Congo', cistern_id: 'cit-gasoil', volume_l: 15000, purchase_price: 33000000, deposit: 15000000, status: 'livre' as const, order_date: mkDate(13), delivered_at: mkDate(12) },
    { id: uid(), supplier_name: 'Cobil', cistern_id: 'cit-super2', volume_l: 12000, purchase_price: 27600000, deposit: 10000000, status: 'en_cours' as const, order_date: mkDate(2), delivered_at: null },
  ];

  // Historique du capital : un point par jour (caisse + stock + dettes + commandes en cours)
  const capitalHistory: CapitalPoint[] = [];
  const dates = [...new Set(reports.map((x) => x.report_date))].sort();
  const stockVal0 = cisterns.reduce((s, c) => s + c.current_l * c.sale_price_fc, 0);
  const ordersVal = pendingOrdersValue(supplierOrders);
  let cumul = 0;
  dates.forEach((date, i) => {
    cumul += reports.filter((x) => x.report_date === date).reduce((s, x) => s + x.total_a_remettre, 0);
    const stock_value = Math.round(stockVal0 * (0.92 + 0.08 * (i / Math.max(dates.length - 1, 1))));
    const debtsV = Math.max(2236800 - i * 30000, 0);
    const caisse = Math.round(cumul * 0.6);
    const ov = i > dates.length - 4 ? ordersVal : 0; // commande passée récemment
    capitalHistory.push({ date, caisse, stock_value, debts: debtsV, orders_value: ov, capital: caisse + stock_value + debtsV + ov });
  });

  // Relevés de jauge physique (audit) + écarts
  const stockLogs: StockLog[] = [
    { id: uid(), cistern_id: 'cit-gasoil', theoretical_l: cisterns[0].current_l + 150, physical_l: cisterns[0].current_l, ecart: -150, note: 'Relevé hebdomadaire', created_by: adminId, created_at: mkDate(2) },
    { id: uid(), cistern_id: 'cit-super1', theoretical_l: cisterns[1].current_l - 80, physical_l: cisterns[1].current_l, ecart: 80, note: 'Relevé hebdomadaire', created_by: adminId, created_at: mkDate(2) },
  ];

  const announcements: Announcement[] = [
    { id: uid(), title: 'Réunion mensuelle', body: 'Réunion de tout le personnel ce vendredi à 17h au bureau. Présence obligatoire.', author_id: adminId, created_at: mkDate(1) },
    { id: uid(), title: 'Nouvelle procédure caisse', body: 'Merci de compter la caisse à deux avant la remise. Tolérance zéro sur les manquants.', author_id: adminId, created_at: mkDate(4) },
  ];

  const settings: Settings = { ...DEFAULT_SETTINGS, updated_at: new Date().toISOString() };
  const landing: LandingContent = { ...DEFAULT_LANDING, gallery: [], updated_at: new Date().toISOString() };

  const notifications: Notification[] = [
    { id: uid(), user_id: jeanUserId, type: 'info', title: 'Bienvenue sur votre espace', body: 'Consultez vos performances et votre fiche de paie à tout moment.', read: false, created_at: new Date().toISOString() },
  ];

  return { users, pompistes, reports, cisterns, pumps, fuelMovements, expenseCategories, expenses, debts, debtPayments, supplierOrders, capitalHistory, stockLogs, announcements, settings, landing, notifications, salaryHistory: [] };
}

// ----------------------------- ÉTAT ---------------------------------
// Champs requis : si un store persisté (ex: HMR partiel) en manque, on re-sème.
const REQUIRED_KEYS: (keyof StationData)[] = [
  'users', 'pompistes', 'reports', 'cisterns', 'pumps', 'fuelMovements',
  'expenseCategories', 'expenses', 'debts', 'debtPayments', 'supplierOrders',
  'capitalHistory', 'stockLogs', 'announcements', 'settings', 'landing', 'notifications', 'salaryHistory',
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

/** Recalcule et upsert le point de capital du jour. */
function snapshotCapital() {
  const b = computeCapital(store.reports, store.cisterns, store.expenses, store.debts, store.debtPayments, store.supplierOrders, store.settings.taux_journalier);
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
    if (!acc || password !== DEMO_PASSWORD) throw new Error('Identifiants incorrects. (Démo : mot de passe « 1234 »)');
    localStorage.setItem(SESSION_KEY, acc.id);
    return acc;
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
    const c = computeReport(draft, { pumps: store.pumps, prices: { super: store.settings.essence_price, gasoil: store.settings.gasoil_price } });
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
      status: 'valide', validated_at: new Date().toISOString(), created_at: new Date().toISOString(),
    };
    store.reports = [report, ...store.reports];

    // Dépenses du rapport -> journal central (avec report_id)
    if (draft.expenses.length) {
      store.expenses = [
        ...draft.expenses.map((e) => ({ ...e, amount_fc: expenseFC(e, draft.taux_journalier), report_id: report.id, created_at: new Date().toISOString() })),
        ...store.expenses,
      ];
    }

    // Décrément des citernes par pompe + mouvements de sortie
    const sortieByCistern = new Map<string, number>();
    c.pumps.forEach((pr) => sortieByCistern.set(pr.cistern_id, (sortieByCistern.get(pr.cistern_id) ?? 0) + pr.litrage));
    sortieByCistern.forEach((vol, cistern_id) => {
      const cit = store.cisterns.find((x) => x.id === cistern_id);
      if (cit && vol > 0) {
        cit.current_l = Math.max(cit.current_l - vol, 0);
        cit.updated_at = new Date().toISOString();
        store.fuelMovements = [
          { id: uid(), cistern_id, kind: 'sortie', volume_l: Math.round(vol), source: 'rapport', ref_id: report.id, label: `Ventes — rapport ${draft.report_date}`, created_at: new Date().toISOString() },
          ...store.fuelMovements,
        ];
      }
    });

    // Impact RH
    if (draft.manquant > 0) {
      const pp = store.pompistes.find((p) => p.id === draft.pompiste_id);
      if (pp) {
        pp.cumul_manquants_mois += draft.manquant;
        if (pp.user_id) store.notifications = [{ id: uid(), user_id: pp.user_id, type: 'manquant', title: 'Manquant imputé', body: `Un manquant de ${draft.manquant.toLocaleString('fr-FR')} FC a été enregistré sur votre rapport du ${draft.report_date}.`, meta: { amount: draft.manquant }, read: false, created_at: new Date().toISOString() }, ...store.notifications];
      }
    }
    snapshotCapital();
    emit();
    return clone(report);
  },

  async updateSalary(pompisteId, newSalary, changedBy) {
    const pp = store.pompistes.find((p) => p.id === pompisteId);
    if (!pp || pp.base_salary === newSalary) return;
    const old = pp.base_salary;
    store.salaryHistory = [{ id: uid(), pompiste_id: pompisteId, old_salary: old, new_salary: newSalary, changed_by: changedBy.id, changed_at: new Date().toISOString() }, ...store.salaryHistory];
    pp.base_salary = newSalary;
    if (newSalary > old && pp.user_id) store.notifications = [{ id: uid(), user_id: pp.user_id, type: 'augmentation_salaire', title: '🎉 Salaire augmenté !', body: `Votre salaire de base passe de ${old.toLocaleString('fr-FR')} à ${newSalary.toLocaleString('fr-FR')} FC. Félicitations !`, meta: { old, new: newSalary }, read: false, created_at: new Date().toISOString() }, ...store.notifications];
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
    store.supplierOrders = [{ id: uid(), supplier_name: input.supplier_name, cistern_id: input.cistern_id, volume_l: input.volume_l, purchase_price: input.purchase_price, deposit: input.deposit, status: 'en_cours', order_date: input.order_date, delivered_at: null }, ...store.supplierOrders];
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
    } catch (e) {
      // Quota localStorage dépassé (images trop lourdes) : on retire la dernière image ajoutée.
      throw new Error("Stockage local saturé : réduisez le nombre/poids des images de la galerie.");
    }
  },

  async markNotificationRead(id) {
    const n = store.notifications.find((x) => x.id === id);
    if (n && !n.read) { n.read = true; emit(); }
  },

  subscribe(cb) { listeners.add(cb); return () => listeners.delete(cb); },
};
