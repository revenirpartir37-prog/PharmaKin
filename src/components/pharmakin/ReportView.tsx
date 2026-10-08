'use client'

import { useEffect, useState } from 'react'
import {
  FileText,
  Loader2,
  Download,
  Share2,
  Clock,
  Wallet,
  ShoppingCart,
  PackagePlus,
  PackageMinus,
  Calendar,
  Power,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAppStore } from '@/lib/store'
import { formatFC, formatNumber, todayStr } from '@/lib/format'
import { buildServiceReportPdf, downloadPdf } from '@/lib/pdf'

interface ReportData {
  pharmacy: { id: string; name: string; phone: string | null; address: string | null }
  seller: { id: string; name: string }
  session: {
    id: string
    startTime: string
    endTime: string | null
    startStr: string
    endStr: string | null
    open: boolean
  }
  sales: {
    id: string
    invoiceNumber: string
    timeStr: string
    clientName: string | null
    total: number
    items: { name: string; quantity: number; unitPrice: number; lineTotal: number }[]
  }[]
  movements: {
    id: string
    type: string
    quantity: number
    reason: string | null
    timeStr: string
    product: { name: string } | null
  }[]
  summary: {
    salesCount: number
    revenue: number
    itemsSold: number
    entriesCount: number
    exitsCount: number
    entriesUnits: number
    exitsUnits: number
    startStr: string
    endStr: string
  }
}

