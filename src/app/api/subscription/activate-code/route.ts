import { createHash, timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  SUBSCRIPTION_CURRENCY,
  SUBSCRIPTION_DURATION_DAYS,
} from '@/lib/subscription'

function matchesConfiguredCode(submittedCode: string) {
  const configuredCode = process.env.PHARMAKIN_RECHARGE_CODE
  if (!configuredCode) throw new Error('PHARMAKIN_RECHARGE_CODE is not configured')

  const submittedHash = createHash('sha256').update(submittedCode).digest()
  const configuredHash = createHash('sha256').update(configuredCode).digest()
  return timingSafeEqual(submittedHash, configuredHash)
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    if (
      typeof body.pharmacyId !== 'string' ||
      typeof body.code !== 'string' ||
      !body.pharmacyId ||
      body.code.length > 128
    ) {
      return NextResponse.json({ error: 'Pharmacie et code requis' }, { status: 400 })
    }

    if (!matchesConfiguredCode(body.code.trim())) {
      return NextResponse.json({ error: 'Code de validation incorrect' }, { status: 401 })
    }

    const pharmacy = await db.pharmacy.findUnique({
      where: { id: body.pharmacyId },
      select: { id: true },
    })
    if (!pharmacy) {
      return NextResponse.json({ error: 'Pharmacie introuvable' }, { status: 404 })
    }

    const now = new Date()
    const activation = await db.$transaction(async (transaction) => {
      const existingSubscriptions = await transaction.subscription.count({
        where: { pharmacyId: pharmacy.id },
      })
      if (existingSubscriptions > 0) return 'payment-already-started' as const

      const claim = await transaction.pharmacy.updateMany({
        where: { id: pharmacy.id, signupCodeUsedAt: null },
        data: { signupCodeUsedAt: now },
      })
      if (claim.count !== 1) return 'code-already-used' as const

      await transaction.subscription.create({
        data: {
          pharmacyId: pharmacy.id,
          status: 'active',
          amount: 0,
          currency: SUBSCRIPTION_CURRENCY,
          durationDays: SUBSCRIPTION_DURATION_DAYS,
          startDate: now,
          endDate: new Date(
            now.getTime() + SUBSCRIPTION_DURATION_DAYS * 24 * 60 * 60 * 1000,
          ),
          paymentMethod: 'manual_code',
          note: 'Période initiale activée par code de validation',
        },
      })
      return 'activated' as const
    })

    if (activation === 'payment-already-started') {
      return NextResponse.json(
        { error: 'Un paiement a déjà été commencé pour cette pharmacie. Le code est réservé à la première inscription.' },
        { status: 409 },
      )
    }
    if (activation === 'code-already-used') {
      return NextResponse.json(
        { error: 'Le code de première inscription a déjà été utilisé pour cette pharmacie.' },
        { status: 409 },
      )
    }

    return NextResponse.json({ activated: true, durationDays: SUBSCRIPTION_DURATION_DAYS })
  } catch (error) {
    console.error('[POST /api/subscription/activate-code]', error)
    return NextResponse.json({ error: 'Impossible d’activer le code de validation' }, { status: 500 })
  }
}
