'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * PharmaKin client-side app state.
 * Persists the active pharmacy + seller + cart to localStorage so the app
 * keeps working offline and across reloads.
 */

export interface CartItem {
  productId: string
  name: string
  unitPrice: number
  quantity: number
  maxAvailable: number
}

export interface SellerInfo {
  id: string
  name: string
  isPrimary: boolean
}

export interface PharmacyInfo {
  id: string
  name: string
  phone: string | null
  address: string | null
  latitude: number | null
  longitude: number | null
  currency: string
}

interface AppState {
  // Identity
  pharmacy: PharmacyInfo | null
  sellers: SellerInfo[]
  activeSellerId: string | null

  // Cart (for sales flow)
  cart: CartItem[]
  clientName: string

  // Last service session id (open)
  activeSessionId: string | null

  // Actions
  setPharmacy: (p: PharmacyInfo, sellers: SellerInfo[]) => void
  setActiveSeller: (id: string) => void
  clearPharmacy: () => void

  addToCart: (item: CartItem) => void
  updateCartQty: (productId: string, quantity: number) => void
  removeFromCart: (productId: string) => void
  clearCart: () => void
  setClientName: (name: string) => void

  setActiveSession: (id: string | null) => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      pharmacy: null,
      sellers: [],
      activeSellerId: null,
      cart: [],
      clientName: '',
      activeSessionId: null,

      setPharmacy: (p, sellers) =>
        set({ pharmacy: p, sellers, activeSellerId: null, cart: [], activeSessionId: null }),

      setActiveSeller: (id) => set({ activeSellerId: id, cart: [] }),

      clearPharmacy: () =>
        set({
          pharmacy: null,
          sellers: [],
          activeSellerId: null,
          cart: [],
          clientName: '',
          activeSessionId: null,
        }),

      addToCart: (item) =>
        set((s) => {
          const existing = s.cart.find((c) => c.productId === item.productId)
          if (existing) {
            const nextQty = Math.min(existing.quantity + item.quantity, item.maxAvailable)
            return {
              cart: s.cart.map((c) =>
                c.productId === item.productId ? { ...c, quantity: nextQty } : c,
              ),
            }
          }
          return { cart: [...s.cart, item] }
        }),

      updateCartQty: (productId, quantity) =>
        set((s) => ({
          cart: s.cart.map((c) =>
            c.productId === productId
              ? { ...c, quantity: Math.max(1, Math.min(quantity, c.maxAvailable)) }
              : c,
          ),
        })),

      removeFromCart: (productId) =>
        set((s) => ({ cart: s.cart.filter((c) => c.productId !== productId) })),

      clearCart: () => set({ cart: [], clientName: '' }),

      setClientName: (name) => set({ clientName: name }),

      setActiveSession: (id) => set({ activeSessionId: id }),
    }),
    {
      name: 'pharmakin-store',
      // Only persist identity, not ephemeral cart state would be fine too,
      // but keeping cart lets us recover from accidental refresh mid-sale.
    },
  ),
)
