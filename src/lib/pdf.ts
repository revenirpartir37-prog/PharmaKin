import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatFC, formatNumber, todayStr } from './format'

/**
 * PharmaKin PDF helpers — invoice and service report.
 * Clean, professional, "bien fait et beau et visible".
 */

interface InvoiceLine {
  name: string
  quantity: number
  unitPrice: number
  lineTotal: number
}

interface InvoiceData {
  pharmacyName: string
  invoiceNumber: string
  date: string
  time: string
  clientName?: string | null
  sellerName: string
  lines: InvoiceLine[]
  total: number
  currency: string
  address?: string | null
}

/**
 * Generate a clean professional invoice PDF and return the jsPDF doc.
 */
export function buildInvoicePdf(data: InvoiceData): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a5' }) // a5 is receipt-like
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 12

  // ---- Header band (teal) ----
  doc.setFillColor(31, 107, 83) // pharma-600
  doc.rect(0, 0, pageWidth, 26, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text('PHARMAKIN', margin, 12)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text("L'application des pharmacies", margin, 18)

  // Right side: FACTURE label
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('FACTURE', pageWidth - margin, 12, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(data.invoiceNumber, pageWidth - margin, 18, { align: 'right' })

  // ---- Pharmacy info ----
  let y = 34
  doc.setTextColor(20, 63, 51) // pharma-800
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text(data.pharmacyName.toUpperCase(), margin, y)

  y += 5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(80, 80, 80)
  if (data.address) {
    doc.text(data.address, margin, y)
    y += 4.5
  }
  doc.text('Kinshasa, RDC', margin, y)

  // ---- Meta box (date / time / seller / client) ----
  y += 8
  const metaLines: [string, string][] = [
    ['Date', data.date],
    ['Heure', data.time],
    ['Vendeur', data.sellerName],
  ]
  if (data.clientName) metaLines.push(['Client', data.clientName])

  doc.setDrawColor(220, 220, 220)
  doc.setFillColor(248, 250, 249)
  doc.roundedRect(margin, y, pageWidth - margin * 2, 6 + metaLines.length * 5, 1.5, 1.5, 'FD')
  let my = y + 5
  doc.setFontSize(8.5)
  for (const [k, v] of metaLines) {
    doc.setTextColor(120, 120, 120)
    doc.setFont('helvetica', 'normal')
    doc.text(k, margin + 2, my)
    doc.setTextColor(20, 40, 35)
    doc.setFont('helvetica', 'bold')
    doc.text(v, margin + 28, my)
    my += 5
  }
  y += 6 + metaLines.length * 5

  // ---- Items table ----
  const rows = data.lines.map((l) => [
    l.name,
    String(l.quantity),
    formatFC(l.unitPrice),
    formatFC(l.lineTotal),
  ])

  autoTable(doc, {
    startY: y + 2,
    head: [['Produit', 'Qté', 'Prix unit.', 'Total']],
    body: rows,
    theme: 'grid',
    headStyles: {
      fillColor: [31, 107, 83],
      textColor: [255, 255, 255],
      fontSize: 9,
      fontStyle: 'bold',
      halign: 'left',
    },
    bodyStyles: {
      fontSize: 9,
      textColor: [30, 40, 35],
      cellPadding: 2.5,
    },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 12, halign: 'center' },
      2: { cellWidth: 'auto', halign: 'right' },
      3: { cellWidth: 'auto', halign: 'right' },
    },
    margin: { left: margin, right: margin },
  })

  // @ts-expect-error lastAutoTable is added by the plugin
  y = (doc.lastAutoTable?.finalY ?? y + 10) + 4

  // ---- Total ----
  doc.setFillColor(31, 107, 83)
  doc.roundedRect(pageWidth - margin - 60, y, 60, 12, 1.5, 1.5, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('TOTAL', pageWidth - margin - 56, y + 5)
  doc.setFontSize(11)
  doc.text(formatFC(data.total), pageWidth - margin - 4, y + 9, { align: 'right' })

  y += 18

  // ---- Footer ----
  doc.setDrawColor(220, 220, 220)
  doc.line(margin, y, pageWidth - margin, y)
  y += 6
  doc.setTextColor(120, 120, 120)
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(9)
  doc.text('Merci pour votre confiance.', pageWidth / 2, y, { align: 'center' })
  y += 6
  doc.setTextColor(180, 180, 180)
  doc.setFontSize(7)
  doc.setFont('helvetica', 'normal')
  doc.text('Créé par HenoBuild Entreprise', pageWidth / 2, y, { align: 'center' })

  return doc
}

interface ServiceReportData {
  pharmacyName: string
  sellerName: string
  date: string
  startTime: string
  endTime: string
  salesCount: number
  revenue: number
  itemsSold: number
  entriesCount: number
  exitsCount: number
  entriesUnits: number
  exitsUnits: number
  sales: {
    invoiceNumber: string
    timeStr: string
    clientName?: string | null
    total: number
    items: { name: string; quantity: number; unitPrice: number; lineTotal: number }[]
  }[]
  movements: {
    timeStr: string
    type: string
    quantity: number
    reason?: string | null
    productName: string
  }[]
}

