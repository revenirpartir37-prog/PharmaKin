import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getVendorSession } from '@/lib/vendor-auth'

/**
 * GET /api/pharmacy/[id] -> get pharmacy with sellers
 * PUT /api/pharmacy/[id] -> update pharmacy (location, phone, address)
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const session = getVendorSession(req)
  if (!session || session.pharmacyId !== id) return NextResponse.json({ error: 'Connexion vendeur requise' }, { status: 401 })
  const pharmacy = await db.pharmacy.findUnique({
    where: { id },
    select: {
      id: true, name: true, phone: true, address: true, latitude: true, longitude: true, currency: true,
      createdAt: true, updatedAt: true,
      sellers: { orderBy: { createdAt: 'asc' }, select: { id: true, pharmacyId: true, name: true, isPrimary: true } },
    },
  })
  if (!pharmacy) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  const state = await db.pharmacy.findUnique({ where: { id }, select: { suspended: true } })
  if (state?.suspended) return NextResponse.json({ error: 'Compte suspendu' }, { status: 403 })
  return NextResponse.json({ pharmacy })
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const session = getVendorSession(req)
  if (!session || session.pharmacyId !== id) return NextResponse.json({ error: 'Connexion vendeur requise' }, { status: 401 })
  const body = await req.json()
  const { name, phone, address, latitude, longitude } = body as {
    name?: string
    phone?: string | null
    address?: string | null
    latitude?: number | null
    longitude?: number | null
  }
  const data: Record<string, unknown> = {}
  if (typeof name === 'string') data.name = name.trim()
  if (typeof phone === 'string') data.phone = phone.trim() || null
  if (typeof address === 'string') data.address = address.trim() || null
  if (typeof latitude === 'number') data.latitude = latitude
  if (typeof longitude === 'number') data.longitude = longitude

  const pharmacy = await db.pharmacy.update({ where: { id }, data, include: { sellers: true } })
  return NextResponse.json({ pharmacy })
}
