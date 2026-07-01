// =====================================================================
//  Sélecteurs / agrégations dérivées (purs, testables).
// =====================================================================
import type {
  CashEntry, Cistern, Debt, DebtPayment, Expense, ExpenseCategory, PompisteProfile, Report, SalaryPayment, SupplierOrder,
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
      const stars = rs.map((r) => r.final_stars ?? 0).filter((x) => x > 0);
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

export interface PayrollBreakdown {
  base_fc: number;
  base_usd: number;
  retenue_fc: number; // manquant déduit de la part FC
  retenue_usd: number; // dépassement converti puis déduit de la part USD
  net_fc: number;
  net_usd: number;
  net_total_fc: number; // net consolidé en FC (net_fc + net_usd * taux)
}

/**
 * Salaire net bi-devise. Le manquant (FC) coupe d'abord dans la part FC ;
 * si le manquant dépasse le FC disponible, le reste est converti en USD
 * (au taux du jour) et déduit de la part USD.
 */
export function payrollOf(p: PompisteProfile, taux: number): PayrollBreakdown {
  const base_fc = p.base_salary;
  const base_usd = p.base_salary_usd;
  const manq = p.cumul_manquants_mois; // FC
  const retenue_fc = Math.min(manq, base_fc);
  const overflow_fc = manq - retenue_fc; // reste après épuisement de la part FC
  const retenue_usd = taux > 0 ? overflow_fc / taux : 0;
  const net_fc = base_fc - retenue_fc;
  const net_usd = base_usd - retenue_usd;
  return { base_fc, base_usd, retenue_fc, retenue_usd, net_fc, net_usd, net_total_fc: net_fc + net_usd * taux };
}

export interface PayrollRow {
  pompiste: PompisteProfile;
  b: PayrollBreakdown;
}

export function payroll(pompistes: PompisteProfile[], taux: number): PayrollRow[] {
  return pompistes.filter((p) => p.active).map((p) => ({ pompiste: p, b: payrollOf(p, taux) }));
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

export function stationRH(pompistes: PompisteProfile[], taux: number) {
  const active = pompistes.filter((p) => p.active);
  const masseSalariale = active.reduce((s, p) => s + p.base_salary + p.base_salary_usd * taux, 0);
  const totalManquants = active.reduce((s, p) => s + p.cumul_manquants_mois, 0);
  const netGlobal = active.reduce((s, p) => s + payrollOf(p, taux).net_total_fc, 0);
  return { masseSalariale, totalManquants, netGlobal, headcount: active.length };
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
  cashEntries: CashEntry[] = [],
  salaryPayments: SalaryPayment[] = [],
): CaisseBalance {
  // Caisse = uniquement les rapports CLÔTURÉS (reconnaissance financière à la clôture).
  const valides = reports.filter((r) => r.status === 'valide' && r.closed);
  const salesFC = valides.reduce((s, r) => s + r.total_billetage_fc, 0);
  const salesUSD = valides.reduce((s, r) => s + r.total_usd, 0);
  const payFC = debtPayments.filter((p) => p.currency === 'FC').reduce((s, p) => s + p.amount, 0);
  const payUSD = debtPayments.filter((p) => p.currency === 'USD').reduce((s, p) => s + p.amount, 0);
  const stand = expenses.filter((e) => !e.report_id);
  // Dépenses mixtes : la part FC sort du compartiment FC, la part USD du compartiment USD.
  const expFC = stand.reduce((s, e) => s + (e.amount || 0), 0);
  const expUSD = stand.reduce((s, e) => s + (e.amount_usd || 0), 0);
  const fournisseurs = orders.reduce((s, o) => s + orderCashOut(o), 0); // décaissements en FC
  const apportFC = cashEntries.filter((c) => c.currency === 'FC').reduce((s, c) => s + c.amount, 0);
  const apportUSD = cashEntries.filter((c) => c.currency === 'USD').reduce((s, c) => s + c.amount, 0);
  // Salaires versés = décaissements de la caisse (par devise).
  const salaireFC = salaryPayments.reduce((s, p) => s + p.montant_paye_fc, 0);
  const salaireUSD = salaryPayments.reduce((s, p) => s + p.montant_paye_usd, 0);
  const fc = salesFC + payFC + apportFC - expFC - fournisseurs - salaireFC;
  const usd = salesUSD + payUSD + apportUSD - expUSD - salaireUSD;
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
  cashEntries: CashEntry[] = [],
  salaryPayments: SalaryPayment[] = [],
): CapitalBreakdown {
  const caisse = computeCaisse(reports, expenses, debtPayments, orders, taux, cashEntries, salaryPayments).total_fc;
  const sv = stockValue(cisterns);
  const dr = recoverableDebtsFC(debts, debtPayments, taux);
  const ov = pendingOrdersValue(orders);
  return { caisse, stock_value: sv, debts: dr, orders_value: ov, capital: caisse + sv + dr + ov };
}

// =================== VENTES PAR CARBURANT (clôturées) ===============
export interface FuelSales {
  superVol: number;
  superMontant: number;
  gasoilVol: number;
  gasoilMontant: number;
}

/** Détail des ventes Super vs Gasoil (volume + montant) sur les rapports clôturés. */
export function salesByFuel(reports: Report[]): FuelSales {
  const closed = reports.filter((r) => r.status === 'valide' && r.closed);
  return {
    superVol: closed.reduce((s, r) => s + r.essence_litrage, 0),
    superMontant: closed.reduce((s, r) => s + r.essence_montant, 0),
    gasoilVol: closed.reduce((s, r) => s + r.gasoil_litrage, 0),
    gasoilMontant: closed.reduce((s, r) => s + r.gasoil_montant, 0),
  };
}

// =================== CAPITAL VENTILÉ PAR DEVISE =====================
export interface CapitalByCurrency {
  usd: { caisse: number; debts: number; total: number }; // natif USD
  fc: { caisse: number; debts: number; stock: number; orders: number; total: number }; // natif FC
  taux: number;
  usdInFc: number; // total USD converti au taux
  grandTotalFc: number; // FC + USD*taux (== computeCapital.capital)
}

/**
 * Ventile le capital par devise d'origine :
 *   • Bloc USD (natif) : caisse USD + dettes clients en USD.
 *   • Bloc FC (natif)  : caisse FC + dettes clients en FC + valeur stock + commandes en cours.
 *   • Grand Total FC   : Bloc FC + Bloc USD × taux.
 * (Stock & commandes fournisseurs sont libellés en FC dans le modèle de données.)
 */
export function capitalByCurrency(
  reports: Report[],
  cisterns: Cistern[],
  expenses: Expense[],
  debts: Debt[],
  debtPayments: DebtPayment[],
  orders: SupplierOrder[],
  taux: number,
  cashEntries: CashEntry[] = [],
  salaryPayments: SalaryPayment[] = [],
): CapitalByCurrency {
  const caisse = computeCaisse(reports, expenses, debtPayments, orders, taux, cashEntries, salaryPayments);
  const enAttente = debts.filter((d) => d.status === 'en_attente');
  const debtsUSD = enAttente.filter((d) => d.currency === 'USD').reduce((s, d) => s + debtRemaining(d, debtPayments), 0);
  const debtsFC = enAttente.filter((d) => d.currency === 'FC').reduce((s, d) => s + debtRemaining(d, debtPayments), 0);
  const stock = stockValue(cisterns);
  const orders_ = pendingOrdersValue(orders);
  const usdTotal = caisse.usd + debtsUSD;
  const fcTotal = caisse.fc + debtsFC + stock + orders_;
  const usdInFc = usdTotal * taux;
  return {
    usd: { caisse: caisse.usd, debts: debtsUSD, total: usdTotal },
    fc: { caisse: caisse.fc, debts: debtsFC, stock, orders: orders_, total: fcTotal },
    taux,
    usdInFc,
    grandTotalFc: fcTotal + usdInFc,
  };
}

export interface CategorySpend {
  category: ExpenseCategory;
  total: number;
}

// =================== RENTABILITÉ : BÉNÉFICES vs DÉPENSES =============
export interface ProfitExpensePoint {
  date: string;
  benefices: number; // marge nette carburant
  depenses: number; // toutes dépenses (FC)
}
export interface ProfitVsExpenses {
  series: ProfitExpensePoint[];
  totalBenefices: number;
  totalDepenses: number;
  resultat: number; // bénéfices - dépenses
  deficit: boolean; // dépenses > bénéfices sur la période
}

/** Croise bénéfices carburant et dépenses par jour sur une période. */
export function profitVsExpenses(reports: Report[], expenses: Expense[], period = currentPeriod()): ProfitVsExpenses {
  const map = new Map<string, ProfitExpensePoint>();
  const get = (d: string) => {
    let e = map.get(d);
    if (!e) { e = { date: d, benefices: 0, depenses: 0 }; map.set(d, e); }
    return e;
  };
  reports
    .filter((r) => r.status === 'valide' && r.closed && r.report_date.startsWith(period))
    .forEach((r) => { get(r.report_date).benefices += r.benefice || 0; });
  expenses
    .filter((e) => e.date.startsWith(period))
    .forEach((ex) => { get(ex.date).depenses += ex.amount_fc || 0; });
  const series = [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
  const totalBenefices = series.reduce((s, p) => s + p.benefices, 0);
  const totalDepenses = series.reduce((s, p) => s + p.depenses, 0);
  return { series, totalBenefices, totalDepenses, resultat: totalBenefices - totalDepenses, deficit: totalDepenses > totalBenefices };
}

/** Bénéfice cumulé total (tous rapports validés). */
export function totalBenefice(reports: Report[]): number {
  return reports.filter((r) => r.status === 'valide' && r.closed).reduce((s, r) => s + (r.benefice || 0), 0);
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
