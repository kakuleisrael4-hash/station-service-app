// Formatage monétaire & dates (locale FR / Franc Congolais)

export function fc(value: number | null | undefined): string {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  return `${Math.round(n).toLocaleString('fr-FR')} FC`;
}

export function usd(value: number | null | undefined): string {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  return `$${n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function liters(value: number | null | undefined): string {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  return `${n.toLocaleString('fr-FR')} L`;
}

export function shortDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  } catch {
    return iso;
  }
}

export function fullDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function currentPeriod(): string {
  return new Date().toISOString().slice(0, 7); // YYYY-MM
}

/** Libellé lisible d'une période "YYYY-MM" -> "Juillet 2026". */
export function monthLabel(period: string): string {
  const [y, m] = period.split('-').map(Number);
  if (!y || !m) return period;
  const label = new Date(y, m - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Liste de N dernières périodes (YYYY-MM) en partant du mois courant. */
export function recentPeriods(count = 12): string[] {
  const out: string[] = [];
  const d = new Date();
  for (let i = 0; i < count; i++) {
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    d.setMonth(d.getMonth() - 1);
  }
  return out;
}
