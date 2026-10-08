import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getVendorSession } from '@/lib/vendor-auth'

/**
 * GET /api/sales/[id] -> get a single sale with items + seller
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const session = getVendorSession(req)
  if (!session) return NextResponse.json({ error: 'Connexion vendeur requise' }, { status: 401 })
  const sale = await db.sale.findUnique({
    where: { id },
    include: {
      items: true,
      seller: { select: { id: true, name: true, isPrimary: true, pharmacyId: true } },
      pharmacy: { select: { id: true, name: true, phone: true, address: true, latitude: true, longitude: true, currency: true } },
    },
  })
  if (!sale || sale.pharmacyId !== session.pharmacyId) return NextResponse.json({ error: 'Vente introuvable' }, { status: 404 })
  return NextResponse.json({ sale })
}