export function ReportView() {
  const { pharmacy, sellers, activeSellerId } = useAppStore()
  const seller = sellers.find((s) => s.id === activeSellerId)

  const [report, setReport] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)

  async function load() {
    if (!pharmacy || !activeSellerId) return
    setLoading(true)
    try {
      // Look for the last session for this seller (open or closed)
      const res = await fetch(
        `/api/report?sessionId=${(window as unknown as { _lastSessionId?: string })._lastSessionId ?? ''}`,
      )
      if (!res.ok) throw new Error('Erreur')
      const data = (await res.json()) as ReportData
      setReport(data)
    } catch {
      // No session id — try to fetch seller's most recent report differently
      // The /api/report endpoint requires sessionId; if missing, show empty state
      setReport(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
     
  }, [pharmacy?.id, activeSellerId])

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    )
  }

  if (!report || !seller) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <FileText size={22} className="text-primary" />
          <h1 className="text-xl font-extrabold tracking-tight">Mon rapport</h1>
        </div>
        <div className="rounded-2xl border border-dashed border-border p-8 text-center">
          <Power size={32} className="mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm font-semibold">Aucun rapport disponible</p>
          <p className="text-xs text-muted-foreground">
            Terminez un service pour générer votre rapport PDF.
          </p>
        </div>
      </div>
    )
  }

  const s = report.summary

  function handleDownload() {
    if (!report) return
    const doc = buildServiceReportPdf({
      pharmacyName: report.pharmacy.name,
      sellerName: report.seller.name,
      date: todayStr(new Date(report.session.startTime)),
      startTime: report.summary.startStr,
      endTime: report.summary.endStr ?? timeNow(),
      salesCount: report.summary.salesCount,
      revenue: report.summary.revenue,
      itemsSold: report.summary.itemsSold,
      entriesCount: report.summary.entriesCount,
      exitsCount: report.summary.exitsCount,
      entriesUnits: report.summary.entriesUnits,
      exitsUnits: report.summary.exitsUnits,
      sales: report.sales.map((x) => ({
        invoiceNumber: x.invoiceNumber,
        timeStr: x.timeStr,
        clientName: x.clientName,
        total: x.total,
        items: x.items,
      })),
      movements: report.movements.map((m) => ({
        timeStr: m.timeStr,
        type: m.type,
        quantity: m.quantity,
        reason: m.reason,
        productName: m.product?.name ?? '—',
      })),
    })
    downloadPdf(
      doc,
      `Rapport_${report.seller.name.replace(/\s+/g, '_')}_${todayStr(new Date(report.session.startTime)).replace(/\//g, '-')}.pdf`,
    )
    toast.success('Rapport téléchargé')
  }

  async function handleShare() {
    if (!report) return
    try {
      const doc = buildServiceReportPdf({
        pharmacyName: report.pharmacy.name,
        sellerName: report.seller.name,
        date: todayStr(new Date(report.session.startTime)),
        startTime: report.summary.startStr,
        endTime: report.summary.endStr ?? timeNow(),
        salesCount: report.summary.salesCount,
        revenue: report.summary.revenue,
        itemsSold: report.summary.itemsSold,
        entriesCount: report.summary.entriesCount,
        exitsCount: report.summary.exitsCount,
        entriesUnits: report.summary.entriesUnits,
        exitsUnits: report.summary.exitsUnits,
        sales: report.sales.map((x) => ({
          invoiceNumber: x.invoiceNumber,
          timeStr: x.timeStr,
          clientName: x.clientName,
          total: x.total,
          items: x.items,
        })),
        movements: report.movements.map((m) => ({
          timeStr: m.timeStr,
          type: m.type,
          quantity: m.quantity,
          reason: m.reason,
          productName: m.product?.name ?? '—',
        })),
      })
      const blob = doc.output('blob')
      const file = new File([blob], `Rapport_${report.seller.name}.pdf`, {
        type: 'application/pdf',
      })
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Rapport de ${report.seller.name}`,
          text: `Rapport de service — ${report.pharmacy.name}`,
        })
      } else {
        handleDownload()
        toast.info('Partage non supporté — téléchargement à la place')
      }
    } catch {
      // cancelled
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <FileText size={22} className="text-primary" />
        <h1 className="text-xl font-extrabold tracking-tight">Mon rapport de service</h1>
      </div>

      {/* Service header */}
      <div className="rounded-3xl bg-gradient-to-br from-primary to-pharma-700 p-5 text-primary-foreground shadow-lg">
        <div className="text-xs uppercase tracking-widest opacity-80">Votre service</div>
        <div className="text-2xl font-extrabold">{report.seller.name}</div>
        <div className="mt-1 flex items-center gap-1.5 text-sm opacity-90">
          <Clock size={14} /> {s.startStr} → {s.endStr ?? timeNow()}
        </div>
      </div>

      {/* Summary metrics */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Metric icon={<ShoppingCart size={18} />} value={String(s.salesCount)} label="Ventes" />
        <Metric icon={<Wallet size={18} />} value={formatFC(s.revenue)} label="Revenu" />
        <Metric icon={<PackagePlus size={18} />} value={`${s.entriesCount}`} label="Entrées" />
        <Metric icon={<PackageMinus size={18} />} value={`${s.exitsCount}`} label="Sorties" />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Metric value={String(s.itemsSold)} label="Produits vendus" />
        <Metric value={`${s.entriesUnits}u / ${s.exitsUnits}u`} label="Entrées/Sorties (unités)" />
      </div>

      {/* Detail: sales */}
      {report.sales.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">
            Détail des ventes
          </h2>
          <div className="space-y-2">
            {report.sales.map((sale) => (
              <div key={sale.id} className="flex items-center justify-between border-b border-border/60 pb-2 last:border-0">
                <div className="min-w-0">
                  <div className="text-sm font-semibold">{sale.invoiceNumber}</div>
                  <div className="text-xs text-muted-foreground">
                    {sale.timeStr}
                    {sale.clientName ? ` · ${sale.clientName}` : ''}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold">{formatFC(sale.total)}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {formatNumber(sale.items.reduce((a, b) => a + b.quantity, 0))} articles
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Detail: stock movements */}
      {report.movements.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">
            Mouvements de stock
          </h2>
          <div className="space-y-1.5">
            {report.movements.map((m) => (
              <div key={m.id} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{m.timeStr}</span>
                  <span className="font-medium">{m.product?.name ?? '—'}</span>
                </div>
                <span
                  className={`font-bold ${m.quantity > 0 ? 'text-emerald-600' : 'text-amber-600'}`}
                >
                  {m.quantity > 0 ? '+' : ''}{m.quantity}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {report.sales.length === 0 && report.movements.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          <Calendar size={24} className="mx-auto mb-2" />
          Aucune opération enregistrée pendant ce service.
        </div>
      )}

      {/* Action buttons */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={handleDownload}
          className="flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3.5 text-sm font-bold text-primary-foreground shadow-sm"
        >
          <Download size={18} /> Télécharger PDF
        </button>
        <button
          onClick={handleShare}
          className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-card px-4 py-3.5 text-sm font-bold text-foreground"
        >
          <Share2 size={18} /> Envoyer / Partager
        </button>
      </div>
    </div>
  )
}

function Metric({
  icon,
  value,
  label,
}: {
  icon?: React.ReactNode
  value: string
  label: string
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      {icon && <div className="mb-1 text-primary">{icon}</div>}
      <div className="text-lg font-extrabold leading-tight text-foreground">{value}</div>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  )
}

function timeNow(): string {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
