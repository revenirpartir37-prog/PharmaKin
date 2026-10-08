'use client'

import { useEffect, useRef, useState } from 'react'
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
  Settings,
  Smartphone,
  Bell,
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

export type SellerTab = 'home' | 'sell' | 'stock' | 'activity' | 'reports' | 'settings'

interface SellerNotification {
  id: string
  title: string
  message: string
}

interface SellerAppProps {
  onExit: () => void
  onSubscriptionExpired?: () => void
  onManageSubscription?: () => void
}

/**
 * Top-level seller experience.
 * If no active seller selected -> show seller picker.
 * Otherwise show dashboard + bottom nav + tab views.
 * "Vendre" tab opens the SalesView which can navigate to InvoiceView after checkout.
 */
export function SellerApp({
  onExit,
  onSubscriptionExpired,
  onManageSubscription,
}: SellerAppProps) {
  const { pharmacy, sellers, activeSellerId, setActiveSeller, clearPharmacy } = useAppStore()
  const [tab, setTab] = useState<SellerTab>('home')
  const [view, setView] = useState<'tab' | 'invoice'>('tab')
  const [lastInvoice, setLastInvoice] = useState<SaleDTO | null>(null)
  const [sessionVersion, setSessionVersion] = useState(0) // bump to refresh dashboard
  const [subCheck, setSubCheck] = useState<'loading' | 'active' | 'pending' | 'rejected' | 'expired'>('loading')
  const [daysRemaining, setDaysRemaining] = useState<number | null>(null)
  const [subscriptionEndDate, setSubscriptionEndDate] = useState<string | null>(null)
  const [reviewMessage, setReviewMessage] = useState<string | null>(null)
  const [rejectionSeconds, setRejectionSeconds] = useState(5)
  const [notifications, setNotifications] = useState<SellerNotification[]>([])
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const redirectedToPayment = useRef(false)

  useEffect(() => {
    if (!pharmacy) return
    let cancelled = false
    let redirectTimer: number | undefined
    let notificationErrorShown = false
    const checkStatus = async () => {
      try {
        const res = await fetch(`/api/subscription/status?pharmacyId=${pharmacy.id}`)
        const data = await res.json()
        if (cancelled) return
        if (res.status === 401 || res.status === 403) {
          clearPharmacy()
          onExit()
          toast.error(data.error || 'Votre accès vendeur a été suspendu ou a expiré.')
          return
        }
        if (!res.ok) throw new Error(data.error || 'Impossible de vérifier votre abonnement')
        if (data.accessAllowed) {
          redirectedToPayment.current = false
          setSubCheck(data.active ? 'active' : 'pending')
          setDaysRemaining(data.daysRemaining ?? 0)
          setSubscriptionEndDate(data.subscription?.endDate ?? null)
          setReviewMessage(data.paymentReview?.reviewMessage ?? null)
        } else {
          setDaysRemaining(0)
          setSubscriptionEndDate(null)
          setReviewMessage(data.paymentReview?.reviewMessage ?? null)
          if (data.paymentReview?.status === 'rejected') {
            setSubCheck('rejected')
          } else {
            setSubCheck('expired')
          }
          if (!data.paymentReview?.status || data.paymentReview.status !== 'rejected') {
            if (redirectedToPayment.current) return
            redirectedToPayment.current = true
            redirectTimer = window.setTimeout(() => {
              if (!cancelled) onSubscriptionExpired?.()
            }, 100)
          }
        }
      } catch {
        if (!cancelled) setSubCheck('active') // be permissive on network error
      }
    }
    const checkNotifications = async () => {
      try {
        const response = await fetch(`/api/pharmacy/${pharmacy.id}/notifications`)
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Impossible de charger les notifications')
        if (!cancelled) {
          setNotifications(data.notifications ?? [])
          notificationErrorShown = false
        }
      } catch (error) {
        if (!cancelled && !notificationErrorShown) {
          notificationErrorShown = true
          toast.error(error instanceof Error ? error.message : 'Impossible de charger les notifications')
        }
      }
    }
    void checkStatus()
    void checkNotifications()
    const timer = window.setInterval(() => {
      void checkStatus()
      void checkNotifications()
    }, 20000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
      if (redirectTimer !== undefined) window.clearTimeout(redirectTimer)
    }
  }, [pharmacy?.id, onSubscriptionExpired, clearPharmacy, onExit])

  useEffect(() => {
    if (subCheck !== 'rejected') return
    const countdown = window.setInterval(() => {
      setRejectionSeconds((seconds) => Math.max(0, seconds - 1))
    }, 1000)
    const redirect = window.setTimeout(() => onSubscriptionExpired?.(), 5000)
    return () => {
      window.clearInterval(countdown)
      window.clearTimeout(redirect)
    }
  }, [subCheck, onSubscriptionExpired])

  async function leaveSellerSpace() {
    try {
      const response = await fetch('/api/auth/vendor/session', { method: 'DELETE' })
      if (!response.ok) throw new Error('Déconnexion impossible')
    } catch {
      if (navigator.onLine) toast.error('La session serveur n’a pas pu être fermée. Réessayez lorsque la connexion sera rétablie.')
    } finally {
      clearPharmacy()
      onExit()
    }
  }

  async function dismissNotification(notificationId: string) {
    if (!pharmacy) return
    try {
      const response = await fetch(`/api/pharmacy/${pharmacy.id}/notifications`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId }),
      })
      if (!response.ok && response.status !== 404) {
        const result = await response.json()
        throw new Error(result.error || 'Impossible de fermer la notification')
      }
      setNotifications((current) => current.filter((notification) => notification.id !== notificationId))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Impossible de fermer la notification')
    }
  }

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

  if (subCheck === 'rejected') {
    return (
      <div className="mx-auto flex min-h-[calc(100vh-3.5rem)] w-full max-w-3xl flex-col items-center justify-center px-5">
        <div className="w-full max-w-md rounded-3xl border border-red-300 bg-red-50 p-6 text-center text-red-950 shadow-sm" role="alert">
          <h1 className="text-xl font-extrabold">Paiement refusé</h1>
          <p className="mt-2 text-sm leading-relaxed">{reviewMessage || 'La capture du paiement n’a pas été validée.'}</p>
          <p className="mt-4 text-sm font-bold">
            Fermeture de l’espace vendeur dans {rejectionSeconds} seconde{rejectionSeconds > 1 ? 's' : ''}…
          </p>
        </div>
      </div>
    )
  }

  // Seller picker screen
  if (!activeSellerId) {
    return (
      <SellerPicker
        sellers={sellers}
        reviewPending={subCheck === 'pending'}
        notifications={notifications}
        onDismissNotification={(id) => void dismissNotification(id)}
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
        onExit={() => void leaveSellerSpace()}
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
          <button
            type="button"
            onClick={() => setNotificationsOpen((open) => !open)}
            aria-expanded={notificationsOpen}
            className="relative inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1.5 text-xs font-semibold hover:bg-accent"
          >
            <Bell size={15} /> Notifications
            {notifications.length > 0 && <span className="rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">{notifications.length}</span>}
          </button>
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
                  void leaveSellerSpace()
                }
              }}
              className="inline-flex items-center justify-center rounded-full border border-border bg-card p-1.5 text-muted-foreground hover:bg-accent"
              title="Quitter"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
        {notificationsOpen && (
          <NotificationList
            notifications={notifications}
            onDismiss={(id) => void dismissNotification(id)}
          />
        )}
        {subCheck === 'pending' && (
          <div className="mt-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-950" role="status">
            <strong>Validation du paiement en cours.</strong> PharmaKin reste accessible pendant la vérification de votre capture.
          </div>
        )}
        {reviewMessage && subCheck === 'active' && (
          <div className="mt-2 rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-950" role="alert">
            <strong>Un paiement a été refusé.</strong> {reviewMessage}
          </div>
        )}
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
              <InvoiceView
                sale={lastInvoice}
                pharmacy={pharmacy}
                seller={{ ...activeSeller, pharmacyId: pharmacy.id }}
              />
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
              {tab === 'settings' && (
                <SellerSettings
                  pharmacyName={pharmacy.name}
                  daysRemaining={daysRemaining ?? 0}
                  subscriptionEndDate={subscriptionEndDate}
                  onManageSubscription={onManageSubscription}
                />
              )}
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
          <TabButton active={tab === 'settings' && view === 'tab'} onClick={() => { setView('tab'); setTab('settings') }} icon={<Settings size={20} />} label="Paramètres" />
        </div>
        <div className="border-t border-border/50 px-4 py-1 text-center text-[10px] text-muted-foreground">
          Créé par <strong className="font-semibold text-foreground">HenoBuild Entreprise</strong> · PharmaKin
        </div>
      </nav>
    </div>
  )
}

