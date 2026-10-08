'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Home as HomeIcon,
  ShoppingCart,
  Boxes,
  Activity as ActivityIcon,
  FileText,
  LogOut,
  Power,
  ArrowLeft,
  CalendarClock,
  Loader2,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAppStore } from '@/lib/store'
import { PharmaKinWordmark } from './Brand'
import { SellerDashboard } from './SellerDashboard'
import { StockView } from './StockView'
import { SalesView } from './SalesView'
import { ActivityView } from './ActivityView'
import { ReportView } from './ReportView'
import { InvoiceView } from './InvoiceView'
import type { SaleDTO } from '@/lib/types'

export type SellerTab = 'home' | 'sell' | 'stock' | 'activity' | 'reports'

interface SellerAppProps {
  onExit: () => void
  onSubscriptionExpired?: () => void
}

/**
 * Top-level seller experience.
 * If no active seller selected -> show seller picker.
 * Otherwise show dashboard + bottom nav + tab views.
 * "Vendre" tab opens the SalesView which can navigate to InvoiceView after checkout.
 */
export function SellerApp({ onExit, onSubscriptionExpired }: SellerAppProps) {
  const { pharmacy, sellers, activeSellerId, setActiveSeller, clearPharmacy } = useAppStore()
  const [tab, setTab] = useState<SellerTab>('home')
  const [view, setView] = useState<'tab' | 'invoice'>('tab')
  const [lastInvoice, setLastInvoice] = useState<SaleDTO | null>(null)
  const [sessionVersion, setSessionVersion] = useState(0) // bump to refresh dashboard
  const [subCheck, setSubCheck] = useState<'loading' | 'active' | 'expired'>('loading')
  const [daysRemaining, setDaysRemaining] = useState<number | null>(null)

  // Check subscription status on mount and on pharmacy change.
  // If expired, redirect to the paywall.
  useEffect(() => {
    if (!pharmacy) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/subscription/status?pharmacyId=${pharmacy.id}`)
        const data = await res.json()
        if (cancelled) return
        if (data.active) {
          setSubCheck('active')
          setDaysRemaining(data.daysRemaining ?? 0)
        } else {
          setSubCheck('expired')
          // Defer to allow the toast / state to settle
          setTimeout(() => {
            if (onSubscriptionExpired) onSubscriptionExpired()
          }, 100)
        }
      } catch {
        if (!cancelled) setSubCheck('active') // be permissive on network error
      }
    })()
    return () => {
      cancelled = true
    }
  }, [pharmacy?.id, onSubscriptionExpired])

  // If no pharmacy at all (shouldn't happen here) bail out
  if (!pharmacy) {
    return null
  }

  // While checking subscription, show a small loader (avoids a flash of
  // the seller app or picker before being bounced to the paywall).
  if (subCheck === 'loading') {
    return (
      <div className="mx-auto flex min-h-[calc(100vh-3.5rem)] w-full max-w-3xl flex-col items-center justify-center px-4">
        <Loader2 className="animate-spin text-primary" size={32} />
        <p className="mt-3 text-sm text-muted-foreground">Vérification de l'abonnement…</p>
      </div>
    )
  }

  // Subscription expired — we should not even render the picker. The effect
  // above will call onSubscriptionExpired; render a tiny placeholder.
  if (subCheck === 'expired') {
    return (
      <div className="mx-auto flex min-h-[calc(100vh-3.5rem)] w-full max-w-3xl flex-col items-center justify-center px-4">
        <Loader2 className="animate-spin text-primary" size={32} />
        <p className="mt-3 text-sm text-muted-foreground">Redirection vers le paiement…</p>
      </div>
    )
  }

  // Seller picker screen
  if (!activeSellerId) {
    return (
      <SellerPicker
        sellers={sellers}
        onPick={async (sellerId) => {
          setActiveSeller(sellerId)
          // Start a new service session
          try {
            const res = await fetch('/api/sessions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                pharmacyId: pharmacy.id,
                sellerId,
              }),
            })
            if (!res.ok) throw new Error('Erreur')
            const data = await res.json()
            useAppStore.getState().setActiveSession(data.session.id)
            toast.success(`Service démarré`)
            setSessionVersion((v) => v + 1)
            setTab('home')
          } catch {
            toast.error('Erreur au démarrage du service')
          }
        }}
        onExit={onExit}
      />
    )
  }

  const activeSeller = sellers.find((s) => s.id === activeSellerId)!

  async function endService() {
    const sessionId = useAppStore.getState().activeSessionId
    if (!sessionId) {
      toast.error('Aucun service en cours')
      return
    }
    try {
      const res = await fetch(`/api/sessions/${sessionId}/end`, { method: 'POST' })
      if (!res.ok) throw new Error('Erreur')
      const data = await res.json()
      toast.success('Service terminé')
      useAppStore.getState().setActiveSession(null)
      // Switch to reports tab and show the just-ended report
      setTab('reports')
      // Store the ended session id in a transient state for ReportView to show
      ;(window as unknown as { _lastSessionId?: string })._lastSessionId = sessionId
      setSessionVersion((v) => v + 1)
      return data
    } catch {
      toast.error('Erreur à la fin du service')
    }
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-3.5rem)] w-full max-w-3xl flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between">
          <PharmaKinWordmark size={32} />
          <div className="flex items-center gap-2">
            <span className="hidden rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary sm:inline">
              {pharmacy.name}
            </span>
            {/* Subscription badge */}
            {subCheck === 'active' && daysRemaining != null && (
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                  daysRemaining <= 1
                    ? 'bg-red-100 text-red-700'
                    : daysRemaining <= 3
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-emerald-100 text-emerald-700'
                }`}
                title={`Abonnement actif — ${daysRemaining} jour(s) restant(s)`}
              >
                <CalendarClock size={12} /> {daysRemaining}j
              </span>
            )}
            <button
              onClick={() => {
                if (confirm('Terminer votre service et changer de vendeur ?')) {
                  endService()
                }
              }}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-accent"
              title="Changer de vendeur"
            >
              <Power size={14} /> {activeSeller.name.split(' ')[0]}
            </button>
            <button
              onClick={() => {
                if (confirm('Quitter lespace vendeur ?')) {
                  clearPharmacy()
                  onExit()
                }
              }}
              className="inline-flex items-center justify-center rounded-full border border-border bg-card p-1.5 text-muted-foreground hover:bg-accent"
              title="Quitter"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 px-4 py-4 pb-36">
        <AnimatePresence mode="wait">
          {view === 'invoice' && lastInvoice ? (
            <motion.div
              key="invoice"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <button
                onClick={() => {
                  setView('tab')
                  setTab('home')
                }}
                className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft size={16} /> Retour au tableau de bord
              </button>
              <InvoiceView sale={lastInvoice} pharmacy={pharmacy} seller={activeSeller} />
            </motion.div>
          ) : (
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
            >
              {tab === 'home' && (
                <SellerDashboard
                  key={`home-${sessionVersion}`}
                  onSell={() => setTab('sell')}
                  onStock={() => setTab('stock')}
                  onActivity={() => setTab('activity')}
                  onReports={() => setTab('reports')}
                  onEndService={endService}
                />
              )}
              {tab === 'sell' && (
                <SalesView
                  onCheckoutDone={(sale) => {
                    setLastInvoice(sale)
                    setView('invoice')
                    setSessionVersion((v) => v + 1)
                  }}
                />
              )}
              {tab === 'stock' && <StockView onChanged={() => setSessionVersion((v) => v + 1)} />}
              {tab === 'activity' && <ActivityView />}
              {tab === 'reports' && <ReportView />}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Bottom navigation (mobile-first) */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-stretch">
          <TabButton active={tab === 'home' && view === 'tab'} onClick={() => { setView('tab'); setTab('home') }} icon={<HomeIcon size={20} />} label="Accueil" />
          <TabButton active={tab === 'sell' && view === 'tab'} onClick={() => { setView('tab'); setTab('sell') }} icon={<ShoppingCart size={20} />} label="Vendre" highlight />
          <TabButton active={tab === 'stock' && view === 'tab'} onClick={() => { setView('tab'); setTab('stock') }} icon={<Boxes size={20} />} label="Stock" />
          <TabButton active={tab === 'activity' && view === 'tab'} onClick={() => { setView('tab'); setTab('activity') }} icon={<ActivityIcon size={20} />} label="Activité" />
          <TabButton active={tab === 'reports' && view === 'tab'} onClick={() => { setView('tab'); setTab('reports') }} icon={<FileText size={20} />} label="Rapports" />
        </div>
        <div className="border-t border-border/50 px-4 py-1 text-center text-[10px] text-muted-foreground">
          Créé par <strong className="font-semibold text-foreground">HenoBuild Entreprise</strong> · PharmaKin
        </div>
      </nav>
    </div>
  )
}

