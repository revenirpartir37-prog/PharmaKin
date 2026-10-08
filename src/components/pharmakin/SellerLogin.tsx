'use client'

import { useState } from 'react'
import { ArrowLeft, Loader2, LockKeyhole, Mail } from 'lucide-react'
import { toast } from 'sonner'
import type { PharmacyDTO, SellerDTO } from '@/lib/types'

interface SellerLoginProps {
  onBack: () => void
  onAuthenticated: (pharmacy: PharmacyDTO, sellers: SellerDTO[]) => void
}

export function SellerLogin({ onBack, onAuthenticated }: SellerLoginProps) {
  const [mode, setMode] = useState<'login' | 'request-reset' | 'reset'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)

  async function login(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    try {
      const response = await fetch('/api/auth/vendor/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Connexion impossible')
      const pharmacyResponse = await fetch(`/api/pharmacy/${result.pharmacy.id}`)
      const pharmacyResult = await pharmacyResponse.json()
      if (!pharmacyResponse.ok) throw new Error(pharmacyResult.error || 'Impossible de charger la pharmacie')
      onAuthenticated(pharmacyResult.pharmacy as PharmacyDTO, pharmacyResult.pharmacy.sellers as SellerDTO[])
      toast.success('Connexion réussie')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Connexion impossible')
    } finally {
      setBusy(false)
    }
  }

  async function requestReset(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    try {
      const response = await fetch('/api/auth/vendor/password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'request', email }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Impossible d’envoyer le code')
      setMode('reset')
      toast.success(result.message || 'Vérifiez votre boîte e-mail')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Impossible d’envoyer le code')
    } finally {
      setBusy(false)
    }
  }

  async function resetPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    try {
      const response = await fetch('/api/auth/vendor/password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset', email, code, password }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Réinitialisation impossible')
      setMode('login')
      setCode('')
      setPassword('')
      toast.success('Mot de passe modifié. Connectez-vous avec le nouveau.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Réinitialisation impossible')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-[calc(100vh-3.5rem)] w-full max-w-md flex-col justify-center px-5 py-10">
      <button onClick={onBack} className="mb-7 self-start inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground">
        <ArrowLeft size={16} /> Retour à l’accueil
      </button>
      <section className="rounded-3xl border border-border bg-card p-6 shadow-xl">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          {mode === 'login' ? <LockKeyhole size={26} /> : <Mail size={26} />}
        </div>
        <h1 className="mt-5 text-2xl font-extrabold">
          {mode === 'login' ? 'Connexion vendeur' : mode === 'request-reset' ? 'Mot de passe oublié' : 'Vérifier le code'}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {mode === 'login'
            ? 'Connectez-vous avec l’e-mail de votre pharmacie.'
            : 'Un code à 6 chiffres valable 10 minutes sera envoyé à votre adresse.'}
        </p>
        {mode === 'login' ? (
          <form onSubmit={login} className="mt-6 space-y-4">
            <label className="block text-sm font-semibold">E-mail
              <input type="email" required autoComplete="username" maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1.5 w-full rounded-xl border border-input bg-background px-4 py-3 outline-none focus:border-primary focus:ring-2 focus:ring-primary/30" />
            </label>
            <label className="block text-sm font-semibold">Mot de passe
              <input type="password" required autoComplete="current-password" maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1.5 w-full rounded-xl border border-input bg-background px-4 py-3 outline-none focus:border-primary focus:ring-2 focus:ring-primary/30" />
            </label>
            <button disabled={busy} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-bold text-primary-foreground disabled:opacity-60">
              {busy && <Loader2 size={18} className="animate-spin" />} Se connecter
            </button>
            <button type="button" onClick={() => setMode('request-reset')} className="w-full text-sm font-semibold text-primary hover:underline">Mot de passe oublié ?</button>
          </form>
        ) : mode === 'request-reset' ? (
          <form onSubmit={requestReset} className="mt-6 space-y-4">
            <label className="block text-sm font-semibold">E-mail du compte
              <input type="email" required autoComplete="email" maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1.5 w-full rounded-xl border border-input bg-background px-4 py-3 outline-none focus:border-primary focus:ring-2 focus:ring-primary/30" />
            </label>
            <button disabled={busy} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-bold text-primary-foreground disabled:opacity-60">
              {busy && <Loader2 size={18} className="animate-spin" />} Envoyer le code
            </button>
            <button type="button" onClick={() => setMode('login')} className="w-full text-sm font-semibold text-muted-foreground">Retour à la connexion</button>
          </form>
        ) : (
          <form onSubmit={resetPassword} className="mt-6 space-y-4">
            <label className="block text-sm font-semibold">Code reçu par e-mail
              <input inputMode="numeric" pattern="[0-9]{6}" required maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} className="mt-1.5 w-full rounded-xl border border-input bg-background px-4 py-3 text-center text-xl tracking-[0.4em] outline-none focus:border-primary focus:ring-2 focus:ring-primary/30" />
            </label>
            <label className="block text-sm font-semibold">Nouveau mot de passe
              <input type="password" required minLength={10} maxLength={128} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1.5 w-full rounded-xl border border-input bg-background px-4 py-3 outline-none focus:border-primary focus:ring-2 focus:ring-primary/30" />
            </label>
            <button disabled={busy} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-bold text-primary-foreground disabled:opacity-60">
              {busy && <Loader2 size={18} className="animate-spin" />} Réinitialiser le mot de passe
            </button>
            <button type="button" onClick={() => setMode('request-reset')} className="w-full text-sm font-semibold text-muted-foreground">Renvoyer un code</button>
          </form>
        )}
      </section>
    </main>
  )
}
