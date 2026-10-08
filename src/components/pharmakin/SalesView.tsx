'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Search,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  X,
  Loader2,
  CheckCircle2,
  User,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAppStore } from '@/lib/store'
import { formatFC } from '@/lib/format'
import type { ProductDTO, SaleDTO, SaleItemDTO } from '@/lib/types'

interface SalesViewProps {
  onCheckoutDone: (sale: SaleDTO) => void
}

export function SalesView({ onCheckoutDone }: SalesViewProps) {
  const { pharmacy, activeSellerId, cart, addToCart, updateCartQty, removeFromCart, clearCart, clientName, setClientName } = useAppStore()
  const [products, setProducts] = useState<ProductDTO[]>([])
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [cartOpen, setCartOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function load() {
    if (!pharmacy) return
    setLoading(true)
    try {
      const res = await fetch(`/api/products?pharmacyId=${pharmacy.id}${q ? `&q=${encodeURIComponent(q)}` : ''}`)
      const json = await res.json()
      setProducts(json.products as ProductDTO[])
    } catch {
      toast.error('Erreur au chargement des produits')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const t = setTimeout(load, 250)
    return () => clearTimeout(t)
     
  }, [pharmacy?.id, q])

  const total = useMemo(
    () => cart.reduce((s, c) => s + c.quantity * c.unitPrice, 0),
    [cart],
  )
  const itemCount = useMemo(() => cart.reduce((s, c) => s + c.quantity, 0), [cart])

  async function checkout() {
    if (!pharmacy || !activeSellerId || cart.length === 0) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pharmacyId: pharmacy.id,
          sellerId: activeSellerId,
          clientName: clientName.trim() || undefined,
          items: cart.map((c) => ({
            productId: c.productId,
            name: c.name,
            quantity: c.quantity,
            unitPrice: c.unitPrice,
          })),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      const sale = data.sale as SaleDTO
      // Items come back with ids; add fallback
      if (!sale.items) sale.items = [] as SaleItemDTO[]
      toast.success(`Vente enregistrée — ${sale.invoiceNumber}`)
      clearCart()
      setCartOpen(false)
      onCheckoutDone(sale)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur lors de la vente')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShoppingCart size={22} className="text-primary" />
          <h1 className="text-xl font-extrabold tracking-tight">Nouvelle vente</h1>
        </div>
        {cart.length > 0 && (
          <button
            onClick={() => setCartOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-2 text-sm font-bold text-primary-foreground shadow-sm"
          >
            <ShoppingCart size={16} /> {itemCount} · {formatFC(total)}
          </button>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher un produit à vendre..."
          className="w-full rounded-2xl border border-input bg-background py-3 pl-10 pr-4 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
          autoFocus
        />
      </div>

      {/* Product list */}
      <div className="space-y-2">
        {loading && (
          <div className="flex h-32 items-center justify-center">
            <Loader2 className="animate-spin text-primary" size={28} />
          </div>
        )}
        {!loading && products.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center">
            <ShoppingCart size={32} className="mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm font-semibold">Aucun produit trouvé</p>
            <p className="text-xs text-muted-foreground">Ajoutez des produits à votre stock pour vendre</p>
          </div>
        )}
        {!loading &&
          products.map((p) => {
            const inCart = cart.find((c) => c.productId === p.id)
            return (
              <div
                key={p.id}
                className={`flex items-center gap-3 rounded-2xl border bg-card p-3 ${inCart ? 'border-primary' : 'border-border'}`}
              >
                <div className="flex h-11 w-11 flex-col items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <span className="text-sm font-extrabold leading-none">{p.quantity}</span>
                  <span className="text-[9px] uppercase">qté</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold">{p.name}</div>
                  <div className="text-xs font-semibold text-foreground">{formatFC(p.price)}</div>
                </div>
                <div className="flex items-center gap-1.5">
                  {inCart ? (
                    <>
                      <button
                        onClick={() => updateCartQty(p.id, inCart.quantity - 1)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-border hover:bg-accent"
                      >
                        <Minus size={16} />
                      </button>
                      <span className="w-6 text-center text-sm font-bold">{inCart.quantity}</span>
                      <button
                        onClick={() => {
                          if (inCart.quantity >= p.quantity) {
                            toast.error('Stock maximum atteint')
                            return
                          }
                          updateCartQty(p.id, inCart.quantity + 1)
                        }}
                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground"
                      >
                        <Plus size={16} />
                      </button>
                    </>
                  ) : (
                    <button
                      disabled={p.quantity <= 0}
                      onClick={() => addToCart({
                        productId: p.id,
                        name: p.name,
                        unitPrice: p.price,
                        quantity: 1,
                        maxAvailable: p.quantity,
                      })}
                      className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-primary px-3 text-sm font-bold text-primary-foreground disabled:opacity-40"
                    >
                      <Plus size={16} /> Ajouter
                    </button>
                  )}
                </div>
              </div>
            )
          })}
      </div>

      {/* Floating cart bar (mobile) */}
      {cart.length > 0 && !cartOpen && (
        <button
          onClick={() => setCartOpen(true)}
          className="fixed bottom-20 left-1/2 z-20 flex w-[calc(100%-2rem)] max-w-3xl -translate-x-1/2 items-center justify-between rounded-2xl bg-primary px-4 py-3.5 text-primary-foreground shadow-xl"
        >
          <span className="flex items-center gap-2 text-sm font-bold">
            <ShoppingCart size={18} /> {itemCount} article(s)
          </span>
          <span className="text-sm font-bold">{formatFC(total)} →</span>
        </button>
      )}

      {/* Cart sheet */}
      {cartOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={() => setCartOpen(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-background p-5 shadow-2xl sm:rounded-3xl scroll-area-thin"
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-lg font-extrabold">
                <ShoppingCart size={20} className="text-primary" /> Panier
              </h3>
              <button onClick={() => setCartOpen(false)} className="rounded-full p-1.5 text-muted-foreground hover:bg-accent">
                <X size={20} />
              </button>
            </div>

            {cart.length === 0 ? (
              <div className="py-10 text-center">
                <ShoppingCart size={32} className="mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm font-medium text-muted-foreground">Panier vide</p>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  {cart.map((c) => (
                    <div key={c.productId} className="flex items-center gap-3 rounded-xl border border-border bg-card p-2.5">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold">{c.name}</div>
                        <div className="text-xs text-muted-foreground">{formatFC(c.unitPrice)} × {c.quantity}</div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => updateCartQty(c.productId, c.quantity - 1)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-border hover:bg-accent"
                        >
                          <Minus size={14} />
                        </button>
                        <span className="w-5 text-center text-sm font-bold">{c.quantity}</span>
                        <button
                          onClick={() => {
                            if (c.quantity >= c.maxAvailable) {
                              toast.error('Stock maximum atteint')
                              return
                            }
                            updateCartQty(c.productId, c.quantity + 1)
                          }}
                          className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                      <div className="w-20 text-right text-sm font-bold">{formatFC(c.quantity * c.unitPrice)}</div>
                      <button
                        onClick={() => removeFromCart(c.productId)}
                        className="rounded-lg p-1.5 text-red-500 hover:bg-red-50"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Client name */}
                <div className="mt-4">
                  <label className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                    <User size={14} /> Nom du client (facultatif)
                  </label>
                  <input
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="Ex: Marie Kabeya"
                    className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                  />
                </div>

                {/* Total */}
                <div className="mt-4 flex items-center justify-between rounded-2xl bg-primary/10 p-4">
                  <span className="text-sm font-bold text-primary">TOTAL</span>
                  <span className="text-xl font-extrabold text-primary">{formatFC(total)}</span>
                </div>

                {/* Checkout */}
                <button
                  onClick={checkout}
                  disabled={submitting}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-4 text-base font-bold text-primary-foreground shadow-md transition-transform active:scale-[0.98] disabled:opacity-50"
                >
                  {submitting ? (
                    <Loader2 size={20} className="animate-spin" />
                  ) : (
                    <>
                      <CheckCircle2 size={20} /> Valider la vente · {formatFC(total)}
                    </>
                  )}
                </button>
                <button
                  onClick={() => {
                    if (confirm('Vider le panier ?')) clearCart()
                  }}
                  className="mt-2 w-full text-center text-sm font-medium text-muted-foreground hover:text-red-500"
                >
                  Vider le panier
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
