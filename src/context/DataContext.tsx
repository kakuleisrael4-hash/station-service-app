import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { AppUser, LandingContent, OrderStatus, PompisteProfile, Pump, ReportDraft, Role, Settings } from '@/types';
import { getDb, type NewCashInput, type NewDebtInput, type NewExpenseInput, type NewOrderInput, type NewPompisteInput, type SalaryParts, type StationData } from '@/lib/db';
import { DEFAULT_LANDING, DEFAULT_SETTINGS } from '@/constants';

interface DataCtx extends StationData {
  ready: boolean;
  refresh: () => Promise<void>;
  createReport: (draft: ReportDraft, author: AppUser) => Promise<void>;
  closeDay: (reportIds: string[]) => Promise<void>;
  deleteReport: (reportId: string) => Promise<void>;
  deleteClosing: (closingId: string) => Promise<void>;
  updateSalary: (pompisteId: string, salary: SalaryParts, changedBy: AppUser) => Promise<void>;
  addExpenseCategory: (name: string, color: string) => Promise<void>;
  addExpense: (input: NewExpenseInput) => Promise<void>;
  addCashEntry: (input: NewCashInput) => Promise<void>;
  addDebt: (input: NewDebtInput) => Promise<void>;
  addDebtPayment: (debtId: string, amount: number, date: string) => Promise<void>;
  createSupplierOrder: (input: NewOrderInput) => Promise<void>;
  setOrderStatus: (orderId: string, status: OrderStatus) => Promise<void>;
  addStockLog: (cisternId: string, physicalL: number, note: string, adjust: boolean) => Promise<void>;
  addAnnouncement: (title: string, body: string, author: AppUser) => Promise<void>;
  deleteAnnouncement: (id: string) => Promise<void>;
  updateSettings: (patch: Partial<Settings>) => Promise<void>;
  updatePump: (pumpId: string, patch: Partial<Pick<Pump, 'cistern_id' | 'fuel'>>) => Promise<void>;
  updateCisternCapacity: (cisternId: string, capacityL: number) => Promise<void>;
  addPompiste: (input: NewPompisteInput) => Promise<void>;
  deletePompiste: (pompisteId: string) => Promise<void>;
  updatePompiste: (id: string, patch: Partial<PompisteProfile>) => Promise<void>;
  updateUserRole: (userId: string, role: Role) => Promise<void>;
  updateLanding: (content: LandingContent) => Promise<void>;
  uploadImage: (file: File) => Promise<string>;
  markNotificationRead: (id: string) => Promise<void>;
}

const EMPTY: StationData = {
  users: [],
  pompistes: [],
  reports: [],
  cisterns: [],
  pumps: [],
  fuelMovements: [],
  expenseCategories: [],
  expenses: [],
  debts: [],
  debtPayments: [],
  supplierOrders: [],
  cashEntries: [],
  dailyClosings: [],
  capitalHistory: [],
  stockLogs: [],
  announcements: [],
  settings: DEFAULT_SETTINGS,
  landing: DEFAULT_LANDING,
  notifications: [],
  salaryHistory: [],
};

