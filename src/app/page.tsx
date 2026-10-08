'use client'

import { useEffect, useState } from 'react'
import { Home } from '@/components/pharmakin/Home'
import { SellerOnboarding } from '@/components/pharmakin/SellerOnboarding'
import { SellerApp } from '@/components/pharmakin/SellerApp'
import { ClientView } from '@/components/pharmakin/ClientView'
import { StickyFooter } from '@/components/pharmakin/StickyFooter'
import { useAppStore } from '@/lib/store'
import type { PharmacyDTO, SellerDTO } from '@/lib/types'

type View = 'home' | 'onboarding' | 'seller' | 'client'

export default function Page() {
  const {
    pharmacy: persistedPharmacy,
    sellers: persistedSellers,
    setPharmacy,
  } = useAppStore()
  const [hydrated, setHydrated] = useState(false)
  const [view, setView] = useState<View>('home')

  // Wait for zustand persist to rehydrate (avoids SSR/CSR mismatch)
  useEffect(() => {
    const unsub = useAppStore.persist.onFinishHydration(() => setHydrated(true))
    // zustand persist with localStorage hydrates synchronously on client;
    // if already hydrated by the time this effect runs, mark it via microtask.
    Promise.resolve().then(() => {
      if (useAppStore.persist.hasHydrated()) setHydrated(true)
    })
    return () => {
      unsub()
    }
  }, [])

  // Auto-route: if a persisted pharmacy exists and user comes from seller flow
  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-10 w-10 animate-pulse rounded-xl bg-primary/30" />
      </div>
    )
  }

  function goHome() {
    setView('home')
  }

  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex-1">
        {view === 'home' && (
          <Home
            hasPharmacy={!!persistedPharmacy}
            onSelectSeller={() => setView('onboarding')}
            onContinueSeller={() => setView('seller')}
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
              setView('seller')
            }}
          />
        )}

        {view === 'seller' && persistedPharmacy && (
          <SellerApp onExit={goHome} />
        )}

        {view === 'client' && <ClientView onBack={goHome} />}
      </main>

      {/* Sticky footer shown on all non-seller views. The seller app has
          its own fixed bottom navigation that would overlap with this. */}
      {view !== 'seller' && <StickyFooter />}
    </div>
  )
}
