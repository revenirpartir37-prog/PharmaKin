'use client'

import { useEffect, useMemo, useRef } from 'react'
import { Download, Share2, Printer, CheckCircle2, MapPin } from 'lucide-react'
import { toast } from 'sonner'
import { formatFC } from '@/lib/format'
import { buildInvoicePdf, downloadPdf, pdfBlobUrl } from '@/lib/pdf'
import type { PharmacyDTO, SaleDTO, SellerDTO } from '@/lib/types'

interface InvoiceViewProps {
  sale: SaleDTO
  pharmacy: PharmacyDTO
  seller: SellerDTO
}

export function InvoiceView({ sale, pharmacy, seller }: InvoiceViewProps) {
  const doc = useMemo(
    () =>
      buildInvoicePdf({
        pharmacyName: pharmacy.name,
        invoiceNumber: sale.invoiceNumber,
        date: sale.dateStr,
        time: sale.timeStr,
        clientName: sale.clientName,
        sellerName: seller.name,
        lines: (sale.items ?? []).map((i) => ({
          name: i.name,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          lineTotal: i.lineTotal,
        })),
        total: sale.total,
        currency: pharmacy.currency,
        address: pharmacy.address,
      }),
    [sale, pharmacy, seller],
  )

  const blobUrl = useMemo(() => pdfBlobUrl(doc), [doc])
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    return () => {
      // jsPDF blob URLs created with output('bloburl') — revoke to avoid leaks
      try {
        URL.revokeObjectURL(blobUrl)
      } catch {
        // ignore
      }
    }
  }, [blobUrl])

  function handleDownload() {
    downloadPdf(doc, `Facture_${sale.invoiceNumber}_${sale.dateStr.replace(/\//g, '-')}.pdf`)
    toast.success('Facture téléchargée')
  }

  async function handleShare() {
    try {
      const blob = doc.output('blob')
      const file = new File([blob], `Facture_${sale.invoiceNumber}.pdf`, {
        type: 'application/pdf',
      })
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Facture ${sale.invoiceNumber}`,
          text: `Facture ${sale.invoiceNumber} — ${pharmacy.name}`,
        })
      } else {
        // Fallback: download
        handleDownload()
        toast.info('Partage non supporté — téléchargement à la place')
      }
    } catch {
      // user cancelled — silent
    }
  }

  function handlePrint() {
    // Open PDF in a new window for printing
    const w = window.open(blobUrl, '_blank')
    if (w) {
      w.focus()
      setTimeout(() => w.print(), 500)
    } else {
      toast.error('Veuillez autoriser les pop-ups pour imprimer')
    }
  }

  return (
    <div className="space-y-4">
      {/* Success banner */}
      <div className="flex items-center gap-3 rounded-2xl bg-emerald-50 border border-emerald-200 p-4">
        <CheckCircle2 size={28} className="text-emerald-600" />
        <div>
          <div className="text-sm font-bold text-emerald-900">Vente enregistrée avec succès</div>
          <div className="text-xs text-emerald-700">Facture {sale.invoiceNumber} · {formatFC(sale.total)}</div>
        </div>
      </div>

      {/* Paper-like invoice preview */}
      <div className="overflow-hidden rounded-3xl border border-border bg-white shadow-lg">
        {/* Header */}
        <div className="bg-primary px-5 py-4 text-primary-foreground">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-lg font-extrabold tracking-tight">PHARMAKIN</div>
              <div className="text-[10px] uppercase tracking-widest opacity-80">L'application des pharmacies</div>
            </div>
            <div className="text-right">
              <div className="text-xs font-bold uppercase opacity-80">Facture</div>
              <div className="text-base font-extrabold">{sale.invoiceNumber}</div>
            </div>
          </div>
        </div>

        {/* Pharmacy info */}
        <div className="px-5 py-4">
          <div className="text-base font-extrabold text-foreground">{pharmacy.name.toUpperCase()}</div>
          <div className="text-xs text-muted-foreground">
            {pharmacy.address ? `${pharmacy.address} · ` : ''}Kinshasa, RDC
          </div>
          {pharmacy.phone && (
            <div className="text-xs text-muted-foreground">Tél: {pharmacy.phone}</div>
          )}
        </div>

        {/* Meta */}
        <div className="mx-5 rounded-xl bg-muted/40 p-3 text-sm">
          <MetaRow label="Date" value={sale.dateStr} />
          <MetaRow label="Heure" value={sale.timeStr} />
          <MetaRow label="Vendeur" value={seller.name} />
          {sale.clientName && <MetaRow label="Client" value={sale.clientName} />}
        </div>

        {/* Items */}
        <div className="mt-3 px-5">
          <div className="grid grid-cols-12 gap-2 border-b-2 border-primary/30 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            <div className="col-span-6">Produit</div>
            <div className="col-span-2 text-center">Qté</div>
            <div className="col-span-2 text-right">P.U.</div>
            <div className="col-span-2 text-right">Total</div>
          </div>
          {(sale.items ?? []).map((it) => (
            <div key={it.id} className="grid grid-cols-12 gap-2 border-b border-border/60 py-2 text-sm">
              <div className="col-span-6 font-medium">{it.name}</div>
              <div className="col-span-2 text-center">{it.quantity}</div>
              <div className="col-span-2 text-right">{formatFC(it.unitPrice)}</div>
              <div className="col-span-2 text-right font-bold">{formatFC(it.lineTotal)}</div>
            </div>
          ))}
        </div>

        {/* Total */}
        <div className="mx-5 my-4 flex items-center justify-between rounded-xl bg-primary px-4 py-3 text-primary-foreground">
          <span className="text-sm font-bold uppercase tracking-wider">Total</span>
          <span className="text-lg font-extrabold">{formatFC(sale.total)}</span>
        </div>

        {/* Footer */}
        <div className="border-t border-border px-5 py-3 text-center">
          <p className="text-sm italic text-muted-foreground">Merci pour votre confiance.</p>
          <p className="mt-1 text-[10px] text-muted-foreground/70">Créé par HenoBuild Entreprise</p>
        </div>
      </div>

      {/* Hidden iframe preview of the actual PDF (used for print/share) */}
      <iframe ref={iframeRef} src={blobUrl} title="Facture PDF" className="hidden" />

      {/* Action buttons */}
      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={handleDownload}
          className="flex flex-col items-center gap-1 rounded-2xl bg-primary px-3 py-3 text-primary-foreground"
        >
          <Download size={22} />
          <span className="text-xs font-bold">Télécharger</span>
        </button>
        <button
          onClick={handleShare}
          className="flex flex-col items-center gap-1 rounded-2xl border border-border bg-card px-3 py-3 text-foreground"
        >
          <Share2 size={22} />
          <span className="text-xs font-bold">Partager</span>
        </button>
        <button
          onClick={handlePrint}
          className="flex flex-col items-center gap-1 rounded-2xl border border-border bg-card px-3 py-3 text-foreground"
        >
          <Printer size={22} />
          <span className="text-xs font-bold">Imprimer</span>
        </button>
      </div>

      {pharmacy.latitude == null && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">
          <div className="flex items-center gap-2 font-semibold">
            <MapPin size={14} /> Astuce
          </div>
          Configurez la position de votre pharmacie pour apparaître dans l'Espace Client.
        </div>
      )}
    </div>
  )
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs font-bold text-foreground">{value}</span>
    </div>
  )
}
