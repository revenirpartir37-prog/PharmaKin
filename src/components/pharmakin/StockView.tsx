'use client'

import { useEffect, useState } from 'react'
import {
  Plus,
  PackagePlus,
  PackageMinus,
  Search,
  Boxes,
  Loader2,
  X,
  AlertTriangle,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAppStore } from '@/lib/store'
import { formatFC, formatNumber } from '@/lib/format'
import type { ProductDTO } from '@/lib/types'

interface StockViewProps {
  onChanged: () => void
}

type DialogMode = null | 'add' | 'entry' | 'exit' | 'edit'

export function StockView({ onChanged }: StockViewProps) {
  const { pharmacy, activeSellerId } = useAppStore()
  const [products, setProducts] = useState<ProductDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [dialog, setDialog] = useState<{ mode: DialogMode; product?: ProductDTO } | null>(null)

  async function load() {
    if (!pharmacy) return
    setLoading(true)
    try {
      const res = await fetch(`/api/products?pharmacyId=${pharmacy.id}${q ? `&q=${encodeURIComponent(q)}` : ''}`)
      const json = await res.json()
      setProducts(json.products as ProductDTO[])
    } catch {
      toast.error('Erreur au chargement du stock')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const t = setTimeout(load, 250)
    return () => clearTimeout(t)
     
  }, [pharmacy?.id, q])

  async function handleDone() {
    setDialog(null)
    await load()
    onChanged()
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Boxes size={22} className="text-primary" />
          <h1 className="text-xl font-extrabold tracking-tight">Mon stock</h1>
        </div>
        <button
          onClick={() => setDialog({ mode: 'add' })}
          className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-2 text-sm font-bold text-primary-foreground shadow-sm"
        >
          <Plus size={16} /> Produit
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher un produit..."
          className="w-full rounded-2xl border border-input bg-background py-3 pl-10 pr-4 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
        />
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => setDialog({ mode: 'entry' })}
          className="inline-flex items-center justify-center gap-1.5 rounded-2xl bg-emerald-600 px-3 py-2.5 text-sm font-bold text-white shadow-sm"
        >
          <PackagePlus size={18} /> Entrée stock
        </button>
        <button
          onClick={() => setDialog({ mode: 'exit' })}
          className="inline-flex items-center justify-center gap-1.5 rounded-2xl bg-amber-500 px-3 py-2.5 text-sm font-bold text-white shadow-sm"
        >
          <PackageMinus size={18} /> Sortie stock
        </button>
      </div>

      {/* List */}
      <div className="space-y-2">
        {loading && (
          <div className="flex h-32 items-center justify-center">
            <Loader2 className="animate-spin text-primary" size={28} />
          </div>
        )}
        {!loading && products.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center">
            <Boxes size={32} className="mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm font-semibold">Aucun produit</p>
            <p className="text-xs text-muted-foreground">Ajoutez votre premier produit pour commencer</p>
          </div>
        )}
        {!loading &&
          products.map((p) => {
            const low = p.minThreshold != null && p.quantity <= (p.minThreshold as number)
            return (
              <div
                key={p.id}
                className={`flex items-center gap-3 rounded-2xl border bg-card p-3 ${low ? 'border-amber-300 bg-amber-50' : 'border-border'}`}
              >
                <div className={`flex h-11 w-11 flex-col items-center justify-center rounded-xl ${low ? 'bg-amber-100 text-amber-700' : 'bg-primary/10 text-primary'}`}>
                  <span className="text-sm font-extrabold leading-none">{formatNumber(p.quantity)}</span>
                  <span className="text-[9px] uppercase">qté</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold">{p.name}</div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">{formatFC(p.price)}</span>
                    {p.category && <span>· {p.category}</span>}
                    {p.expiryDate && <span>· exp {p.expiryDate}</span>}
                  </div>
                  {low && (
                    <div className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-bold text-amber-700">
                      <AlertTriangle size={11} /> Stock bas
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <button
                    onClick={() => setDialog({ mode: 'entry', product: p })}
                    className="rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-50"
                    title="Entrée"
                  >
                    <PackagePlus size={16} />
                  </button>
                  <button
                    onClick={() => setDialog({ mode: 'exit', product: p })}
                    className="rounded-lg p-1.5 text-amber-600 hover:bg-amber-50"
                    title="Sortie"
                  >
                    <PackageMinus size={16} />
                  </button>
                </div>
              </div>
            )
          })}
      </div>

      {/* Dialogs */}
      {dialog && (
        <StockDialog
          mode={dialog.mode as Exclude<DialogMode, null>}
          product={dialog.product}
          products={products}
          onClose={() => setDialog(null)}
          onDone={handleDone}
        />
      )}
    </div>
  )
}

