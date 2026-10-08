import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/sales/[id] -> get a single sale with items + seller
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const sale = await db.sale.findUnique({
    where: { id },
    include: { items: true, seller: true, pharmacy: true },
  })
  if (!sale) return NextResponse.json({ error: 'Vente introuvable' }, { status: 404 })
  return NextResponse.json({ sale })
}
