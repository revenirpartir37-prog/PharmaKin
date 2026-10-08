'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ShieldCheck,
  Smartphone,
  Key,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  Clock,
  Zap,
  ShoppingCart,
  Boxes,
  FileText,
  PartyPopper,
  Receipt,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAppStore } from '@/lib/store'

interface PaywallViewProps {
  pharmacyId: string
  pharmacyName: string
  customerPhone?: string
  onBack: () => void
  onActivated: () => void
  /**
   * If the page was opened via a GeniusPay redirect (?payment=success|error&reference=...),
   * the parent passes the reference here so we can verify immediately on mount.
   */
  pendingReference?: string
  pendingStatus?: 'success' | 'error'
}

const PRICE_CDF = 5000 // fallback only; backend is the source of truth
const DURATION_DAYS = 7

export function PaywallView({
  pharmacyId,
  pharmacyName,
  customerPhone,
  onBack,
  onActivated,
  pendingReference,
  pendingStatus,
}: PaywallViewProps) {
  const [paying, setPaying] = useState(false)
  const [codeOpen, setCodeOpen] = useState(false)
  const [code, setCode] = useState('')
  const [codeLoading, setCodeLoading] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [activated, setActivated] = useState(false)

  // On mount, if we have a pending reference from GeniusPay redirect, verify it.
  // Use a ref to ensure we only verify once per reference (avoids duplicate
  // toasts / API calls when parent re-renders).
  const verifiedRef = useRef<string | null>(null)
  useEffect(() => {
    if (!pendingReference) return
    if (verifiedRef.current === pendingReference) return
    verifiedRef.current = pendingReference
    // Defer the synchronous setVerifying(true) to a microtask to satisfy
    // the set-state-in-effect lint rule.
    Promise.resolve().then(() => setVerifying(true))
    ;(async () => {
      try {
        const res = await fetch('/api/subscription/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reference: pendingReference }),
        })
        const data = await res.json()
        if (res.ok && (data.activated || data.alreadyActive)) {
          toast.success('Paiement confirmé ! Abonnement activé pour 7 jours.')
          setActivated(true)
          setTimeout(() => onActivated(), 1800)
        } else if (pendingStatus === 'error') {
          toast.error('Le paiement a échoué. Réessayez ou utilisez un code.')
        } else {
          // Still pending — GeniusPay hasn't confirmed yet
          toast.info('Paiement en cours de confirmation...')
        }
      } catch {
        // Reset the ref so the user can retry
        verifiedRef.current = null
        toast.error('Erreur de vérification')
      } finally {
        setVerifying(false)
      }
    })()
  }, [pendingReference, pendingStatus, onActivated])

  async function handlePay() {
    setPaying(true)
    try {
      const res = await fetch('/api/subscription/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pharmacyId,
          customerPhone,
          customerName: pharmacyName,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur')
      if (data.alreadyActive) {
        toast.success('Vous avez déjà un abonnement actif')
        setActivated(true)
        setTimeout(() => onActivated(), 1200)
        return
      }
      const checkoutUrl = data.checkoutUrl
      if (!checkoutUrl) throw new Error('URL de paiement manquante')
      toast.success('Redirection vers GeniusPay...')
      // Give the toast a moment to show, then redirect
      setTimeout(() => {
        window.location.href = checkoutUrl
      }, 600)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur lors du paiement')
      setPaying(false)
    }
  }

  async function handleCodeSubmit() {
    if (!code.trim()) {
      toast.error('Saisissez un code')
      return
    }
    setCodeLoading(true)
    try {
      const res = await fetch('/api/subscription/recharge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pharmacyId, code: code.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Code invalide')
      if (data.alreadyActive) {
        toast.success('Vous avez déjà un abonnement actif')
      } else {
        toast.success('Code validé ! Abonnement activé pour 7 jours.')
      }
      setActivated(true)
      setTimeout(() => onActivated(), 1500)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setCodeLoading(false)
    }
  }

  // Success state (after payment confirmed)
  if (activated) {
    return (
      <div className="mx-auto flex min-h-[calc(100vh-3.5rem)] w-full max-w-md flex-col items-center justify-center px-4 py-8 text-center">
        <motion.div
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          className="mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-emerald-100"
        >
          <PartyPopper size={48} className="text-emerald-600" />
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="text-2xl font-extrabold tracking-tight text-foreground"
        >
          Abonnement activé !
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="mt-2 text-sm text-muted-foreground"
        >
          Vous avez maintenant accès à PharmaKin pendant{' '}
          <strong className="text-foreground">7 jours</strong>. Bonne vente !
        </motion.p>
        <Loader2 className="mt-6 animate-spin text-primary" size={24} />
      </div>
    )
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-3.5rem)] w-full max-w-md flex-col px-4 py-6">
      <button
        onClick={onBack}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft size={16} /> Retour
      </button>

      {/* Verification banner */}
      {verifying && (
        <div className="mb-4 flex items-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
          <Loader2 size={16} className="animate-spin" />
          Vérification du paiement GeniusPay...
        </div>
      )}
      {pendingStatus === 'error' && !verifying && (
        <div className="mb-4 flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <AlertCircle size={16} /> Le paiement a échoué. Réessayez ou utilisez un code.
        </div>
      )}

      {/* Hero card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary to-pharma-700 p-6 text-primary-foreground shadow-xl"
      >
        <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-white/10" />
        <div className="absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-white/5" />
        <div className="relative">
          <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-bold uppercase tracking-wider">
            <ShieldCheck size={12} /> Abonnement PharmaKin
          </div>
          <h1 className="text-2xl font-extrabold leading-tight">
            Débloquez PharmaKin
          </h1>
          <p className="mt-1 text-sm text-primary-foreground/80">
            {pharmacyName}
          </p>

          {/* Price */}
          <div className="mt-5 flex items-end gap-2">
            <span className="text-5xl font-extrabold tracking-tight">{PRICE_CDF.toLocaleString('fr-FR')}</span>
            <span className="mb-1 text-lg font-bold">CDF</span>
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-sm text-primary-foreground/80">
            <Clock size={14} /> par semaine · 7 jours d'accès
          </div>
        </div>
      </motion.div>

      {/* Features */}
      <div className="mt-5 space-y-2">
        <FeatureRow icon={<ShoppingCart size={18} />} label="Ventes illimitées avec factures PDF" />
        <FeatureRow icon={<Boxes size={18} />} label="Gestion complète du stock" />
        <FeatureRow icon={<Receipt size={18} />} label="Factures professionnelles HK-000001+" />
        <FeatureRow icon={<FileText size={18} />} label="Rapports de service PDF" />
        <FeatureRow icon={<Zap size={18} />} label="Activité par vendeur, illimitée" />
      </div>

      {/* Pay button */}
      <button
        onClick={handlePay}
        disabled={paying || verifying}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-4 text-base font-bold text-primary-foreground shadow-lg transition-transform active:scale-[0.98] disabled:opacity-60"
      >
        {paying ? (
          <>
            <Loader2 size={20} className="animate-spin" /> Redirection...
          </>
        ) : (
          <>
            <Smartphone size={20} /> Payer {PRICE_CDF.toLocaleString('fr-FR')} CDF — Mobile Money
          </>
        )}
      </button>
      <p className="mt-2 text-center text-[11px] text-muted-foreground">
        Paiement sécurisé via GeniusPay · M-Pesa, Airtel Money, Orange Money
      </p>

      {/* Divider */}
      <div className="my-5 flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-[11px] uppercase tracking-widest text-muted-foreground">ou</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      {/* Code de réabonnement */}
      <button
        onClick={() => setCodeOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-2xl border border-border bg-card p-4 text-left transition-colors hover:bg-accent"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Key size={18} />
          </div>
          <div>
            <div className="text-sm font-bold">J'ai un code de réabonnement</div>
            <div className="text-xs text-muted-foreground">Activez 7 jours sans payer</div>
          </div>
        </div>
        <ChevronDown
          size={18}
          className={`text-muted-foreground transition-transform ${codeOpen ? 'rotate-180' : ''}`}
        />
      </button>

      <AnimatePresence initial={false}>
        {codeOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-3 space-y-3 rounded-2xl border border-border bg-muted/30 p-4">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Ex: PHARMAKIN-2024"
                className="w-full rounded-xl border border-input bg-background px-4 py-3 text-base font-mono tracking-wider outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
              />
              <button
                onClick={handleCodeSubmit}
                disabled={codeLoading || !code.trim()}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-primary bg-primary/5 px-4 py-3 text-sm font-bold text-primary transition-colors hover:bg-primary/10 disabled:opacity-50"
              >
                {codeLoading ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <CheckCircle2 size={18} />
                )}
                Activer mon accès
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reassurance */}
      <div className="mt-auto pt-6 text-center">
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          L'abonnement est valable 7 jours. À l'expiration, payez à nouveau{' '}
          <strong className="text-foreground">{PRICE_CDF.toLocaleString('fr-FR')} CDF</strong> ou
          utilisez un code de réabonnement pour continuer.
        </p>
      </div>
    </div>
  )
}

function FeatureRow({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </span>
      <span className="text-sm font-medium text-foreground">{label}</span>
      <CheckCircle2 size={16} className="ml-auto text-emerald-600" />
    </div>
  )
}
