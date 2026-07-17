// =====================================================================
//  Export PDF HAUTE FIDÉLITÉ (jsPDF + autotable, chargés à la demande).
//  Génération VECTORIELLE programmatique (jamais de capture DOM) : aucun
//  élément interactif (boutons, filtres, menus) ne peut fuiter dans le
//  document — seule la donnée pure est composée.
//  Garanties de rendu :
//   • En-tête professionnel (station, titre, date) et pied de page
//     (« Page X sur Y » + « Généré le … ») répétés sur CHAQUE page.
//   • Anti-coupure : rowPageBreak 'avoid' — aucune ligne de tableau
//     scindée entre deux pages.
//   • Largeurs de colonnes FIXES calculées pour la page (A4 portrait,
//     paysage pour les clôtures) — aucun chevauchement ni débordement.
//   • Formatage strict : « 150 000 FC », « $250.00 », « 4 250 L (SUPER) ».
// =====================================================================
import type { DailyClosing, Debt, DebtPayment, PompisteProfile, Report } from '@/types';
import { STATION, FUEL_LABEL, pumpById } from '@/constants';
import { fc, usd, liters, fullDate } from './format';
import { debtPaid, debtRemaining, payrollOf } from './selectors';

const GREEN: [number, number, number] = [16, 185, 129];
const DARK: [number, number, number] = [11, 16, 30];
const MARGIN = 14;
const HEADER_H = 26;

interface DocMeta { title: string; subtitle?: string }

async function newDoc(orientation: 'p' | 'l' = 'p') {
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;
  const doc = new jsPDF({ orientation, unit: 'mm', format: 'a4' });
  return { doc, autoTable };
}

/** Options communes à TOUS les tableaux : marges réservant l'en-tête sur
 *  chaque page + interdiction de couper une ligne entre deux pages. */
function baseTable() {
  return {
    margin: { top: HEADER_H + 6, left: MARGIN, right: MARGIN, bottom: 18 },
    rowPageBreak: 'avoid' as const,
    styles: { overflow: 'linebreak' as const, cellPadding: 1.6 },
  };
}

function drawHeader(doc: any, meta: DocMeta) {
  const w = doc.internal.pageSize.getWidth();
  doc.setFillColor(...DARK);
  doc.rect(0, 0, w, HEADER_H, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(STATION.name, MARGIN, 13);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`${STATION.city} · ${STATION.phone}`, MARGIN, 19);
  doc.setTextColor(...GREEN);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text(meta.title, w - MARGIN, 13, { align: 'right' });
  if (meta.subtitle) {
    doc.setTextColor(160, 160, 160);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(meta.subtitle, w - MARGIN, 19, { align: 'right' });
  }
  doc.setTextColor(0, 0, 0);
}

/** Repasse sur TOUTES les pages : en-tête fixe + pied de page numéroté. */
function finalize(doc: any, meta: DocMeta) {
  const n = doc.getNumberOfPages();
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    drawHeader(doc, meta);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(150);
    doc.text(`Généré le ${new Date().toLocaleString('fr-FR')}`, MARGIN, h - 7);
    doc.text(`Page ${i} sur ${n}`, w - MARGIN, h - 7, { align: 'right' });
  }
}

/** Volume + unité + carburant : « 4 250 L (SUPER) ». */
const vol = (l: number, fuel?: 'super' | 'gasoil') => `${liters(l)}${fuel ? ` (${FUEL_LABEL[fuel].toUpperCase()})` : ''}`;

