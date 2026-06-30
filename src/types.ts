// =====================================================================
//  Modèle de données — miroir du schéma supabase/schema.sql
//  NOTE: "essence" == "Super" dans tout le code (l'enum DB historique).
//  Les agrégats Report.essence_* représentent le total SUPER (pompes 2-4).
// =====================================================================

export type Role = 'admin' | 'pompiste' | 'viewer';
export type ReportStatus = 'brouillon' | 'valide';
export type FuelType = 'super' | 'gasoil';
export type NotifType = 'manquant' | 'augmentation_salaire' | 'rapport_valide' | 'info';
export type MovementKind = 'entree' | 'sortie';
export type MovementSource = 'livraison' | 'rapport' | 'ajustement';
export type DebtStatus = 'en_attente' | 'soldee';
export type OrderStatus = 'en_cours' | 'livre';
export type Currency = 'FC' | 'USD';
/** Décision de l'admin sur l'écart de caisse d'un rapport.
 *  'aucun' = surplus/équilibré (rien à imputer) ·
 *  'tolere' = déficit toléré (perte sèche, pompiste non pénalisé) ·
 *  'debit_salaire' = déficit déduit du salaire (manquant officiel). */
export type EcartDecision = 'aucun' | 'tolere' | 'debit_salaire';

export interface AppUser {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  avatar_url?: string | null;
  pompiste_id?: string | null;
}

export interface PompisteProfile {
  id: string;
  user_id: string | null;
  display_name: string;
  phone?: string | null;
  photo_url?: string | null;
  base_salary: number; // part du salaire en FC
  base_salary_usd: number; // part du salaire en USD
  cumul_manquants_mois: number; // toujours en FC
  current_period: string;
  active: boolean;
}

export interface SalaryHistory {
  id: string;
  pompiste_id: string;
  old_salary: number;
  new_salary: number;
  old_salary_usd?: number;
  new_salary_usd?: number;
  changed_by?: string | null;
  reason?: string | null;
  changed_at: string;
}

export type TempsUnite = 'jours' | 'heures';

/** Paiement officiel d'un salaire (clôture RH d'une période). */
export interface SalaryPayment {
  id: string;
  pompiste_id: string;
  mois_concerne: string; // période "YYYY-MM"
  date_paiement: string; // date de remise de l'argent
  temps_travail: number; // quantité (jours ou heures)
  temps_unite: TempsUnite;
  montant_paye_fc: number;
  montant_paye_usd: number;
  valide_par?: string | null; // admin ayant validé
  created_at: string;
}

// ----------------------- ARCHITECTURE PHYSIQUE -----------------------
/** Citerne / cuve. 3 au total : 1 Gasoil + 2 Super. */
export interface Cistern {
  id: string;
  name: string;
  fuel: FuelType;
  capacity_l: number;
  current_l: number;
  sale_price_fc: number; // prix de vente unitaire FC/L (sert au calcul du capital)
  updated_at: string;
}

/** Pompe. 4 au total, chacune reliée à une citerne. */
export interface Pump {
  id: string;
  label: string;
  fuel: FuelType;
  cistern_id: string;
}

/** Relevé d'index d'une pompe dans un rapport. */
export interface PumpReading {
  pump_id: string;
  fuel: FuelType;
  cistern_id: string;
  index_open: number;
  index_close: number;
  litrage: number;
  unit_price: number;
  montant: number;
}

/** Mouvement de carburant d'une citerne (entrée livraison / sortie vente). */
export interface FuelMovement {
  id: string;
  cistern_id: string;
  kind: MovementKind;
  volume_l: number;
  source: MovementSource;
  ref_id?: string | null; // report_id ou supplier_order_id
  label: string;
  created_at: string;
}

/** Relevé de jauge physique — double sécurisation théorique vs physique. */
export interface StockLog {
  id: string;
  cistern_id: string;
  theoretical_l: number; // stock système (initial + livraisons - ventes)
  physical_l: number; // relevé manuel admin
  ecart: number; // physical - theoretical (négatif = coulage)
  note?: string | null;
  created_by?: string | null;
  created_at: string;
}

// --------------------------- CAISSE / DÉPENSES -----------------------
export interface ExpenseCategory {
  id: string;
  name: string;
  color: string;
}

/** Dépense — liée à un rapport (report_id) ou hors-rapport (null). */
export interface Expense {
  id: string;
  category_id: string | null;
  description: string;
  amount: number; // montant brut dans la devise choisie
  currency: Currency;
  amount_fc: number; // valeur convertie en FC (capturée à la saisie)
  date: string;
  report_id?: string | null;
  created_at?: string;
}

// ------------------- APPORT DE FONDS (hors rapport) ------------------
/** Entrée de caisse indépendante des ventes (apport gérant, fonds de roulement, prêt…). */
export interface CashEntry {
  id: string;
  currency: Currency;
  amount: number; // dans la devise choisie
  motif: string; // origine des fonds (obligatoire)
  date: string;
  created_by?: string | null;
  created_at?: string;
}

// ----------------------------- DETTES --------------------------------
export interface Debt {
  id: string;
  client_name: string;
  phone?: string | null;
  fuel: FuelType;
  liters: number;
  total_amount: number; // dans la devise de la dette
  currency: Currency;
  date: string;
  status: DebtStatus;
  created_at: string;
}

export interface DebtPayment {
  id: string;
  debt_id: string;
  amount: number;
  currency: Currency; // même devise que la dette
  date: string;
}

