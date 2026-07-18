// =====================================================================
//  Constantes métier de la station
// =====================================================================
import type { Cistern, ExpenseCategory, FuelType, LandingContent, Pump, Settings } from '@/types';

export const STATION = {
  name: 'STATION KKC OIL',
  tagline: "L'énergie qui fait avancer la République.",
  city: 'Lubumbashi, RDC',
  phone: '+243 970 000 000',
};

/** Prix unitaires de vente par carburant (FC / litre). */
export const PRICE_BY_FUEL: Record<FuelType, number> = {
  super: 2440, // Essence / Super
  gasoil: 2430,
};
export const PRICE_ESSENCE_FC = PRICE_BY_FUEL.super;
export const PRICE_GASOIL_FC = PRICE_BY_FUEL.gasoil;

export const FUEL_LABEL: Record<FuelType, string> = {
  super: 'Super',
  gasoil: 'Gasoil',
};

/** Réglages par défaut (modifiables dans le menu Paramètres). */
/** Prix d'achat fournisseur par défaut (FC/L) — modifiables dans Paramètres. */
export const BUY_PRICE_BY_FUEL: Record<FuelType, number> = {
  super: 2200,
  gasoil: 2200,
};

export const DEFAULT_SETTINGS: Settings = {
  essence_price: PRICE_BY_FUEL.super, // prix de vente
  gasoil_price: PRICE_BY_FUEL.gasoil,
  essence_buy_price: BUY_PRICE_BY_FUEL.super, // prix d'achat
  gasoil_buy_price: BUY_PRICE_BY_FUEL.gasoil,
  taux_journalier: 2850,
  updated_at: new Date().toISOString(),
};

/** Contenu par défaut de la vitrine (modifiable via le CMS « Gestion du site »). */
/** Ordre par défaut des sections de la page publique (toutes visibles). */
export const DEFAULT_SECTIONS: LandingContent['sections'] = [
  { id: 'hero', visible: true },
  { id: 'tarifs', visible: true },
  { id: 'features', visible: true },
  { id: 'apropos', visible: true },
  { id: 'infos', visible: true },
  { id: 'cta', visible: true },
];

export const SECTION_LABELS: Record<LandingContent['sections'][number]['id'], string> = {
  hero: 'Bannière Hero',
  tarifs: 'Tarifs du jour',
  features: 'Points forts',
  apropos: 'À propos & Galerie',
  infos: 'Infos pratiques & Réseaux',
  cta: 'Appel à connexion (CTA)',
};

export const DEFAULT_LANDING: LandingContent = {
  hero_title: 'Le carburant de qualité, la gestion moderne.',
  hero_slogan: STATION.tagline,
  hero_bg_url: '',
  logo_url: '',
  about_text:
    "STATION KKC OIL approvisionne particuliers et professionnels en carburant de qualité contrôlée. Notre engagement : une caisse transparente, des cuves toujours suivies et une équipe de pompistes reconnue à sa juste valeur.",
  gallery: [],
  hours: '24h/24 — 7 jours sur 7',
  phones: STATION.phone,
  address: STATION.city,
  social: {},
  sections: DEFAULT_SECTIONS,
  promo_text: '',
  hero_mode: 'image',
  hero_video_url: '',
  open_mode: 'auto',
  closed_reason: '',
  open_from: '',
  open_to: '',
  updated_at: new Date().toISOString(),
};

/** Normalise un contenu landing potentiellement ancien (colonnes manquantes). */
export function normalizeLanding(raw: Partial<LandingContent> | null | undefined): LandingContent {
  const base = raw ?? {};
  const sections = Array.isArray(base.sections) && base.sections.length > 0
    ? // garantit que toutes les sections connues existent (ajouts futurs inclus)
      [...base.sections.filter((s) => DEFAULT_SECTIONS.some((d) => d.id === s.id)),
       ...DEFAULT_SECTIONS.filter((d) => !base.sections!.some((s) => s.id === d.id))]
    : DEFAULT_SECTIONS;
  return { ...DEFAULT_LANDING, ...base, sections, social: base.social ?? {}, gallery: base.gallery ?? [] };
}

// ----------------------- INFRASTRUCTURE PHYSIQUE ---------------------
// IDs stables partagés entre le seed mock et les références UI.
export const CISTERN_IDS = {
  gasoil: 'cit-gasoil',
  super1: 'cit-super1',
  super2: 'cit-super2',
} as const;

/** Définition des 3 citernes : 1 Gasoil + 2 Super. */
export const CISTERNS_DEF: Omit<Cistern, 'current_l' | 'updated_at'>[] = [
  { id: CISTERN_IDS.gasoil, name: 'Citerne Gasoil', fuel: 'gasoil', capacity_l: 30000, sale_price_fc: PRICE_BY_FUEL.gasoil },
  { id: CISTERN_IDS.super1, name: 'Citerne Super 1', fuel: 'super', capacity_l: 30000, sale_price_fc: PRICE_BY_FUEL.super },
  { id: CISTERN_IDS.super2, name: 'Citerne Super 2', fuel: 'super', capacity_l: 30000, sale_price_fc: PRICE_BY_FUEL.super },
];

/** Définition des 4 pompes, chacune reliée à une citerne. */
export const PUMPS: Pump[] = [
  { id: 'p1', label: 'Pompe 1 — Gasoil', fuel: 'gasoil', cistern_id: CISTERN_IDS.gasoil },
  { id: 'p2', label: 'Pompe 2 — Super', fuel: 'super', cistern_id: CISTERN_IDS.super1 },
  { id: 'p3', label: 'Pompe 3 — Super', fuel: 'super', cistern_id: CISTERN_IDS.super1 }, // configurable Super 1/2
  { id: 'p4', label: 'Pompe 4 — Super', fuel: 'super', cistern_id: CISTERN_IDS.super2 },
];

export const pumpById = (id: string): Pump | undefined => PUMPS.find((p) => p.id === id);

/** Seuil d'alerte de stock critique (jauge rouge en dessous). */
export const CRITICAL_STOCK_PCT = 15;

// --------------------------- DÉPENSES --------------------------------
export const DEFAULT_EXPENSE_CATEGORIES: ExpenseCategory[] = [
  { id: 'cat-rh', name: 'RH / Primes', color: '#f97316' },
  { id: 'cat-maint', name: 'Maintenance Pompes', color: '#f59e0b' },
  { id: 'cat-taxes', name: 'Taxes & Impôts', color: '#fb7185' },
  { id: 'cat-elec', name: 'Factures Électricité', color: '#38bdf8' },
  { id: 'cat-divers', name: 'Divers', color: '#a78bfa' },
];

/** Coupures de billets FC acceptées au billetage (ordre décroissant). */
export const BILLETS_FC = [20000, 10000, 5000, 1000, 500, 200, 100] as const;

/** Tolérance d'arrondi pour la comparaison X == Y (en FC). */
export const BALANCE_TOLERANCE = 0.5;

/** Note automatique /10 selon le manquant (FC). */
export function autoScoreFromManquant(manquant: number): number {
  if (manquant <= 0) return 10;
  if (manquant < 5000) return 9;
  if (manquant < 10000) return 7;
  return 0;
}
