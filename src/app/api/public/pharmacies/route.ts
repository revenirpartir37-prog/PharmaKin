import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/public/pharmacies
 * Returns public info for pharmacies that have a location set.
 * No stock/sales/activities — only public-facing fields.
 */
export async function GET() {
  const pharmacies = await db.pharmacy.findMany({
    where: {
      latitude: { not: null },
      longitude: { not: null },
    },
    select: {
      id: true,
      name: true,
      phone: true,
      address: true,
      latitude: true,
      longitude: true,
    },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json({ pharmacies })
}