function TabButton({
  active,
  onClick,
  icon,
  label,
  highlight,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
  highlight?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={`relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2.5 text-[11px] font-medium transition-colors ${
        active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
      }`}
    >
      {highlight && (
        <div className={`absolute -top-3 flex h-12 w-12 items-center justify-center rounded-full ${active ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-primary'} shadow-md transition-all`}>
          {icon}
        </div>
      )}
      {!highlight && icon}
      <span className={highlight ? 'mt-7' : ''}>{label}</span>
      {active && !highlight && (
        <motion.div
          layoutId="tab-indicator"
          className="absolute bottom-0 h-0.5 w-8 rounded-full bg-primary"
        />
      )}
    </button>
  )
}

function SellerPicker({
  sellers,
  onPick,
  onExit,
}: {
  sellers: { id: string; name: string; isPrimary: boolean }[]
  onPick: (id: string) => void
  onExit: () => void
}) {
  const { pharmacy } = useAppStore()
  return (
    <div className="mx-auto flex min-h-[calc(100vh-3.5rem)] w-full max-w-xl flex-col items-center justify-center px-4 py-8">
      <PharmaKinWordmark size={40} />
      <h1 className="mt-6 text-2xl font-extrabold tracking-tight">Qui commence ?</h1>
      <p className="mt-1 text-sm text-muted-foreground text-center">
        {pharmacy?.name} — Sélectionnez votre profil pour démarrer votre service
      </p>

      <div className="mt-8 grid w-full gap-3">
        {sellers.map((s) => (
          <button
            key={s.id}
            onClick={() => onPick(s.id)}
            className="flex items-center gap-3 rounded-2xl border-2 border-border bg-card p-4 text-left transition-all hover:border-primary hover:bg-primary/5"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground">
              {s.name[0]?.toUpperCase() ?? '?'}
            </div>
            <div className="flex-1">
              <div className="text-base font-bold">{s.name}</div>
              <div className="text-xs text-muted-foreground">
                {s.isPrimary ? 'Vendeur principal' : 'Vendeur'}
              </div>
            </div>
            <Power size={20} className="text-primary" />
          </button>
        ))}
      </div>

      <button
        onClick={onExit}
        className="mt-8 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft size={16} /> Retour à laccueil
      </button>
    </div>
  )
}