/**
 * Generate the end-of-service report PDF.
 */
export function buildServiceReportPdf(data: ServiceReportData): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 14

  // ---- Header band ----
  doc.setFillColor(31, 107, 83)
  doc.rect(0, 0, pageWidth, 32, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.text('PHARMAKIN', margin, 14)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text("Rapport de service vendeur", margin, 21)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text(data.pharmacyName.toUpperCase(), pageWidth - margin, 14, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text(`${data.date}`, pageWidth - margin, 21, { align: 'right' })

  // ---- Seller + period ----
  let y = 44
  doc.setTextColor(20, 63, 51)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text('Vendeur', margin, y)
  doc.setFontSize(16)
  doc.text(data.sellerName, margin + 24, y)

  y += 8
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(80, 80, 80)
  doc.text(`Période : ${data.startTime} → ${data.endTime}`, margin, y)

  // ---- Summary cards ----
  y += 8
  const cardW = (pageWidth - margin * 2 - 12) / 4
  const cards: [string, string][] = [
    ['Ventes', String(data.salesCount)],
    ['Revenu', formatFC(data.revenue)],
    ['Produits vendus', String(data.itemsSold)],
    ['Entrées/Sorties', `${data.entriesCount}/${data.exitsCount}`],
  ]
  for (let i = 0; i < cards.length; i++) {
    const x = margin + i * (cardW + 4)
    doc.setFillColor(238, 247, 244)
    doc.roundedRect(x, y, cardW, 18, 2, 2, 'F')
    doc.setTextColor(120, 120, 120)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.text(cards[i][0], x + 3, y + 6)
    doc.setTextColor(31, 107, 83)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text(cards[i][1], x + 3, y + 14)
  }
  y += 26

  // ---- Détail des ventes ----
  doc.setTextColor(20, 63, 51)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('Détail des ventes', margin, y)
  y += 4

  const saleRows = data.sales.map((s) => [
    s.invoiceNumber,
    s.timeStr,
    s.clientName || '—',
    formatNumber(s.items.reduce((a, b) => a + b.quantity, 0)),
    formatFC(s.total),
  ])

  autoTable(doc, {
    startY: y,
    head: [['Facture', 'Heure', 'Client', 'Qté', 'Total']],
    body: saleRows,
    theme: 'striped',
    headStyles: { fillColor: [31, 107, 83], textColor: [255, 255, 255], fontSize: 9 },
    bodyStyles: { fontSize: 9, textColor: [30, 40, 35] },
    alternateRowStyles: { fillColor: [243, 249, 247] },
    margin: { left: margin, right: margin },
  })

  // @ts-expect-error plugin
  y = (doc.lastAutoTable?.finalY ?? y) + 8

  if (y > pageHeight - 60) {
    doc.addPage()
    y = margin + 4
  }

  // ---- Mouvements de stock ----
  doc.setTextColor(20, 63, 51)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('Mouvements de stock', margin, y)
  y += 4

  const mvRows = data.movements.map((m) => [
    m.timeStr,
    m.type === 'ENTRY' ? 'Entrée' : m.type === 'EXIT' ? 'Sortie' : m.type,
    m.productName,
    (m.quantity > 0 ? '+' : '') + formatNumber(m.quantity),
    m.reason || '—',
  ])

  autoTable(doc, {
    startY: y,
    head: [['Heure', 'Type', 'Produit', 'Qté', 'Motif']],
    body: mvRows,
    theme: 'striped',
    headStyles: { fillColor: [31, 107, 83], textColor: [255, 255, 255], fontSize: 9 },
    bodyStyles: { fontSize: 9, textColor: [30, 40, 35] },
    alternateRowStyles: { fillColor: [243, 249, 247] },
    margin: { left: margin, right: margin },
  })

  // @ts-expect-error plugin
  y = (doc.lastAutoTable?.finalY ?? y) + 12

  // ---- Footer ----
  doc.setDrawColor(220, 220, 220)
  doc.line(margin, pageHeight - 22, pageWidth - margin, pageHeight - 22)
  doc.setTextColor(180, 180, 180)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text(
    `Rapport généré le ${todayStr()} — PharmaKin par HenoBuild Entreprise`,
    pageWidth / 2,
    pageHeight - 16,
    { align: 'center' },
  )

  return doc
}

/**
 * Helper to trigger a browser download of a jsPDF doc.
 */
export function downloadPdf(doc: jsPDF, filename: string) {
  doc.save(filename)
}

/**
 * Helper to get a blob URL for a jsPDF doc (for sharing / preview / iframe).
 */
export function pdfBlobUrl(doc: jsPDF): string {
  return doc.output('bloburl') as unknown as string
}
