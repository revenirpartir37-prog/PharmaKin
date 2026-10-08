import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getVendorSession } from '@/lib/vendor-auth'

/**
 * PUT /api/products/[id]  -> update product details (name, price, category, etc.)
 * Stock is never updated directly here — only via stock entry/exit/sale to keep history.
 */
export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const session = getVendorSession(req)
  if (!session) return NextResponse.json({ error: 'Connexion vendeur requise' }, { status: 401 })
  const owned = await db.product.findFirst({ where: { id, pharmacyId: session.pharmacyId }, select: { id: true } })
  if (!owned) return NextResponse.json({ error: 'Produit introuvable' }, { status: 404 })
  const body = await req.json()
  const { name, category, price, minThreshold, expiryDate, barcode } = body as {
    name?: string
    category?: string | null
    price?: number
    minThreshold?: number | null
    expiryDate?: string | null
    barcode?: string | null
  }
  const data: Record<string, unknown> = {}
  if (typeof name === 'string') data.name = name.trim()
  if (typeof category === 'string') data.category = category.trim() || null
  if (typeof price === 'number') data.price = price
  if (minThreshold !== undefined) data.minThreshold = minThreshold != null ? Number(minThreshold) : null
  if (typeof expiryDate === 'string') data.expiryDate = expiryDate || null
  if (typeof barcode === 'string') data.barcode = barcode || null

  const product = await db.product.update({ where: { id }, data })
  return NextResponse.json({ product })
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const session = getVendorSession(req)
  if (!session) return NextResponse.json({ error: 'Connexion vendeur requise' }, { status: 401 })
  const owned = await db.product.findFirst({ where: { id, pharmacyId: session.pharmacyId }, select: { id: true } })
  if (!owned) return NextResponse.json({ error: 'Produit introuvable' }, { status: 404 })
  // Soft: only allow if no stock movements? For MVP we hard delete.
  await db.product.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
