import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getVendorSession } from '@/lib/vendor-auth'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params
  const session = getVendorSession(request)
  if (!session || session.pharmacyId !== id) return NextResponse.json({ error: 'Connexion vendeur requise' }, { status: 401 })
  const pharmacy = await db.pharmacy.findUnique({ where: { id }, select: { id: true } })
  if (!pharmacy) return NextResponse.json({ error: 'Pharmacie introuvable' }, { status: 404 })

  const notifications = await db.pharmacyNotification.findMany({
    where: { pharmacyId: id, readAt: null },
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: { id: true, title: true, message: true, createdAt: true },
  })
  return NextResponse.json({ notifications })
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params
  const session = getVendorSession(request)
  if (!session || session.pharmacyId !== id) return NextResponse.json({ error: 'Connexion vendeur requise' }, { status: 401 })
  try {
    const body = await request.json()
    if (typeof body.notificationId !== 'string' || !body.notificationId) {
      return NextResponse.json({ error: 'Notification requise' }, { status: 400 })
    }
    const result = await db.pharmacyNotification.updateMany({
      where: { id: body.notificationId, pharmacyId: id, readAt: null },
      data: { readAt: new Date() },
    })
    if (result.count === 0) {
      return NextResponse.json({ error: 'Notification introuvable ou déjà lue' }, { status: 404 })
    }
    return NextResponse.json({ dismissed: true })
  } catch (error) {
    console.error('[PATCH /api/pharmacy/[id]/notifications]', error)
    return NextResponse.json({ error: 'Impossible de fermer cette notification' }, { status: 500 })
  }
}
