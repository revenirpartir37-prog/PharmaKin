'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import Image from 'next/image'
import {
  ArrowLeft,
  Boxes,
  CheckCircle2,
  Clock,
  Copy,
  FileText,
  ImagePlus,
  Loader2,
  PartyPopper,
  Receipt,
  ShieldCheck,
  ShoppingCart,
  X,
  Zap,
} from 'lucide-react'
import { toast } from 'sonner'

interface PaywallViewProps {
  pharmacyId: string
  pharmacyName: string
  onBack: () => void
  onPaymentSubmitted: () => void
}

const PRICE_FC = 5000
const DURATION_DAYS = 7
const MPESA_NUMBER = '0862719972'
const MPESA_RECIPIENT = 'CHRISPIN CIRHUZA'

export function PaywallView({
  pharmacyId,
  pharmacyName,
  onBack,
  onPaymentSubmitted,
}: PaywallViewProps) {
  const [screenshot, setScreenshot] = useState<File | null>(null)
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [signupCode, setSignupCode] = useState('')
  const [codeSubmitting, setCodeSubmitting] = useState(false)
  const [signupCodeAvailable, setSignupCodeAvailable] = useState(false)
  const [paymentReview, setPaymentReview] = useState<{
    status: string
    reviewMessage: string | null
  } | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/subscription/status?pharmacyId=${encodeURIComponent(pharmacyId)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error('Impossible de vérifier le statut du paiement')
        return res.json()
      })
      .then((data) => {
        if (!cancelled) {
          setSignupCodeAvailable(data.lastSubscription === null)
          if (data.paymentReview) setPaymentReview(data.paymentReview)
        }
      })
      .catch(() => {
        if (!cancelled) toast.error('Impossible de charger le statut de votre paiement')
      })
    return () => {
      cancelled = true
    }
  }, [pharmacyId])

  useEffect(() => {
    return () => {
      if (screenshotPreview) URL.revokeObjectURL(screenshotPreview)
    }
  }, [screenshotPreview])

  async function copyMpesaNumber() {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(MPESA_NUMBER)
      } else {
        const input = document.createElement('textarea')
        input.value = MPESA_NUMBER
        input.setAttribute('readonly', '')
        input.style.position = 'fixed'
        input.style.opacity = '0'
        document.body.appendChild(input)
        input.select()
        const copied = document.execCommand('copy')
        document.body.removeChild(input)
        if (!copied) throw new Error('Copie indisponible')
      }
      toast.success('Numéro M-Pesa copié')
    } catch {
      toast.error('Impossible de copier le numéro. Vous pouvez le recopier manuellement.')
    }
  }

  function handleScreenshotChange(file: File | undefined) {
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error('Choisissez une capture au format JPG, PNG ou WebP')
      return
    }
    if (screenshotPreview) URL.revokeObjectURL(screenshotPreview)
    setScreenshot(file)
    setScreenshotPreview(URL.createObjectURL(file))
  }

  async function handlePaymentSubmit() {
    if (!screenshot) {
      toast.error('Ajoutez la capture de votre paiement M-Pesa')
      return
    }
    setSubmitting(true)
    try {
      const formData = new FormData()
      formData.append('pharmacyId', pharmacyId)
      formData.append('screenshot', screenshot)
      const res = await fetch('/api/subscription/payment-request', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Impossible d’envoyer la capture')
      setPaymentReview({ status: 'pending_review', reviewMessage: null })
      toast.success('Capture envoyée. Validation en cours.')
      onPaymentSubmitted()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erreur lors de l’envoi')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSignupCodeSubmit() {
    if (!signupCode.trim()) {
      toast.error('Saisissez votre code de validation')
      return
    }
    setCodeSubmitting(true)
    try {
      const response = await fetch('/api/subscription/activate-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pharmacyId, code: signupCode.trim() }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Code de validation refusé')
      toast.success('Inscription validée. Votre accès de 7 jours est activé.')
      onPaymentSubmitted()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Impossible de valider ce code')
    } finally {
      setCodeSubmitting(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-3.5rem)] w-full max-w-md flex-col px-4 py-6">
      <button
        onClick={onBack}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft size={16} /> Retour
      </button>

      {paymentReview?.status === 'pending_review' && (
        <div className="mb-4 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          <div className="font-bold">Validation en cours</div>
          <p className="mt-1">Votre capture a été envoyée à l’administration. PharmaKin reste accessible pendant la vérification.</p>
        </div>
      )}
      {paymentReview?.status === 'rejected' && (
        <div className="mb-4 rounded-2xl border border-red-300 bg-red-50 p-4 text-sm text-red-950" role="alert">
          <div className="font-bold">Paiement refusé par l’administration</div>
          <p className="mt-1">{paymentReview.reviewMessage || 'Aucun motif n’a été communiqué.'}</p>
          <p className="mt-2">Vérifiez le transfert, puis envoyez une nouvelle capture après correction.</p>
        </div>
      )}

      {signupCodeAvailable && (
        <section className="mb-5 rounded-2xl border border-primary/20 bg-primary/5 p-4">
          <h2 className="font-bold">Vous avez un code de validation ?</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Le code fourni par PharmaKin active directement les 7 premiers jours.
          </p>
          <form
            className="mt-3 flex gap-2"
            onSubmit={(event) => {
              event.preventDefault()
              void handleSignupCodeSubmit()
            }}
          >
            <input
              aria-label="Code de validation pour l'inscription"
              autoComplete="off"
              maxLength={128}
              value={signupCode}
              onChange={(event) => setSignupCode(event.target.value)}
              placeholder="Code de validation"
              className="min-w-0 flex-1 rounded-xl border border-input bg-background px-3 py-2 text-sm uppercase outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
            />
            <button
              type="submit"
              disabled={codeSubmitting}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-3 text-sm font-bold text-primary-foreground disabled:opacity-60"
            >
              {codeSubmitting && <Loader2 size={16} className="animate-spin" />}
              Valider
            </button>
          </form>
        </section>
      )}

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
          <h1 className="text-2xl font-extrabold leading-tight">Débloquez PharmaKin</h1>
          <p className="mt-1 text-sm text-primary-foreground/80">{pharmacyName}</p>
          <div className="mt-5 flex items-end gap-2">
            <span className="text-5xl font-extrabold tracking-tight">{PRICE_FC.toLocaleString('fr-FR')}</span>
            <span className="mb-1 text-lg font-bold">FC</span>
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-sm text-primary-foreground/80">
            <Clock size={14} /> pour {DURATION_DAYS} jours d'accès
          </div>
        </div>
      </motion.div>

      <section className="mt-5 rounded-3xl border border-emerald-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div
            role="img"
            aria-label="M-PESA"
            className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-xl font-black italic tracking-tight"
          >
            <span className="text-red-600">M</span><span className="-ml-0.5 text-emerald-700">P</span>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
              Paiement Mobile Money
            </div>
            <h2 className="text-xl font-extrabold tracking-tight">
              <span className="text-red-600">M</span><span className="text-emerald-800">-PESA</span>
            </h2>
          </div>
        </div>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          Envoyez <strong className="text-foreground">{PRICE_FC.toLocaleString('fr-FR')} FC</strong> au numéro M-Pesa ci-dessous.
          Vérifiez le nom du bénéficiaire avant de confirmer le transfert.
        </p>
        <div className="mt-4 rounded-2xl bg-emerald-50 p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
            Numéro M-Pesa Vodacom
          </div>
          <div className="mt-1 flex items-center gap-2">
            <span className="flex-1 select-all text-2xl font-extrabold tracking-wider text-emerald-950">
              {MPESA_NUMBER}
            </span>
            <button
              type="button"
              onClick={copyMpesaNumber}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-700 px-3 text-sm font-bold text-white transition-colors hover:bg-emerald-800"
              aria-label="Copier le numéro M-Pesa"
            >
              <Copy size={16} /> Copier
            </button>
          </div>
          <div className="mt-2 text-sm font-semibold text-emerald-900">
            Nom du bénéficiaire : {MPESA_RECIPIENT}
          </div>
        </div>
        <ol className="mt-4 space-y-3 text-sm leading-relaxed text-foreground">
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-800">1</span>
            <span>Depuis votre téléphone, composez <strong>*1122#</strong> pour ouvrir le menu M-Pesa Vodacom.</span>
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-800">2</span>
            <span>Choisissez <strong>FC</strong>, puis <strong>Envoyer de l'argent</strong>. Depuis un autre opérateur, choisissez l'envoi vers un autre réseau et M-Pesa/Vodacom.</span>
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-800">3</span>
            <span>Saisissez le numéro copié, vérifiez que le nom affiché est <strong>{MPESA_RECIPIENT}</strong>, puis confirmez l'envoi de <strong>{PRICE_FC.toLocaleString('fr-FR')} FC</strong>.</span>
          </li>
        </ol>
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-xs leading-relaxed text-emerald-950">
          Vous pouvez aussi effectuer le transfert auprès d'un agent ou d'un shop M-Pesa. Depuis Airtel Money, Orange Money ou un autre opérateur, choisissez l'envoi vers M-Pesa/Vodacom et suivez les choix affichés par votre opérateur.
        </div>
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          Après le transfert, prenez une capture d'écran du reçu et envoyez-la à l'administration avec le bouton ci-dessous. Votre demande sera examinée avant validation définitive.
        </p>
        <div className="mt-4 rounded-2xl border border-border bg-card p-4">
          <label className="block text-sm font-bold text-foreground" htmlFor="mpesa-screenshot">
            Capture du reçu M-Pesa
          </label>
          <p className="mt-1 text-xs text-muted-foreground">Image JPG, PNG ou WebP, maximum 2 Mo.</p>
          <input
            id="mpesa-screenshot"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => handleScreenshotChange(event.target.files?.[0])}
            className="mt-3 block w-full text-sm text-muted-foreground file:mr-3 file:rounded-xl file:border-0 file:bg-emerald-100 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-emerald-900"
          />
          {screenshotPreview && (
            <div className="relative mt-3">
              <Image
                src={screenshotPreview}
                alt="Aperçu de la capture M-Pesa"
                width={800}
                height={800}
                unoptimized
                className="max-h-64 w-full rounded-xl border border-border bg-muted object-contain"
              />
              <button
                type="button"
                onClick={() => {
                  setScreenshot(null)
                  setScreenshotPreview(null)
                }}
                className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-background/90 text-foreground shadow"
                aria-label="Supprimer la capture"
              >
                <X size={18} />
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={handlePaymentSubmit}
            disabled={submitting || !screenshot}
            className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-4 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? <Loader2 size={18} className="animate-spin" /> : <ImagePlus size={18} />}
            {submitting ? 'Envoi en cours…' : 'Paiement effectué — envoyer la capture'}
          </button>
          {paymentReview?.status === 'pending_review' && (
            <p className="mt-3 text-center text-xs font-semibold text-amber-800">
              Validation en cours : vous pouvez renvoyer une capture plus lisible si nécessaire.
            </p>
          )}
        </div>
      </section>

      <div className="mt-5 space-y-2">
        <FeatureRow icon={<ShoppingCart size={18} />} label="Ventes illimitées avec factures PDF" />
        <FeatureRow icon={<Boxes size={18} />} label="Gestion complète du stock" />
        <FeatureRow icon={<Receipt size={18} />} label="Factures professionnelles HK-000001+" />
        <FeatureRow icon={<FileText size={18} />} label="Rapports de service PDF" />
        <FeatureRow icon={<Zap size={18} />} label="Activité par vendeur, illimitée" />
      </div>

      <div className="mt-auto pt-6 text-center">
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          L'abonnement validé est valable 7 jours. À l'expiration, payez à nouveau{' '}
          <strong className="text-foreground">{PRICE_FC.toLocaleString('fr-FR')} FC via M-Pesa</strong>,
          puis envoyez la capture à l'administration pour validation.
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
