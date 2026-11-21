import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatINR } from './india';

export function exportToCsv(filename: string, rows: Record<string, unknown>[]) {
  const csv = Papa.unparse(rows);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportToExcel(filename: string, sheetName: string, rows: Record<string, unknown>[]) {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  XLSX.writeFile(wb, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
}

export function exportReportPdf(
  title: string,
  subtitle: string,
  headers: string[],
  rows: (string | number)[][],
  filename: string
) {
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text(title, 14, 18);
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(subtitle, 14, 25);

  autoTable(doc, {
    startY: 32,
    head: [headers],
    body: rows,
    styles: { fontSize: 9 },
    headStyles: { fillColor: [15, 23, 42] },
  });

  doc.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
}

export function generateCommissionStatementPdf(params: {
  companyName: string;
  gstNumber?: string;
  agentName: string;
  dealTitle: string;
  grossInr: number;
  tdsPercent: number;
  tdsInr: number;
  netInr: number;
  status: string;
  payoutRef?: string;
}) {
  const doc = new jsPDF();
  doc.setFontSize(18);
  doc.text(params.companyName, 14, 20);
  doc.setFontSize(11);
  doc.setTextColor(80);
  doc.text(`Commission Payout Statement | GSTIN: ${params.gstNumber || 'N/A'}`, 14, 28);

  autoTable(doc, {
    startY: 38,
    head: [['Particulars', 'Details']],
    body: [
      ['Advisor / Agent', params.agentName],
      ['Deal / Unit', params.dealTitle],
      ['Gross Brokerage', formatINR(params.grossInr)],
      [`TDS u/s 194H (${params.tdsPercent}%)`, `- ${formatINR(params.tdsInr)}`],
      ['Net Payable Amount', formatINR(params.netInr)],
      ['Approval Status', params.status.toUpperCase()],
      ['UTR / Payout Ref', params.payoutRef || 'Pending Disbursement'],
    ],
    headStyles: { fillColor: [13, 148, 136] },
  });

  doc.setFontSize(9);
  doc.text('Generated via NivaasOS Indian Real Estate CRM', 14, 130);
  doc.save(`commission-statement-${params.agentName.replace(/\s+/g, '-').toLowerCase()}.pdf`);
}

export function generateGstInvoicePdf(params: {
  companyName: string;
  gstNumber?: string;
  planName: string;
  baseAmountInr: number;
  invoiceNo: string;
  dateStr: string;
}) {
  const cgst = Math.round(params.baseAmountInr * 0.09);
  const sgst = Math.round(params.baseAmountInr * 0.09);
  const total = params.baseAmountInr + cgst + sgst;

  const doc = new jsPDF();
  doc.setFontSize(18);
  doc.text('TAX INVOICE (GST)', 14, 20);
  doc.setFontSize(10);
  doc.text(`Supplier: NivaasOS Technologies Pvt Ltd | GSTIN: 27AABCN8901F1Z5`, 14, 28);
  doc.text(`Billed To: ${params.companyName} | Buyer GSTIN: ${params.gstNumber || 'Unregistered'}`, 14, 34);
  doc.text(`Invoice No: ${params.invoiceNo} | Date: ${params.dateStr}`, 14, 40);

  autoTable(doc, {
    startY: 48,
    head: [['SAC 998314 Description', 'Taxable Value', 'CGST (9%)', 'SGST (9%)', 'Total (INR)']],
    body: [
      [
        `NivaasOS SaaS Subscription - ${params.planName}`,
        formatINR(params.baseAmountInr),
        formatINR(cgst),
        formatINR(sgst),
        formatINR(total),
      ],
    ],
    headStyles: { fillColor: [15, 23, 42] },
  });

  doc.save(`${params.invoiceNo}.pdf`);
}
