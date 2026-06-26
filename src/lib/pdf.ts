// =====================================================================
//  Export PDF (jsPDF + autotable, chargés à la demande pour ne pas
//  alourdir le bundle principal). Rapports, fiches de paie, registre dettes.
// =====================================================================
import type { Debt, DebtPayment, PompisteProfile, Report } from '@/types';
import { STATION, FUEL_LABEL, pumpById } from '@/constants';
import { fc, usd, liters, fullDate } from './format';
import { debtPaid, debtRemaining } from './selectors';

async function newDoc() {
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;
  const doc = new jsPDF();
  return { doc, autoTable };
}

const GREEN: [number, number, number] = [16, 185, 129];
const DARK: [number, number, number] = [11, 16, 30];

function header(doc: any, title: string, subtitle?: string) {
  doc.setFillColor(...DARK);
  doc.rect(0, 0, 210, 26, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(STATION.name, 14, 13);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`${STATION.city} · ${STATION.phone}`, 14, 19);
  doc.setTextColor(...GREEN);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 196, 13, { align: 'right' });
  if (subtitle) {
    doc.setTextColor(120, 120, 120);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(subtitle, 196, 19, { align: 'right' });
  }
  doc.setTextColor(0, 0, 0);
}

function footer(doc: any) {
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`Généré le ${new Date().toLocaleString('fr-FR')}`, 14, 290);
    doc.text(`Page ${i}/${n}`, 196, 290, { align: 'right' });
  }
}

/** Rapport journalier d'un pompiste. */
export async function exportReportPDF(report: Report, pompisteName: string) {
  const { doc, autoTable } = await newDoc();
  header(doc, 'RAPPORT JOURNALIER', fullDate(report.report_date));

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(`Pompiste : ${pompisteName}`, 14, 36);

  autoTable(doc, {
    startY: 42,
    head: [['Pompe', 'Carburant', 'Index ouv.', 'Index ferm.', 'Litrage', 'Montant']],
    body: report.pump_readings.map((pr) => {
      const p = pumpById(pr.pump_id);
      return [
        p?.label ?? pr.pump_id,
        FUEL_LABEL[pr.fuel],
        pr.index_open.toLocaleString('fr-FR'),
        pr.index_close.toLocaleString('fr-FR'),
        liters(pr.litrage),
        fc(pr.montant),
      ];
    }),
    headStyles: { fillColor: GREEN, textColor: DARK },
    styles: { fontSize: 9 },
    columnStyles: { 4: { halign: 'right' }, 5: { halign: 'right' } },
  });

  const rows: [string, string][] = [
    ['Total Super', fc(report.essence_montant)],
    ['Total Gasoil', fc(report.gasoil_montant)],
    ['− Dépenses', fc(report.total_depenses)],
    ['− Manquant', fc(report.manquant)],
    ['TOTAL À REMETTRE', fc(report.total_a_remettre)],
    ['Billetage encaissé (X)', fc(report.total_encaisse)],
    ['Écart (X − Y)', fc(report.ecart)],
    ['Note', `${report.auto_score ?? 0}/10 · ${report.final_stars ?? 0}★`],
  ];
  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 6,
    body: rows,
    theme: 'plain',
    styles: { fontSize: 10 },
    columnStyles: { 0: { fontStyle: 'bold' }, 1: { halign: 'right' } },
    didParseCell: (d: any) => {
      if (d.row.raw[0] === 'TOTAL À REMETTRE') { d.cell.styles.textColor = GREEN; d.cell.styles.fontStyle = 'bold'; }
      if (d.row.raw[0] === '− Manquant' && report.manquant > 0) d.cell.styles.textColor = [220, 38, 38];
    },
  });

  if (report.admin_comment) {
    const y = (doc as any).lastAutoTable.finalY + 6;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(80);
    doc.text(`Suggestions de l'admin : ${report.admin_comment}`, 14, y, { maxWidth: 182 });
  }
  footer(doc);
  doc.save(`rapport_${pompisteName.replace(/\s+/g, '_')}_${report.report_date}.pdf`);
}

/** Fiche de paie d'un pompiste. */
export async function exportPayslipPDF(pompiste: PompisteProfile, period: string) {
  const { doc, autoTable } = await newDoc();
  header(doc, 'FICHE DE PAIE', `Période ${period}`);
  const net = pompiste.base_salary - pompiste.cumul_manquants_mois;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(`Employé : ${pompiste.display_name}`, 14, 36);
  if (pompiste.phone) { doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.text(`Tél : ${pompiste.phone}`, 14, 42); }

  autoTable(doc, {
    startY: 48,
    head: [['Élément', 'Montant']],
    body: [
      ['Salaire de base', fc(pompiste.base_salary)],
      ['Retenues (manquants cumulés du mois)', `− ${fc(pompiste.cumul_manquants_mois)}`],
      ['NET À PAYER', fc(net)],
    ],
    headStyles: { fillColor: GREEN, textColor: DARK },
    styles: { fontSize: 11 },
    columnStyles: { 1: { halign: 'right' } },
    didParseCell: (d: any) => {
      if (d.section === 'body' && d.row.index === 1 && d.column.index === 1) d.cell.styles.textColor = [220, 38, 38];
      if (d.section === 'body' && d.row.index === 2) { d.cell.styles.fontStyle = 'bold'; d.cell.styles.textColor = d.column.index === 1 ? GREEN : DARK; }
    },
  });
  footer(doc);
  doc.save(`fiche_paie_${pompiste.display_name.replace(/\s+/g, '_')}_${period}.pdf`);
}

/** Registre des dettes clients. */
export async function exportDebtsPDF(debts: Debt[], payments: DebtPayment[]) {
  const { doc, autoTable } = await newDoc();
  header(doc, 'REGISTRE DES DETTES', `${debts.length} dette(s)`);
  const money = (a: number, c: string) => (c === 'USD' ? usd(a) : fc(a));

  autoTable(doc, {
    startY: 34,
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
    styles: { fontSize: 8 },
    columnStyles: { 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' } },
    didParseCell: (d: any) => {
      if (d.section === 'body' && d.column.index === 6) d.cell.styles.textColor = d.cell.raw === 'Soldée' ? GREEN : [220, 38, 38];
    },
  });
  footer(doc);
  doc.save(`registre_dettes_${new Date().toISOString().slice(0, 10)}.pdf`);
}
