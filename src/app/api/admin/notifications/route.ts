import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { isAdminRequest } from '@/lib/admin-auth'

export async function POST(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: 'Accès administrateur requis' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const title = typeof body.title === 'string' ? body.title.trim() : ''
    const message = typeof body.message === 'string' ? body.message.trim() : ''
    if (!title || title.length > 100 || !message || message.length > 1000) {
      return NextResponse.json({ error: 'Titre (1 à 100 caractères) et message (1 à 1 000 caractères) requis' }, { status: 400 })
    }
    if (
      typeof body.sendToAll !== 'boolean' ||
      (!body.sendToAll &&
        (!Array.isArray(body.pharmacyIds) ||
          body.pharmacyIds.length < 1 ||
          body.pharmacyIds.length > 100 ||
          body.pharmacyIds.some((id: unknown) => typeof id !== 'string')))
    ) {
      return NextResponse.json({ error: 'Choisissez toutes les pharmacies ou une sélection' }, { status: 400 })
    }

    const pharmacyIds = body.sendToAll
      ? (await db.pharmacy.findMany({ select: { id: true } })).map((pharmacy) => pharmacy.id)
      : [...new Set(body.pharmacyIds as string[])]
    if (pharmacyIds.length === 0) {
      return NextResponse.json({ error: 'Aucune pharmacie à notifier' }, { status: 400 })
    }
    const recipients = await db.pharmacy.findMany({
      where: { id: { in: pharmacyIds } },
      select: { id: true },
    })
    if (recipients.length !== pharmacyIds.length) {
      return NextResponse.json({ error: 'Une ou plusieurs pharmacies sont introuvables' }, { status: 404 })
    }

    await db.pharmacyNotification.createMany({
      data: recipients.map(({ id }) => ({ pharmacyId: id, title, message })),
    })
    return NextResponse.json({ sent: recipients.length })
  } catch (error) {
    console.error('[POST /api/admin/notifications]', error)
    return NextResponse.json({ error: 'Impossible d’envoyer les notifications' }, { status: 500 })
  }
}