// =====================================================================
//  RAPPORT JOURNALIER D'UN POMPISTE (A4 portrait — 182 mm utiles)
// =====================================================================
export async function exportReportPDF(report: Report, pompisteName: string) {
  const meta: DocMeta = { title: 'RAPPORT JOURNALIER', subtitle: fullDate(report.report_date) };
  const { doc, autoTable } = await newDoc('p');

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(`Pompiste : ${pompisteName}`, MARGIN, HEADER_H + 10);

  // ---- Détail des 4 pompes (largeurs fixes : 30+26+28+28+30+40 = 182) ----
  autoTable(doc, {
    ...baseTable(),
    startY: HEADER_H + 16,
    head: [['Pompe', 'Carburant', 'Index ouv.', 'Index ferm.', 'Litrage', 'Montant']],
    body: report.pump_readings.map((pr) => {
      const p = pumpById(pr.pump_id);
      return [
        p?.label ?? pr.pump_id,
        FUEL_LABEL[pr.fuel].toUpperCase(),
        pr.index_open.toLocaleString('fr-FR'),
        pr.index_close.toLocaleString('fr-FR'),
        liters(pr.litrage),
        fc(pr.montant),
      ];
    }),
    headStyles: { fillColor: GREEN, textColor: DARK },
    styles: { ...baseTable().styles, fontSize: 9 },
    columnStyles: {
      0: { cellWidth: 30 }, 1: { cellWidth: 26 },
      2: { cellWidth: 28, halign: 'right' }, 3: { cellWidth: 28, halign: 'right' },
      4: { cellWidth: 30, halign: 'right' }, 5: { cellWidth: 40, halign: 'right' },
    },
  });

  // ---- Dépenses mixtes rattachées (80+34+30+38 = 182) ----
  if (report.expenses && report.expenses.length > 0) {
    autoTable(doc, {
      ...baseTable(),
      startY: (doc as any).lastAutoTable.finalY + 6,
      head: [['Dépense', 'Part FC', 'Part USD', 'Total FC']],
      body: report.expenses.map((e) => [
        e.description || '—',
        (e.amount || 0) > 0 ? fc(e.amount) : '—',
        (e.amount_usd || 0) > 0 ? usd(e.amount_usd) : '—',
        fc(e.amount_fc),
      ]),
      headStyles: { fillColor: DARK, textColor: 255 },
      styles: { ...baseTable().styles, fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 80 },
        1: { cellWidth: 34, halign: 'right' }, 2: { cellWidth: 30, halign: 'right' }, 3: { cellWidth: 38, halign: 'right' },
      },
    });
  }

  // ---- Synthèse financière (bloc insécable) ----
  const rows: [string, string][] = [
    [`Total Super — ${vol(report.essence_litrage, 'super')}`, fc(report.essence_montant)],
    [`Total Gasoil — ${vol(report.gasoil_litrage, 'gasoil')}`, fc(report.gasoil_montant)],
    ['− Dépenses', fc(report.total_depenses)],
    ['− Manquant', fc(report.manquant)],
    ['TOTAL À REMETTRE (Y)', fc(report.total_a_remettre)],
    ['Billetage encaissé (X)', fc(report.total_encaisse)],
    ['Écart (X − Y)', fc(report.ecart)],
    ['Décision écart', report.decision_imputation === 'tolere' ? 'Toléré (perte sèche)' : report.decision_imputation === 'debit_salaire' ? 'Déduit du salaire' : '—'],
    ['Évaluation admin', report.final_stars ? `${report.final_stars} étoile${report.final_stars > 1 ? 's' : ''} sur 5` : 'Non notée'],
  ];
  autoTable(doc, {
    ...baseTable(),
    startY: (doc as any).lastAutoTable.finalY + 6,
    body: rows,
    theme: 'plain',
    pageBreak: 'avoid', // bloc synthèse jamais scindé
    styles: { ...baseTable().styles, fontSize: 10 },
    columnStyles: { 0: { cellWidth: 120, fontStyle: 'bold' }, 1: { cellWidth: 62, halign: 'right' } },
    didParseCell: (d: any) => {
      if (d.row.raw[0] === 'TOTAL À REMETTRE (Y)') { d.cell.styles.textColor = GREEN; d.cell.styles.fontStyle = 'bold'; }
      if (d.row.raw[0] === '− Manquant' && report.manquant > 0) d.cell.styles.textColor = [220, 38, 38];
    },
  });

  if (report.admin_comment) {
    const y = (doc as any).lastAutoTable.finalY + 6;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(80);
    doc.text(`Suggestions de l'admin : ${report.admin_comment}`, MARGIN, y, { maxWidth: 182 });
  }

  finalize(doc, meta);
  doc.save(`rapport_${pompisteName.replace(/\s+/g, '_')}_${report.report_date}.pdf`);
}