// ------------------------ COMMANDES FOURNISSEURS ---------------------
export interface SupplierOrder {
  id: string;
  supplier_name: string;
  fuel: FuelType; // SUPER ou GASOIL (arrivage)
  cistern_id: string; // citerne de déchargement (cohérente avec fuel)
  volume_l: number;
  purchase_price: number;
  deposit: number;
  status: OrderStatus;
  order_date: string;
  delivered_at?: string | null;
}

// ----------------------------- CAPITAL -------------------------------
export interface CapitalPoint {
  date: string;
  caisse: number;
  stock_value: number;
  debts: number;
  orders_value: number; // valeur des commandes fournisseurs en cours
  capital: number;
}

// ------------------------ COMMUNIQUÉS & RÉGLAGES ---------------------
/** Pièce jointe universelle d'un communiqué (image, vidéo, document…). */
export interface Attachment {
  file_url: string; // URL publique Storage (prod) ou data-URL (démo)
  file_name: string; // nom d'origine, ex: consignes_securite.mp4
  file_type: string; // type MIME, ex: video/mp4, image/png, application/pdf
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  author_id?: string | null;
  attachments: Attachment[]; // 0..n fichiers de tout type
  created_at: string;
}

/** Paramètres globaux modifiables par l'Admin. */
export interface Settings {
  essence_price: number; // Prix de VENTE Super (FC/L)
  gasoil_price: number; // Prix de VENTE Gasoil (FC/L)
  essence_buy_price: number; // Prix d'ACHAT Super (FC/L)
  gasoil_buy_price: number; // Prix d'ACHAT Gasoil (FC/L)
  taux_journalier: number; // USD -> FC
  updated_at: string;
}

// --------------------- CMS : CONTENU DE LA VITRINE -------------------
export interface GalleryImage {
  id: string;
  url: string; // URL Supabase Storage (prod) ou data-URL (démo locale)
  caption?: string;
}

export interface SocialLinks {
  facebook?: string;
  instagram?: string;
  whatsapp?: string;
  tiktok?: string;
}

/** Contenu éditable de la page d'accueil (table landing_page_content, singleton). */
export interface LandingContent {
  hero_title: string;
  hero_slogan: string;
  hero_bg_url: string;
  logo_url: string;
  about_text: string;
  gallery: GalleryImage[];
  hours: string;
  phones: string;
  address: string;
  social: SocialLinks;
  updated_at: string;
}

/** Quantités de billets par coupure FC. */
export type Billetage = Record<string, number>;

export interface Report {
  id: string;
  pompiste_id: string;
  author_id?: string | null;
  report_date: string;

  pump_readings: PumpReading[]; // 4 pompes

  manquant: number;
  taux_journalier: number;
  total_usd: number;
  billetage: Billetage;
  expenses: Expense[];

  auto_score: number | null;
  final_stars: number | null;
  admin_comment?: string | null;

  // agrégats dérivés (essence == Super)
  essence_litrage: number;
  essence_montant: number;
  gasoil_litrage: number;
  gasoil_montant: number;
  total_depenses: number;
  total_a_remettre: number; // Y
  total_billetage_fc: number;
  total_usd_fc: number;
  total_encaisse: number; // X
  ecart: number;
  montant_ecart: number; // écart constaté X − Y (négatif = déficit, positif = surplus)
  decision_imputation: EcartDecision; // décision admin sur l'écart
  benefice: number; // marge nette générée par le rapport (FC)

  status: ReportStatus;
  closed: boolean; // clôturé (reconnu financièrement à la clôture journalière)
  closed_at?: string | null;
  validated_at?: string | null;
  created_at: string;
}

/** Clôture journalière : consolidation d'un ensemble de rapports choisis par l'Admin. */
export interface DailyClosing {
  id: string;
  date: string;
  report_ids: string[];
  report_count: number;
  total_super_l: number;
  total_gasoil_l: number;
  total_volume_l: number;
  total_encaisse: number;
  total_benefice: number;
  closed_by?: string | null;
  closed_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: NotifType;
  title: string;
  body?: string | null;
  meta?: Record<string, unknown>;
  read: boolean;
  created_at: string;
}

/** Saisie d'une pompe dans le formulaire (chaînes -> nombres). */
export interface PumpDraft {
  pump_id: string;
  index_open: number;
  index_close: number;
}

export interface ReportDraft {
  pompiste_id: string;
  report_date: string;
  pumps: PumpDraft[];
  manquant: number;
  taux_journalier: number;
  total_usd: number;
  billetage: Billetage;
  expenses: Expense[];
  final_stars: number | null;
  admin_comment: string;
  montant_ecart?: number; // écart constaté X − Y (renseigné à la soumission)
  decision_imputation?: EcartDecision; // décision admin (défaut 'aucun')
}

export interface ComputedReport {
  pumps: PumpReading[];
  essence_litrage: number;
  essence_montant: number;
  gasoil_litrage: number;
  gasoil_montant: number;
  total_depenses: number;
  total_a_remettre: number; // Y
  total_billetage_fc: number;
  total_usd_fc: number;
  total_encaisse: number; // X
  ecart: number;
  is_balanced: boolean;
  auto_score: number;
  marge_super: number; // PV - PA Super (FC/L)
  marge_gasoil: number; // PV - PA Gasoil (FC/L)
  benefice: number; // litrage_super*marge_super + litrage_gasoil*marge_gasoil
}
