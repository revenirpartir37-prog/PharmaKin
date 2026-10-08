import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * PUT /api/products/[id]  -> update product details (name, price, category, etc.)
 * Stock is never updated directly here — only via stock entry/exit/sale to keep history.
 */
export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
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

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  // Soft: only allow if no stock movements? For MVP we hard delete.
  await db.product.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