// =====================================================================
//  CLÔTURE JOURNALIÈRE (A4 PAYSAGE — 269 mm utiles : 8 colonnes à l'aise)
// =====================================================================
export async function exportClosingPDF(closing: DailyClosing, reports: Report[], nameOf: (id: string | null) => string) {
  const meta: DocMeta = { title: 'CLÔTURE JOURNALIÈRE', subtitle: fullDate(closing.closed_at) };
  const { doc, autoTable } = await newDoc('l');
  const totalDepenses = reports.reduce((s, r) => s + (r.total_depenses || 0), 0);

  // ---- 1er tableau : synthèse consolidée de la journée (insécable) ----
  autoTable(doc, {
    ...baseTable(),
    startY: HEADER_H + 8,
    head: [['Synthèse de la journée', 'Valeur']],
    body: [
      ['Rapports fusionnés', String(closing.report_count)],
      ['Volume vendu Super', vol(closing.total_super_l, 'super')],
      ['Volume vendu Gasoil', vol(closing.total_gasoil_l, 'gasoil')],
      ['Volume total', liters(closing.total_volume_l)],
      ['Total dépenses (rapports)', fc(totalDepenses)],
      ['TOTAL RECETTES ENCAISSÉES', fc(closing.total_encaisse)],
      ['Bénéfice net de la journée', fc(closing.total_benefice)],
    ],
    theme: 'striped',
    pageBreak: 'avoid',
    headStyles: { fillColor: GREEN, textColor: DARK },
    styles: { ...baseTable().styles, fontSize: 10 },
    columnStyles: { 0: { cellWidth: 160, fontStyle: 'bold' }, 1: { cellWidth: 109, halign: 'right' } },
    didParseCell: (d: any) => {
      if (d.section === 'body' && d.row.raw[0] === 'TOTAL RECETTES ENCAISSÉES') { d.cell.styles.textColor = GREEN; d.cell.styles.fontStyle = 'bold'; }
    },
  });

  // ---- 2e tableau : détail des rapports (42+45+28+28+34+34+32+26 = 269) ----
  autoTable(doc, {
    ...baseTable(),
    startY: (doc as any).lastAutoTable.finalY + 8,
    head: [['Date', 'Pompiste', 'Super', 'Gasoil', 'À remettre', 'Encaissé', 'Écart', 'Décision']],
    body: reports.map((r) => [
      fullDate(r.report_date),
      nameOf(r.pompiste_id),
      liters(r.essence_litrage),
      liters(r.gasoil_litrage),
      fc(r.total_a_remettre),
      fc(r.total_encaisse),
      Math.abs(r.montant_ecart ?? 0) < 1 ? '—' : fc(r.montant_ecart),
      r.decision_imputation === 'tolere' ? 'Toléré' : r.decision_imputation === 'debit_salaire' ? 'Salaire' : '—',
    ]),
    headStyles: { fillColor: GREEN, textColor: DARK },
    styles: { ...baseTable().styles, fontSize: 8.5 },
    columnStyles: {
      0: { cellWidth: 42 }, 1: { cellWidth: 45 },
      2: { cellWidth: 28, halign: 'right' }, 3: { cellWidth: 28, halign: 'right' },
      4: { cellWidth: 34, halign: 'right' }, 5: { cellWidth: 34, halign: 'right' },
      6: { cellWidth: 32, halign: 'right' }, 7: { cellWidth: 26 },
    },
    didParseCell: (d: any) => {
      if (d.section === 'body' && d.column.index === 6 && String(d.cell.raw).startsWith('-')) d.cell.styles.textColor = [220, 38, 38];
    },
  });

  finalize(doc, meta);
  doc.save(`cloture_${closing.closed_at.slice(0, 10)}.pdf`);
}

