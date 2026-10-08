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

  const paymentReview = await db.subscription.findFirst({
    where: { pharmacyId, status: { in: ['pending_review', 'rejected'] } },
    orderBy: { updatedAt: 'desc' },
    select: { status: true, reviewMessage: true, updatedAt: true },
  })
  const latestPaymentReview =
    paymentReview?.status === 'rejected' &&
    active &&
    active.updatedAt >= paymentReview.updatedAt
      ? null
      : paymentReview

  const daysRemaining = active?.endDate
    ? Math.max(0, Math.ceil((active.endDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)))
    : 0

  const safeSubscription = (subscription: typeof active | typeof lastSub) =>
    subscription
      ? {
          status: subscription.status,
          amount: subscription.amount,
          currency: subscription.currency,
          durationDays: subscription.durationDays,
          startDate: subscription.startDate,
          endDate: subscription.endDate,
          paymentMethod: subscription.paymentMethod,
          createdAt: subscription.createdAt,
        }
      : null

  return NextResponse.json({
    active: !!active,
    accessAllowed: !!active || latestPaymentReview?.status === 'pending_review',
    subscription: safeSubscription(active),
    daysRemaining,
    lastSubscription: safeSubscription(lastSub),
    paymentReview: latestPaymentReview,
  })
}
