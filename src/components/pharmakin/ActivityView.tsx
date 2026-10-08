'use client'

import { useEffect, useState } from 'react'
import {
  Activity as ActivityIcon,
  Loader2,
  PlayCircle,
  StopCircle,
  ShoppingCart,
  PackagePlus,
  PackageMinus,
  Package,
  Clock,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAppStore } from '@/lib/store'
import type { ActivityDTO } from '@/lib/types'

export function ActivityView() {
  const { pharmacy, activeSellerId, sellers } = useAppStore()
  const [activities, setActivities] = useState<ActivityDTO[]>([])
  const [loading, setLoading] = useState(true)

  const seller = sellers.find((s) => s.id === activeSellerId)

  async function load() {
    if (!pharmacy || !activeSellerId) return
    setLoading(true)
    try {
      const res = await fetch(
        `/api/activities?pharmacyId=${pharmacy.id}&sellerId=${activeSellerId}&limit=500`,
      )
      const json = await res.json()
      setActivities(json.activities as ActivityDTO[])
    } catch {
      toast.error('Erreur au chargement de lactivité')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
     
  }, [pharmacy?.id, activeSellerId])

  // Group by date (reverse-chronological)
  const groups = groupByDate(activities)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <ActivityIcon size={22} className="text-primary" />
        <div>
          <h1 className="text-xl font-extrabold tracking-tight">Mon activité</h1>
          {seller && (
            <p className="text-xs text-muted-foreground">Historique de {seller.name}</p>
          )}
        </div>
      </div>

      {loading && (
        <div className="flex h-32 items-center justify-center">
          <Loader2 className="animate-spin text-primary" size={28} />
        </div>
      )}

      {!loading && activities.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center">
          <ActivityIcon size={32} className="mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm font-semibold">Aucune activité enregistrée</p>
          <p className="text-xs text-muted-foreground">Vos opérations apparaîtront ici</p>
        </div>
      )}

      {!loading &&
        groups.map(([date, items]) => (
          <div key={date} className="space-y-2">
            <div className="sticky top-0 z-10 bg-background/95 py-1 text-xs font-bold uppercase tracking-wider text-muted-foreground backdrop-blur">
              {date}
            </div>
            <div className="relative space-y-1.5 border-l-2 border-primary/20 pl-4">
              {items.map((a) => (
                <ActivityRow key={a.id} a={a} />
              ))}
            </div>
          </div>
        ))}
    </div>
  )
}

function ActivityRow({ a }: { a: ActivityDTO }) {
  const icon = iconFor(a.type)
  const tone = toneFor(a.type)
  return (
    <div className="relative">
      <span
        className={`absolute -left-[1.32rem] top-3 flex h-3 w-3 items-center justify-center rounded-full border-2 border-background ${tone.dot}`}
      />
      <div className="flex items-start gap-2 rounded-xl border border-border bg-card p-2.5">
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${tone.bg} ${tone.fg}`}>
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold leading-tight">{a.description}</div>
          <div className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
            <Clock size={11} /> {a.timeStr}
          </div>
        </div>
      </div>
    </div>
  )
}

function iconFor(type: string) {
  switch (type) {
    case 'SERVICE_START':
      return <PlayCircle size={18} />
    case 'SERVICE_END':
      return <StopCircle size={18} />
    case 'SALE':
      return <ShoppingCart size={18} />
    case 'STOCK_ENTRY':
      return <PackagePlus size={18} />
    case 'STOCK_EXIT':
      return <PackageMinus size={18} />
    case 'PRODUCT_ADD':
      return <Package size={18} />
    default:
      return <ActivityIcon size={18} />
  }
}

function toneFor(type: string) {
  switch (type) {
    case 'SERVICE_START':
      return { dot: 'bg-emerald-500', bg: 'bg-emerald-50', fg: 'text-emerald-600' }
    case 'SERVICE_END':
      return { dot: 'bg-amber-500', bg: 'bg-amber-50', fg: 'text-amber-600' }
    case 'SALE':
      return { dot: 'bg-primary', bg: 'bg-primary/10', fg: 'text-primary' }
    case 'STOCK_ENTRY':
      return { dot: 'bg-blue-500', bg: 'bg-blue-50', fg: 'text-blue-600' }
    case 'STOCK_EXIT':
      return { dot: 'bg-amber-500', bg: 'bg-amber-50', fg: 'text-amber-600' }
    case 'PRODUCT_ADD':
      return { dot: 'bg-purple-500', bg: 'bg-purple-50', fg: 'text-purple-600' }
    default:
      return { dot: 'bg-muted-foreground', bg: 'bg-muted', fg: 'text-muted-foreground' }
  }
}

function groupByDate(items: ActivityDTO[]): [string, ActivityDTO[]][] {
  const map = new Map<string, ActivityDTO[]>()
  for (const a of items) {
    const arr = map.get(a.dateStr) ?? []
    arr.push(a)
    map.set(a.dateStr, arr)
  }
  // Preserve insertion order (which is reverse-chronological from API)
  return Array.from(map.entries())
}
