// =====================================================================
//  Sélecteurs / agrégations dérivées (purs, testables).
// =====================================================================
import type {
  Cistern, Debt, DebtPayment, Expense, ExpenseCategory, PompisteProfile, Report, SupplierOrder,
} from '@/types';
import { currentPeriod } from './format';

const inPeriod = (r: Report, period: string) => r.report_date.startsWith(period) && r.status === 'valide';

export interface ChampionRow {
  pompiste: PompisteProfile;
  volume: number; // litres essence + gasoil
  avgStars: number;
  reports: number;
  points: number; // score composite volume + notation
}

/** Classement des champions du mois : 60% volume vendu, 40% notation. */
export function leaderboard(
  reports: Report[],
  pompistes: PompisteProfile[],
  period = currentPeriod(),
): ChampionRow[] {
  const rows: ChampionRow[] = pompistes
    .filter((p) => p.active)
    .map((pompiste) => {
      const rs = reports.filter((r) => r.pompiste_id === pompiste.id && inPeriod(r, period));
      const volume = rs.reduce((s, r) => s + r.essence_litrage + r.gasoil_litrage, 0);
      const stars = rs.map((r) => r.final_stars ?? Math.round((r.auto_score ?? 0) / 2)).filter((x) => x > 0);
      const avgStars = stars.length ? stars.reduce((a, b) => a + b, 0) / stars.length : 0;
      return { pompiste, volume, avgStars, reports: rs.length, points: 0 };
    });

  const maxVol = Math.max(1, ...rows.map((r) => r.volume));
  for (const r of rows) {
    r.points = Math.round((r.volume / maxVol) * 60 + (r.avgStars / 5) * 40);
  }
  return rows.sort((a, b) => b.points - a.points || b.volume - a.volume);
}

export interface DailyVolume {
  date: string;
  essence: number;
  gasoil: number;
  total: number;
}

