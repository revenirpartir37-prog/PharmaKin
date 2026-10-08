'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Plus,
  PackagePlus,
  PackageMinus,
  Boxes,
  Activity as ActivityIcon,
  FileText,
  Power,
  AlertTriangle,
  TrendingUp,
  Loader2,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAppStore } from '@/lib/store'
import { formatFC, formatNumber } from '@/lib/format'

interface DashboardData {
  pharmacy: { name: string; phone: string | null; address: string | null; latitude: number | null; longitude: number | null }
  today: {
    date: string
    salesCount: number
    revenue: number
    itemsSold: number
    lowStock: number
    seller?: { salesCount: number; revenue: number; itemsSold: number } | null
  }
  openSession: {
    id: string
    startStr: string
    startTime: string
  } | null
}

interface SellerDashboardProps {
  onSell: () => void
  onStock: () => void
  onActivity: () => void
  onReports: () => void
  onEndService: () => Promise<unknown>
}

export function SellerDashboard({
  onSell,
  onStock,
  onActivity,
  onReports,
  onEndService,
}: SellerDashboardProps) {
  const { pharmacy, sellers, activeSellerId } = useAppStore()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [ending, setEnding] = useState(false)

  async function load() {
    if (!pharmacy || !activeSellerId) return
    setLoading(true)
    try {
      const res = await fetch(
        `/api/dashboard?pharmacyId=${pharmacy.id}&sellerId=${activeSellerId}`,
      )
      const json = await res.json()
      setData(json)
    } catch {
      toast.error('Erreur au chargement du tableau de bord')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
     
  }, [pharmacy?.id, activeSellerId])

  const seller = sellers.find((s) => s.id === activeSellerId)
  if (!pharmacy || !seller || !data) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    )
  }

  const sellerToday = data.today.seller ?? { salesCount: 0, revenue: 0, itemsSold: 0 }

  async function handleEnd() {
    setEnding(true)
    try {
      await onEndService()
    } finally {
      setEnding(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* Greeting */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl bg-gradient-to-br from-primary to-pharma-700 p-5 text-primary-foreground shadow-lg"
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest opacity-80">
              {data.pharmacy.name}
            </div>
            <h1 className="text-2xl font-extrabold">
              Bonjour {seller.name.split(' ')[0]} <span className="inline-block">👋</span>
            </h1>
          </div>
          {data.openSession && (
            <div className="flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold">
              <span className="h-2 w-2 animate-pulse rounded-full bg-green-300" />
              Service {data.openSession.startStr}
            </div>
          )}
        </div>

        {/* Today summary */}
        <div className="mt-5 grid grid-cols-3 gap-2">
          <SummaryStat label="Ventes du jour" value={formatFC(data.today.revenue)} highlight />
          <SummaryStat label="Ventes" value={String(data.today.salesCount)} />
          <SummaryStat label="Produits" value={String(data.today.itemsSold)} />
        </div>
      </motion.div>

      {/* My session today */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
            Mon service aujourd'hui
          </h2>
          <TrendingUp size={16} className="text-primary" />
        </div>
        <div className="grid grid-cols-3 gap-3 text-center">
          <Metric value={String(sellerToday.salesCount)} label="Ventes" />
          <Metric value={formatNumber(sellerToday.revenue) + ' FC'} label="Revenu" />
          <Metric value={String(sellerToday.itemsSold)} label="Articles" />
        </div>
      </div>

      {/* Action grid */}
      <div className="grid grid-cols-2 gap-3">
        <ActionCard
          onClick={onSell}
          icon={<Plus size={28} />}
          title="Vendre"
          subtitle="Nouvelle vente"
          variant="primary"
        />
        <ActionCard
          onClick={onStock}
          icon={<PackagePlus size={24} />}
          title="Entrée stock"
          subtitle="Ajouter au stock"
          variant="success"
        />
        <ActionCard
          onClick={onStock}
          icon={<PackageMinus size={24} />}
          title="Sortie stock"
          subtitle="Retirer du stock"
          variant="warning"
        />
        <ActionCard
          onClick={onStock}
          icon={<Boxes size={24} />}
          title="Mon stock"
          subtitle="Voir les produits"
          variant="neutral"
        />
        <ActionCard
          onClick={onActivity}
          icon={<ActivityIcon size={24} />}
          title="Mon activité"
          subtitle="Historique"
          variant="neutral"
        />
        <ActionCard
          onClick={onReports}
          icon={<FileText size={24} />}
          title="Mon rapport"
          subtitle="Télécharger / partager"
          variant="neutral"
        />
      </div>

      {/* Low stock warning */}
      {data.today.lowStock > 0 && (
        <button
          onClick={onStock}
          className="flex w-full items-center gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-left"
        >
          <AlertTriangle size={20} className="text-amber-600" />
          <div className="flex-1">
            <div className="text-sm font-bold text-amber-900">
              {data.today.lowStock} produit(s) en stock faible
            </div>
            <div className="text-xs text-amber-700">Touchez pour vérifier</div>
          </div>
        </button>
      )}

      {/* End service */}
      <button
        onClick={handleEnd}
        disabled={ending}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-primary/30 bg-primary/5 px-4 py-4 text-base font-bold text-primary transition-colors hover:bg-primary/10 disabled:opacity-50"
      >
        {ending ? <Loader2 size={20} className="animate-spin" /> : <Power size={20} />}
        Terminer mon service
      </button>
    </div>
  )
}

function SummaryStat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-2xl px-3 py-2.5 ${highlight ? 'bg-white/20' : 'bg-white/10'}`}>
      <div className="text-[10px] uppercase tracking-wider opacity-80">{label}</div>
      <div className="mt-0.5 text-sm font-bold leading-tight sm:text-base">{value}</div>
    </div>
  )
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl bg-muted/50 px-2 py-3">
      <div className="text-lg font-extrabold text-foreground">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  )
}

function ActionCard({
  onClick,
  icon,
  title,
  subtitle,
  variant,
}: {
  onClick: () => void
  icon: React.ReactNode
  title: string
  subtitle: string
  variant: 'primary' | 'success' | 'warning' | 'neutral'
}) {
  const palette = {
    primary: 'bg-primary text-primary-foreground shadow-md',
    success: 'bg-emerald-600 text-white',
    warning: 'bg-amber-500 text-white',
    neutral: 'bg-card text-foreground border border-border',
  }[variant]

  return (
    <button
      onClick={onClick}
      className={`group relative flex flex-col items-start gap-2 overflow-hidden rounded-2xl p-4 text-left transition-transform active:scale-[0.97] ${palette}`}
    >
      <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-white/15">
        {icon}
      </div>
      <div>
        <div className="text-base font-bold leading-tight">{title}</div>
        <div className="text-[11px] opacity-80">{subtitle}</div>
      </div>
    </button>
  )
}
