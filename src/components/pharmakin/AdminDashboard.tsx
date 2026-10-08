'use client'

import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import {
  Building2,
  Bell,
  Ban,
  Check,
  Clock3,
  Gift,
  LogOut,
  Loader2,
  KeyRound,
  RefreshCw,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react'
import { toast } from 'sonner'

interface AdminRequest {
  id: string
  pharmacyId: string
  amount: number
  currency: string
  createdAt: string
  updatedAt: string
  screenshotData: string | null
  pharmacy: { name: string; phone: string | null; address: string | null }
}

interface AdminPharmacy {
  id: string
  name: string
  phone: string | null
  email: string | null
  suspended: boolean
  createdAt: string
  revenue: number
  approvedPayments: number
  subscriptionStatus: 'active' | 'pending_review' | 'rejected' | 'expired' | 'unpaid' | 'suspended'
  daysRemaining: number
  endDate: string | null
}

interface DashboardData {
  requests: AdminRequest[]
  pharmacies: AdminPharmacy[]
  totalRevenue: number
  pendingCount: number
  activeCount: number
  unpaidCount: number
  expiringSoonCount: number
}

interface AdminDashboardProps {
  onExit: () => void
}

function formatMoney(amount: number) {
  return `${amount.toLocaleString('fr-FR')} FC`
}

export function AdminDashboard({ onExit }: AdminDashboardProps) {
  const [authenticated, setAuthenticated] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)
  const [password, setPassword] = useState('')
  const [loggingIn, setLoggingIn] = useState(false)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<DashboardData | null>(null)
  const [decisionId, setDecisionId] = useState<string | null>(null)
  const [rejectionMessages, setRejectionMessages] = useState<Record<string, string>>({})
  const [grantAll, setGrantAll] = useState(false)
  const [grantPharmacyIds, setGrantPharmacyIds] = useState<string[]>([])
  const [grantWeeks, setGrantWeeks] = useState(1)
  const [granting, setGranting] = useState(false)
  const [notifyAll, setNotifyAll] = useState(true)
  const [notifyPharmacyIds, setNotifyPharmacyIds] = useState<string[]>([])
  const [notificationTitle, setNotificationTitle] = useState('')
  const [notificationMessage, setNotificationMessage] = useState('')
  const [sendingNotification, setSendingNotification] = useState(false)
  const [pharmacyActionId, setPharmacyActionId] = useState<string | null>(null)

  const loadDashboard = useCallback(async (showErrors = true) => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/subscriptions')
      const result = await response.json()
      if (response.status === 401) {
        setAuthenticated(false)
        setData(null)
        return
      }
      if (!response.ok) throw new Error(result.error || 'Erreur de chargement')
      setData(result as DashboardData)
    } catch (error) {
      if (showErrors) {
        toast.error(error instanceof Error ? error.message : 'Impossible de charger le tableau')
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    fetch('/api/admin/session')
      .then((response) => response.json())
      .then((result) => {
        if (!cancelled) setAuthenticated(result.authenticated === true)
      })
      .catch(() => {
        if (!cancelled) toast.error('Impossible de vérifier la session administrateur')
      })
      .finally(() => {
        if (!cancelled) setCheckingSession(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!authenticated) return
    const initialLoad = window.setTimeout(() => void loadDashboard(false), 0)
    const timer = window.setInterval(() => void loadDashboard(false), 20000)
    return () => {
      window.clearTimeout(initialLoad)
      window.clearInterval(timer)
    }
  }, [authenticated, loadDashboard])

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoggingIn(true)
    try {
      const response = await fetch('/api/admin/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Connexion refusée')
      setPassword('')
      setAuthenticated(true)
      toast.success('Connexion administrateur réussie')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Connexion impossible')
    } finally {
      setLoggingIn(false)
    }
  }

  async function reviewRequest(subscriptionId: string, decision: 'approve' | 'reject') {
    const message = rejectionMessages[subscriptionId]?.trim() ?? ''
    if (decision === 'reject' && !message) {
      toast.error('Indiquez le motif du refus pour prévenir la pharmacie')
      return
    }
    setDecisionId(subscriptionId)
    try {
      const response = await fetch('/api/admin/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscriptionId,
          decision,
          ...(decision === 'reject' ? { message } : {}),
        }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Impossible de traiter la demande')
      toast.success(decision === 'approve' ? 'Paiement validé, abonnement activé' : 'Demande refusée, motif transmis')
      await loadDashboard()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erreur de validation')
    } finally {
      setDecisionId(null)
    }
  }

  async function grantWeeksToPharmacies() {
    if (!data) return
    const pharmacyIds = grantAll ? [] : grantPharmacyIds
    if (!grantAll && pharmacyIds.length === 0) {
      toast.error('Sélectionnez au moins une pharmacie')
      return
    }
    setGranting(true)
    try {
      const response = await fetch('/api/admin/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'grant',
          sendToAll: grantAll,
          pharmacyIds,
          weeks: grantWeeks,
        }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Impossible d’offrir ces semaines')
      toast.success(`${result.granted} pharmacie(s) ont reçu ${grantWeeks} semaine(s) offerte(s)`)
      setGrantPharmacyIds([])
      await loadDashboard()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erreur lors de l’offre')
    } finally {
      setGranting(false)
    }
  }

  async function managePharmacy(pharmacy: AdminPharmacy, action: 'delete' | 'suspend' | 'unsuspend' | 'cancel' | 'renew' | 'reset-password') {
    const confirmation = action === 'delete'
      ? `Supprimer définitivement ${pharmacy.name} et ses données (ventes, stock et historique) ? Cette action est irréversible.`
      : action === 'cancel'
        ? `Annuler l’abonnement actif de ${pharmacy.name} ?`
        : action === 'suspend'
          ? `Suspendre l’accès de ${pharmacy.name} ?`
          : action === 'renew'
            ? `Accorder un renouvellement gratuit de 7 jours à ${pharmacy.name} ?`
            : null
    if (confirmation && !window.confirm(confirmation)) return
    const email = action === 'reset-password' && !pharmacy.email
      ? window.prompt(`Cette pharmacie n’a pas encore d’e-mail de connexion. Saisissez l’e-mail du compte pour ${pharmacy.name} :`)?.trim()
      : undefined
    if (action === 'reset-password' && !pharmacy.email && !email) return
    setPharmacyActionId(pharmacy.id)
    try {
      const response = await fetch('/api/admin/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, pharmacyId: pharmacy.id, ...(email ? { email } : {}) }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Action impossible')
      if (action === 'reset-password') {
        window.alert(`Mot de passe temporaire pour ${pharmacy.email || pharmacy.name} :\n\n${result.temporaryPassword}\n\nCommuniquez-le de manière privée. La pharmacie pourra ensuite utiliser « Mot de passe oublié » pour le changer.`)
      } else {
        toast.success(action === 'delete' ? 'Pharmacie supprimée' : action === 'renew' ? 'Abonnement renouvelé' : action === 'cancel' ? 'Abonnement annulé' : action === 'suspend' ? 'Pharmacie suspendue' : 'Pharmacie réactivée')
      }
      await loadDashboard()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Action impossible')
    } finally {
      setPharmacyActionId(null)
    }
  }

  async function sendNotification(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!notifyAll && notifyPharmacyIds.length === 0) {
      toast.error('Sélectionnez au moins une pharmacie')
      return
    }
    setSendingNotification(true)
    try {
      const response = await fetch('/api/admin/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sendToAll: notifyAll,
          pharmacyIds: notifyPharmacyIds,
          title: notificationTitle,
          message: notificationMessage,
        }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Impossible d’envoyer le message')
      toast.success(`Notification envoyée à ${result.sent} pharmacie(s)`)
      setNotificationTitle('')
      setNotificationMessage('')
      setNotifyPharmacyIds([])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erreur lors de l’envoi')
    } finally {
      setSendingNotification(false)
    }
  }

  async function logout() {
    try {
      const response = await fetch('/api/admin/session', { method: 'DELETE' })
      if (!response.ok) throw new Error('Déconnexion impossible')
      setAuthenticated(false)
      setData(null)
      toast.success('Session administrateur fermée')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erreur de déconnexion')
    }
  }

  if (checkingSession) {
    return <CenteredLoader label="Vérification de la session…" />
  }

  if (!authenticated) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-5 py-10">
        <button onClick={onExit} className="mb-8 self-start text-sm font-semibold text-muted-foreground hover:text-foreground">
          ← Retour à PharmaKin
        </button>
        <div className="rounded-3xl border border-border bg-card p-6 shadow-xl">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <ShieldCheck size={28} />
          </div>
          <h1 className="mt-5 text-2xl font-extrabold">Espace administration</h1>
          <p className="mt-1 text-sm text-muted-foreground">Connexion réservée à l’administrateur.</p>
          <form onSubmit={handleLogin} className="mt-6 space-y-4">
            <label className="block text-sm font-semibold" htmlFor="admin-password">
              Mot de passe administrateur
            </label>
            <input
              id="admin-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              className="w-full rounded-xl border border-input bg-background px-4 py-3 outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
            />
            <button
              type="submit"
              disabled={loggingIn}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-bold text-primary-foreground disabled:opacity-60"
            >
              {loggingIn && <Loader2 size={18} className="animate-spin" />}
              Se connecter
            </button>
          </form>
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-4 py-6 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">Administration PharmaKin</p>
          <h1 className="mt-1 text-2xl font-extrabold sm:text-3xl">Bonjour PDG Henock Aduma</h1>
          <p className="mt-1 text-sm text-muted-foreground">Suivi des pharmacies, paiements et validations M-Pesa.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => void loadDashboard()}
            disabled={loading}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border bg-card px-3 text-sm font-semibold hover:bg-accent disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Actualiser
          </button>
          <button
            onClick={() => void logout()}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border bg-card px-3 text-sm font-semibold hover:bg-accent"
          >
            <LogOut size={16} /> Déconnexion
          </button>
        </div>
      </header>

      {!data ? (
        <div className="mt-12"><CenteredLoader label="Chargement du tableau administrateur…" /></div>
      ) : (
        <>
          <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <MetricCard label="Revenus abonnements validés" value={formatMoney(data.totalRevenue)} />
            <MetricCard label="Pharmacies enregistrées" value={String(data.pharmacies.length)} />
            <MetricCard label="Paiements à vérifier" value={String(data.pendingCount)} highlight />
            <MetricCard label="Abonnements actifs" value={String(data.activeCount)} />
            <MetricCard label="Sans accès payé / expiré" value={String(data.unpaidCount)} />
            <MetricCard label="Expirent sous 3 jours" value={String(data.expiringSoonCount)} highlight={data.expiringSoonCount > 0} />
          </section>

          <section className="mt-8">
            <div className="mb-4 flex items-center gap-2">
              <Clock3 size={20} className="text-amber-600" />
              <h2 className="text-xl font-extrabold">Paiements en attente</h2>
            </div>
            {data.requests.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
                Aucune capture à examiner pour le moment.
              </div>
            ) : (
              <div className="space-y-4">
                {data.requests.map((item) => (
                  <article key={item.id} className="grid gap-4 rounded-2xl border border-border bg-card p-4 sm:grid-cols-[minmax(0,1fr)_minmax(220px,0.8fr)]">
                    <div>
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <h3 className="text-lg font-bold">{item.pharmacy.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {item.pharmacy.phone || 'Téléphone non renseigné'}
                            {item.pharmacy.address ? ` · ${item.pharmacy.address}` : ''}
                          </p>
                        </div>
                        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">
                          {formatMoney(item.amount)} · M-Pesa
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Envoyé le {new Date(item.updatedAt).toLocaleString('fr-FR')}
                      </p>
                      <label className="mt-4 block text-sm font-semibold" htmlFor={`reject-${item.id}`}>
                        Motif à transmettre en cas de refus
                      </label>
                      <textarea
                        id={`reject-${item.id}`}
                        value={rejectionMessages[item.id] ?? ''}
                        onChange={(event) => setRejectionMessages((current) => ({
                          ...current,
                          [item.id]: event.target.value,
                        }))}
                        rows={2}
                        maxLength={500}
                        placeholder="Ex. montant incorrect ou reçu illisible"
                        className="mt-1 w-full resize-y rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                      />
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          onClick={() => void reviewRequest(item.id, 'approve')}
                          disabled={decisionId !== null}
                          className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-emerald-700 px-4 text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-50"
                        >
                          {decisionId === item.id ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                          Valider le paiement
                        </button>
                        <button
                          onClick={() => void reviewRequest(item.id, 'reject')}
                          disabled={decisionId !== null}
                          className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-red-300 bg-red-50 px-4 text-sm font-bold text-red-800 hover:bg-red-100 disabled:opacity-50"
                        >
                          <X size={16} /> Refuser et notifier
                        </button>
                      </div>
                    </div>
                    {item.screenshotData ? (
                      <a
                        href={item.screenshotData}
                        target="_blank"
                        rel="noreferrer"
                        className="block overflow-hidden rounded-xl border border-border bg-muted"
                        aria-label={`Ouvrir la capture de ${item.pharmacy.name}`}
                      >
                        <Image
                          src={item.screenshotData}
                          alt={`Capture du paiement M-Pesa de ${item.pharmacy.name}`}
                          width={800}
                          height={800}
                          unoptimized
                          className="max-h-80 w-full object-contain"
                        />
                      </a>
                    ) : (
                      <div className="flex min-h-32 items-center justify-center rounded-xl bg-muted text-sm text-muted-foreground">
                        Aucune capture jointe
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="mt-8">
            <div className="mb-4 flex items-center gap-2">
              <Building2 size={20} className="text-primary" />
              <h2 className="text-xl font-extrabold">Pharmacies et abonnements</h2>
            </div>
            {data.pharmacies.length === 0 ? (
              <p className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">Aucune pharmacie enregistrée.</p>
            ) : (
              <div className="space-y-2">
                {data.pharmacies.map((pharmacy) => (
                  <article key={pharmacy.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4">
                    <div className="min-w-52">
                      <h3 className="font-bold">{pharmacy.name}</h3>
                      <p className="text-xs text-muted-foreground">{pharmacy.email || 'E-mail non renseigné'} · {pharmacy.phone || 'Téléphone non renseigné'}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {pharmacy.approvedPayments} paiement(s) M-Pesa approuvé(s)
                        {pharmacy.endDate ? ` · Fin : ${new Date(pharmacy.endDate).toLocaleDateString('fr-FR')}` : ''}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ${subscriptionStatusStyle(pharmacy.subscriptionStatus)}`}>
                        {subscriptionStatusLabel(pharmacy.subscriptionStatus)}
                        {pharmacy.subscriptionStatus === 'active' ? ` · ${pharmacy.daysRemaining} j` : ''}
                      </span>
                      <div className="text-right">
                        <div className="font-extrabold text-emerald-800">{formatMoney(pharmacy.revenue)}</div>
                        <div className="text-[11px] text-muted-foreground">Revenu M-Pesa confirmé</div>
                      </div>
                    </div>
                    <div className="flex w-full flex-wrap gap-2 border-t border-border pt-3">
                      <button disabled={pharmacyActionId !== null} onClick={() => void managePharmacy(pharmacy, pharmacy.suspended ? 'unsuspend' : 'suspend')} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-amber-300 px-3 text-xs font-bold text-amber-800 disabled:opacity-50">
                        <Ban size={14} /> {pharmacy.suspended ? 'Réactiver' : 'Suspendre'}
                      </button>
                      <button disabled={pharmacyActionId !== null} onClick={() => void managePharmacy(pharmacy, 'cancel')} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-bold disabled:opacity-50">
                        <X size={14} /> Annuler abonnement
                      </button>
                      <button disabled={pharmacyActionId !== null} onClick={() => void managePharmacy(pharmacy, 'renew')} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-emerald-300 px-3 text-xs font-bold text-emerald-800 disabled:opacity-50">
                        <RefreshCw size={14} /> Renouveler 7 jours
                      </button>
                      <button disabled={pharmacyActionId !== null} onClick={() => void managePharmacy(pharmacy, 'reset-password')} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-bold disabled:opacity-50">
                        <KeyRound size={14} /> Réinitialiser mot de passe
                      </button>
                      <button disabled={pharmacyActionId !== null} onClick={() => void managePharmacy(pharmacy, 'delete')} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-red-300 px-3 text-xs font-bold text-red-700 disabled:opacity-50">
                        <Trash2 size={14} /> Supprimer
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="mt-8 rounded-2xl border border-border bg-card p-4 sm:p-5">
            <div className="mb-4 flex items-center gap-2">
              <Gift size={20} className="text-primary" />
              <h2 className="text-xl font-extrabold">Offrir des semaines gratuites</h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
              <PharmacyMultiSelect
                pharmacies={data.pharmacies}
                selectAll={grantAll}
                onSelectAll={setGrantAll}
                selectedIds={grantPharmacyIds}
                onSelectedIdsChange={setGrantPharmacyIds}
              />
              <div className="flex flex-col gap-3 sm:w-52">
                <label className="text-sm font-semibold">
                  Durée offerte
                  <select
                    value={grantWeeks}
                    onChange={(event) => setGrantWeeks(Number(event.target.value))}
                    className="mt-1 block min-h-11 w-full rounded-xl border border-input bg-background px-3"
                  >
                    {[1, 2, 3, 4, 8, 12, 26, 52].map((weeks) => (
                      <option key={weeks} value={weeks}>{weeks} semaine(s)</option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  onClick={() => void grantWeeksToPharmacies()}
                  disabled={granting}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-50"
                >
                  {granting && <Loader2 size={16} className="animate-spin" />}
                  Offrir l’accès
                </button>
              </div>
            </div>
          </section>

          <section className="mt-8 rounded-2xl border border-border bg-card p-4 sm:p-5">
            <div className="mb-4 flex items-center gap-2">
              <Bell size={20} className="text-primary" />
              <h2 className="text-xl font-extrabold">Envoyer une notification</h2>
            </div>
            <form onSubmit={sendNotification} className="space-y-4">
              <PharmacyMultiSelect
                pharmacies={data.pharmacies}
                selectAll={notifyAll}
                onSelectAll={setNotifyAll}
                selectedIds={notifyPharmacyIds}
                onSelectedIdsChange={setNotifyPharmacyIds}
              />
              <label className="block text-sm font-semibold">
                Titre
                <input
                  required
                  maxLength={100}
                  value={notificationTitle}
                  onChange={(event) => setNotificationTitle(event.target.value)}
                  className="mt-1 block min-h-11 w-full rounded-xl border border-input bg-background px-3"
                />
              </label>
              <label className="block text-sm font-semibold">
                Message
                <textarea
                  required
                  maxLength={1000}
                  rows={3}
                  value={notificationMessage}
                  onChange={(event) => setNotificationMessage(event.target.value)}
                  className="mt-1 block w-full rounded-xl border border-input bg-background px-3 py-2"
                />
              </label>
              <button
                type="submit"
                disabled={sendingNotification}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-50"
              >
                {sendingNotification && <Loader2 size={16} className="animate-spin" />}
                Envoyer dans l’application
              </button>
            </form>
          </section>
        </>
      )}
    </main>
  )
}

function subscriptionStatusLabel(status: AdminPharmacy['subscriptionStatus']) {
  const labels = {
    active: 'Actif',
    pending_review: 'Paiement en validation',
    rejected: 'Paiement refusé',
    expired: 'Expiré',
    unpaid: 'Aucun paiement',
    suspended: 'Pharmacie suspendue',
  }
  return labels[status]
}

function subscriptionStatusStyle(status: AdminPharmacy['subscriptionStatus']) {
  const styles = {
    active: 'bg-emerald-100 text-emerald-800',
    pending_review: 'bg-amber-100 text-amber-900',
    rejected: 'bg-red-100 text-red-800',
    expired: 'bg-orange-100 text-orange-800',
    unpaid: 'bg-muted text-muted-foreground',
    suspended: 'bg-red-200 text-red-900',
  }
  return styles[status]
}

function PharmacyMultiSelect({
  pharmacies,
  selectAll,
  onSelectAll,
  selectedIds,
  onSelectedIdsChange,
}: {
  pharmacies: AdminPharmacy[]
  selectAll: boolean
  onSelectAll: (value: boolean) => void
  selectedIds: string[]
  onSelectedIdsChange: (ids: string[]) => void
}) {
  return (
    <div className="min-w-0">
      <label className="flex min-h-10 items-center gap-2 text-sm font-semibold">
        <input
          type="checkbox"
          checked={selectAll}
          onChange={(event) => onSelectAll(event.target.checked)}
          className="h-4 w-4 accent-primary"
        />
        Toutes les pharmacies
      </label>
      {!selectAll && (
        <div className="mt-2 max-h-44 space-y-1 overflow-y-auto rounded-xl border border-border p-2">
          {pharmacies.map((pharmacy) => (
            <label key={pharmacy.id} className="flex min-h-9 items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={selectedIds.includes(pharmacy.id)}
                onChange={(event) => onSelectedIdsChange(
                  event.target.checked
                    ? [...selectedIds, pharmacy.id]
                    : selectedIds.filter((id) => id !== pharmacy.id),
                )}
                className="h-4 w-4 accent-primary"
              />
              <span className="truncate">{pharmacy.name}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

function MetricCard({
  label,
  value,
  highlight,
}: {
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div className={`rounded-2xl border p-4 ${highlight ? 'border-amber-300 bg-amber-50' : 'border-border bg-card'}`}>
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-2 text-2xl font-extrabold">{value}</div>
    </div>
  )
}

function CenteredLoader({ label }: { label: string }) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center">
      <Loader2 className="animate-spin text-primary" size={28} />
      <p className="mt-3 text-sm text-muted-foreground">{label}</p>
    </div>
  )
}