function SellerSettings({
  pharmacyName,
  daysRemaining,
  subscriptionEndDate,
  onManageSubscription,
}: {
  pharmacyName: string
  daysRemaining: number
  subscriptionEndDate: string | null
  onManageSubscription?: () => void
}) {
  const expiryDate = subscriptionEndDate
    ? new Date(subscriptionEndDate).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Paramètres</h1>
        <p className="mt-1 text-sm text-muted-foreground">{pharmacyName}</p>
      </div>
      <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <CalendarClock size={22} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-bold">Abonnement PharmaKin</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {daysRemaining > 0
                ? `Actif · ${daysRemaining} jour${daysRemaining > 1 ? 's' : ''} restant${daysRemaining > 1 ? 's' : ''}`
                : 'Expiré · un renouvellement est nécessaire'}
            </p>
            {expiryDate && (
              <p className="mt-1 text-xs text-muted-foreground">Expire le {expiryDate}</p>
            )}
          </div>
        </div>
        <div className="mt-4 rounded-2xl bg-emerald-50 p-4 text-sm leading-relaxed text-emerald-950">
          Renouvelez pour <strong>5 000 FC / 7 jours</strong> avec M-Pesa Vodacom. Vous trouverez le numéro à copier et les étapes de paiement sur la page de renouvellement.
        </div>
        {onManageSubscription && (
          <button
            onClick={onManageSubscription}
            className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
          >
            <Smartphone size={18} />
            Payer / renouveler avec M-Pesa
          </button>
        )}
      </div>
    </section>
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
  reviewPending,
  notifications,
  onDismissNotification,
  onPick,
  onExit,
}: {
  sellers: { id: string; name: string; isPrimary: boolean }[]
  reviewPending: boolean
  notifications: SellerNotification[]
  onDismissNotification: (id: string) => void
  onPick: (id: string) => void
  onExit: () => void
}) {
  const { pharmacy } = useAppStore()
  return (
    <div className="mx-auto flex min-h-[calc(100vh-3.5rem)] w-full max-w-xl flex-col items-center justify-center px-4 py-8">
      <PharmaKinWordmark size={40} />
      {reviewPending && (
        <div className="mt-5 w-full rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-center text-sm text-amber-950" role="status">
          <strong>Validation du paiement en cours.</strong> L’espace vendeur est disponible pendant l’examen.
        </div>
      )}
      <NotificationList
        notifications={notifications}
        onDismiss={onDismissNotification}
      />
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

function NotificationList({
  notifications,
  onDismiss,
}: {
  notifications: SellerNotification[]
  onDismiss: (id: string) => void
}) {
  if (notifications.length === 0) {
    return <p className="mt-2 rounded-xl border border-border bg-card px-3 py-3 text-sm text-muted-foreground">Aucune nouvelle notification.</p>
  }
  return (
    <div className="space-y-2">
      {notifications.map((notification) => (
        <article
          key={notification.id}
          className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-left text-sm"
          role="status"
        >
          <div className="min-w-0 flex-1">
            <h2 className="font-bold">{notification.title}</h2>
            <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{notification.message}</p>
          </div>
          <button
            type="button"
            onClick={() => onDismiss(notification.id)}
            className="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-primary hover:bg-primary/10"
          >
            Lu
          </button>
        </article>
      ))}
    </div>
  )
}