function StockDialog({
  mode,
  product,
  products,
  onClose,
  onDone,
}: {
  mode: Exclude<DialogMode, null>
  product?: ProductDTO
  products: ProductDTO[]
  onClose: () => void
  onDone: () => void
}) {
  const { pharmacy, activeSellerId } = useAppStore()
  const [target, setTarget] = useState<ProductDTO | null>(product ?? null)
  const [pickerOpen, setPickerOpen] = useState(!product && mode !== 'add')
  const [submitting, setSubmitting] = useState(false)

  // add product fields
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [price, setPrice] = useState('')
  const [quantity, setQuantity] = useState('')
  const [minThreshold, setMinThreshold] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [barcode, setBarcode] = useState('')

  // entry / exit fields
  const [qty, setQty] = useState('')
  const [reason, setReason] = useState('')

  // edit fields
  const [editPrice, setEditPrice] = useState('')
  const [editMin, setEditMin] = useState('')
  const [editExpiry, setEditExpiry] = useState('')

  useEffect(() => {
    if (mode === 'edit' && product) {
      setEditPrice(String(product.price))
      setEditMin(product.minThreshold != null ? String(product.minThreshold) : '')
      setEditExpiry(product.expiryDate ?? '')
    }
  }, [mode, product])

  if (!pharmacy) return null

  const sellerId = activeSellerId
  const title =
    mode === 'add'
      ? 'Ajouter un produit'
      : mode === 'entry'
      ? 'Entrée de stock'
      : mode === 'exit'
      ? 'Sortie de stock'
      : 'Modifier le produit'

  async function submitAdd() {
    if (!name.trim() || !price || !quantity) {
      toast.error('Nom, prix et quantité sont requis')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pharmacyId: pharmacy!.id,
          sellerId,
          name: name.trim(),
          category: category.trim() || undefined,
          price: Number(price),
          quantity: Number(quantity),
          minThreshold: minThreshold ? Number(minThreshold) : null,
          expiryDate: expiryDate || null,
          barcode: barcode || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success('Produit ajouté au stock')
      onDone()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setSubmitting(false)
    }
  }

  async function submitEntry() {
    if (!target || !qty) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/stock/entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pharmacyId: pharmacy!.id,
          sellerId,
          productId: target.id,
          quantity: Number(qty),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success(`+${qty} ajouté à ${target.name}`)
      onDone()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setSubmitting(false)
    }
  }

  async function submitExit() {
    if (!target || !qty) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/stock/exit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pharmacyId: pharmacy!.id,
          sellerId,
          productId: target.id,
          quantity: Number(qty),
          reason: reason || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success(`-${qty} retiré de ${target.name}`)
      onDone()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setSubmitting(false)
    }
  }

  async function submitEdit() {
    if (!target) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/products/${target.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          price: Number(editPrice),
          minThreshold: editMin ? Number(editMin) : null,
          expiryDate: editExpiry || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success('Produit mis à jour')
      onDone()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setSubmitting(false)
    }
  }

  async function submitDelete() {
    if (!target) return
    if (!confirm(`Supprimer définitivement "${target.name}" ?`)) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/products/${target.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error)
      }
      toast.success('Produit supprimé')
      onDone()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-background p-5 shadow-2xl sm:rounded-3xl scroll-area-thin"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-extrabold">{title}</h3>
          <button onClick={onClose} className="rounded-full p-1.5 text-muted-foreground hover:bg-accent">
            <X size={20} />
          </button>
        </div>

        {/* Product picker for entry/exit */}
        {(mode === 'entry' || mode === 'exit') && pickerOpen && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Choisir un produit</p>
            {products.length === 0 && (
              <p className="rounded-xl bg-muted/50 p-4 text-center text-sm text-muted-foreground">
                Aucun produit. Ajoutez-en dabord.
              </p>
            )}
            <div className="max-h-72 space-y-1.5 overflow-y-auto scroll-area-thin">
              {products.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setTarget(p)
                    setPickerOpen(false)
                  }}
                  className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-3 text-left hover:bg-accent"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
                    {p.quantity}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="truncate text-sm font-semibold">{p.name}</div>
                    <div className="text-xs text-muted-foreground">{formatFC(p.price)} · stock {p.quantity}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Selected product display */}
        {(mode === 'entry' || mode === 'exit') && target && !pickerOpen && (
          <div className="mb-3 rounded-xl border border-border bg-muted/30 p-3">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <div className="truncate text-sm font-bold">{target.name}</div>
                <div className="text-xs text-muted-foreground">
                  Stock actuel: <strong>{target.quantity}</strong> · {formatFC(target.price)}
                </div>
              </div>
              <button onClick={() => setPickerOpen(true)} className="text-xs font-semibold text-primary hover:underline">
                Changer
              </button>
            </div>
          </div>
        )}

        {/* Add product form */}
        {mode === 'add' && (
          <div className="space-y-3">
            <Field label="Nom du produit *" placeholder="Ex: Paracétamol 500 mg" value={name} onChange={setName} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Prix (FC) *" placeholder="1000" value={price} onChange={setPrice} inputMode="numeric" />
              <Field label="Quantité *" placeholder="50" value={quantity} onChange={setQuantity} inputMode="numeric" />
            </div>
            <Field label="Catégorie (facultatif)" placeholder="Ex: Antidouleur" value={category} onChange={setCategory} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Seuil minimum" placeholder="10" value={minThreshold} onChange={setMinThreshold} inputMode="numeric" />
              <Field label="Date expiration" placeholder="MM/AAAA" value={expiryDate} onChange={setExpiryDate} />
            </div>
            <Field label="Code/barcode (facultatif)" placeholder="..." value={barcode} onChange={setBarcode} />
            <SubmitButton onClick={submitAdd} loading={submitting} label="Ajouter au stock" />
          </div>
        )}

        {/* Entry form */}
        {mode === 'entry' && target && !pickerOpen && (
          <div className="space-y-3">
            <Field label="Quantité à ajouter *" placeholder="Ex: 30" value={qty} onChange={setQty} inputMode="numeric" />
            <PreviewRow label="Nouveau stock" value={String(target.quantity + (Number(qty) || 0))} />
            <SubmitButton onClick={submitEntry} loading={submitting} label="Confirmer lentrée" color="success" />
          </div>
        )}

        {/* Exit form */}
        {mode === 'exit' && target && !pickerOpen && (
          <div className="space-y-3">
            <Field label="Quantité à retirer *" placeholder="Ex: 5" value={qty} onChange={setQty} inputMode="numeric" />
            <ReasonSelect value={reason} onChange={setReason} />
            <PreviewRow label="Nouveau stock" value={String(target.quantity - (Number(qty) || 0))} />
            <SubmitButton onClick={submitExit} loading={submitting} label="Confirmer la sortie" color="warning" />
          </div>
        )}

        {/* Edit form */}
        {mode === 'edit' && target && (
          <div className="space-y-3">
            <div className="rounded-xl bg-muted/30 p-3 text-sm">
              <div className="font-bold">{target.name}</div>
              <div className="text-xs text-muted-foreground">Stock actuel: {target.quantity} (non modifiable ici)</div>
            </div>
            <Field label="Prix (FC)" placeholder="1000" value={editPrice} onChange={setEditPrice} inputMode="numeric" />
            <Field label="Seuil minimum" placeholder="10" value={editMin} onChange={setEditMin} inputMode="numeric" />
            <Field label="Date expiration" placeholder="MM/AAAA" value={editExpiry} onChange={setEditExpiry} />
            <div className="flex gap-2">
              <SubmitButton onClick={submitEdit} loading={submitting} label="Enregistrer" />
              <button
                onClick={submitDelete}
                disabled={submitting}
                className="inline-flex items-center gap-1.5 rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-bold text-red-600 disabled:opacity-50"
              >
                <Trash2 size={16} /> Supprimer
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Field({
  label,
  placeholder,
  value,
  onChange,
  inputMode,
}: {
  label: string
  placeholder: string
  value: string
  onChange: (v: string) => void
  inputMode?: 'text' | 'numeric' | 'tel'
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-muted-foreground">{label}</span>
      <input
        inputMode={inputMode}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
      />
    </label>
  )
}

function ReasonSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const reasons = ['Produit endommagé', 'Perte', 'Retour', 'Autre']
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-muted-foreground">Motif (facultatif)</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
      >
        <option value="">— Choisir —</option>
        {reasons.map((r) => (
          <option key={r} value={r}>{r}</option>
        ))}
      </select>
    </label>
  )
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-emerald-50 px-3 py-2 text-sm">
      <span className="text-emerald-700">{label}</span>
      <strong className="text-emerald-900">{value}</strong>
    </div>
  )
}

function SubmitButton({
  onClick,
  loading,
  label,
  color = 'primary',
}: {
  onClick: () => void
  loading: boolean
  label: string
  color?: 'primary' | 'success' | 'warning'
}) {
  const palette = {
    primary: 'bg-primary text-primary-foreground',
    success: 'bg-emerald-600 text-white',
    warning: 'bg-amber-500 text-white',
  }[color]
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3.5 text-base font-bold shadow-sm transition-transform active:scale-[0.98] disabled:opacity-50 ${palette}`}
    >
      {loading && <Loader2 size={18} className="animate-spin" />}
      {label}
    </button>
  )
}
