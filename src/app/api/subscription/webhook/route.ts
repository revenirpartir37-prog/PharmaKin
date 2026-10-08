import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * POST /api/subscription/webhook
 * GeniusPay sends a webhook when a payment reaches a terminal status.
 *
 * Body shape (per docs): { reference, status, amount, currency, metadata, ... }
 * We trust the signature-less sandbox payload and re-verify by status:
 *  - status === 'completed'  -> activate the matching subscription
 *  - status === 'failed'     -> mark failed
 *  - otherwise               -> ignore
 *
 * Always returns 200 quickly so GeniusPay doesn't retry.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as
      | {
          reference?: string
          status?: string
          event?: string
          data?: { reference?: string; status?: string }
        }
      | null

    const reference = body?.reference || body?.data?.reference
    const status = body?.status || body?.data?.status

    if (!reference) {
      return NextResponse.json({ ok: true, ignored: 'no reference' })
    }

    const subscription = await db.subscription.findFirst({
      where: { paymentRef: reference },
    })
    if (!subscription) {
      // Not a PharmaKin subscription; acknowledge anyway
      return NextResponse.json({ ok: true, ignored: 'unknown reference' })
    }

    if (subscription.status === 'active') {
      return NextResponse.json({ ok: true, alreadyActive: true })
    }

    if (status === 'completed') {
      const now = new Date()
      const endDate = new Date(
        now.getTime() + subscription.durationDays * 24 * 60 * 60 * 1000,
      )
      await db.subscription.update({
        where: { id: subscription.id },
        data: {
          status: 'active',
          startDate: now,
          endDate,
          note: `Activé par webhook GeniusPay`,
        },
      })
    } else if (status === 'failed') {
      await db.subscription.update({
        where: { id: subscription.id },
        data: { status: 'failed' },
      })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[POST /api/subscription/webhook]', e)
    // Still 200 to avoid GeniusPay retries
    return NextResponse.json({ ok: true, error: 'server error' })
  }
}
