import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getPaymentStatus, SUBSCRIPTION_DURATION_DAYS } from '@/lib/geniuspay'

/**
 * POST /api/subscription/verify
 * Body: { reference }
 *
 * - Looks up the Subscription row by paymentRef = reference
 * - Calls GeniusPay GET /payments/{reference} to get the real status
 * - If status === 'completed': activate the subscription (start now,
 *   end = now + durationDays), return active subscription
 * - Otherwise: return current status
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { reference } = body as { reference?: string }
    if (!reference) {
      return NextResponse.json({ error: 'reference requis' }, { status: 400 })
    }

    const subscription = await db.subscription.findFirst({
      where: { paymentRef: reference },
    })
    if (!subscription) {
      return NextResponse.json(
        { error: 'Aucune souscription trouvée pour cette référence' },
        { status: 404 },
      )
    }

    // Already active? Return immediately
    if (subscription.status === 'active' && subscription.endDate) {
      return NextResponse.json({
        subscription,
        verified: true,
        alreadyActive: true,
      })
    }

    // Ask GeniusPay for the real status
    const status = await getPaymentStatus(reference)
    if (!status.success) {
      return NextResponse.json(
        { error: status.error || 'Vérification GeniusPay impossible' },
        { status: 502 },
      )
    }

    if (status.status === 'completed') {
      const now = new Date()
      const endDate = new Date(now.getTime() + subscription.durationDays * 24 * 60 * 60 * 1000)

      const updated = await db.subscription.update({
        where: { id: subscription.id },
        data: {
          status: 'active',
          startDate: now,
          endDate,
          note: `Paiement confirmé via GeniusPay (${status.paymentMethod || 'mobile money'})`,
        },
      })

      return NextResponse.json({
        subscription: updated,
        verified: true,
        activated: true,
      })
    }

    // Pending or failed: persist latest known status and return
    const mapped = status.status === 'failed' ? 'failed' : 'pending'
    if (mapped !== subscription.status) {
      await db.subscription.update({
        where: { id: subscription.id },
        data: { status: mapped },
      })
    }

    return NextResponse.json({
      subscription: { ...subscription, status: mapped },
      verified: true,
      geniuspayStatus: status.status,
    })
  } catch (e) {
    console.error('[POST /api/subscription/verify]', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

/**
 * GET /api/subscription/verify?reference=...
 * Convenience GET for redirect-based verification (e.g. on success_url landing).
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const reference = searchParams.get('reference')
  if (!reference) {
    return NextResponse.json({ error: 'reference requis' }, { status: 400 })
  }
  // Reuse the POST logic
  return POST(
    new NextRequest(req.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reference }),
    }),
  )
}

export const runtime = 'nodejs'