const Ctx = createContext<DataCtx | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const db = getDb();
  const [data, setData] = useState<StationData>(EMPTY);
  const [ready, setReady] = useState(false);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    const fresh = await db.loadAll();
    if (mounted.current) setData(fresh);
  }, [db]);

  useEffect(() => {
    mounted.current = true;
    refresh().finally(() => mounted.current && setReady(true));
    // Temps réel : toute mutation (locale ou Supabase) recharge l'état.
    const unsub = db.subscribe(() => {
      refresh();
    });
    return () => {
      mounted.current = false;
      unsub();
    };
  }, [db, refresh]);

  const createReport = useCallback(
    async (draft: ReportDraft, author: AppUser) => {
      await db.createReport(draft, author);
      await refresh();
    },
    [db, refresh],
  );

  const closeDay = useCallback(async (reportIds: string[]) => { await db.closeDay(reportIds); await refresh(); }, [db, refresh]);
  const deleteReport = useCallback(async (reportId: string) => { await db.deleteReport(reportId); await refresh(); }, [db, refresh]);
  const deleteClosing = useCallback(async (closingId: string) => { await db.deleteClosing(closingId); await refresh(); }, [db, refresh]);

  const updateSalary = useCallback(
    async (pompisteId: string, salary: SalaryParts, changedBy: AppUser) => {
      await db.updateSalary(pompisteId, salary, changedBy);
      await refresh();
    },
    [db, refresh],
  );

  const markNotificationRead = useCallback(
    async (id: string) => {
      await db.markNotificationRead(id);
      await refresh();
    },
    [db, refresh],
  );

  const addExpenseCategory = useCallback(async (name: string, color: string) => { await db.addExpenseCategory(name, color); await refresh(); }, [db, refresh]);
  const addExpense = useCallback(async (input: NewExpenseInput) => { await db.addExpense(input); await refresh(); }, [db, refresh]);
  const addCashEntry = useCallback(async (input: NewCashInput) => { await db.addCashEntry(input); await refresh(); }, [db, refresh]);
  const addDebt = useCallback(async (input: NewDebtInput) => { await db.addDebt(input); await refresh(); }, [db, refresh]);
  const addDebtPayment = useCallback(async (debtId: string, amount: number, date: string) => { await db.addDebtPayment(debtId, amount, date); await refresh(); }, [db, refresh]);
  const createSupplierOrder = useCallback(async (input: NewOrderInput) => { await db.createSupplierOrder(input); await refresh(); }, [db, refresh]);
  const setOrderStatus = useCallback(async (orderId: string, status: OrderStatus) => { await db.setOrderStatus(orderId, status); await refresh(); }, [db, refresh]);
  const addStockLog = useCallback(async (cisternId: string, physicalL: number, note: string, adjust: boolean) => { await db.addStockLog(cisternId, physicalL, note, adjust); await refresh(); }, [db, refresh]);
  const addAnnouncement = useCallback(async (title: string, body: string, author: AppUser) => { await db.addAnnouncement(title, body, author); await refresh(); }, [db, refresh]);
  const deleteAnnouncement = useCallback(async (id: string) => { await db.deleteAnnouncement(id); await refresh(); }, [db, refresh]);
  const updateSettings = useCallback(async (patch: Partial<Settings>) => { await db.updateSettings(patch); await refresh(); }, [db, refresh]);
  const updatePump = useCallback(async (pumpId: string, patch: Partial<Pick<Pump, 'cistern_id' | 'fuel'>>) => { await db.updatePump(pumpId, patch); await refresh(); }, [db, refresh]);
  const updateCisternCapacity = useCallback(async (cisternId: string, capacityL: number) => { await db.updateCisternCapacity(cisternId, capacityL); await refresh(); }, [db, refresh]);
  const addPompiste = useCallback(async (input: NewPompisteInput) => { await db.addPompiste(input); await refresh(); }, [db, refresh]);
  const deletePompiste = useCallback(async (pompisteId: string) => { await db.deletePompiste(pompisteId); await refresh(); }, [db, refresh]);
  const updatePompiste = useCallback(async (id: string, patch: Partial<PompisteProfile>) => { await db.updatePompiste(id, patch); await refresh(); }, [db, refresh]);
  const updateUserRole = useCallback(async (userId: string, role: Role) => { await db.updateUserRole(userId, role); await refresh(); }, [db, refresh]);
  const updateLanding = useCallback(async (content: LandingContent) => { await db.updateLanding(content); await refresh(); }, [db, refresh]);
  const uploadImage = useCallback((file: File) => db.uploadImage(file), [db]);

  return (
    <Ctx.Provider value={{ ...data, ready, refresh, createReport, closeDay, deleteReport, deleteClosing, updateSalary, addExpenseCategory, addExpense, addCashEntry, addDebt, addDebtPayment, createSupplierOrder, setOrderStatus, addStockLog, addAnnouncement, deleteAnnouncement, updateSettings, updatePump, updateCisternCapacity, addPompiste, deletePompiste, updatePompiste, updateUserRole, updateLanding, uploadImage, markNotificationRead }}>
      {children}
    </Ctx.Provider>
  );
}

export function useData(): DataCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useData doit être utilisé dans <DataProvider>');
  return c;
}
