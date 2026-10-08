'use client'

import { motion } from 'framer-motion'
import { HeartPulse, MapPin, User, ShieldCheck, Zap, Receipt, PackageOpen } from 'lucide-react'
import { PharmaKinLogo } from './Brand'

interface HomeProps {
  onSelectSeller: () => void
  onSelectClient: () => void
  hasPharmacy: boolean
  onContinueSeller: () => void
  onSellerLogin: () => void
}

export function Home({
  onSelectSeller,
  onSelectClient,
  hasPharmacy,
  onContinueSeller,
  onSellerLogin,
}: HomeProps) {
  return (
    <div className="mx-auto flex min-h-[calc(100vh-3.5rem)] w-full max-w-3xl flex-col items-center justify-center px-4 py-8">
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-6 flex flex-col items-center text-center"
      >
        <PharmaKinLogo size={64} className="mb-4" />
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
          PharmaKin
        </h1>
        <p className="mt-2 max-w-md text-sm text-muted-foreground sm:text-base">
          L'application simple et rapide pour gérer une pharmacie à Kinshasa
          et trouver les pharmacies à proximité.
        </p>
      </motion.div>

      {/* Two big choices */}
      <div className="grid w-full gap-4 sm:grid-cols-2">
        <motion.button
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.35, delay: 0.05 }}
          onClick={hasPharmacy ? onContinueSeller : onSelectSeller}
          className="group relative flex min-h-[220px] flex-col items-start justify-between overflow-hidden rounded-3xl bg-primary p-6 text-left text-primary-foreground shadow-lg transition-transform active:scale-[0.98] sm:min-h-[260px]"
        >
          <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10" />
          <div className="absolute -bottom-10 -left-6 h-24 w-24 rounded-full bg-white/5" />
          <div className="relative">
            <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm">
              <HeartPulse size={32} />
            </div>
            <div className="text-2xl font-extrabold leading-tight">
              Je suis vendeur
            </div>
            <p className="mt-1 text-sm text-primary-foreground/80">
              {hasPharmacy
                ? 'Reprendre votre activité'
                : 'Gérer stock, ventes, factures et rapports'}
            </p>
          </div>
          <div className="relative mt-6 inline-flex items-center gap-1 text-sm font-semibold">
            <User size={16} />
            {hasPharmacy ? 'Continuer' : 'Démarrer'}
            <span aria-hidden className="transition-transform group-hover:translate-x-1">→</span>
          </div>
        </motion.button>

        <motion.button
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.35, delay: 0.1 }}
          onClick={onSelectClient}
          className="group relative flex min-h-[220px] flex-col items-start justify-between overflow-hidden rounded-3xl border-2 border-primary/20 bg-card p-6 text-left shadow-sm transition-transform active:scale-[0.98] sm:min-h-[260px]"
        >
          <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary/5" />
          <div className="relative">
            <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <MapPin size={32} />
            </div>
            <div className="text-2xl font-extrabold leading-tight text-foreground">
              Je suis client
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Trouver les pharmacies à proximité sans inscription
            </p>
          </div>
          <div className="relative mt-6 inline-flex items-center gap-1 text-sm font-semibold text-primary">
            <MapPin size={16} />
            Trouver
            <span aria-hidden className="transition-transform group-hover:translate-x-1">→</span>
          </div>
        </motion.button>
      </div>

      <button
        type="button"
        onClick={onSellerLogin}
        className="mt-4 rounded-lg px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/5"
      >
        Déjà un compte pharmacie ? Se connecter
      </button>

      {/* Features strip */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15 }}
        className="mt-8 grid w-full grid-cols-2 gap-3 sm:grid-cols-4"
      >
        <Feature icon={<Zap size={18} />} label="Simple & rapide" />
        <Feature icon={<PackageOpen size={18} />} label="Stock en temps réel" />
        <Feature icon={<Receipt size={18} />} label="Factures PDF" />
        <Feature icon={<ShieldCheck size={18} />} label="Historique vendeur" />
      </motion.div>
    </div>
  )
}

function Feature({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-border bg-card px-3 py-2.5">
      <span className="text-primary">{icon}</span>
      <span className="text-xs font-medium text-foreground">{label}</span>
    </div>
  )
}
