import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/subscription/status?pharmacyId=...
 *
 * Returns the active subscription (if any) for the pharmacy, plus a
 * boolean `active` and `daysRemaining` for convenience.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const pharmacyId = searchParams.get('pharmacyId')
  if (!pharmacyId) {
    return NextResponse.json({ error: 'pharmacyId requis' }, { status: 400 })
  }

  const now = new Date()

  // Mark any expired ones (status=active but endDate<now) as expired
  await db.subscription.updateMany({
    where: { pharmacyId, status: 'active', endDate: { lt: now } },
    data: { status: 'expired' },
  })

  const active = await db.subscription.findFirst({
    where: { pharmacyId, status: 'active', endDate: { gt: now } },
    orderBy: { endDate: 'desc' },
  })

  const lastSub = await db.subscription.findFirst({
    where: { pharmacyId },
    orderBy: { createdAt: 'desc' },
  })

  const daysRemaining = active?.endDate
    ? Math.max(0, Math.ceil((active.endDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)))
    : 0

  return NextResponse.json({
    active: !!active,
    subscription: active,
    daysRemaining,
    lastSubscription: lastSub,
  })
}
