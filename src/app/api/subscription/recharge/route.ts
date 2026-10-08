import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  RECHARGE_CODE,
  SUBSCRIPTION_PRICE,
  SUBSCRIPTION_DURATION_DAYS,
  SUBSCRIPTION_CURRENCY,
} from '@/lib/geniuspay'

/**
 * POST /api/subscription/recharge
 * Body: { pharmacyId, code }
 *
 * - Compares the submitted code with the PHARMAKIN_RECHARGE_CODE env var.
 * - If it matches: creates an active Subscription (paymentMethod=recharge_code,
 *   paymentRef=code used, start now, end = now + durationDays) and returns it.
 * - If it doesn't match or recharge codes are disabled: returns 400.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { pharmacyId, code } = body as { pharmacyId: string; code: string }

    if (!pharmacyId || !code) {
      return NextResponse.json({ error: 'pharmacyId et code requis' }, { status: 400 })
    }

    const pharmacy = await db.pharmacy.findUnique({ where: { id: pharmacyId } })
    if (!pharmacy) {
      return NextResponse.json({ error: 'Pharmacie introuvable' }, { status: 404 })
    }

    // Recharge codes disabled?
    if (!RECHARGE_CODE) {
      return NextResponse.json(
        { error: 'Les codes de réabonnement sont désactivés' },
        { status: 400 },
      )
    }

    const submitted = code.trim()
    if (submitted.localeCompare(RECHARGE_CODE, undefined, { sensitivity: 'accent' }) !== 0) {
      return NextResponse.json({ error: 'Code de réabonnement invalide' }, { status: 400 })
    }

    // Already active? Just extend the existing one OR return it
    const now = new Date()
    const existing = await db.subscription.findFirst({
      where: {
        pharmacyId,
        status: 'active',
        endDate: { gt: now },
      },
      orderBy: { endDate: 'desc' },
    })
    if (existing) {
      return NextResponse.json({
        alreadyActive: true,
        subscription: existing,
        message: 'Vous avez déjà un abonnement actif',
      })
    }

    const endDate = new Date(now.getTime() + SUBSCRIPTION_DURATION_DAYS * 24 * 60 * 60 * 1000)

    const subscription = await db.subscription.create({
      data: {
        pharmacyId,
        status: 'active',
        amount: SUBSCRIPTION_PRICE,
        currency: SUBSCRIPTION_CURRENCY,
        durationDays: SUBSCRIPTION_DURATION_DAYS,
        startDate: now,
        endDate,
        paymentMethod: 'recharge_code',
        paymentRef: submitted,
        note: `Accès accordé via code de réabonnement (${SUBSCRIPTION_DURATION_DAYS} jours)`,
      },
    })

    return NextResponse.json({ subscription, activated: true })
  } catch (e) {
    console.error('[POST /api/subscription/recharge]', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