/** Série quotidienne de QUANTITÉS (litres) pour un pompiste — jamais de montants. */
export function pompisteDaily(reports: Report[], pompisteId: string, period = currentPeriod()): DailyVolume[] {
  const map = new Map<string, DailyVolume>();
  reports
    .filter((r) => r.pompiste_id === pompisteId && inPeriod(r, period))
    .forEach((r) => {
      const e = map.get(r.report_date) ?? { date: r.report_date, essence: 0, gasoil: 0, total: 0 };
      e.essence += r.essence_litrage;
      e.gasoil += r.gasoil_litrage;
      e.total = e.essence + e.gasoil;
      map.set(r.report_date, e);
    });
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/** Série quotidienne globale de la station (tous pompistes). */
export function globalDaily(reports: Report[], period = currentPeriod()): DailyVolume[] {
  const map = new Map<string, DailyVolume>();
  reports
    .filter((r) => inPeriod(r, period))
    .forEach((r) => {
      const e = map.get(r.report_date) ?? { date: r.report_date, essence: 0, gasoil: 0, total: 0 };
      e.essence += r.essence_litrage;
      e.gasoil += r.gasoil_litrage;
      e.total = e.essence + e.gasoil;
      map.set(r.report_date, e);
    });
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export interface ShareRow {
  name: string;
  value: number;
}

/** Parts de volume vendu par pompiste (pour le camembert viewer). */
export function volumeShare(reports: Report[], pompistes: PompisteProfile[], period = currentPeriod()): ShareRow[] {
  return pompistes
    .filter((p) => p.active)
    .map((p) => ({
      name: p.display_name,
      value: reports
        .filter((r) => r.pompiste_id === p.id && inPeriod(r, period))
        .reduce((s, r) => s + r.essence_litrage + r.gasoil_litrage, 0),
    }))
    .filter((row) => row.value > 0);
}

export interface PayrollRow {
  pompiste: PompisteProfile;
  net: number;
}

export function payroll(pompistes: PompisteProfile[]): PayrollRow[] {
  return pompistes
    .filter((p) => p.active)
    .map((p) => ({ pompiste: p, net: p.base_salary - p.cumul_manquants_mois }));
}

/**
 * Règle d'or de continuité : pour chaque pompe, l'index de fermeture du tout
 * dernier rapport VALIDÉ (le plus récent par date puis création). Sert d'index
 * d'ouverture automatique au prochain rapport.
 */
export function lastClosingIndexByPump(reports: Report[]): Record<string, number> {
  const out: Record<string, number> = {};
  const sorted = [...reports]
    .filter((r) => r.status === 'valide')
    .sort((a, b) => b.report_date.localeCompare(a.report_date) || b.created_at.localeCompare(a.created_at));
  for (const r of sorted) {
    for (const pr of r.pump_readings) {
      if (out[pr.pump_id] == null) out[pr.pump_id] = pr.index_close;
    }
  }
  return out;
}

export function stationRH(pompistes: PompisteProfile[]) {
  const active = pompistes.filter((p) => p.active);
  const masseSalariale = active.reduce((s, p) => s + p.base_salary, 0);
  const totalManquants = active.reduce((s, p) => s + p.cumul_manquants_mois, 0);
  return { masseSalariale, totalManquants, netGlobal: masseSalariale - totalManquants, headcount: active.length };
}

// ===================== FINANCE : CAISSE / CAPITAL ====================

/** Montant déjà remboursé sur une dette. */
export function debtPaid(debt: Debt, payments: DebtPayment[]): number {
  return payments.filter((p) => p.debt_id === debt.id).reduce((s, p) => s + p.amount, 0);
}

/** Reste dû sur une dette. */
export function debtRemaining(debt: Debt, payments: DebtPayment[]): number {
  return Math.max(debt.total_amount - debtPaid(debt, payments), 0);
}

/** Décaissement réel d'une commande fournisseur : acompte, ou prix total si livré. */
export function orderCashOut(o: SupplierOrder): number {
  return o.status === 'livre' ? o.purchase_price : o.deposit;
}

export interface CaisseBalance {
  fc: number; // solde en Francs
  usd: number; // solde en Dollars (physiques)
  total_fc: number; // FC + USD * taux
}

/**
 * Caisse à DOUBLE COMPARTIMENT (FC + USD).
 *   - FC : billets FC des ventes + remboursements FC − dépenses FC hors-rapport − fournisseurs
 *   - USD : dollars encaissés au billetage + remboursements USD − dépenses USD hors-rapport
 *   Total_Caisse_FC = Solde_FC + Solde_USD × Taux_du_jour.
 * (Les dépenses d'un rapport sont déjà déduites dans son billetage / total_a_remettre.)
 */
export function computeCaisse(
  reports: Report[],
  expenses: Expense[],
  debtPayments: DebtPayment[],
  orders: SupplierOrder[],
  taux: number,
): CaisseBalance {
  const valides = reports.filter((r) => r.status === 'valide');
  const salesFC = valides.reduce((s, r) => s + r.total_billetage_fc, 0);
  const salesUSD = valides.reduce((s, r) => s + r.total_usd, 0);
  const payFC = debtPayments.filter((p) => p.currency === 'FC').reduce((s, p) => s + p.amount, 0);
  const payUSD = debtPayments.filter((p) => p.currency === 'USD').reduce((s, p) => s + p.amount, 0);
  const stand = expenses.filter((e) => !e.report_id);
  const expFC = stand.filter((e) => e.currency === 'FC').reduce((s, e) => s + e.amount, 0);
  const expUSD = stand.filter((e) => e.currency === 'USD').reduce((s, e) => s + e.amount, 0);
  const fournisseurs = orders.reduce((s, o) => s + orderCashOut(o), 0); // décaissements en FC
  const fc = salesFC + payFC - expFC - fournisseurs;
  const usd = salesUSD + payUSD - expUSD;
  return { fc, usd, total_fc: fc + usd * taux };
}

/** Valeur du stock carburant = Σ (litres restants × prix de vente). */
export function stockValue(cisterns: Cistern[]): number {
  return cisterns.reduce((s, c) => s + c.current_l * c.sale_price_fc, 0);
}

/** Dettes recouvrables converties en FC = Σ restes dus (×taux si la dette est en USD). */
export function recoverableDebtsFC(debts: Debt[], payments: DebtPayment[], taux: number): number {
  return debts
    .filter((d) => d.status === 'en_attente')
    .reduce((s, d) => s + debtRemaining(d, payments) * (d.currency === 'USD' ? taux : 1), 0);
}

/** Valeur des commandes fournisseurs « en cours » (prix d'achat). */
export function pendingOrdersValue(orders: SupplierOrder[]): number {
  return orders.filter((o) => o.status === 'en_cours').reduce((s, o) => s + o.purchase_price, 0);
}

export interface CapitalBreakdown {
  caisse: number;
  stock_value: number;
  debts: number;
  orders_value: number;
  capital: number;
}

/**
 * Capital (FC) = Caisse (FC + USD convertis) + Valeur Stock Carburant
 *              + Dettes Recouvrables (USD converties) + Commandes Fournisseurs en cours.
 */
export function computeCapital(
  reports: Report[],
  cisterns: Cistern[],
  expenses: Expense[],
  debts: Debt[],
  debtPayments: DebtPayment[],
  orders: SupplierOrder[],
  taux: number,
): CapitalBreakdown {
  const caisse = computeCaisse(reports, expenses, debtPayments, orders, taux).total_fc;
  const sv = stockValue(cisterns);
  const dr = recoverableDebtsFC(debts, debtPayments, taux);
  const ov = pendingOrdersValue(orders);
  return { caisse, stock_value: sv, debts: dr, orders_value: ov, capital: caisse + sv + dr + ov };
}

export interface CategorySpend {
  category: ExpenseCategory;
  total: number;
}

/** Dépenses agrégées par catégorie (pour le camembert analytique). */
export function expensesByCategory(
  expenses: Expense[],
  categories: ExpenseCategory[],
  period?: string,
): CategorySpend[] {
  const filtered = period ? expenses.filter((e) => e.date.startsWith(period)) : expenses;
  return categories
    .map((category) => ({
      category,
      total: filtered.filter((e) => e.category_id === category.id).reduce((s, e) => s + e.amount_fc, 0),
    }))
    .filter((r) => r.total > 0)
    .sort((a, b) => b.total - a.total);
}
