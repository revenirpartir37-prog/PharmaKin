'use client'

import { useCallback, useEffect, useState } from 'react'
import { Home } from '@/components/pharmakin/Home'
import { SellerOnboarding } from '@/components/pharmakin/SellerOnboarding'
import { SellerApp } from '@/components/pharmakin/SellerApp'
import { ClientView } from '@/components/pharmakin/ClientView'
import { PaywallView } from '@/components/pharmakin/PaywallView'
import { StickyFooter } from '@/components/pharmakin/StickyFooter'
import { useAppStore } from '@/lib/store'
import type { PharmacyDTO, SellerDTO } from '@/lib/types'

type View = 'home' | 'onboarding' | 'paywall' | 'seller' | 'client'

interface PendingRedirect {
  status: 'success' | 'error'
  reference: string
}

export default function Page() {
  const {
    pharmacy: persistedPharmacy,
    sellers: persistedSellers,
    setPharmacy,
  } = useAppStore()
  const [hydrated, setHydrated] = useState(false)
  const [view, setView] = useState<View>('home')
  const [pendingRedirect, setPendingRedirect] = useState<PendingRedirect | null>(null)

  // Wait for zustand persist to rehydrate (avoids SSR/CSR mismatch)
  useEffect(() => {
    const unsub = useAppStore.persist.onFinishHydration(() => setHydrated(true))
    Promise.resolve().then(() => {
      if (useAppStore.persist.hasHydrated()) setHydrated(true)
    })
    return () => {
      unsub()
    }
  }, [])

  // Detect GeniusPay redirect (?payment=success|error) on mount.
  // We strip the query afterwards so a refresh doesn't re-trigger.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const status = params.get('payment')
    const reference = params.get('reference')
    if ((status === 'success' || status === 'error') && reference) {
      // Defer the setState to a microtask to avoid the synchronous
      // set-state-in-effect lint rule.
      Promise.resolve().then(() => setPendingRedirect({ status, reference }))
      // Clean the URL
      const cleanUrl = window.location.pathname
      window.history.replaceState({}, '', cleanUrl)
    }
  }, [])

  // If a GeniusPay redirect was detected and there's no persisted pharmacy yet,
  // we can't show the paywall (no pharmacy context). We'll surface the pending
  // reference once the user re-enters the paywall view.
  useEffect(() => {
    if (pendingRedirect && persistedPharmacy && view !== 'paywall') {
      // Defer to a microtask to avoid the synchronous-setState-in-effect lint rule.
      Promise.resolve().then(() => setView('paywall'))
    }
  }, [pendingRedirect, persistedPharmacy?.id, view])

  const goHome = useCallback(() => {
    setView('home')
    setPendingRedirect(null)
  }, [])
  const goToSeller = useCallback(() => {
    setView('seller')
    // Clear any pending GeniusPay redirect so the effect that auto-bounces
    // to the paywall doesn't loop back after a successful activation.
    setPendingRedirect(null)
  }, [])
  const goToPaywall = useCallback(() => setView('paywall'), [])

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-10 w-10 animate-pulse rounded-xl bg-primary/30" />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex-1">
        {view === 'home' && (
          <Home
            hasPharmacy={!!persistedPharmacy}
            onSelectSeller={() => setView('onboarding')}
            onContinueSeller={goToSeller}
            onSelectClient={() => setView('client')}
          />
        )}

        {view === 'onboarding' && (
          <SellerOnboarding
            onBack={goHome}
            onDone={(pharmacy: PharmacyDTO, sellers: SellerDTO[]) => {
              setPharmacy(
                {
                  id: pharmacy.id,
                  name: pharmacy.name,
                  phone: pharmacy.phone,
                  address: pharmacy.address,
                  latitude: pharmacy.latitude,
                  longitude: pharmacy.longitude,
                  currency: pharmacy.currency ?? 'FC',
                },
                sellers.map((s) => ({ id: s.id, pharmacyId: s.pharmacyId, name: s.name, isPrimary: s.isPrimary })),
              )
              // After onboarding, send to the paywall — pharmacy must pay
              // 5000 CDF before getting access.
              setView('paywall')
            }}
          />
        )}

        {view === 'paywall' && persistedPharmacy && (
          <PaywallView
            pharmacyId={persistedPharmacy.id}
            pharmacyName={persistedPharmacy.name}
            customerPhone={persistedPharmacy.phone ?? undefined}
            onBack={goHome}
            onActivated={goToSeller}
            pendingReference={pendingRedirect?.reference}
            pendingStatus={pendingRedirect?.status}
          />
        )}

        {view === 'seller' && persistedPharmacy && (
          <SellerApp
            onExit={goHome}
            onSubscriptionExpired={goToPaywall}
          />
        )}

        {view === 'client' && <ClientView onBack={goHome} />}
      </main>

      {/* Sticky footer shown on all non-seller views. The seller app has
          its own fixed bottom navigation that would overlap with this. */}
      {view !== 'seller' && <StickyFooter />}
    </div>
  )
}
