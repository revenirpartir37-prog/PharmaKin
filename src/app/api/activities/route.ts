import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/activities?pharmacyId=...&sellerId=...&limit=...
 * Returns activity log for a seller (or whole pharmacy if no sellerId).
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const pharmacyId = searchParams.get('pharmacyId') || undefined
  const sellerId = searchParams.get('sellerId') || undefined
  const limit = Number(searchParams.get('limit') || '500')

  const activities = await db.activity.findMany({
    where: {
      ...(pharmacyId ? { pharmacyId } : {}),
      ...(sellerId ? { sellerId } : {}),
    },
    include: { seller: true },
    orderBy: { createdAt: 'desc' },
    take: Math.min(limit, 2000),
  })

  return NextResponse.json({ activities })
}
