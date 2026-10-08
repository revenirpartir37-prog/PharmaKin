import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  initiatePayment,
  appBaseUrl,
  SUBSCRIPTION_PRICE,
  SUBSCRIPTION_DURATION_DAYS,
  SUBSCRIPTION_CURRENCY,
} from '@/lib/geniuspay'

/**
 * POST /api/subscription/initiate
 * Body: { pharmacyId, customerPhone?, customerName? }
 *
 * - Creates a pending Subscription row
 * - Calls GeniusPay POST /payments with amount=5000, currency=CDF (fallback XOF),
 *   description "Abonnement PharmaKin 7 jours", success/error URLs that come
 *   back to /?payment=success|error&reference=MTX-...
 * - Returns { subscription, checkoutUrl } so the client can redirect.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { pharmacyId, customerPhone, customerName } = body as {
      pharmacyId: string
      customerPhone?: string
      customerName?: string
    }

    if (!pharmacyId) {
      return NextResponse.json({ error: 'pharmacyId requis' }, { status: 400 })
    }

    const pharmacy = await db.pharmacy.findUnique({ where: { id: pharmacyId } })
    if (!pharmacy) {
      return NextResponse.json({ error: 'Pharmacie introuvable' }, { status: 404 })
    }

    // Don't create a new pending subscription if one is already active
    const now = new Date()
    const active = await db.subscription.findFirst({
      where: {
        pharmacyId,
        status: 'active',
        endDate: { gt: now },
      },
      orderBy: { endDate: 'desc' },
    })
    if (active) {
      return NextResponse.json({
        alreadyActive: true,
        subscription: active,
        message: 'Vous avez déjà un abonnement actif',
      })
    }

    const origin = req.headers.get('origin') || req.headers.get('host')
    const base = appBaseUrl(origin)
    // reference will be appended by GeniusPay redirect as ?reference=MTX-...
    const successUrl = `${base}/?payment=success`
    const errorUrl = `${base}/?payment=error`

    const result = await initiatePayment({
      amount: SUBSCRIPTION_PRICE,
      description: `Abonnement PharmaKin — ${SUBSCRIPTION_DURATION_DAYS} jours (${pharmacy.name})`,
      customer: {
        name: customerName || pharmacy.name,
        phone: customerPhone,
        country: 'CD',
      },
      successUrl,
      errorUrl,
      metadata: {
        pharmacy_id: pharmacyId,
        type: 'subscription',
        duration_days: String(SUBSCRIPTION_DURATION_DAYS),
      },
    })

    if (!result.success || !result.reference) {
      return NextResponse.json(
        { error: result.error || 'Échec initier paiement GeniusPay' },
        { status: 502 },
      )
    }

    // Persist the pending subscription with the GeniusPay reference
    const subscription = await db.subscription.create({
      data: {
        pharmacyId,
        status: 'pending',
        amount: SUBSCRIPTION_PRICE,
        currency: SUBSCRIPTION_CURRENCY,
        durationDays: SUBSCRIPTION_DURATION_DAYS,
        paymentMethod: 'geniuspay',
        paymentRef: result.reference,
        checkoutUrl: result.checkoutUrl || result.paymentUrl || null,
        customerPhone: customerPhone || null,
        note: 'Paiement GeniusPay initié',
      },
    })

    return NextResponse.json({
      subscription,
      checkoutUrl: result.checkoutUrl || result.paymentUrl,
      reference: result.reference,
    })
  } catch (e) {
    console.error('[POST /api/subscription/initiate]', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
