'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, MapPin, User, Users, UserCheck, Building2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { PharmaKinLogo } from './Brand'
import { useAppStore } from '@/lib/store'
import { todayStr, timeStr } from '@/lib/format'
import type { PharmacyDTO, SellerDTO } from '@/lib/types'

interface OnboardingProps {
  onBack: () => void
  onDone: (pharmacy: PharmacyDTO, sellers: SellerDTO[]) => void
}

type Mode = 'alone' | 'two'

export function SellerOnboarding({ onBack, onDone }: OnboardingProps) {
  const [step, setStep] = useState<0 | 1 | 2 | 3>(0)
  const [pharmacyName, setPharmacyName] = useState('')
  const [sellerName, setSellerName] = useState('')
  const [phone, setPhone] = useState('')
  const [mode, setMode] = useState<Mode | null>(null)
  const [secondSeller, setSecondSeller] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [locating, setLocating] = useState(false)

  function pickLocation() {
    if (!navigator.geolocation) {
      toast.error('La géolocalisation nest pas disponible sur cet appareil')
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setLocating(false)
        toast.success('Position captée — vous pourrez la confirmer.')
      },
      () => {
        setLocating(false)
        toast.error('Impossible dobtenir votre position. Réessayez.')
      },
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  async function submit() {
    if (!pharmacyName.trim() || !sellerName.trim()) {
      toast.error('Veuillez renseigner le nom de la pharmacie et le vôtre')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/pharmacy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: pharmacyName.trim(),
          phone: phone.trim() || undefined,
          latitude: location?.lat ?? null,
          longitude: location?.lng ?? null,
          sellerName: sellerName.trim(),
          secondSellerName: mode === 'two' ? secondSeller.trim() : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur')
      const pharmacy = data.pharmacy as PharmacyDTO
      const sellers = (pharmacy as { sellers?: SellerDTO[] }).sellers ?? []
      toast.success('Pharmacie configurée avec succès !')
      onDone(pharmacy, sellers)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur lors de la création')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-3.5rem)] w-full max-w-xl flex-col px-4 py-6">
      <button
        onClick={onBack}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft size={16} /> Retour
      </button>

      <div className="mb-6 flex items-center gap-3">
        <PharmaKinLogo size={40} />
        <div>
          <h1 className="text-xl font-extrabold tracking-tight">Configuration initiale</h1>
          <p className="text-xs text-muted-foreground">Créez votre espace, puis activez-le par M-Pesa</p>
        </div>
      </div>

      {/* Progress dots */}
      <div className="mb-6 flex items-center gap-1.5">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              i <= step ? 'bg-primary' : 'bg-muted'
            }`}
          />
        ))}
      </div>

      <motion.div
        key={step}
        initial={{ opacity: 0, x: 12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.25 }}
        className="flex flex-1 flex-col"
      >
        {step === 0 && (
          <section className="space-y-4">
            <div className="flex items-center gap-2 text-primary">
              <Building2 size={20} />
              <h2 className="text-lg font-bold">Votre pharmacie</h2>
            </div>
            <Field label="Nom de la pharmacie" placeholder="Ex: Pharmacie Grâce" value={pharmacyName} onChange={setPharmacyName} autoFocus />
            <Field label="Téléphone (facultatif)" placeholder="+243 ..." value={phone} onChange={setPhone} inputMode="tel" />
            <button
              onClick={pickLocation}
              className="flex w-full items-center gap-2 rounded-2xl border border-border bg-card p-3 text-left transition-colors hover:bg-accent"
            >
              <MapPin size={18} className={locating ? 'animate-pulse text-primary' : 'text-primary'} />
              <div className="flex-1">
                <div className="text-sm font-semibold">Position de la pharmacie</div>
                {locating ? (
                  <div className="text-xs text-muted-foreground">Localisation en cours…</div>
                ) : location ? (
                  <div className="text-xs text-primary font-medium">
                    Captée: {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground">
                    Rendez votre pharmacie visible par les clients (facultatif)
                  </div>
                )}
              </div>
            </button>
            <NavRow onNext={() => setStep(1)} nextLabel="Continuer" disabled={!pharmacyName.trim()} />
          </section>
        )}

        {step === 1 && (
          <section className="space-y-4">
            <div className="flex items-center gap-2 text-primary">
              <User size={20} />
              <h2 className="text-lg font-bold">Votre nom</h2>
            </div>
            <Field label="Votre nom" placeholder="Ex: Jean" value={sellerName} onChange={setSellerName} autoFocus />
            <NavRow onBack={() => setStep(0)} onNext={() => setStep(2)} nextLabel="Continuer" disabled={!sellerName.trim()} />
          </section>
        )}

        {step === 2 && (
          <section className="space-y-4">
            <div className="flex items-center gap-2 text-primary">
              <Users size={20} />
              <h2 className="text-lg font-bold">Travaillez-vous seul ?</h2>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <ChoiceCard
                active={mode === 'alone'}
                onClick={() => setMode('alone')}
                icon={<User size={28} />}
                title="Je suis seul"
                subtitle="Un seul vendeur"
              />
              <ChoiceCard
                active={mode === 'two'}
                onClick={() => setMode('two')}
                icon={<Users size={28} />}
                title="Nous sommes deux"
                subtitle="Deux vendeurs"
              />
            </div>
            <NavRow onBack={() => setStep(1)} onNext={() => setStep(3)} nextLabel="Continuer" disabled={!mode} />
          </section>
        )}

        {step === 3 && (
          <section className="space-y-4">
            <div className="flex items-center gap-2 text-primary">
              <UserCheck size={20} />
              <h2 className="text-lg font-bold">
                {mode === 'two' ? 'Nom du deuxième vendeur' : 'Récapitulatif'}
              </h2>
            </div>
            {mode === 'two' && (
              <Field
                label="Nom du deuxième vendeur"
                placeholder="Ex: Patrick"
                value={secondSeller}
                onChange={setSecondSeller}
                autoFocus
              />
            )}
            <div className="rounded-2xl border border-border bg-muted/30 p-4 text-sm">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Récapitulatif
              </div>
              <Row label="Pharmacie" value={pharmacyName} />
              <Row label="Vendeur principal" value={sellerName} />
              {mode === 'two' && secondSeller && <Row label="Deuxième vendeur" value={secondSeller} />}
              <Row label="Organisation" value={mode === 'two' ? 'Deux vendeurs' : 'Seul'} />
              {location && <Row label="Position" value="Captée" />}
            </div>
            <button
              onClick={submit}
              disabled={submitting || (mode === 'two' && !secondSeller.trim())}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-4 text-base font-bold text-primary-foreground shadow-md transition-transform active:scale-[0.98] disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <>
                  Continuer vers le paiement M-Pesa
                  <ArrowRight size={18} />
                </>
              )}
            </button>
            <button
              onClick={() => setStep(2)}
              className="w-full text-center text-sm text-muted-foreground hover:text-foreground"
            >
              Retour
            </button>
          </section>
        )}
      </motion.div>
    </div>
  )
}

function Field({
  label,
  placeholder,
  value,
  onChange,
  autoFocus,
  inputMode,
}: {
  label: string
  placeholder: string
  value: string
  onChange: (v: string) => void
  autoFocus?: boolean
  inputMode?: 'text' | 'tel' | 'numeric'
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-foreground">{label}</span>
      <input
        autoFocus={autoFocus}
        inputMode={inputMode}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-input bg-background px-4 py-3.5 text-base outline-none ring-offset-2 transition-colors focus:border-primary focus:ring-2 focus:ring-primary/30"
      />
    </label>
  )
}

function NavRow({
  onBack,
  onNext,
  nextLabel,
  disabled,
}: {
  onBack?: () => void
  onNext: () => void
  nextLabel: string
  disabled?: boolean
}) {
  return (
    <div className="flex gap-2 pt-2">
      {onBack && (
        <button
          onClick={onBack}
          className="rounded-2xl border border-border bg-card px-4 py-3 text-sm font-semibold hover:bg-accent"
        >
          Retour
        </button>
      )}
      <button
        onClick={onNext}
        disabled={disabled}
        className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-sm disabled:opacity-50"
      >
        {nextLabel}
        <ArrowRight size={16} />
      </button>
    </div>
  )
}

function ChoiceCard({
  active,
  onClick,
  icon,
  title,
  subtitle,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  title: string
  subtitle: string
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-2 rounded-2xl border-2 p-5 text-center transition-all ${
        active
          ? 'border-primary bg-primary/5 shadow-sm'
          : 'border-border bg-card hover:bg-accent'
      }`}
    >
      <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${active ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'}`}>
        {icon}
      </div>
      <div className="text-base font-bold">{title}</div>
      <div className="text-xs text-muted-foreground">{subtitle}</div>
    </button>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold">{value}</span>
    </div>
  )
}