// =====================================================================
//  FICHE DE PAIE (A4 portrait)
// =====================================================================
export async function exportPayslipPDF(pompiste: PompisteProfile, period: string, taux: number) {
  const meta: DocMeta = { title: 'FICHE DE PAIE', subtitle: `Période ${period}` };
  const { doc, autoTable } = await newDoc('p');
  const b = payrollOf(pompiste, taux);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(`Employé : ${pompiste.display_name}`, MARGIN, HEADER_H + 10);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`${pompiste.phone ? 'Tél : ' + pompiste.phone + '   ·   ' : ''}Taux du jour : ${taux.toLocaleString('fr-FR')} FC/$`, MARGIN, HEADER_H + 16);

  autoTable(doc, {
    ...baseTable(),
    startY: HEADER_H + 22,
    head: [['Élément', 'FC', 'USD']],
    body: [
      ['Salaire de base', fc(b.base_fc), usd(b.base_usd)],
      ['Retenues (manquants)', `− ${fc(b.retenue_fc)}`, b.retenue_usd > 0 ? `− ${usd(b.retenue_usd)}` : '—'],
      ['NET À PAYER', fc(b.net_fc), usd(b.net_usd)],
      ['NET CONSOLIDÉ (≈ FC)', fc(b.net_total_fc), ''],
    ],
    pageBreak: 'avoid',
    headStyles: { fillColor: GREEN, textColor: DARK },
    styles: { ...baseTable().styles, fontSize: 11 },
    columnStyles: { 0: { cellWidth: 90 }, 1: { cellWidth: 50, halign: 'right' }, 2: { cellWidth: 42, halign: 'right' } },
    didParseCell: (d: any) => {
      if (d.section === 'body' && d.row.index === 1 && d.column.index > 0) d.cell.styles.textColor = [220, 38, 38];
      if (d.section === 'body' && d.row.index >= 2) { d.cell.styles.fontStyle = 'bold'; if (d.column.index > 0) d.cell.styles.textColor = GREEN; }
    },
  });

  finalize(doc, meta);
  doc.save(`fiche_paie_${pompiste.display_name.replace(/\s+/g, '_')}_${period}.pdf`);
}

// =====================================================================
//  REGISTRE DES DETTES (A4 portrait — 34+24+34+26+26+26+12 = 182)
// =====================================================================
export async function exportDebtsPDF(debts: Debt[], payments: DebtPayment[]) {
  const meta: DocMeta = { title: 'REGISTRE DES DETTES', subtitle: `${debts.length} dette(s)` };
  const { doc, autoTable } = await newDoc('p');
  const money = (a: number, c: string) => (c === 'USD' ? usd(a) : fc(a));

  autoTable(doc, {
    ...baseTable(),
    startY: HEADER_H + 8,
    head: [['Client', 'Tél.', 'Carburant', 'Total', 'Payé', 'Reste', 'Statut']],
    body: debts.map((d) => {
      const paid = debtPaid(d, payments), rem = debtRemaining(d, payments);
      return [
        d.client_name, d.phone ?? '', `${FUEL_LABEL[d.fuel]} · ${liters(d.liters)}`,
        money(d.total_amount, d.currency), money(paid, d.currency), money(rem, d.currency),
        d.status === 'soldee' ? 'Soldée' : 'En attente',
      ];
    }),
    headStyles: { fillColor: GREEN, textColor: DARK },
    styles: { ...baseTable().styles, fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 34 }, 1: { cellWidth: 24 }, 2: { cellWidth: 34 },
      3: { cellWidth: 25, halign: 'right' }, 4: { cellWidth: 25, halign: 'right' }, 5: { cellWidth: 25, halign: 'right' },
      6: { cellWidth: 15 },
    },
    didParseCell: (d: any) => {
      if (d.section === 'body' && d.column.index === 6) d.cell.styles.textColor = d.cell.raw === 'Soldée' ? GREEN : [220, 38, 38];
    },
  });

  finalize(doc, meta);
  doc.save(`registre_dettes_${new Date().toISOString().slice(0, 10)}.pdf`);
}
