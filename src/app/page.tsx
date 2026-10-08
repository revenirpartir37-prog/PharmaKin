'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Star } from 'lucide-react'
import { Home } from '@/components/pharmakin/Home'
import { SellerOnboarding } from '@/components/pharmakin/SellerOnboarding'
import { SellerLogin } from '@/components/pharmakin/SellerLogin'
import { SellerApp } from '@/components/pharmakin/SellerApp'
import { ClientView } from '@/components/pharmakin/ClientView'
import { PaywallView } from '@/components/pharmakin/PaywallView'
import { AdminDashboard } from '@/components/pharmakin/AdminDashboard'
import { StickyFooter } from '@/components/pharmakin/StickyFooter'
import { useAppStore } from '@/lib/store'
import type { PharmacyDTO, SellerDTO } from '@/lib/types'

type View = 'home' | 'onboarding' | 'login' | 'paywall' | 'seller' | 'client' | 'admin'

export default function Page() {
  const {
    pharmacy: persistedPharmacy,
    sellers: persistedSellers,
    setPharmacy,
  } = useAppStore()
  const [hydrated, setHydrated] = useState(false)
  const [view, setView] = useState<View>('home')
  const [paywallReturnToSeller, setPaywallReturnToSeller] = useState(false)
  const starClicks = useRef(0)
  const starResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  const goHome = useCallback(() => {
    setView('home')
  }, [])
  const goToSeller = useCallback(() => {
    setView('seller')
  }, [])
  const goToPaywall = useCallback(() => {
    setPaywallReturnToSeller(false)
    setView('paywall')
  }, [])
  const goToSubscription = useCallback(() => {
    setPaywallReturnToSeller(true)
    setView('paywall')
  }, [])
  const handleAdminStar = useCallback(() => {
    starClicks.current += 1
    if (starResetTimer.current) clearTimeout(starResetTimer.current)
    if (starClicks.current >= 3) {
      starClicks.current = 0
      setView('admin')
      return
    }
    starResetTimer.current = setTimeout(() => {
      starClicks.current = 0
    }, 1200)
  }, [])

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
            onContinueSeller={() => setView('login')}
            onSellerLogin={() => setView('login')}
            onSelectClient={() => setView('client')}
          />
        )}

        {view === 'login' && (
          <SellerLogin
            onBack={goHome}
            onAuthenticated={(pharmacy: PharmacyDTO, sellers: SellerDTO[]) => {
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
                sellers.map((seller) => ({
                  id: seller.id,
                  pharmacyId: seller.pharmacyId,
                  name: seller.name,
                  isPrimary: seller.isPrimary,
                })),
              )
              setView('seller')
            }}
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
              setPaywallReturnToSeller(false)
              setView('paywall')
            }}
          />
        )}

        {view === 'paywall' && persistedPharmacy && (
          <PaywallView
            pharmacyId={persistedPharmacy.id}
            pharmacyName={persistedPharmacy.name}
            onBack={paywallReturnToSeller ? goToSeller : goHome}
            onPaymentSubmitted={goToSeller}
          />
        )}

        {view === 'seller' && persistedPharmacy && (
          <SellerApp
            onExit={goHome}
            onSubscriptionExpired={goToPaywall}
            onManageSubscription={goToSubscription}
          />
        )}

        {view === 'client' && <ClientView onBack={goHome} />}
        {view === 'admin' && <AdminDashboard onExit={goHome} />}
      </main>

      {view !== 'admin' && (
        <button
          type="button"
          onClick={handleAdminStar}
          className="fixed bottom-2 right-2 z-50 flex h-7 w-7 items-center justify-center rounded-full bg-background/70 text-[11px] opacity-35 transition-opacity hover:opacity-100"
          aria-label="Accès administrateur"
          title="Accès administrateur"
        >
          <Star size={13} />
        </button>
      )}

      {/* Sticky footer shown on all non-seller views. The seller app has
          its own fixed bottom navigation that would overlap with this. */}
      {view !== 'seller' && view !== 'admin' && <StickyFooter />}
    </div>
  )
}
