import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  SUBSCRIPTION_CURRENCY,
  SUBSCRIPTION_DURATION_DAYS,
  SUBSCRIPTION_PRICE,
} from '@/lib/subscription'

const MAX_SCREENSHOT_BYTES = 2 * 1024 * 1024

function hasValidImageHeader(type: string, bytes: Buffer) {
  if (type === 'image/jpeg') {
    return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  }
  if (type === 'image/png') {
    return bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  }
  if (type === 'image/webp') {
    return bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP'
  }
  return false
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const pharmacyId = formData.get('pharmacyId')
    const screenshot = formData.get('screenshot')

    if (typeof pharmacyId !== 'string' || !(screenshot instanceof File)) {
      return NextResponse.json(
        { error: 'Pharmacie et capture du paiement requises' },
        { status: 400 },
      )
    }
    if (screenshot.size === 0 || screenshot.size > MAX_SCREENSHOT_BYTES) {
      return NextResponse.json({ error: 'La capture doit peser moins de 2 Mo' }, { status: 413 })
    }

    const bytes = Buffer.from(await screenshot.arrayBuffer())
    if (!hasValidImageHeader(screenshot.type, bytes)) {
      return NextResponse.json(
        { error: 'Format accepté : image JPG, PNG ou WebP valide' },
        { status: 400 },
      )
    }

    const pharmacy = await db.pharmacy.findUnique({
      where: { id: pharmacyId },
      select: { id: true },
    })
    if (!pharmacy) {
      return NextResponse.json({ error: 'Pharmacie introuvable' }, { status: 404 })
    }

    const latestPendingRequest = await db.subscription.findFirst({
      where: { pharmacyId, status: 'pending_review' },
      orderBy: { createdAt: 'desc' },
    })
    const data = {
      screenshotData: `data:${screenshot.type};base64,${bytes.toString('base64')}`,
      amount: SUBSCRIPTION_PRICE,
      currency: SUBSCRIPTION_CURRENCY,
      durationDays: SUBSCRIPTION_DURATION_DAYS,
      paymentMethod: 'manual_mpesa',
      reviewMessage: null,
      note: 'Capture reçue — validation du paiement en cours',
    }

    const paymentRequest = latestPendingRequest
      ? await db.subscription.update({
          where: { id: latestPendingRequest.id },
          data,
          select: { id: true, status: true, updatedAt: true },
        })
      : await db.subscription.create({
          data: { pharmacyId, status: 'pending_review', ...data },
          select: { id: true, status: true, updatedAt: true },
        })

    return NextResponse.json({ request: paymentRequest }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/subscription/payment-request]', error)
    return NextResponse.json({ error: 'Impossible d’envoyer la capture' }, { status: 500 })
  }
}
