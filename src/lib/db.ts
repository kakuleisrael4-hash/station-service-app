// =====================================================================
//  Couche d'accès aux données — UNE interface, DEUX implémentations.
//  - Sans clés Supabase  -> magasin local temps-réel (mockDb).
//  - Avec clés Supabase   -> Postgres + Realtime + RLS (supabaseDb).
// =====================================================================
import type {
  Announcement,
  AppUser,
  Attachment,
  CapitalPoint,
  CashEntry,
  Cistern,
  DailyClosing,
  Currency,
  Debt,
  DebtPayment,
  Expense,
  ExpenseCategory,
  FuelMovement,
  FuelType,
  LandingContent,
  Notification,
  OrderStatus,
  PompisteProfile,
  Pump,
  Report,
  ReportDraft,
  Role,
  SalaryHistory,
  SalaryPayment,
  Settings,
  StockLog,
  SupplierOrder,
  TempsUnite,
} from '@/types';
import { mockDb } from './mockDb';
import { createSupabaseDb } from './supabaseDb';

export interface StationData {
  users: AppUser[];
  pompistes: PompisteProfile[];
  reports: Report[];
  cisterns: Cistern[];
  pumps: Pump[];
  fuelMovements: FuelMovement[];
  expenseCategories: ExpenseCategory[];
  expenses: Expense[];
  debts: Debt[];
  debtPayments: DebtPayment[];
  supplierOrders: SupplierOrder[];
  cashEntries: CashEntry[];
  dailyClosings: DailyClosing[];
  capitalHistory: CapitalPoint[];
  stockLogs: StockLog[];
  announcements: Announcement[];
  settings: Settings;
  landing: LandingContent;
  notifications: Notification[];
  salaryHistory: SalaryHistory[];
  salaryPayments: SalaryPayment[];
}

export interface NewExpenseInput {
  category_id: string | null;
  description: string;
  amount: number;
  currency: Currency;
  date: string;
}
export interface NewDebtInput {
  client_name: string;
  phone: string;
  fuel: FuelType;
  liters: number;
  total_amount: number;
  currency: Currency;
  date: string;
}
export interface NewOrderInput {
  supplier_name: string;
  fuel: FuelType;
  cistern_id: string;
  volume_l: number;
  purchase_price: number;
  deposit: number;
  order_date: string;
}
export interface NewCashInput {
  currency: Currency;
  amount: number;
  motif: string;
  date: string;
}
export interface NewPompisteInput {
  display_name: string;
  phone: string;
  base_salary: number;
  base_salary_usd: number;
  email: string; // compte de connexion du pompiste
  password: string; // mot de passe initial
}
export interface SalaryParts {
  base_salary: number;
  base_salary_usd: number;
}
export interface SalaryPaymentInput {
  pompiste_id: string;
  mois_concerne: string; // "YYYY-MM"
  date_paiement: string;
  temps_travail: number;
  temps_unite: TempsUnite;
  montant_paye_fc: number;
  montant_paye_usd: number;
}

export interface StationDB {
  readonly isMock: boolean;

  getSession(): Promise<AppUser | null>;
  signIn(email: string, password: string): Promise<AppUser>;
  signInDemo?(role: Role): Promise<AppUser>;
  signOut(): Promise<void>;

  loadAll(): Promise<StationData>;

  // Mutations (admin)
  createReport(draft: ReportDraft, author: AppUser): Promise<Report>;
  /** Clôture journalière : consolide les rapports sélectionnés, applique les impacts (stock, RH, caisse, capital). */
  closeDay(reportIds: string[]): Promise<void>;
  /** Suppression d'un rapport avec rollback en cascade (stock, manquant RH, clôtures, capital). */
  deleteReport(reportId: string): Promise<void>;
  /** Suppression d'une clôture : ré-ouvre ses rapports et annule ses impacts (stock, manquant RH, capital). */
  deleteClosing(closingId: string): Promise<void>;
  updateSalary(pompisteId: string, salary: SalaryParts, changedBy: AppUser): Promise<void>;
  /** Paiement officiel d'un salaire : historise, remet le cumul manquants à 0, décaisse la caisse. */
  paySalary(input: SalaryPaymentInput, paidBy: AppUser): Promise<void>;
  addExpenseCategory(name: string, color: string): Promise<void>;
  addExpense(input: NewExpenseInput): Promise<void>;
  addCashEntry(input: NewCashInput): Promise<void>;
  addDebt(input: NewDebtInput): Promise<void>;
  addDebtPayment(debtId: string, amount: number, date: string): Promise<void>;
  createSupplierOrder(input: NewOrderInput): Promise<void>;
  setOrderStatus(orderId: string, status: OrderStatus): Promise<void>;

  // Stock physique / audit
  addStockLog(cisternId: string, physicalL: number, note: string, adjust: boolean): Promise<void>;

  // Communiqués & paramètres
  addAnnouncement(title: string, body: string, author: AppUser, attachments?: Attachment[]): Promise<void>;
  deleteAnnouncement(id: string): Promise<void>;
  /** Téléverse une pièce jointe universelle (vidéo, doc, image…) et renvoie ses métadonnées. */
  uploadAttachment(file: File): Promise<Attachment>;
  updateSettings(patch: Partial<Settings>): Promise<void>;
  updatePump(pumpId: string, patch: Partial<Pick<Pump, 'cistern_id' | 'fuel'>>): Promise<void>;
  updateCisternCapacity(cisternId: string, capacityL: number): Promise<void>;
  addPompiste(input: NewPompisteInput): Promise<void>;
  /** Suppression totale : fiche RH + compte Auth lié (rapports passés -> pompiste_id NULL). */
  deletePompiste(pompisteId: string): Promise<void>;
  updatePompiste(id: string, patch: Partial<PompisteProfile>): Promise<void>;
  updateUserRole(userId: string, role: Role): Promise<void>;

  // CMS vitrine
  updateLanding(content: LandingContent): Promise<void>;
  /** Téléverse une image et renvoie son URL (data-URL en démo, URL Storage en prod). */
  uploadImage(file: File): Promise<string>;

  markNotificationRead(id: string): Promise<void>;

  subscribe(cb: () => void): () => void;
}

let _db: StationDB | null = null;

export function getDb(): StationDB {
  if (_db) return _db;
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  _db = url && key ? createSupabaseDb(url, key) : mockDb;
  return _db;
}

export const USING_SUPABASE = Boolean(
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY,
);
